#include "tcp.h"
#include "../main.h"

#include "lwipopts.h"
#include "lwip/sockets.h"

static const char *TAG = "Air TCP";

#define HOST_IP_ADDR "192.168.1.131"
#define PORT 3333

void tcp_client_task()
{
    // char rx_buffer[128];
    uint8_t rx_buffer[6];
    char host_ip[] = HOST_IP_ADDR;
    int addr_family = 0;
    int ip_protocol = 0;

    while (1)
    {
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
        int sock = socket(addr_family, SOCK_STREAM, ip_protocol);
        if (sock < 0)
        {
            ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
            break;
        }
        ESP_LOGI(TAG, "Socket created, connecting to %s:%d", host_ip, PORT);

        int err = connect(sock, (struct sockaddr *)&dest_addr, sizeof(struct sockaddr_in6));
        if (err != 0)
        {
            ESP_LOGE(TAG, "Socket unable to connect: errno %d", errno);
            break;
        }
        ESP_LOGI(TAG, "Successfully connected");

        uint16_t sensor_output[3];
        uint8_t tx_buffer[6];

        while (1)
        {
            xQueueReceive(scd41_co2_queue, sensor_output, portMAX_DELAY);
            xQueueReceive(scd41_temp_queue, &sensor_output[1], portMAX_DELAY);
            xQueueReceive(scd41_humi_queue, &sensor_output[2], portMAX_DELAY);

            tx_buffer[0] = sensor_output[0] >> 8;
            tx_buffer[1] = sensor_output[0];
            tx_buffer[2] = sensor_output[1] >> 8;
            tx_buffer[3] = sensor_output[0];
            tx_buffer[4] = sensor_output[2] >> 8;
            tx_buffer[5] = sensor_output[0];

            ESP_LOGI(TAG, "Sending %u %u %u %u %u %u:", tx_buffer[0], tx_buffer[1], tx_buffer[2], tx_buffer[3], tx_buffer[4], tx_buffer[5]);
            // ESP_LOGI(TAG, "Sending %u %u %u:", sensor_output[0], sensor_output[1], sensor_output[2]);

            int err = send(sock, tx_buffer, sizeof(tx_buffer), 0);
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
            else
            {
                // rx_buffer[len] = 0; // Null-terminate whatever we received and treat like a string
                ESP_LOGI(TAG, "Received %d bytes from %s:", len, host_ip);
                ESP_LOGI(TAG, "%u %u %u %u %u %u", rx_buffer[0], rx_buffer[1], rx_buffer[2], rx_buffer[3], rx_buffer[4], rx_buffer[5]);
            }

            // vTaskDelay(2000 / portTICK_PERIOD_MS);
        }

        if (sock != -1)
        {
            ESP_LOGE(TAG, "Shutting down socket and restarting...");
            shutdown(sock, 0);
            close(sock);
        }
    }
    vTaskDelete(NULL);
}