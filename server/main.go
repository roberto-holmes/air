package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/roberto-holmes/air/server/ghost"
	"github.com/roberto-holmes/air/server/websocket"
)

func serveSite(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "layout.html")
}

func main() {
	fmt.Println("Running Air Server")

	// Start hub for storing and dealing  with all websocket connections
	hub := websocket.NewHub()
	go hub.Run()

	// Setup TCP route
	go ghost.SetupTcp(hub)

	// Set up HTTP and websocket routes
	http.HandleFunc("/", serveSite)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(hub, w, r)
	})

	// Setup port for web app
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
