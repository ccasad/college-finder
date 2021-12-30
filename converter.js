// This file is used to take html data from NCSA pages 
// of baseball colleges and csv data from IPEDS and spit out
// geojson and json files of the combined data

const _ = require("lodash");
const fs = require("fs");
const { toDecimal } = require("geolib");
const { XMLParser } = require("fast-xml-parser");
const csvtojson = require("csvtojson");

let htmlColleges = [];
let csvColleges = [];

const _process = async () => {
  const dataHtml = await fs.readFileSync(`./data/colleges.txt`, "utf8");
  _parseHtmlFile(dataHtml);

  const dataCsv = await fs.readFileSync(`./data/colleges.csv`, "utf8");
  _parseCsvFile(dataCsv);
};

const _parseCsvFile = async (data) => {
  csvtojson({
    noheader: false,
    output: "json",
    delimiter: ",",
  })
    .fromString(data)
    .on("error", error => {
      if (error) {
        console.log("Error: ", JSON.stringify(error));
      }
    })
    .then(async output => {
      const len = output.length;
      for (let i = 0; i < len; i++) {
        const row = output[i];
        if (
          _.get(row, "NAICS_CODE") &&
          (row["NAICS_CODE"].startsWith("6112") ||
            row["NAICS_CODE"].startsWith("6113"))
        ) {
          csvColleges.push(row);
        }
      }
      const mergedColleges = _mergeData();
      await fs.writeFileSync("./data/colleges.json", JSON.stringify(mergedColleges));
      console.log("College json file written");

      const geoJson = _buildGeoJson(mergedColleges);
      await fs.writeFileSync("./data/colleges.geojson", JSON.stringify(geoJson));
      console.log("College geojson file written");
      console.log("DONE");
    })
    .catch(error => {
      console.error("ERROR: ", error);
    });
};

const _mergeData = () => {
  const mergedColleges = [];
  const lenCsv = csvColleges.length;
  const lenHtml = htmlColleges.length;
  for (let i = 0; i < lenHtml; i++) {
    const htmlCollege = htmlColleges[i];
    for (let j = 0; j < lenCsv; j++) {
      const csvCollege = csvColleges[j];
      if (csvCollege["NAME"].toLowerCase() === htmlCollege.name.toLowerCase()) {
        htmlCollege.match = true;
        const merged = _.assign(htmlCollege, _changeObjectProperties(csvCollege));
        mergedColleges.push(merged);
        break;
      }
    }
  }
  return mergedColleges;
};

const _parseHtmlFile = (data) => {
  const parsingOptions = {
    ignoreAttributes: false,
    unpairedTags: ["hr", "br", "link", "meta"],
    stopNodes : [ "*.pre", "*.script"],
    processEntities: true,
    htmlEntities: true
  };
  const parser = new XMLParser(parsingOptions);
  const result = parser.parse(data);
  const divs = result.div;
  const len = divs.length;
  for (let i = 0; i < len; i++) {
    const div = divs[i];
    const item = {
      match: false,
    };
    if (_.get(div, "div")) {
      item.ncsa_url = _.get(div, `div.link["@_href"]`);
      const infoDivs = _.get(div, "div.div");
      item.name = _.get(infoDivs, `[0].a["#text"]`);
      item.city = _.get(infoDivs, `[1].span[0]["#text"]`);
      item.state = _.get(infoDivs, `[1].span[1]["#text"]`);
      item.region = _.get(infoDivs, `[2].span["#text"]`);
      item.conference = _.get(infoDivs, `[3]["#text"]`);
      item.division = _.get(infoDivs, `[4]`);
      htmlColleges.push(item);
    }
  }
};

const _buildGeoJson = (json) => {
  let features = [];
  json.forEach(item => {
    const properties = {};
    properties.ipedsid = item.ipedsid ? item.ipedsid : null;
    properties.name = item.name ? item.name : null;
    properties.division = item.division ? item.division : null;
    features.push({
      type: "Feature",
      geometry: _buildGeometry(item),
      properties: properties,
    });
  });
  return {
    type: "FeatureCollection",
    features: features
  };
};

const _buildGeometry = (item) => {
  const lat = parseFloat(item.latitude).toFixed(5);
  const lng = parseFloat(item.longitude).toFixed(5);
  const FORMATTED_LAT = toDecimal(lat);
  const FORMATTED_LNG = toDecimal(lng);
  return {
    type: "Point",
    coordinates: [
      FORMATTED_LNG,
      FORMATTED_LAT
    ]
  }
};

const _changeObjectProperties = (obj) => {
  const newObj = {};
  _.keys(obj).forEach((key) => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

(async () => {
  await _process();
})();
