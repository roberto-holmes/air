/* BSD Socket API Example

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#include <string.h>
#include <sys/param.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "protocol_examples_common.h"
#include "addr_from_stdin.h"
#include "lwip/err.h"
#include "lwip/sockets.h"

#include "driver/i2c.h"

// Network defines
#if defined(CONFIG_EXAMPLE_IPV4)
#define HOST_IP_ADDR CONFIG_EXAMPLE_IPV4_ADDR
#elif defined(CONFIG_EXAMPLE_IPV6)
#define HOST_IP_ADDR CONFIG_EXAMPLE_IPV6_ADDR
#else
#define HOST_IP_ADDR ""
#endif

#define PORT CONFIG_EXAMPLE_PORT

// Sensor defines
#define I2C_SCL_IO 9
#define I2C_SDA_IO 8
#define I2C_MASTER_FREQ_HZ 400000
#define I2C_MASTER_TIMEOUT_MS 1000
#define I2C_PORT 0

#define SCD41_ADDR 0x62
#define SCD41_START_MEASUREMENT 0x21B1
#define SCD41_READ_MEASUREMENT 0xEC05
#define SCD41_STOP_MEASUREMENT 0x3F86

static const char *TAG = "Air";
static const char *TAG_SCD = "SCD41";
// static const char *payload = "Message from ESP32\n";

QueueHandle_t scd41_co2_queue, scd41_temp_queue, scd41_humi_queue;
uint8_t scd41_raw_output[9];

/**
 * @brief i2c master initialization
 */
static esp_err_t i2c_master_init(void)
{
    int i2c_master_port = I2C_PORT;

    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_SDA_IO,
        .scl_io_num = I2C_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ_HZ,
    };

    i2c_param_config(i2c_master_port, &conf);

    return i2c_driver_install(i2c_master_port, conf.mode, 0, 0, 0);
}

static esp_err_t scd41_send_command(uint16_t reg_addr)
{
    int ret;
    uint8_t write_buf[2] = {(reg_addr >> 8) & 0xFF, reg_addr & 0xFF};

    ret = i2c_master_write_to_device(I2C_PORT, SCD41_ADDR, write_buf, sizeof(write_buf), I2C_MASTER_TIMEOUT_MS / portTICK_PERIOD_MS);

    return ret;
}

/**
 * @brief Read a sequence of bytes
 */
static esp_err_t scd41_read(uint16_t reg_addr, uint8_t *data, size_t len)
{
    uint8_t write_buf[2] = {(reg_addr >> 8) & 0xFF, reg_addr & 0xFF};
    return i2c_master_write_read_device(I2C_PORT, SCD41_ADDR, write_buf, sizeof(write_buf), data, len, I2C_MASTER_TIMEOUT_MS / portTICK_PERIOD_MS);
}

static void tcp_client_task(void *pvParameters)
{
    // char rx_buffer[128];
    uint8_t rx_buffer[6];
    char host_ip[] = HOST_IP_ADDR;
    int addr_family = 0;
    int ip_protocol = 0;

    while (1)
    {
#if defined(CONFIG_EXAMPLE_IPV4)
        struct sockaddr_in dest_addr;
        dest_addr.sin_addr.s_addr = inet_addr(host_ip);
        dest_addr.sin_family = AF_INET;
        dest_addr.sin_port = htons(PORT);
        addr_family = AF_INET;
        ip_protocol = IPPROTO_IP;
#elif defined(CONFIG_EXAMPLE_IPV6)
        struct sockaddr_in6 dest_addr = {0};
        inet6_aton(host_ip, &dest_addr.sin6_addr);
        dest_addr.sin6_family = AF_INET6;
        dest_addr.sin6_port = htons(PORT);
        dest_addr.sin6_scope_id = esp_netif_get_netif_impl_index(EXAMPLE_INTERFACE);
        addr_family = AF_INET6;
        ip_protocol = IPPROTO_IPV6;
#elif defined(CONFIG_EXAMPLE_SOCKET_IP_INPUT_STDIN)
        struct sockaddr_storage dest_addr = {0};
        ESP_ERROR_CHECK(get_addr_from_stdin(PORT, SOCK_STREAM, &ip_protocol, &addr_family, &dest_addr));
#endif
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

static void scd42_task()
{
    ESP_LOGI(TAG_SCD, "Initialising I2C");
    ESP_ERROR_CHECK(i2c_master_init());

    ESP_LOGI(TAG_SCD, "Starting measurement");
    scd41_send_command(SCD41_START_MEASUREMENT);

    vTaskDelay(2000 / portTICK_PERIOD_MS);

    while (true)
    {
        vTaskDelay(5000 / portTICK_PERIOD_MS);
        ESP_ERROR_CHECK(scd41_read(SCD41_READ_MEASUREMENT, scd41_raw_output, 9));

        uint8_t data_out[6];

        data_out[0] = scd41_raw_output[0];
        data_out[1] = scd41_raw_output[1];
        data_out[2] = scd41_raw_output[3];
        data_out[3] = scd41_raw_output[4];
        data_out[4] = scd41_raw_output[6];
        data_out[5] = scd41_raw_output[7];

        uint16_t processed_data[3];

        processed_data[0] = scd41_raw_output[0] << 8 | scd41_raw_output[1]; // CO2
        processed_data[1] = scd41_raw_output[3] << 8 | scd41_raw_output[4]; // Temp
        processed_data[2] = scd41_raw_output[6] << 8 | scd41_raw_output[7]; // Humidity

        float temp = -45 + 175 * (float)processed_data[1] / 0xFFFF;
        float humi = 100 * (float)processed_data[2] / 0xFFFF;

        printf("CO2: %u ppm, Temp: %.1f C, Humidity: %.1f %%\n", processed_data[0], temp, humi);
        // ESP_LOGI(TAG_SCD, "Adding %u %u %u to queue:", processed_data[0], processed_data[1], processed_data[2]);
        ESP_LOGI(TAG_SCD, "Adding %u %u %u %u %u %u to queue:", data_out[0], data_out[1], data_out[2], data_out[3], data_out[4], data_out[5]);
        // xQueueSend(scd41_queue, data_out, 10);
        xQueueSend(scd41_co2_queue, processed_data, 10);
        xQueueSend(scd41_temp_queue, &processed_data[1], 10);
        xQueueSend(scd41_humi_queue, &processed_data[2], 10);
    }
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    /* This helper function configures Wi-Fi or Ethernet, as selected in menuconfig.
     * Read "Establishing Wi-Fi or Ethernet Connection" section in
     * examples/protocols/README.md for more information about this function.
     */
    ESP_ERROR_CHECK(example_connect());

    scd41_co2_queue = xQueueCreate(1, sizeof(uint16_t));
    scd41_temp_queue = xQueueCreate(1, sizeof(uint16_t));
    scd41_humi_queue = xQueueCreate(1, sizeof(uint16_t));

    xTaskCreate(tcp_client_task, "tcp_client", 4096, NULL, 4, NULL);
    xTaskCreate(scd42_task, "scd41", 4096, NULL, 5, NULL);
}
