import Chart from "chart.js/auto";
import {
    ChartItem,
    ChartTypeRegistry,
    LegendElement,
    LegendOptions,
} from "chart.js";
// import Chart, { ChartTypeRegistry } from "chart.js/auto";
// import _ from "chart.js";
// import * as _ from "chart.js";
import "./styles.css";

const url = "192.168.1.131:8080";

enum SensorType {
    co2 = 0,
    temperature,
    humidity,
}

interface Config {
    name: string;
    bg: string;
}

const cardConfig: { name: string; bg: string }[] = [
    { name: "default", bg: "bg-gray-400" },
    { name: "Versinetic", bg: "bg-teal-300" },
    { name: "ByteSnap", bg: "bg-sky-700" },
];

// const cardColours = {"default": "bg-gray-400","Versinetic":"bg-teal-300", "ByteSnap":"bg-sky-700"}

// Chart.defaults.color = "#fff";
// Chart.defaults.color = "#000";

// getPastData();
// createCard();
// setupWebsocket();
// graph();

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
                    co2.innerHTML = formatData(
                        sensorType,
                        data.Value
                    ).toString();
                break;
            case SensorType.temperature:
                if (temp !== null)
                    temp.innerHTML = formatData(sensorType, data.Value).toFixed(
                        1
                    );
                break;
            case SensorType.humidity:
                if (humi !== null)
                    humi.innerHTML = formatData(sensorType, data.Value).toFixed(
                        1
                    );
                break;
        }

        // users.innerHTML = data.UserCount;
        if (time !== null)
            time.innerHTML =
                date.getHours() +
                ":" +
                date.getMinutes() +
                ":" +
                date.getSeconds();
    };
}

function getPastData() {
    console.log("Retrieving data");
    fetch("data")
        .then((response) => response.json())
        .then((data) => console.log(data));
}

function formatData(sensorType: number, rawValue: number): number {
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

// 	const config = {
// 		type: <keyof ChartTypeRegistry>"line",
// 		// drawLine: true,
// 		data: data,
// 		options: {
// 			plugins: {
// 				legend: {
// 					display: false,
// 				},
// 			},
// 			spanGaps: true,
// 			scales: {
// 				x: {
// 					type: <"linear">"linear",
// 					position: <"bottom">"bottom",
// 				},
// 			},
// 		},
// 	};

class Location {
    id: number;
    prefix: string;
    co2ChartElement: HTMLElement | null;
    tempChartElement: HTMLElement | null;
    humiChartElement: HTMLElement | null;

    co2Colour: string;
    tempColour: string;
    humiColour: string;

    co2Chart: Chart | undefined;
    tempChart: Chart | undefined;
    humiChart: Chart | undefined;

    co2Tab: HTMLElement | null;
    tempTab: HTMLElement | null;
    humiTab: HTMLElement | null;

    constructor(id: number) {
        const self = this;

        this.id = id;
        this.prefix = id + "-";

        let template = document.getElementsByTagName("template")[0];
        let container = document.getElementById("card-container");

        // Copy template into a document fragment
        let frag = <DocumentFragment>template.content.cloneNode(true);

        this.renameElementId(frag, "title");
        this.renameElementId(frag, "lastUpdate");
        this.renameElementId(frag, "cardMain");

        this.renameElementId(frag, "co2Chart");
        this.renameElementId(frag, "tempChart");
        this.renameElementId(frag, "humiChart");
        this.renameElementId(frag, "co2Tab");
        this.renameElementId(frag, "tempTab");
        this.renameElementId(frag, "humiTab");

        // console.log(template)
        // console.log(frag)

        if (container !== null) container.appendChild(frag);

        let currentConfig = cardConfig[this.id];

        if (currentConfig === undefined) currentConfig = cardConfig[0];

        let cardElement = document.getElementById(this.prefix + "cardMain");
        console.log(this.prefix + "cardMain");
        console.log(cardElement);

        if (cardElement !== null) cardElement.classList.add(currentConfig.bg);

        let title = document.getElementById(this.prefix + "title");
        if (title !== null) title.innerHTML = currentConfig.name;

        this.co2ChartElement = document.getElementById(
            this.prefix + "co2Chart"
        );
        this.tempChartElement = document.getElementById(
            this.prefix + "tempChart"
        );
        this.humiChartElement = document.getElementById(
            this.prefix + "humiChart"
        );

        this.co2Colour = "rgb(255, 99, 132)";
        this.tempColour = "rgb(94, 234, 212)";
        this.humiColour = "rgb(251, 146, 60)";

        if (this.co2ChartElement)
            this.co2Chart = this.generateChart(
                this.co2Colour,
                this.co2ChartElement
            );
        if (this.tempChartElement)
            this.tempChart = this.generateChart(
                this.tempColour,
                this.tempChartElement
            );
        if (this.humiChartElement)
            this.humiChart = this.generateChart(
                this.humiColour,
                this.humiChartElement
            );

        if (this.tempChartElement) this.tempChartElement.style.display = "none";
        if (this.humiChartElement) this.humiChartElement.style.display = "none";

        this.co2Tab = document.getElementById(this.prefix + "co2Tab");
        this.tempTab = document.getElementById(this.prefix + "tempTab");
        this.humiTab = document.getElementById(this.prefix + "humiTab");

        // console.log(this.co2Tab);

        if (this.co2Tab !== null)
            this.co2Tab.onclick = function () {
                if (self.co2Tab !== null) self.toggleTab(self.co2Tab);
            };
        if (this.tempTab !== null)
            this.tempTab.onclick = function () {
                if (self.tempTab !== null) self.toggleTab(self.tempTab);
            };
        if (this.humiTab !== null)
            this.humiTab.onclick = function () {
                if (self.humiTab !== null) self.toggleTab(self.humiTab);
            };

        // console.log(this.co2Tab);
    }
    renameElementId(frag: DocumentFragment, id: string) {
        let x = frag.getElementById(id);
        if (x !== null) x.id = this.prefix + id;
    }
    generateChart(colour: string, element: HTMLElement) {
        const data = {
            datasets: [
                {
                    backgroundColor: colour,
                    borderColor: colour,
                    data: [],
                },
            ],
        };

        const config = {
            type: <keyof ChartTypeRegistry>"scatter",
            data: data,
            options: {
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        };
        if (element) return new Chart(<ChartItem>element, config);
    }
    toggleTab(element: HTMLElement) {
        console.log(element);
        if (element.classList.contains("tab-active"))
            console.log("Already selected");
        else {
            const activeTabs = document.getElementsByClassName("tab-active");
            console.log(activeTabs);
            for (let i = 0; i < activeTabs.length; i++) {
                let activeTabId = activeTabs[i].id;
                // Only remove active tab if it belongs to this location
                switch (activeTabId) {
                    case this.prefix + "co2Tab":
                    case this.prefix + "tempTab":
                    case this.prefix + "humiTab":
                        activeTabs[i].classList.remove("tab-active");
                        break;
                    default:
                        break;
                }
            }

            // Null check
            if (
                this.co2ChartElement &&
                this.tempChartElement &&
                this.humiChartElement
            ) {
                // Change which graph is being displayed
                if (element.id === this.prefix + "co2Tab") {
                    this.co2ChartElement.style.display = "block";
                    this.tempChartElement.style.display = "none";
                    this.humiChartElement.style.display = "none";
                } else if (element.id === this.prefix + "tempTab") {
                    this.co2ChartElement.style.display = "none";
                    this.tempChartElement.style.display = "block";
                    this.humiChartElement.style.display = "none";
                } else if (element.id === this.prefix + "humiTab") {
                    this.co2ChartElement.style.display = "none";
                    this.tempChartElement.style.display = "none";
                    this.humiChartElement.style.display = "block";
                }
            }

            let newData = {
                x: Math.floor(Math.random() * 100),
                y: Math.floor(Math.random() * 100),
            };
            if (this.co2Chart) this.updateChart(this.co2Chart, newData);

            element.classList.add("tab-active");
        }
    }
    updateChart(chart: Chart, data: { x: number; y: number }) {
        console.log(data);
        console.log(chart.data.datasets[0].data);
        chart.data.datasets.forEach((dataset) => {
            dataset.data.push(data);
        });
        console.log(chart.data.datasets[0].data);
        chart.update();
    }
}

const versinetic = new Location(1);
const bytesnap = new Location(2);
const test = new Location(3);
