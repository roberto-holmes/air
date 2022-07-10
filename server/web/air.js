"use strict";
const url = "192.168.1.131:8080";
var SensorType;
(function (SensorType) {
    SensorType[SensorType["co2"] = 0] = "co2";
    SensorType[SensorType["temperature"] = 1] = "temperature";
    SensorType[SensorType["humidity"] = 2] = "humidity";
})(SensorType || (SensorType = {}));
getPastData();
setupWebsocket();
function setupWebsocket() {
    console.log("Setting up websocket");
    // let users = document.getElementById("users");
    let time = document.getElementById("time");
    let co2 = document.getElementById("co2");
    let temp = document.getElementById("temp");
    let humi = document.getElementById("humi");
    // let output = document.getElementById("output");
    let socket = new WebSocket("ws://" + url + "/ws");
    // socket.onopen = function () {
    // 	output.innerHTML += "Status: Connected\n";
    // };
    socket.onmessage = function (e) {
        // output.innerHTML += "Server: " + e.data + "\n";
        // console.log(e);
        // console.log(e.data);
        // console.log(JSON.parse(e.data));
        const data = JSON.parse(e.data);
        console.log(data);
        const date = new Date(data.Time * 1000);
        const sensorType = data.Type;
        const location = data.Location;
        const userCount = data.UserCount;
        console.log("Number of Users = " + userCount);
        switch (sensorType) {
            case SensorType.co2:
                if (co2 !== null)
                    co2.innerHTML = formatData(sensorType, data.Value).toString();
                break;
            case SensorType.temperature:
                if (temp !== null)
                    temp.innerHTML = formatData(sensorType, data.Value).toFixed(1);
                break;
            case SensorType.humidity:
                if (humi !== null)
                    humi.innerHTML = formatData(sensorType, data.Value).toFixed(1);
                break;
        }
        // users.innerHTML = data.UserCount;
        if (time !== null)
            time.innerHTML = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    };
}
function getPastData() {
    console.log("Retrieving data");
    fetch("data")
        .then((response) => response.json())
        .then((data) => console.log(data));
}
function formatData(sensorType, rawValue) {
    switch (sensorType) {
        case SensorType.co2:
            return rawValue;
        case SensorType.temperature:
            return -45 + (175 * rawValue) / 0xffff;
        case SensorType.humidity:
            return (100 * rawValue) / 0xffff;
    }
    return 0;
}
// func formatData(data []byte) (uint16, float64, float64) {
// 	co2 := uint16(data[0])<<8 | uint16(data[1])
// 	temp_int := uint16(data[2])<<8 | uint16(data[3])
// 	humi_int := uint16(data[4])<<8 | uint16(data[5])
// 	temp := -45 + 175*float64(temp_int)/0xFFFF
// 	humi := 100 * float64(humi_int) / 0xFFFF
// 	temp = math.Round(temp*10) / 10
// 	humi = math.Round(humi*10) / 10
// 	return co2, temp, humi
// }
