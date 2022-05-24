package sensor

import (
	"fmt"
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

func handleConnection(c net.Conn, pool *websocket.Pool) {
	fmt.Print("TCP connected")
	for {
		// Make a buffer to hold incoming data.
		buf := make([]byte, 6)
		// Read the incoming connection into the buffer.
		reqLen, err := c.Read(buf)
		if err != nil {
			fmt.Println("Error reading:", err.Error())
		}

		co2, temp, humi := formatData(buf)
		fmt.Println("Received ", reqLen, " bytes containing ", buf, " | CO2: ", co2, " ppm, Temp: ", temp, " C, Humidity: ", humi, " %")
		t := time.Now().GoString()
		message := websocket.Message{UserCount: len(pool.Clients), Time: t, Co2: co2, Temp: temp, Humi: humi}
		pool.Broadcast <- message
		c.Write(buf)
	}
	// count--
	// c.Close()
}

func SetupTcp(pool *websocket.Pool) {
	fmt.Println("Setting up tcp")
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
