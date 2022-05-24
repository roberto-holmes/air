package websocket

import (
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID   string
	Conn *websocket.Conn
	Pool *Pool
}

type Message struct {
	UserCount int
	Time      string
	Co2       uint16
	Temp      float64
	Humi      float64
}

// func (c *Client) Read() {
// 	defer func() {
// 		c.Pool.Unregister <- c
// 		c.Conn.Close()
// 	}()

// 	for {
// 		messageType, p, err := c.Conn.ReadMessage()
// 		if err != nil {
// 			log.Println(err)
// 			return
// 		}
// 		message := Message{Type: messageType, Body: string(p)}
// 		c.Pool.Broadcast <- message
// 		fmt.Printf("Message Received: %+v\n", message)
// 	}
// }

func (c *Client) Update() {
	defer func() {
		c.Pool.Unregister <- c
		c.Conn.Close()
	}()

	for {
		// t := time.Now().GoString()
		// message := Message{UserCount: len(pool.Clients), Time: t, }
		// message := sensor
		// c.Pool.Broadcast <- message
		// c.Pool.Broadcast <- sensor
		// c.Conn.WriteMessage(websocket.TextMessage, []byte(t))
		time.Sleep(time.Second)
	}
}
