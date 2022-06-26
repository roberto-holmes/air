package util

const crc8_polynomial = 0x31
const crc8_init = 0xFF

func CrcGenerate(data []uint8, count int) uint8 {
	var crc uint8 = crc8_init

	for current_byte := 0; current_byte < count; current_byte++ {
		crc ^= (data[current_byte])
		for crc_bit := 8; crc_bit > 0; crc_bit-- {
			if (crc & 0x80) != 0 {
				crc = (crc << 1) ^ crc8_polynomial
			} else {
				crc = crc << 1
			}
		}
	}
	return crc
}

func CrcCheck(crc1 uint8, data []uint8, count int) bool {
	crc2 := CrcGenerate(data, count)
	// log.Printf("CRC1 = %v, CRC2 = %v, CRC1 == CRC2: %v", crc1, crc2, crc1 == crc2)
	return crc2 == crc1
}
