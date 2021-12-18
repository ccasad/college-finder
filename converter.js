const _ = require("lodash");
const fs = require("fs");
const { toDecimal } = require("geolib");
const { XMLParser } = require("fast-xml-parser");
const csvtojson = require("csvtojson");

let htmlColleges = [];
let csvColleges = [];

// TODO
// * DONE convert mergedColleges array into geojson and put into own file
// * export each distance buffer layer into it's own geojson file (have 1-8hrs) possibly using this API https://docs.traveltime.com/api/overview/getting-keys
// * using turfjs (https://turfjs.org/) determine how far each school is using point in polygon function, add that distance as a new property
//   

// https://docs.traveltime.com/api/reference/isochrones
// Application ID: 36c52bfc
// API key:  b1a8a6f648bb1e3b030825f152df8177

fs.readFile("./colleges.txt", "utf8" , (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  _parseHtmlFile(data);

  fs.readFile("./colleges.csv", "utf8" , (err, data) => {
    if (err) {
      console.error(err)
      return
    }
    _parseCsvFile(data);
  });
});

const _parseCsvFile = (data) => {
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
    .then(output => {
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

      const gjson = _buildGeoJson(mergedColleges);
      const geoJson = JSON.stringify(gjson);

      fs.writeFile("./colleges.geojson", geoJson, (err) => {
        if (err) {
          throw err;
        }
        console.log("geojson data is saved.");
      });
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
    features.push({
      type: "Feature",
      geometry: _buildGeometry(item),
      properties: item
    });
  });
  return {
    type: "FeatureCollection",
    features: features
  };
};

const _buildGeometry = (item) => {
  const FORMATTED_LAT = toDecimal(item.latitude);
  const FORMATTED_LNG = toDecimal(item.longitude);
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
