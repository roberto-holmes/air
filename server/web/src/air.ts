import Chart from "chart.js/auto";
import { ChartItem } from "chart.js";
import "./styles.css";

// Chart.register(TimeScale);
// Chart.register(...registerables);

const url = "192.168.1.131:8080";

const maxSensors = 3;

enum SensorType {
    co2 = 0,
    temperature,
    humidity,
}

interface Data {
    timestamp: number;
    value: number;
}

interface SensorData {
    sensor: string;
    data: Data[];
}

interface LocationData {
    location: number;
    sensors: SensorData[];
}

interface PastData {
    all: LocationData[];
}

const cardConfig: { name: string; bg: string }[] = [
    { name: "default", bg: "bg-gray-400" },
    { name: "Versinetic", bg: "bg-teal-300" },
    { name: "ByteSnap", bg: "bg-sky-700" },
];

const currentUnixTime = Math.floor(Date.now() / 1000);

const testData: PastData = {
    all: [
        {
            location: 1,
            sensors: [
                {
                    sensor: "co2",
                    data: [
                        { timestamp: currentUnixTime, value: 500 },
                        { timestamp: currentUnixTime + 1, value: 550 },
                        { timestamp: currentUnixTime + 2, value: 650 },
                    ],
                },
                {
                    sensor: "humidity",
                    data: [
                        { timestamp: currentUnixTime - 5, value: 100 },
                        { timestamp: currentUnixTime - 4, value: 50 },
                        { timestamp: currentUnixTime - 3, value: 110 },
                    ],
                },
            ],
        },
    ],
};

// Chart text colour
// Chart.defaults.color = "#fff";
// Chart.defaults.color = "#000";

// getPastData();
// createCard();
// setupWebsocket();
// graph();

class Location {
    id: number;
    prefix: string;
    supportedSensors: number;

    activeSensorId: SensorType | null;

    chartElements: (HTMLElement | null)[];
    chartColours: string[];
    charts: (Chart | undefined)[];
    tabs: (HTMLElement | null)[];

    hasEnabledDefaultChart: boolean;

    xMaxRange: number[];
    displayedPeriod: string;

    constructor(id: number) {
        const self = this;

        this.id = id;
        this.prefix = id + "-";
        this.supportedSensors = 0;
        this.hasEnabledDefaultChart = false;
        this.activeSensorId = null;

        // this.xMaxRange = [0, 0, 0, 0, 0, 0];
        this.xMaxRange = new Array<number>(maxSensors * 2).fill(0);
        this.displayedPeriod = "hour";

        this.chartElements = new Array<null>(maxSensors).fill(null);
        this.chartColours = new Array<string>(maxSensors).fill("");
        this.charts = new Array<undefined>(maxSensors).fill(undefined);
        this.tabs = new Array<null>(maxSensors).fill(null);

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

        this.renameElementId(frag, "periodHour");
        this.renameElementId(frag, "periodDay");
        this.renameElementId(frag, "periodWeek");
        this.renameElementId(frag, "periodAll");

        // Create card
        if (container) container.appendChild(frag);

        // Get the settings for this card with adefault if they aren't found
        let currentConfig = cardConfig[this.id];
        if (currentConfig === undefined) currentConfig = cardConfig[0];

        // Set the background colour of the card
        let cardElement = document.getElementById(this.prefix + "cardMain");
        if (cardElement) cardElement.classList.add(currentConfig.bg);

        // Set card title
        let title = document.getElementById(this.prefix + "title");
        if (title) title.innerHTML = currentConfig.name;

        // Get the canvas elements for the charts
        this.chartElements[SensorType.co2] = document.getElementById(this.prefix + "co2Chart");
        this.chartElements[SensorType.temperature] = document.getElementById(this.prefix + "tempChart");
        this.chartElements[SensorType.humidity] = document.getElementById(this.prefix + "humiChart");

        // Set the graph colours
        this.chartColours[SensorType.co2] = "rgb(255, 99, 132)";
        this.chartColours[SensorType.temperature] = "rgb(94, 234, 212)";
        this.chartColours[SensorType.humidity] = "rgb(251, 146, 60)";

        // Gnenerate each of the graphs
        this.charts[SensorType.co2] = this.generateChart(
            this.chartColours[SensorType.co2],
            this.chartElements[SensorType.co2]
        );

        this.charts[SensorType.temperature] = this.generateChart(
            this.chartColours[SensorType.temperature],
            this.chartElements[SensorType.temperature]
        );

        this.charts[SensorType.humidity] = this.generateChart(
            this.chartColours[SensorType.humidity],
            this.chartElements[SensorType.humidity]
        );

        // Configure onclick for tabs
        this.tabs[SensorType.co2] = document.getElementById(this.prefix + "co2Tab");
        this.tabs[SensorType.temperature] = document.getElementById(this.prefix + "tempTab");
        this.tabs[SensorType.humidity] = document.getElementById(this.prefix + "humiTab");

        let tempTab = this.tabs[SensorType.co2];
        if (tempTab) {
            tempTab.style.display = "none";
            tempTab.onclick = function () {
                let tempTab = self.tabs[SensorType.co2];
                if (tempTab) self.toggleTab(tempTab);
            };
        }
        tempTab = this.tabs[SensorType.temperature];
        if (tempTab) {
            tempTab.style.display = "none";
            tempTab.onclick = function () {
                let tempTab = self.tabs[SensorType.temperature];
                if (tempTab) self.toggleTab(tempTab);
            };
        }
        tempTab = this.tabs[SensorType.humidity];
        if (tempTab) {
            tempTab.style.display = "none";
            tempTab.onclick = function () {
                let tempTab = self.tabs[SensorType.humidity];
                if (tempTab) self.toggleTab(tempTab);
            };
        }

        // Configure onclick for time period drop down
        let periodHour = document.getElementById(this.prefix + "periodHour");
        let periodDay = document.getElementById(this.prefix + "periodDay");
        let periodWeek = document.getElementById(this.prefix + "periodWeek");
        let periodAll = document.getElementById(this.prefix + "periodAll");

        if (periodHour !== null)
            periodHour.onclick = function () {
                self.displayedPeriod = "hour";
                self.configureChartPeriod();
            };
        if (periodDay !== null)
            periodDay.onclick = function () {
                self.displayedPeriod = "day";
                self.configureChartPeriod();
            };
        if (periodWeek !== null)
            periodWeek.onclick = function () {
                self.displayedPeriod = "week";
                self.configureChartPeriod();
            };
        if (periodAll !== null)
            periodAll.onclick = function () {
                self.displayedPeriod = "all";
                self.configureChartPeriod();
            };

        // Set Last update to update every second
        this.automateLastUpdate();
    }
    renameElementId(frag: DocumentFragment, id: string) {
        let x = frag.getElementById(id);
        if (x !== null) x.id = this.prefix + id;
    }
    generateChart(colour: string, element: HTMLElement | null) {
        if (element === null) return undefined;
        // Configure chart
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
            type: "scatter" as const,
            data: data,
            options: {
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    x: {
                        min: 0,
                        max: Date.now(),
                        type: "linear" as const,
                        // type: "time" as const,
                        // time: {
                        //     isoWeek: true,
                        //     unit: "month" as const,
                        // },
                        bounds: <"ticks">"ticks",
                        ticks: {
                            count: 8,
                            callback: function (value: any, index: any, ticks: any) {
                                return "*" + value + "*";
                            },
                        },
                    },
                },
            },
        };
        // Hide chart by default
        element.style.display = "none";
        return new Chart(<ChartItem>element, config);
    }
    toggleTab(element: HTMLElement) {
        if (element.classList.contains("tab-active")) console.log("Already selected");
        else {
            const activeTabs = document.getElementsByClassName("tab-active");
            // console.log(activeTabs);
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

            let co2ChartElement = this.chartElements[SensorType.co2];
            let temChartElement = this.chartElements[SensorType.temperature];
            let humChartElement = this.chartElements[SensorType.humidity];

            // Change which graph is being displayed
            if (element.id === this.prefix + "co2Tab" && co2ChartElement) {
                this.activeSensorId = SensorType.co2;
                co2ChartElement.style.display = "block";
                if (temChartElement) temChartElement.style.display = "none";
                if (humChartElement) humChartElement.style.display = "none";
            } else if (element.id === this.prefix + "tempTab" && temChartElement) {
                this.activeSensorId = SensorType.temperature;
                if (co2ChartElement) co2ChartElement.style.display = "none";
                temChartElement.style.display = "block";
                if (humChartElement) humChartElement.style.display = "none";
            } else if (element.id === this.prefix + "humiTab" && humChartElement) {
                this.activeSensorId = SensorType.humidity;
                if (co2ChartElement) co2ChartElement.style.display = "none";
                if (temChartElement) temChartElement.style.display = "none";
                humChartElement.style.display = "block";
            }

            element.classList.add("tab-active");
            this.updateLastUpdate();
        }
    }
    // Fill appropriate chart with all past data
    populateChart(data: SensorData) {
        let chart: Chart | undefined = undefined;
        let sensorId: SensorType;

        switch (data.sensor) {
            case "co2":
                sensorId = SensorType.co2;
                break;
            case "temperature":
                sensorId = SensorType.temperature;
                break;
            case "humidity":
                sensorId = SensorType.humidity;
                break;
            default:
                return;
        }
        chart = this.charts[sensorId];
        this.xMaxRange[2 * sensorId] = data.data[0].timestamp;
        this.xMaxRange[2 * sensorId + 1] = data.data[data.data.length - 1].timestamp;
        if (chart) {
            // For each datapoint in the sensor data
            for (let i = 0; i < data.data.length; i++) {
                // Get x and y
                const step = {
                    x: data.data[i].timestamp,
                    y: data.data[i].value,
                };
                // Add to chart
                chart.data.datasets.forEach((dataset) => {
                    dataset.data.push(step);
                });
            }
            this.configureChartPeriod();
        }

        let tabElement = this.tabs[sensorId];
        if (tabElement) tabElement.style.display = "block";

        if (!this.hasEnabledDefaultChart) {
            this.activeSensorId = sensorId;
            let chartElement = this.chartElements[sensorId];
            if (chartElement) chartElement.style.display = "block";
            if (tabElement) tabElement.classList.add("tab-active");

            this.hasEnabledDefaultChart = true;
        }
        this.updateLastUpdate();
    }

    // Add a new data point to a chart
    addChartPoint(sensorId: SensorType, data: Data) {
        let chart = this.charts[sensorId];

        // Enable tab if not already
        let tabElement = this.tabs[sensorId];
        if (tabElement) tabElement.style.display = "block";

        if (!this.hasEnabledDefaultChart) {
            let chartElement = this.chartElements[sensorId];
            if (chartElement) chartElement.style.display = "block";
            if (tabElement) tabElement.classList.add("tab-active");

            this.hasEnabledDefaultChart = true;
        }

        // Add data point to x range
        if (this.xMaxRange[2 * sensorId] <= 0) this.xMaxRange[2 * sensorId] = data.timestamp;
        this.xMaxRange[2 * sensorId + 1] = data.timestamp;

        if (chart) {
            // Get x and y
            const step = {
                x: data.timestamp,
                y: data.value,
            };
            // Add to chart
            chart.data.datasets.forEach((dataset) => {
                dataset.data.push(step);
            });

            this.configureChartPeriod();
        }

        this.updateLastUpdate();
    }
    configureChartPeriod() {
        console.log("Configuring period");
        for (let i = 0; i < this.charts.length; i++) {
            const chart = this.charts[i];
            if (chart === undefined) continue;

            const firstTimestamp = this.xMaxRange[2 * i];
            const lastTimestamp = this.xMaxRange[2 * i + 1];

            if (
                chart.config.options &&
                chart.config.options.scales &&
                chart.config.options.scales.x &&
                chart.config.options.scales.x.min !== undefined &&
                chart.config.options.scales.x.max !== undefined &&
                chart.config.options.scales.x.ticks
            ) {
                switch (this.displayedPeriod) {
                    case "all":
                        chart.config.options.scales.x.min = firstTimestamp;
                        chart.config.options.scales.x.max = lastTimestamp;
                        chart.config.options.scales.x.ticks.callback = function (value: any, index: any, ticks: any) {
                            const today = new Date(value * 1000);
                            const yyyy = today.getFullYear();
                            const mm_num = today.getMonth() + 1; // Months start at 0
                            const dd_num = today.getDate();

                            let dd_str = dd_num.toString();
                            let mm_str = mm_num.toString();

                            if (dd_num < 10) dd_str = "0" + dd_num;
                            if (mm_num < 10) mm_str = "0" + mm_num;

                            return dd_str + "/" + mm_str + "/" + yyyy;
                        };
                        break;
                    case "week":
                        // 604800 seconds in a week
                        if (lastTimestamp > 604800) chart.config.options.scales.x.min = lastTimestamp - 604800;
                        else chart.config.options.scales.x.min = 0;
                        chart.config.options.scales.x.max = lastTimestamp;
                        chart.config.options.scales.x.ticks.callback = function (value: any, index: any, ticks: any) {
                            const now = new Date(value * 1000);
                            const weekDay = now.getDay();
                            switch (weekDay) {
                                case 0:
                                    return "Mon";
                                case 1:
                                    return "Tue";
                                case 2:
                                    return "Wed";
                                case 3:
                                    return "Thu";
                                case 4:
                                    return "Fri";
                                case 5:
                                    return "Sat";
                                case 6:
                                    return "Sun";
                                default:
                                    return "err";
                            }
                        };
                        break;
                    case "day":
                        // 86400 seconds in a day
                        if (lastTimestamp > 86400) chart.config.options.scales.x.min = lastTimestamp - 86400;
                        else chart.config.options.scales.x.min = 0;
                        chart.config.options.scales.x.max = lastTimestamp;
                        chart.config.options.scales.x.ticks.callback = function (value: any, index: any, ticks: any) {
                            const now = new Date(value * 1000);
                            const hh_num = now.getHours();
                            const mm_num = now.getMinutes();
                            const ss_num = now.getSeconds();

                            let hh_str = hh_num.toString();
                            let mm_str = mm_num.toString();
                            let ss_str = ss_num.toString();

                            if (hh_num < 10) hh_str = "0" + hh_str;
                            if (mm_num < 10) mm_str = "0" + mm_str;
                            if (ss_num < 10) ss_str = "0" + ss_str;

                            return hh_str + ":" + mm_str + ":00";
                        };
                        break;
                    case "hour":
                    default:
                        // 3600 seconds in an hour
                        if (lastTimestamp > 3600) chart.config.options.scales.x.min = lastTimestamp - 3600;
                        else chart.config.options.scales.x.min = 0;
                        chart.config.options.scales.x.max = lastTimestamp;
                        chart.config.options.scales.x.ticks.callback = function (value: any, index: any, ticks: any) {
                            const now = new Date(value * 1000);
                            const hh_num = now.getHours();
                            const mm_num = now.getMinutes();
                            const ss_num = now.getSeconds();

                            let hh_str = hh_num.toString();
                            let mm_str = mm_num.toString();
                            let ss_str = ss_num.toString();

                            if (hh_num < 10) hh_str = "0" + hh_str;
                            if (mm_num < 10) mm_str = "0" + mm_str;
                            if (ss_num < 10) ss_str = "0" + ss_str;

                            return hh_str + ":" + mm_str + ":" + ss_str;
                        };
                        break;
                }
            }
            chart.update();
        }
    }
    updateLastUpdate() {
        let lastUpdateElement = document.getElementById(this.prefix + "lastUpdate");

        if (lastUpdateElement) {
            if (this.activeSensorId !== null) {
                let time_s = Math.round(Date.now() / 1000) - this.xMaxRange[2 * this.activeSensorId + 1];

                // If the element exists, display the given value as seconds, minutes, hours, or days
                if (time_s < 60) lastUpdateElement.innerHTML = "Last update: " + time_s + "s ago";
                else if (time_s < 180 * 60)
                    lastUpdateElement.innerHTML = "Last update: " + Math.round(time_s / 60) + " min ago";
                else if (time_s < 48 * 60 * 60)
                    lastUpdateElement.innerHTML = "Last update: " + Math.round(time_s / (60 * 60)) + "h ago";
                else if (time_s < 730 * 24 * 60 * 60)
                    lastUpdateElement.innerHTML = "Last update: " + Math.round(time_s / (24 * 60 * 60)) + " days ago";
                else
                    lastUpdateElement.innerHTML =
                        "Last update: " + Math.round(time_s / (365 * 24 * 60 * 60)) + " years ago";
            } else {
                lastUpdateElement.innerHTML = "Last update: a long time ago";
            }
        }
    }
    automateLastUpdate() {
        this.updateLastUpdate();
        setTimeout(this.automateLastUpdate.bind(this), 1000);
    }
}

let cards: Location[] = [];

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
                if (co2 !== null) co2.innerHTML = formatData(sensorType, data.Value).toString();
                break;
            case SensorType.temperature:
                if (temp !== null) temp.innerHTML = formatData(sensorType, data.Value).toFixed(1);
                break;
            case SensorType.humidity:
                if (humi !== null) humi.innerHTML = formatData(sensorType, data.Value).toFixed(1);
                break;
        }

        // users.innerHTML = data.UserCount;
        if (time !== null) time.innerHTML = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
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

function build(data: PastData) {
    // Loop through the locations
    for (let i = 0; i < data.all.length; i++) {
        const location = data.all[i];
        cards.push(new Location(location.location));

        // Loop through sensors
        for (let j = 0; j < location.sensors.length; j++) {
            const sensor = location.sensors[j];
            cards[i].populateChart(sensor);
        }
    }
    // const versinetic = new Location(1);
    // const bytesnap = new Location(2);
    // const test = new Location(3);
    console.log(cards);
}

build(testData);

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
