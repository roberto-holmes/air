#include "main.h"

#include "network/wifi.h"
#include "sensors/scd41.h"
#include "tcp/tcp.h"

#include "esp_wifi.h"
#include "nvs_flash.h"
#include "esp_netif.h"

void app_main(void)
{
    // Initialize Non-Volatile Storage
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Connect to wifi
    wifi_init();

    // Initialise TCP/IP stack
    ESP_ERROR_CHECK(esp_netif_init());

    // Create a Queue for the sensor data
    sensor_data_queue = xQueueCreate(6, sizeof(uint64_t));

    xTaskCreate(tcp_client_task, "tcp_client", 4096, NULL, 4, NULL);
    xTaskCreate(scd41_task, "scd41", 4096, NULL, 5, NULL);
}
