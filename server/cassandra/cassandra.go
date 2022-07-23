package cassandra

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

type DataPoint struct {
	Timestamp int64
	Value     uint16
}
type SensorData struct {
	Sensor string
	Data   []DataPoint
}
type LocationData struct {
	Location int
	Sensors  []SensorData
}
type PastData struct {
	All []LocationData
}

var (
	session *gocql.Session
	ctx     context.Context
)

func SetContext(c context.Context) {
	ctx = c

}

func ConnectDatabase(url string, keyspace string) *gocql.Session {

	log.Printf("Creating cluster\n")
	cluster := gocql.NewCluster(url)
	cluster.Keyspace = keyspace
	cluster.ProtoVersion = 4
	cluster.Consistency = gocql.Quorum

	log.Printf("Cluster created")
	s, err := cluster.CreateSession()
	session = s
	for {
		if err != nil {
			log.Printf("Failed to create Cassandra session with error: %v\n", err)
			time.Sleep(5 * time.Second)
		} else {
			log.Printf("Successfully connected to Cassandra\n")
			break
		}
		session, err = cluster.CreateSession()
	}

	return session
}

func PopulatePastData(c *gin.Context) {
	// `SELECT timestamp, value FROM co2`

	// packet := gin.H{}
	// packet := make(map[string][]map)
	var packet PastData
	// packet := gin.H{
	// 	"message": "pong",
	// }

	// var macArray []string
	locations := make(map[int]struct{})

	scanner := session.Query(`SELECT location FROM co2`).WithContext(ctx).Iter().Scanner()
	for scanner.Next() {
		var (
			loc int
		)
		err := scanner.Scan(&loc)
		if err != nil {
			log.Fatal(err)
		} else {
			// log.Printf("Found MAC: %v", mac)
			// macArray = append(macArray, mac)
			locations[loc] = struct{}{}
		}
	}

	for location := range locations {
		// locationSpecificData := gin.H{}
		var locationData LocationData

		locationData.Location = location
		// locationSpecificData["location"] = location
		// locationSpecificData["sensors"] = []gin.H{}
		scanner := session.Query(`SELECT timestamp, value FROM co2 WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		locationData.Sensors = append(locationData.Sensors, extractData("co2", scanner))
		// j := []gin.H{}[co2, co2]

		scanner = session.Query(`SELECT timestamp, value FROM temperature WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		locationData.Sensors = append(locationData.Sensors, extractData("temperature", scanner))
		// extractData("temperature", scanner, locationSpecificData)
		scanner = session.Query(`SELECT timestamp, value FROM humidity WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		locationData.Sensors = append(locationData.Sensors, extractData("humidity", scanner))
		// extractData("humidity", scanner, locationSpecificData)
		packet.All = append(packet.All, locationData)
		// packet["all"] = locationSpecificData
	}
	c.JSON(http.StatusOK, packet)
}

func extractData(sensor string, scanner gocql.Scanner) SensorData {
	// sensorSpecificData := gin.H{}
	var sensorData SensorData
	sensorData.Sensor = sensor
	for scanner.Next() {
		var (
			timestamp int64
			value     uint16
		)
		err := scanner.Scan(&timestamp, &value)
		if err != nil {
			log.Fatal(err)
		} else {
			// log.Printf("Found %v : %v", timestamp, value)
			// dataPoint := gin.H{}
			var dataPoint DataPoint
			dataPoint.Timestamp = timestamp / 1000
			dataPoint.Value = value

			sensorData.Data = append(sensorData.Data, dataPoint)
			// dataPoint["timestamp"] = strconv.FormatInt(timestamp, 10)
			// dataPoint["value"] = value
			// sensorSpecificData[strconv.FormatInt(timestamp, 10)] = value
		}
	}
	// return sensorSpecificData
	return sensorData
	// json[sensor] = sensorSpecificData
	// json["sensors"] = append(json["sensors"], sensorSpecificData)

}
