package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/roberto-holmes/air/server/cassandra"
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
	// fmt.Println("Connecting to Cassandra")
	// session := cassandra.ConnectDatabase("cassandra", "air")
	// ctx := context.Background()

	// cassandra.SetContext(ctx)

	// Setup TCP route
	// go ghost.SetupTcp(session, ctx, hub)

	r := gin.Default()
	// r.Static("/assets")
	r.LoadHTMLGlob("web/dist/*.html")
	// API to get all past data
	r.GET("/data", cassandra.PopulatePastData)

	// Main site
	r.Static("/web/dist", "./web/dist")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{})
	})
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(c, hub)
	})

	r.Run(":8080") // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}
