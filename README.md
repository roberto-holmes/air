# AIR

Using an ESP32-S3 to take air quality measurements and send them to a server to be displayed on a local website.

### MCU

Unexpected Maker TinyS3: https://esp32s3.com/tinys3.html

Toolchain: https://docs.espressif.com/projects/esp-idf/en/v4.4.1/esp32s3/index.html

## Commands

### Client

`idf.py set-target esp32-s3`

`idf.py menuconfig`

`idf.py -p PORT flash`

### Server

`go run .` or (`go build .` and `./server.exe`)
