// websockets.go
package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Connection - Websocket connection interface
type Connection struct {
	Socket *websocket.Conn
	mu     sync.Mutex
}

var sockets = make(map[string]*Connection)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func updater(ws *websocket.Conn) {
	defer ws.Close()
	for {
		ws.WriteMessage(websocket.TextMessage, []byte("Hi"))
		time.Sleep(time.Second)
	}
}

func main() {
	http.HandleFunc("/echo", func(w http.ResponseWriter, r *http.Request) {
		ws, _ := upgrader.Upgrade(w, r, nil) // error ignored for sake of simplicity

		if sockets[message.SOME_ID] == nil {
			connection := new(Connection)
			connection.Socket = conn
			sockets[message.SOME_ID] = connection
		}

		go updater(ws)
		// for {
		// 	// Read message from browser
		// 	_, msg, _ := conn.ReadMessage()
		// 	// msgType, msg, err := conn.ReadMessage()
		// 	// if err != nil {
		// 	// 	return
		// 	// }

		// 	// Print the message to the console
		// 	fmt.Printf("%s sent: %s\n", conn.RemoteAddr(), string(msg))

		// 	conn.WriteMessage(websocket.TextMessage, []byte("Hi"))

		// 	// Write message back to browser
		// 	// if err = conn.WriteMessage(msgType, msg); err != nil {
		// 	// 	return
		// 	// }
		// }
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "websockets.html")
	})

	http.ListenAndServe(":8080", nil)
}
