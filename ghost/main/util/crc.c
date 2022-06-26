#include "crc.h"

#define CRC8_POLYNOMIAL 0x31
#define CRC8_INIT 0xFF

uint8_t crc_generate(const uint8_t *data, uint16_t count)
{
    uint16_t current_byte;
    uint8_t crc = CRC8_INIT;
    uint8_t crc_bit; /* calculates 8-Bit checksum with given polynomial */
    for (current_byte = 0; current_byte < count; ++current_byte)
    {
        crc ^= (data[current_byte]);
        for (crc_bit = 8; crc_bit > 0; --crc_bit)
        {
            if (crc & 0x80)
                crc = (crc << 1) ^ CRC8_POLYNOMIAL;
            else
                crc = (crc << 1);
        }
    }
    return crc;
}

uint8_t crc_check(const uint8_t crc1, const uint8_t *data, uint16_t count)
{
    uint8_t crc2 = crc_generate(data, count);
    return crc2 == crc1;
}