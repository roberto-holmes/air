package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/roberto-holmes/air/server/cassandra"
	"github.com/roberto-holmes/air/server/ghost"
	"github.com/roberto-holmes/air/server/websocket"
)

// func serveSite(w http.ResponseWriter, r *http.Request) {
// 	log.Println(r.URL)
// 	if r.URL.Path != "/" {
// 		http.Error(w, "Not found", http.StatusNotFound)
// 		return
// 	}
// 	if r.Method != http.MethodGet {
// 		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
// 		return
// 	}
// 	http.ServeFile(w, r, "layout.html")
// }

func main() {
	fmt.Println("Running Air Server")

	// Start hub for storing and dealing  with all websocket connections
	hub := websocket.NewHub()
	go hub.Run()

	// Setup database
	fmt.Println("Connecting to Cassandra")
	session := cassandra.ConnectDatabase("cassandra", "air")
	ctx := context.Background()

	cassandra.SetContext(ctx)

	// Setup TCP route
	go ghost.SetupTcp(session, ctx, hub)

	// CREATE TABLE [IF NOT EXISTS] [keyspace_name.]table_name
	// CREATE TABLE cycling.cyclist_alt_stats ( id UUID PRIMARY KEY, lastname text, birthday timestamp, nationality text, weight text, height text );

	// if err := session.Query(`CREATE TABLE IF NOT EXISTS CO2_1 ( timestamp timestamp PRIMARY KEY, value int )`).WithContext(ctx).Exec(); err != nil {
	// 	log.Printf("Unable to create table: %v\n", err)
	// }

	// time.Sleep(5 * time.Second)

	// if err := session.Query(`INSERT INTO CO2_1 (timestamp, value) VALUES (1, 500)`).WithContext(ctx).Exec(); err != nil {
	// 	log.Printf("Unable to insert data: %v\n", err)
	// }

	// Set up HTTP and websocket routes
	// http.HandleFunc("/", serveSite)
	// http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
	// 	websocket.ServeWs(hub, w, r)
	// })

	// // Setup port for web app
	// err := http.ListenAndServe(":8080", nil)
	// if err != nil {
	// 	log.Fatal("ListenAndServe: ", err)
	// }

	r := gin.Default()
	// r.Static("/assets")
	r.LoadHTMLGlob("web/*.html")
	// API to get all past data
	r.GET("/data", cassandra.PopulatePastData)

	// Main site
	r.Static("/web", "./web")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "Air",
		})
	})
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(c, hub)
	})

	r.Run(":8080") // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}
