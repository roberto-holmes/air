package cassandra

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

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

	packet := gin.H{
		"message": "pong",
	}

	// var macArray []string
	locations := make(map[string]struct{})

	scanner := session.Query(`SELECT location FROM co2`).WithContext(ctx).Iter().Scanner()
	for scanner.Next() {
		var (
			mac string
		)
		err := scanner.Scan(&mac)
		if err != nil {
			log.Fatal(err)
		} else {
			// log.Printf("Found MAC: %v", mac)
			// macArray = append(macArray, mac)
			locations[mac] = struct{}{}
		}
	}

	for location := range locations {
		locationSpecificData := gin.H{}
		scanner := session.Query(`SELECT timestamp, value FROM co2 WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		extractData("co2", scanner, locationSpecificData)
		scanner = session.Query(`SELECT timestamp, value FROM temperature WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		extractData("temperature", scanner, locationSpecificData)
		scanner = session.Query(`SELECT timestamp, value FROM humidity WHERE location = ? ALLOW FILTERING`, location).WithContext(ctx).Iter().Scanner()
		extractData("humidity", scanner, locationSpecificData)
		packet[location] = locationSpecificData
	}

	c.JSON(http.StatusOK, packet)
}

func extractData(sensor string, scanner gocql.Scanner, json gin.H) {
	sensorSpecificData := gin.H{}
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
			sensorSpecificData[strconv.FormatInt(timestamp, 10)] = value
		}
	}
	json[sensor] = sensorSpecificData
}
