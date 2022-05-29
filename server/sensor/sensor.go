package sensor

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"time"

	"github.com/roberto-holmes/air/server/websocket"
)

var count = 0

func formatData(data []byte) (uint16, float64, float64) {
	co2 := uint16(data[0])<<8 | uint16(data[1])
	temp_int := uint16(data[2])<<8 | uint16(data[3])
	humi_int := uint16(data[4])<<8 | uint16(data[5])

	temp := -45 + 175*float64(temp_int)/0xFFFF
	humi := 100 * float64(humi_int) / 0xFFFF

	temp = math.Round(temp*10) / 10
	humi = math.Round(humi*10) / 10

	return co2, temp, humi
}

func handleConnection(c net.Conn, hub *websocket.Hub) {
	log.Println("TCP connected")
	for {
		// Make a buffer to hold incoming data.
		buf := make([]byte, 6)
		// Read the incoming connection into the buffer.
		reqLen, err := c.Read(buf)
		if err != nil {
			log.Println("Error reading:", err.Error())
		}

		co2, temp, humi := formatData(buf)
		log.Printf("Received %v bytes containing %v | CO2: %v ppm, Temp: %v C, Humidity: %v %%\n", reqLen, buf, co2, temp, humi)
		t := time.Now().UnixMilli()

		// Encode data into a message to be passed to the websocket
		message, err := json.Marshal(websocket.Message{UserCount: len(hub.Clients), Time: t, Co2: co2, Temp: temp, Humi: humi})
		if err != nil {
			log.Println("Error in encoding to json bytes:", err)
		}
		hub.Broadcast <- message

		// Sends data back to sensor for debugging
		c.Write(buf)
	}
	// count--
	// c.Close()
}

func SetupTcp(pool *websocket.Hub) {
	log.Println("Setting up tcp")
	l, err := net.Listen("tcp4", ":3333")
	if err != nil {
		fmt.Println(err)
		return
	}
	defer l.Close()

	for {
		c, err := l.Accept()
		if err != nil {
			fmt.Println(err)
			return
		}
		go handleConnection(c, pool)
		count++
	}
}
