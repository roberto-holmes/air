#include "scd41.h"
#include "../util/crc.h"
#include "../main.h"

#include "driver/i2c.h"
// #include "time.h"

static const char *TAG = "SCD41";

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

typedef enum
{
    sensor_co2,
    sensor_temp,
    sensor_humi
} sensor_type_t;

void scd_41_process_data(sensor_type_t sensor, uint8_t *data)
{
    uint64_t data_packet;
    uint8_t crc_buffer[3];

    // All three sensor values are stored back to back in the data array
    uint8_t offset = 3 * (uint8_t)sensor;

    crc_buffer[1] = data[0 + offset];
    crc_buffer[2] = data[1 + offset];

    // If the data from the sensor is valid, create the packet and send it
    if (crc_check(data[2 + offset], &crc_buffer[1], 2))
    {
        crc_buffer[0] = sensor;
        data_packet = crc_buffer[0] << 24 | crc_buffer[1] << 16 | crc_buffer[2] << 8 | crc_generate(crc_buffer, 3);
        uint32_t time_s = xTaskGetTickCount() / 100;
        data_packet |= (uint64_t)time_s << 32;

        xQueueSend(sensor_data_queue, &data_packet, 10);
        // ESP_LOGI(TAG, "Added 0x%llX to the queue, current time is %u", data_packet, time / 100);
    }
    else
    {
        ESP_LOGE(TAG, "Sensor produced invalid data");
    }
}

void scd41_task()
{
    ESP_LOGI(TAG, "Initialising I2C");
    ESP_ERROR_CHECK(i2c_master_init());

    ESP_LOGI(TAG, "Starting measurement");
    scd41_send_command(SCD41_START_MEASUREMENT);

    vTaskDelay(2000 / portTICK_PERIOD_MS);

    while (true)
    {
        vTaskDelay(5000 / portTICK_PERIOD_MS);
        ESP_ERROR_CHECK(scd41_read(SCD41_READ_MEASUREMENT, scd41_raw_output, 9));

        scd_41_process_data(sensor_co2, scd41_raw_output);
        scd_41_process_data(sensor_temp, scd41_raw_output);
        scd_41_process_data(sensor_humi, scd41_raw_output);

        ESP_LOGI(TAG, "Current free RAM = %u B and minimum free RAM = %u B", esp_get_free_heap_size(), esp_get_minimum_free_heap_size());

        // float temp = -45 + 175 * (float)processed_data[1] / 0xFFFF;
        // float humi = 100 * (float)processed_data[2] / 0xFFFF;

        // printf("CO2: %u ppm, Temp: %.1f C, Humidity: %.1f %%\n", processed_data[0], temp, humi);
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