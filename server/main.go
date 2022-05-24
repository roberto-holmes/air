package main

import (
	"fmt"
	"net/http"

	"github.com/roberto-holmes/air/server/sensor"
	"github.com/roberto-holmes/air/server/websocket"
)

func serveWs(pool *websocket.Pool, w http.ResponseWriter, r *http.Request) {
	fmt.Println("WebSocket Endpoint Hit")
	conn, err := websocket.Upgrade(w, r)
	if err != nil {
		fmt.Fprintf(w, "%+v\n", err)
	}

	client := &websocket.Client{
		Conn: conn,
		Pool: pool,
	}

	pool.Register <- client
	// client.Update()
}

func serveSite(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "layout.html")
}

func setupRoutes(pool *websocket.Pool) {
	go pool.Start()
	http.HandleFunc("/", serveSite)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(pool, w, r)
	})
}

func main() {
	fmt.Println("Running Air Server")

	// c := make(chan Message)
	pool := websocket.NewPool()

	// Set up HTTP
	setupRoutes(pool)
	go sensor.SetupTcp(pool)
	fmt.Println("Hello?")
	http.ListenAndServe(":8080", nil)
}
