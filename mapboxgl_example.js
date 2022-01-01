// TODO:
// * switch out the accessToken to a personal one
// * add filter to turn on/off colleges by division
// * add ability to see all data when click on college
// *

import fs from "fs";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { difference, featureCollection, bbox } from "@turf/turf";
// import bbox from "@turf/bbox";

let hour1, hour2, hour3, hour4, hour5, collegesGeojson, collegesJson;

async function getData() {
  let result = await fs.readFileSync(
    "/src/data/hour-1-distance.geojson",
    "utf8"
  );
  hour1 = JSON.parse(result);
  result = await fs.readFileSync("/src/data/hour-2-distance.geojson", "utf8");
  hour2 = JSON.parse(result);
  result = await fs.readFileSync("/src/data/hour-3-distance.geojson", "utf8");
  hour3 = JSON.parse(result);
  result = await fs.readFileSync("/src/data/hour-4-distance.geojson", "utf8");
  hour4 = JSON.parse(result);
  result = await fs.readFileSync("/src/data/hour-5-distance.geojson", "utf8");
  hour5 = JSON.parse(result);
  result = await fs.readFileSync(
    "/src/data/colleges_with_distance.geojson",
    "utf8"
  );
  collegesGeojson = JSON.parse(result);
  result = await fs.readFileSync(
    "/src/data/colleges_with_distance.json",
    "utf8"
  );
  collegesJson = JSON.parse(result);

  // cutout just the polygon ring for that hour
  const hour2Diff = difference(hour2.features[0], hour1.features[0]);
  const hour3Diff = difference(hour3.features[0], hour2.features[0]);
  const hour4Diff = difference(hour4.features[0], hour3.features[0]);
  const hour5Diff = difference(hour5.features[0], hour4.features[0]);

  hour2 = featureCollection([hour2Diff]);
  hour3 = featureCollection([hour3Diff]);
  hour4 = featureCollection([hour4Diff]);
  hour5 = featureCollection([hour5Diff]);
}

(async () => {
  await getData();
  init();
})();

mapboxgl.accessToken =
  "pk.eyJ1IjoiY2Nhc2FkIiwiYSI6ImNqN3BpNnByZTN1bjkycW5wZXMyYzU0bHEifQ.__Gj3_aFbIH7Uo8YlmHLJQ";

function init() {
  let map = new mapboxgl.Map({
    container: "map",
    center: [-77.266433, 35.799289],
    zoom: 9,
    hash: true,
    style: "mapbox://styles/mapbox/streets-v9"
  });

  map.on("load", function () {
    map.addSource("hour1", { type: "geojson", data: hour1 });
    map.addSource("hour2", { type: "geojson", data: hour2 });
    map.addSource("hour3", { type: "geojson", data: hour3 });
    map.addSource("hour4", { type: "geojson", data: hour4 });
    map.addSource("hour5", { type: "geojson", data: hour5 });

    map.addLayer({
      id: "hour5",
      type: "fill",
      source: "hour5",
      paint: { "fill-color": "purple", "fill-opacity": 0.2 }
    });
    map.addLayer({
      id: "hour4",
      type: "fill",
      source: "hour4",
      paint: { "fill-color": "red", "fill-opacity": 0.2 }
    });
    map.addLayer({
      id: "hour3",
      type: "fill",
      source: "hour3",
      paint: { "fill-color": "orange", "fill-opacity": 0.2 }
    });
    map.addLayer({
      id: "hour2",
      type: "fill",
      source: "hour2",
      paint: { "fill-color": "yellow", "fill-opacity": 0.2 }
    });
    map.addLayer({
      id: "hour1",
      type: "fill",
      source: "hour1",
      paint: { "fill-color": "green", "fill-opacity": 0.2 }
    });

    map.addSource("colleges", { type: "geojson", data: collegesGeojson });

    map.addLayer({
      id: "colleges",
      type: "circle",
      source: "colleges",
      paint: {
        "circle-radius": 4,
        "circle-color": [
          "match",
          ["get", "division"],
          "NCAA D1",
          "#00ff00", // green
          "NCAA D2",
          "#0000ff", // blue
          "NCAA D3",
          "#ff0000", // red
          "JC",
          "#fff000", // yellow
          "NAIA",
          "#ffffff", // white
          "#000000" // black
        ]
      }
    });

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on("mouseenter", "colleges", (e) => {
      map.getCanvas().style.cursor = "pointer";

      const coordinates = e.features[0].geometry.coordinates.slice();
      const name = e.features[0].properties.name;
      const division = e.features[0].properties.division;
      const hoursAway = e.features[0].properties.within_hours_away;

      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      const html = `<b>${name}</b><br>${division}<br>Within ${hoursAway}hrs`;
      popup.setLngLat(coordinates).setHTML(html).addTo(map);
    });

    map.on("mouseleave", "colleges", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });

    const bounds = bbox(hour5);
    map.fitBounds(bounds, {
      padding: 20
    });
  });
}
