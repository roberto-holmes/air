#include "tcp.h"
#include "../main.h"
#include "../util/crc.h"

#include "esp_mac.h"
#include "lwipopts.h"
#include "lwip/sockets.h"

static const char *TAG = "TCP";
static const int retry_delay = 10; // Seconds

#define HOST_IP_ADDR "192.168.1.131"
#define PORT 3333

void tcp_client_task()
{
    uint8_t tx_buffer[8];
    uint8_t rx_buffer[8];
    uint32_t unix_time_offset_s;
    char host_ip[] = HOST_IP_ADDR;
    int addr_family = 0;
    int ip_protocol = 0;

    while (1)
    {
        ESP_LOGI(TAG, "Attempting to setup TCP socket");

        // #if defined(CONFIG_EXAMPLE_IPV4)
        struct sockaddr_in dest_addr;
        dest_addr.sin_addr.s_addr = inet_addr(host_ip);
        dest_addr.sin_family = AF_INET;
        dest_addr.sin_port = htons(PORT);
        addr_family = AF_INET;
        ip_protocol = IPPROTO_IP;
        // #elif defined(CONFIG_EXAMPLE_IPV6)
        //         struct sockaddr_in6 dest_addr = {0};
        //         inet6_aton(host_ip, &dest_addr.sin6_addr);
        //         dest_addr.sin6_family = AF_INET6;
        //         dest_addr.sin6_port = htons(PORT);
        //         dest_addr.sin6_scope_id = esp_netif_get_netif_impl_index(EXAMPLE_INTERFACE);
        //         addr_family = AF_INET6;
        //         ip_protocol = IPPROTO_IPV6;
        // #elif defined(CONFIG_EXAMPLE_SOCKET_IP_INPUT_STDIN)
        //         struct sockaddr_storage dest_addr = {0};
        //         ESP_ERROR_CHECK(get_addr_from_stdin(PORT, SOCK_STREAM, &ip_protocol, &addr_family, &dest_addr));
        // #endif

        // ----------------------------- Create socket -----------------------------
        int sock = socket(addr_family, SOCK_STREAM, ip_protocol);
        if (sock < 0)
        {
            ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
            goto retry_tcp;
        }
        ESP_LOGI(TAG, "Socket created, connecting to %s:%d", host_ip, PORT);

        int err = connect(sock, (struct sockaddr *)&dest_addr, sizeof(struct sockaddr_in6));
        if (err != 0)
        {
            ESP_LOGE(TAG, "Socket unable to connect: errno %d", errno);
            goto retry_tcp;
        }
        ESP_LOGI(TAG, "Successfully connected");

        // ----------------------------- Perform handshake -----------------------------
        // Wait for unix time + CRC
        int len = recv(sock, rx_buffer, 5, 0);
        if (len != 5)
        {
            ESP_LOGE(TAG, "Failed to receive handshake: errno %d", errno);
            goto retry_tcp;
        }
        ESP_LOGI(TAG, "Received %d bytes from %s:", len, host_ip);
        ESP_LOGI(TAG, "%u %u %u %u %u", rx_buffer[0], rx_buffer[1], rx_buffer[2], rx_buffer[3], rx_buffer[4]);

        if (!crc_check(rx_buffer[4], rx_buffer, 4))
        {
            ESP_LOGE(TAG, "Handshake packet failed CRC: expected %u, received %u", crc_generate(rx_buffer, 4), rx_buffer[4]);
            memset(tx_buffer, 0, 5);
            err = send(sock, tx_buffer, 5, 0);
            if (err < 0)
                ESP_LOGE(TAG, "Error occurred while sending handshake failure response: errno %d", errno);
            goto retry_tcp;
        }

        // Store the offset to unix time so that a time stamp can be sent with data
        unix_time_offset_s = rx_buffer[0] << 24 | rx_buffer[1] << 16 | rx_buffer[2] << 8 | rx_buffer[3];
        unix_time_offset_s -= xTaskGetTickCount() / 100;

        // Prepare response
        for (size_t i = 0; i < 4; i++)
        {
            tx_buffer[i] = rx_buffer[3 - i];
        }

        tx_buffer[4] = crc_generate(tx_buffer, 4);

        // Response
        err = send(sock, tx_buffer, 5, 0);
        if (err < 0)
        {
            ESP_LOGE(TAG, "Error occurred while sending handshake: errno %d", errno);
            goto retry_tcp;
        }

        // Send MAC address
        ESP_ERROR_CHECK(esp_read_mac(tx_buffer, ESP_MAC_WIFI_STA));
        ESP_LOGI(TAG, "MAC Address is %X:%X:%X:%X:%X:%X", tx_buffer[0], tx_buffer[1], tx_buffer[2], tx_buffer[3], tx_buffer[4], tx_buffer[5]);
        tx_buffer[6] = crc_generate(tx_buffer, 6);
        err = send(sock, tx_buffer, 7, 0);
        if (err < 0)
        {
            ESP_LOGE(TAG, "Error occurred while sending MAC address: errno %d", errno);
            goto retry_tcp;
        }

        // Listen for MAC response
        len = recv(sock, rx_buffer, 7, 0);
        if (len != 7)
        {
            ESP_LOGE(TAG, "Failed to receive MAC: errno %d", errno);
            goto retry_tcp;
        }
        // Check if the server accepted the given MAC address
        if (!memcmp(rx_buffer, tx_buffer, 7))
        {
            ESP_LOGW(TAG, "Returned MAC address is new");
            // TODO: Update MAC address if the server issues a new one
            // esp_err_t esp_base_mac_addr_set(uint8_t *mac)
        }

        ESP_LOGI(TAG, "Handshake complete, entering operational state");

        // ----------------------------- Start sending data as it arrives -----------------------------
        uint64_t sensor_packet;
        uint32_t timestamp;
        while (1)
        {
            xQueueReceive(sensor_data_queue, &sensor_packet, portMAX_DELAY);
            // ESP_LOGW(TAG, "Collected 0x%llX from the queue", sensor_packet);

            timestamp = (sensor_packet >> 32) + unix_time_offset_s;

            tx_buffer[0] = (uint8_t)(timestamp >> 24);
            tx_buffer[1] = (uint8_t)(timestamp >> 16);
            tx_buffer[2] = (uint8_t)(timestamp >> 8);
            tx_buffer[3] = (uint8_t)(timestamp);
            tx_buffer[4] = (uint8_t)(sensor_packet >> 24);
            tx_buffer[5] = (uint8_t)(sensor_packet >> 16);
            tx_buffer[6] = (uint8_t)(sensor_packet >> 8);
            tx_buffer[7] = crc_generate(tx_buffer, 7);

            ESP_LOGI(TAG, "Sending: %u %u %u %u %u %u %u %u", tx_buffer[0], tx_buffer[1], tx_buffer[2], tx_buffer[3], tx_buffer[4], tx_buffer[5], tx_buffer[6], tx_buffer[7]);

            err = send(sock, tx_buffer, sizeof(tx_buffer), 0);
            if (err < 0)
            {
                ESP_LOGE(TAG, "Error occurred during sending: errno %d", errno);
                break;
            }

            int len = recv(sock, rx_buffer, sizeof(rx_buffer), 0);
            // Error occurred during receiving
            if (len < 0)
            {
                ESP_LOGE(TAG, "recv failed: errno %d", errno);
                break;
            }
            // Data received

            // rx_buffer[len] = 0; // Null-terminate whatever we received and treat like a string
            if (memcmp(rx_buffer, tx_buffer, 8))
            {
                ESP_LOGE(TAG, "Server response incorrect");
                break;
            }
            ESP_LOGI(TAG, "Received the correct %d bytes from %s", len, host_ip);
            // ESP_LOGI(TAG, "%u %u %u %u", rx_buffer[0], rx_buffer[1], rx_buffer[2], rx_buffer[3]);
            // ESP_LOGI(TAG, "%u %u %u %u %u %u", rx_buffer[0], rx_buffer[1], rx_buffer[2], rx_buffer[3], rx_buffer[4], rx_buffer[5]);
        }

    retry_tcp:
        ESP_LOGE(TAG, "Retrying TCP Socket in %i seconds", retry_delay);
        vTaskDelay(retry_delay * 1000 / portTICK_PERIOD_MS);
        if (sock != -1)
        {
            ESP_LOGE(TAG, "Shutting down socket and restarting...");
            shutdown(sock, 0);
            close(sock);
        }
    }
    vTaskDelete(NULL);
}