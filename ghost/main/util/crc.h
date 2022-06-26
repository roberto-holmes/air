#ifndef CRC_H
#define CRC_H

#include <stdint.h>

uint8_t crc_generate(const uint8_t *data, uint16_t count);
uint8_t crc_check(const uint8_t crc, const uint8_t *data, uint16_t count);

#endif