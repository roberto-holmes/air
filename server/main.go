package main

import (
	"html/template"
	"net/http"
	"strconv"
)

type Todo struct {
	Title string
	Done  bool
}

type TodoPageData struct {
	PageTitle string
	Co2       string
	Temp      string
	Humi      string
}

func main() {
	tmpl := template.Must(template.ParseFiles("layout.html"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		data := TodoPageData{
			PageTitle: "My TODO list",
			Co2:       strconv.Itoa(400),
			Temp:      strconv.Itoa(24),
			Humi:      strconv.Itoa(45),
		}
		tmpl.Execute(w, data)
	})
	http.ListenAndServe(":80", nil)
}
