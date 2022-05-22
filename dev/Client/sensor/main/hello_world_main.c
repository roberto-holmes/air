/* Hello World Example

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#include <stdio.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_spi_flash.h"
#include "driver/i2c.h"

#define I2C_SCL_IO 9
#define I2C_SDA_IO 8
#define I2C_MASTER_FREQ_HZ 400000
#define I2C_MASTER_TIMEOUT_MS 1000
#define I2C_PORT 0

#define SCD41_ADDR 0x62
#define SCD41_START_MEASUREMENT 0x21B1
#define SCD41_READ_MEASUREMENT 0xEC05
#define SCD41_STOP_MEASUREMENT 0x3F86

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

    ret = i2c_master_write_to_device(I2C_PORT, SCD41_ADDR, write_buf, sizeof(write_buf), I2C_MASTER_TIMEOUT_MS / portTICK_RATE_MS);

    return ret;
}

/**
 * @brief Read a sequence of bytes
 */
static esp_err_t scd41_read(uint16_t reg_addr, uint8_t *data, size_t len)
{
    uint8_t write_buf[2] = {(reg_addr >> 8) & 0xFF, reg_addr & 0xFF};
    return i2c_master_write_read_device(I2C_PORT, SCD41_ADDR, write_buf, sizeof(write_buf), data, len, I2C_MASTER_TIMEOUT_MS / portTICK_RATE_MS);
}

void app_main(void)
{
    printf("Hi!\n");

    /* Print chip information */
    esp_chip_info_t chip_info;
    esp_chip_info(&chip_info);
    printf("This is %s chip with %d CPU core(s), WiFi%s%s, ",
           CONFIG_IDF_TARGET,
           chip_info.cores,
           (chip_info.features & CHIP_FEATURE_BT) ? "/BT" : "",
           (chip_info.features & CHIP_FEATURE_BLE) ? "/BLE" : "");

    printf("silicon revision %d, ", chip_info.revision);

    printf("%dMB %s flash\n", spi_flash_get_chip_size() / (1024 * 1024),
           (chip_info.features & CHIP_FEATURE_EMB_FLASH) ? "embedded" : "external");

    printf("Minimum free heap size: %d bytes\n", esp_get_minimum_free_heap_size());

    printf("Initialising I2C\n");
    ESP_ERROR_CHECK(i2c_master_init());

    vTaskDelay(2000 / portTICK_PERIOD_MS);

    printf("Starting measurement\n");
    scd41_send_command(SCD41_START_MEASUREMENT);
    uint8_t data[9];

    printf("Beginning sampling sensor\n");

    while (true)
    {
        vTaskDelay(5000 / portTICK_PERIOD_MS);
        ESP_ERROR_CHECK(scd41_read(SCD41_READ_MEASUREMENT, data, 9));

        uint16_t co2 = data[0] << 8 | data[1];
        uint16_t temp_int = data[3] << 8 | data[4];
        uint16_t humi_int = data[6] << 8 | data[7];

        float temp = -45 + 175 * (float)temp_int / 0xFFFF;
        float humi = 100 * (float)humi_int / 0xFFFF;

        printf("CO2: %u ppm, Temp: %.1f C, Humidity: %.1f %%\n", co2, temp, humi);
    }

    printf("Restarting now.\n");
    fflush(stdout);
    esp_restart();
}
