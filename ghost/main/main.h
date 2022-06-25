#ifndef MAIN_H
#define MAIN_H

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "esp_log.h"

QueueHandle_t scd41_co2_queue, scd41_temp_queue, scd41_humi_queue;

#endif