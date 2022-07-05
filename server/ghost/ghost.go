package ghost

import (
	"context"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"net"
	"reflect"
	"sync/atomic"
	"time"

	"github.com/gocql/gocql"
	"github.com/roberto-holmes/air/server/util"
)

const packetLength = 8

type DataType uint8

const (
	Co2 DataType = iota
	Temperature
	Humidity
)

var count int32 = 0

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

func handleConnection(c net.Conn, session *gocql.Session, ctx context.Context) {
	defer log.Println("TCP disconnected")
	defer c.Close()

	// Keep count of active connections while trying to avoid race conditions
	defer atomic.AddInt32(&count, -1)
	atomic.AddInt32(&count, 1)

	log.Println("TCP connected")
	buf := make([]uint8, packetLength)

	// Handshake
	unixTime := uint32(time.Now().Unix())
	for i := 0; i < 4; i++ {
		buf[i] = uint8(unixTime >> (i * 8))
	}
	buf[4] = util.CrcGenerate(buf[0:4], 4)
	_, err := c.Write(buf[0:5])
	if err != nil {
		log.Println("Error Sending Handshake:", err.Error())
		return
	}

	// Empty buffer
	for i := 0; i < len(buf); i++ {
		buf[i] = 0
	}

	// Response
	expectedResponse := make([]uint8, 5)
	for i := 0; i < 4; i++ {
		expectedResponse[i] = uint8(unixTime >> ((3 - i) * 8))
	}
	expectedResponse[4] = util.CrcGenerate(expectedResponse[0:4], 4)

	reqLen, err := c.Read(buf)
	if err != nil {
		log.Println("Error reading:", err.Error())
		return
	}
	if reqLen != 5 {
		log.Printf("Handshake response was of length %v instead of %v. Terminating socket.\n", reqLen, 5)
		return
	}
	if !reflect.DeepEqual(buf[0:5], expectedResponse[0:5]) {
		log.Printf("Received %v but expected %v. Terminating socket.\n", buf, expectedResponse)
		return
	}

	// Receive MAC Address
	reqLen, err = c.Read(buf)
	if err != nil {
		log.Println("Error reading:", err.Error())
		return
	}
	if reqLen != 7 {
		log.Println(buf)
		log.Printf("MAC address + CRC was of length %v instead of %v. Terminating socket.\n", reqLen, 7)
		return
	}
	if !util.CrcCheck(buf[6], buf, 6) {
		log.Println(buf)
		log.Printf("MAC address CRC failed: Expected %v but received %v. Terminating socket.\n", util.CrcGenerate(buf, 6), buf[6])
		return
	}

	// TODO: Reissue MAC address

	_, err = c.Write(buf[0:7])
	if err != nil {
		log.Println("Error Returning MAC:", err.Error())
		return
	}

	mac := fmt.Sprintf("%X:%X:%X:%X:%X:%X", buf[0], buf[1], buf[2], buf[3], buf[4], buf[5])
	log.Printf("Handshake success with device %s\n", mac)

	table_title_co2 := "co2_" + mac
	table_title_temp := "temp_" + mac
	table_title_humi := "humi_" + mac

	log.Printf("Creating table: %v", table_title_co2)
	if err := session.Query(`CREATE TABLE IF NOT EXISTS ? ( timestamp timestamp PRIMARY KEY, value int )`, table_title_co2).WithContext(ctx).Exec(); err != nil {
		log.Printf("Unable to create table: %v\n", err)
	}

	log.Printf("Creating table: %v", table_title_temp)
	if err := session.Query(`CREATE TABLE IF NOT EXISTS ? ( timestamp timestamp PRIMARY KEY, value int )`, table_title_temp).WithContext(ctx).Exec(); err != nil {
		log.Printf("Unable to create table: %v\n", err)
	}

	log.Printf("Creating table: %v", table_title_humi)
	if err := session.Query(`CREATE TABLE IF NOT EXISTS ? ( timestamp timestamp PRIMARY KEY, value int )`, table_title_humi).WithContext(ctx).Exec(); err != nil {
		log.Printf("Unable to create table: %v\n", err)
	}

	// Wait for tables to be created
	time.Sleep(1 * time.Second)

	for {
		// Read the incoming connection into the buffer.
		reqLen, err = c.Read(buf)
		if err != nil {
			log.Println("Error reading:", err.Error())
			return
		}
		if reqLen != packetLength {
			log.Printf("Received data was of length %v instead of %v. Terminating socket.\n", reqLen, packetLength)
			return
		}

		log.Printf("Received %v \n", buf)

		// CRC
		if !util.CrcCheck(buf[packetLength-1], buf, packetLength-1) {
			log.Printf("Invalid CRC. Expected %v but received %v\n", util.CrcGenerate(buf, packetLength-1), buf[packetLength-1])
		}

		timestamp := binary.BigEndian.Uint32(buf[0:4]) * 1000
		dataType := DataType(buf[4])
		data := binary.BigEndian.Uint16(buf[5:7])

		tableTitle := mac

		switch dataType {
		case Co2:
			tableTitle = table_title_co2
		case Temperature:
			tableTitle = table_title_temp
		case Humidity:
			tableTitle = table_title_humi
		default:
			log.Printf("%v is an invalid Data Type", dataType)
			tableTitle += "-undefined"
		}

		if err := session.Query(`INSERT INTO ? (timestamp, value) VALUES (?, ?)`, tableTitle, timestamp, data).WithContext(ctx).Exec(); err != nil {
			log.Fatal(err)
		}

		// else {
		// co2, temp, humi := formatData(buf)
		// }

		// log.Printf("Received %v bytes containing %v | CO2: %v ppm, Temp: %v C, Humidity: %v %%\n", reqLen, buf, co2, temp, humi)
		// t := time.Now().UnixMilli()

		// Encode data into a message to be passed to the websocket
		// message, err := json.Marshal(websocket.Message{UserCount: len(hub.Clients), Time: t, Co2: co2, Temp: temp, Humi: humi})
		// if err != nil {
		// 	log.Println("Error in encoding to json bytes:", err)
		// }
		// hub.Broadcast <- message

		// Sends data back to sensor for debugging
		c.Write(buf)
	}
}

func SetupTcp(session *gocql.Session, ctx context.Context) {
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
		go handleConnection(c, session, ctx)
	}
}
