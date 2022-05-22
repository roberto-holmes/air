// https://www.linode.com/docs/guides/developing-udp-and-tcp-clients-and-servers-in-go/

package main

import (
	"fmt"
	"math"
	"net"
	"os"
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

func handleConnection(c net.Conn) {
	fmt.Print(".")
	for {
		// netData, err := bufio.NewReader(c).ReadString('\n')
		// var data []byte
		// n, err := bufio.NewReaderSize(c, 3).Read(data)
		// if err != nil {
		// 	fmt.Println(err)
		// 	return
		// }
		// Make a buffer to hold incoming data.
		buf := make([]byte, 6)
		// Read the incoming connection into the buffer.
		reqLen, err := c.Read(buf)
		if err != nil {
			fmt.Println("Error reading:", err.Error())
		}

		// temp := strings.TrimSpace(string(netData))
		// if temp == "STOP" {
		// 	break
		// }

		co2, temp, humi := formatData(buf)
		fmt.Println("Received ", reqLen, " bytes containing ", buf, " | CO2: ", co2, " ppm, Temp: ", temp, " C, Humidity: ", humi, " %")
		// counter := strconv.Itoa(count) + "\n"
		c.Write(buf)
		// c.Write([]byte(string(counter)))
	}
	// count--
	// c.Close()
}

func main() {
	arguments := os.Args
	if len(arguments) == 1 {
		fmt.Println("Please provide a port number!")
		return
	}

	PORT := ":" + arguments[1]
	l, err := net.Listen("tcp4", PORT)
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
		go handleConnection(c)
		count++
	}
}
