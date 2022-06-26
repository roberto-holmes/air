#ifndef MAIN_H
#define MAIN_H

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "esp_log.h"

QueueHandle_t sensor_data_queue;

#endif