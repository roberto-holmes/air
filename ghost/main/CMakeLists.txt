idf_component_register(SRCS "main.c" "sensors/scd41.c" "tcp/tcp.c" "network/wifi.c" "util/crc.c"
                    INCLUDE_DIRS "." "sensors" "tcp" "network" "util")
