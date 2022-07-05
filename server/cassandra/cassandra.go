package cassandra

import (
	"log"
	"time"

	"github.com/gocql/gocql"
)

func ConnectDatabase(url string, keyspace string) *gocql.Session {

	log.Printf("Creating cluster\n")
	cluster := gocql.NewCluster(url)
	cluster.Keyspace = keyspace
	cluster.ProtoVersion = 4
	cluster.Consistency = gocql.Quorum

	log.Printf("Cluster created")
	session, err := cluster.CreateSession()
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
