import Chart from "chart.js/auto";
import { ChartItem } from "chart.js";
import "./styles.css";

// Chart.register(TimeScale);
// Chart.register(...registerables);

main();

const url = "192.168.1.131:8080";

const maxSensors = 3;
let lastUserCount = -1;

enum SensorType {
    co2 = 0,
    temperature,
    humidity,
}

interface Data {
    Timestamp: number;
    Value: number;
}

interface SensorData {
    Sensor: string;
    Data: Data[];
}

interface LocationData {
    Location: number;
    Sensors: SensorData[];
}

interface PastData {
    All: LocationData[];
}

const cardConfig: { name: string; bg: string }[] = [
    { name: "default", bg: "bg-gray-400" },
    { name: "Versinetic", bg: "bg-teal-300" },
    { name: "ByteSnap", bg: "bg-sky-700" },
];

const currentUnixTime = Math.floor(Date.now() / 1000);

const testData: PastData = {
    All: [
        {
            Location: 1,
            Sensors: [
                {
                    Sensor: "co2",
                    Data: [
                        { Timestamp: currentUnixTime, Value: 500 },
                        { Timestamp: currentUnixTime + 1, Value: 550 },
                        { Timestamp: currentUnixTime + 2, Value: 650 },
                    ],
                },
                {
                    Sensor: "temperature",
                    Data: [
                        { Timestamp: currentUnixTime - 5, Value: 100 },
                        { Timestamp: currentUnixTime - 4, Value: 50 },
                        { Timestamp: currentUnixTime - 3, Value: 110 },
                    ],
                },
            ],
        },
    ],
};

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

    lastCo2Value: number;
    lastTemValue: number;
    lastHumValue: number;

    constructor(id: number) {
        const self = this;

        this.id = id;
        this.prefix = id + "-";
        this.supportedSensors = 0;
        this.hasEnabledDefaultChart = false;
        this.activeSensorId = null;

        this.lastCo2Value = 0;
        this.lastTemValue = 0;
        this.lastHumValue = 0;

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
        this.renameElementId(frag, "lastValues");

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
        this.charts[SensorType.co2] = this.generateChart(SensorType.co2);
        this.charts[SensorType.temperature] = this.generateChart(SensorType.temperature);
        this.charts[SensorType.humidity] = this.generateChart(SensorType.humidity);

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
    generateChart(sensor: SensorType) {
        const colour = this.chartColours[sensor];
        const element = this.chartElements[sensor];
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
                        bounds: <"ticks">"ticks",
                        ticks: {
                            count: 8,
                            callback: function (value: any, index: any, ticks: any) {
                                return "*" + value + "*";
                            },
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Units",
                        },
                    },
                },
                animation: {
                    duration: 0,
                },
            },
        };

        switch (sensor) {
            case SensorType.co2:
                config.options.scales.y.title.text = "ppm";
                break;
            case SensorType.humidity:
                config.options.scales.y.title.text = "%";
                break;
            case SensorType.temperature:
                config.options.scales.y.title.text = "°C";
                break;
            default:
                break;
        }
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

        switch (data.Sensor) {
            case "co2":
                sensorId = SensorType.co2;
                this.lastCo2Value = data.Data[data.Data.length - 1].Value;
                break;
            case "temperature":
                sensorId = SensorType.temperature;
                this.lastTemValue = data.Data[data.Data.length - 1].Value;
                break;
            case "humidity":
                sensorId = SensorType.humidity;
                this.lastHumValue = data.Data[data.Data.length - 1].Value;
                break;
            default:
                return;
        }
        chart = this.charts[sensorId];
        this.xMaxRange[2 * sensorId] = data.Data[0].Timestamp;
        this.xMaxRange[2 * sensorId + 1] = data.Data[data.Data.length - 1].Timestamp;
        if (chart) {
            // For each datapoint in the sensor data
            for (let i = 0; i < data.Data.length; i++) {
                // Get x and y
                const step = {
                    x: data.Data[i].Timestamp,
                    y: this.formatData(sensorId, data.Data[i].Value),
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
        this.updateDisplayedValues();
    }

    // Add a new data point to a chart
    addChartPoint(sensorId: SensorType, data: Data) {
        let chart = this.charts[sensorId];

        switch (sensorId) {
            case SensorType.co2:
                this.lastCo2Value = data.Value;
                break;
            case SensorType.temperature:
                this.lastTemValue = data.Value;
                break;
            case SensorType.humidity:
                this.lastHumValue = data.Value;
                break;
        }

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
        if (this.xMaxRange[2 * sensorId] <= 0) this.xMaxRange[2 * sensorId] = data.Timestamp;
        this.xMaxRange[2 * sensorId + 1] = data.Timestamp;

        if (chart) {
            // Get x and y
            const step = {
                x: data.Timestamp,
                y: this.formatData(sensorId, data.Value),
            };
            // Add to chart
            chart.data.datasets.forEach((dataset) => {
                dataset.data.push(step);
            });

            this.configureChartPeriod();
            this.updateDisplayedValues();
        }

        this.updateLastUpdate();
    }
    configureChartPeriod() {
        for (let i = 0; i < this.charts.length; i++) {
            const chart = this.charts[i];
            if (chart === undefined) continue;

            const firstTimestamp = this.xMaxRange[2 * i];
            const lastTimestamp = this.xMaxRange[2 * i + 1];

            // console.log(chart);
            // console.log("Min x: " + firstTimestamp + ", Max x: " + lastTimestamp);

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
    updateDisplayedValues() {
        let e = document.getElementById(this.prefix + "lastValues");

        let s = "";

        if (this.lastCo2Value) s += this.formatData(SensorType.co2, this.lastCo2Value) + "ppm CO<sub>2</sub> ";
        if (this.lastTemValue) s += this.formatData(SensorType.temperature, this.lastTemValue).toFixed(1) + "&#8451; ";
        if (this.lastHumValue)
            s += this.formatData(SensorType.humidity, this.lastHumValue).toFixed(0) + "% Relative Humidity";

        if (e) e.innerHTML = s;
    }
    formatData(sensorType: SensorType, rawValue: number): number {
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
}

let cards: Location[] = [];

function setupWebsocket() {
    console.log("Setting up websocket");
    let socket = new WebSocket("ws://" + url + "/ws");

    socket.onopen = function () {
        console.log("Websocket connected");
    };

    socket.onmessage = function (e) {
        // Extract all data out of JSON
        const data = JSON.parse(e.data);
        // console.log(data);
        const userCount = data.UserCount;
        const timestamp = data.Time;
        const value = data.Value;
        const sensorType = data.Type;
        const location = data.Location;

        if (lastUserCount !== userCount) {
            console.log("Number of Users = " + userCount);
            lastUserCount = userCount;
        }

        const datapoint: Data = {
            Timestamp: timestamp,
            Value: value,
        };

        cards[location].addChartPoint(sensorType, datapoint);
    };
}

async function getPastData() {
    console.log("Retrieving data");
    return fetch("data")
        .then((response) => response.json())
        .then((data) => build(data));
    // .then((data) => console.log(data));
}

function build(data: PastData) {
    // Loop through the locations
    for (let i = 0; i < data.All.length; i++) {
        const location = data.All[i];
        cards.push(new Location(location.Location));

        // Loop through sensors
        for (let j = 0; j < location.Sensors.length; j++) {
            const sensor = location.Sensors[j];
            cards[i].populateChart(sensor);
        }
    }
    // const versinetic = new Location(1);
    // const bytesnap = new Location(2);
    // const test = new Location(3);
    console.log(cards);
}

async function main() {
    // build(testData);
    await getPastData();
    setupWebsocket();
}
