#include "scd41.h"
#include "../main.h"

#include "driver/i2c.h"

static const char *TAG_SCD = "SCD41";

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

uint8_t scd41_raw_output[9];

static esp_err_t i2c_master_init(void);
static esp_err_t scd41_send_command(uint16_t reg_addr);
static esp_err_t scd41_read(uint16_t reg_addr, uint8_t *data, size_t len);

void scd41_task()
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