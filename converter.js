// This file is used to take html data from NCSA pages 
// of baseball colleges and csv data from IPEDS and spit out
// geojson and json files of the combined data

const _ = require("lodash");
const fs = require("fs");
const { toDecimal } = require("geolib");
const { XMLParser } = require("fast-xml-parser");
const csvtojson = require("csvtojson");

let baseballColleges = [];
let csvColleges = [];

const _process = async () => {
  // schools with baseball from NCSA website
  const dataBaseballNCSA = await fs.readFileSync(`./data/colleges_with_baseball_from_ncsa.txt`, "utf8");
  await _parseHtmlFile(dataBaseballNCSA);

  // schools with baseball from collegedata.com website
  // const dataBaseballCD = await fs.readFileSync(`./data/colleges.txt`, "utf8");
  // _parseHtmlFile(dataBaseballCD);

  // all schools from 
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
        csvColleges.push(row);
      }
      const mergedColleges = await _mergeData();
      await fs.writeFileSync("./data/colleges_with_baseball.json", JSON.stringify(mergedColleges));
      console.log("College json file written");

      const geoJson = _buildGeoJson(mergedColleges);
      await fs.writeFileSync("./data/colleges_with_baseball.geojson", JSON.stringify(geoJson));
      console.log("College geojson file written");
      console.log("DONE");
    })
    .catch(error => {
      console.error("ERROR: ", error);
    });
};

const _prepareForComparison = (str) => {
  return str ? str.toLowerCase()
    .replace(/\s/g, "")
    .replace(/-/g,"")
    .replace(/&/g,"")
    .replace(/'/g,"")
    .replace(/\./g,"") : null;
};

const _mergeData = async () => {
  const mergedColleges = [];
  const lenCsv = csvColleges.length;
  const lenBaseball = baseballColleges.length;
  csvColleges = _.orderBy(csvColleges, "NAME", "asc");
  baseballColleges = _.orderBy(baseballColleges, "name", "asc");
  let notMatchedColleges = "";
  let notMatchedCount = 0;
  let matchedCount = 0;
  let matched;
  console.log(`Baseball colleges file contains ${lenBaseball} colleges`);

  const statesAbbrevInterestedIn = ["VA", "MD", "WV", "NC", "PA", "NY", "NJ", "DE", "DC"];
  const statesInterestedIn = ["VIRGINIA", "MARYLAND", "WEST VIRGINIA", "NORTH CAROLINA", "PENNSYLVANIA", "NEW YORK", "NEW JERSEY", "DELAWARE", "DISTRICT OF COLUMBIA"];

  for (let i = 0; i < lenBaseball; i++) {
    const baseballCollege = baseballColleges[i];

    if (!baseballCollege.state || statesInterestedIn.includes(baseballCollege.state.toUpperCase())) {
      matched = false;
      baseballCollege.ipedsid = null;
      baseballCollege.latitude = null;
      baseballCollege.longitude = null;
      baseballCollege.website = null;
      const schoolsWithSameCity = [];
      
      for (let j = 0; j < lenCsv; j++) {
        const csvCollege = csvColleges[j];
        if (statesAbbrevInterestedIn.includes(csvCollege.STATE)) {
          const baseballNameCondensed = _prepareForComparison(baseballCollege.name);
          const baseballCityCondensed = _prepareForComparison(baseballCollege.city);
          const csvNameCondensed = _prepareForComparison(csvCollege.NAME);
          const csvAliasCondensed = _prepareForComparison(csvCollege.ALIAS);
          const csvCityCondensed = _prepareForComparison(csvCollege.CITY);

          if (baseballCityCondensed && csvCityCondensed && baseballCityCondensed === csvCityCondensed) {
            schoolsWithSameCity.push(csvCollege.NAME);
          }
          if (baseballNameCondensed === csvNameCondensed || baseballNameCondensed === csvAliasCondensed) {
            matched = true;
            matchedCount++;
            baseballCollege.ipedsid = csvCollege.IPEDSID;
            baseballCollege.website = csvCollege.WEBSITE;
            baseballCollege.latitude = parseFloat(csvCollege.LATITUDE).toFixed(5);
            baseballCollege.longitude = parseFloat(csvCollege.LONGITUDE).toFixed(5);
            mergedColleges.push(baseballCollege);
            break;
          }
        }
      }
      
      if (!matched && schoolsWithSameCity.length) {
        notMatchedColleges += `${baseballCollege.name} (${schoolsWithSameCity.join()})\n`;
        notMatchedCount++;
        mergedColleges.push(baseballCollege);
      }
    }
  }
  console.log(`${matchedCount} MATCHED - ${notMatchedCount} NOT MATCHED`);
  await fs.writeFileSync("./data/not_matched.txt", notMatchedColleges);
  return mergedColleges;
};

const _parseHtmlFile = async (data) => {
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
    const item = {};
    if (_.get(div, "div")) {
      const infoDivs = _.get(div, "div.div");
      item.name = _.get(infoDivs, `[0].a["#text"]`).replace("&amp;", "&");
      item.city = _.get(infoDivs, `[1].span[0]["#text"]`);
      item.state = _.get(infoDivs, `[1].span[1]["#text"]`);
      item.conference = _.get(infoDivs, `[3]["#text"]`);
      item.division = _.get(infoDivs, `[4]`);
      baseballColleges.push(item);
    }
  }
  await fs.writeFileSync("./data/colleges_with_baseball_from_ncsa.json", JSON.stringify(baseballColleges));
};

const _buildGeoJson = (json) => {
  let features = [];
  json.forEach(item => {
    const geometry = item.latitude && item.longitude ? _buildGeometry(item) : null;
    delete item.latitude;
    delete item.longitude;
    features.push({
      type: "Feature",
      geometry: geometry,
      properties: item,
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
