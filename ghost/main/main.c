#include "main.h"

#include "network/wifi.h"
#include "scd41/scd41.h"
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
    // ESP_ERROR_CHECK(esp_event_loop_create_default());
    scd41_co2_queue = xQueueCreate(1, sizeof(uint16_t));
    scd41_temp_queue = xQueueCreate(1, sizeof(uint16_t));
    scd41_humi_queue = xQueueCreate(1, sizeof(uint16_t));

    xTaskCreate(tcp_client_task, "tcp_client", 4096, NULL, 4, NULL);
    xTaskCreate(scd41_task, "scd41", 4096, NULL, 5, NULL);
}
