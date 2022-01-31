const _ = require("lodash");
const fs = require("fs");
const csvtojson = require("csvtojson");
const { toDecimal } = require("geolib");

const _process = async () => {
  const collegesIPEDS = await csvtojson().fromFile("./data/colleges.csv");

  result = await fs.readFileSync("./data/colleges_divisions_from_ncaa.json", "utf8");
  const collegesNCAA = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_crosswalk_ncaa_ipeds.json", "utf8");
  const collegesCrosswalk = JSON.parse(result);

  // let crosswalks = [];
  let matched = 0;
  let collegesMatched = [];
  const lenCollegesNCAA = collegesNCAA.length;

  for (let j = 0; j < lenCollegesNCAA; j++) {
    const collegeNCAA = collegesNCAA[j];
    let exists;
    if (collegeNCAA.webSiteUrl) {
      exists = _.find(collegesIPEDS, function(collegeIPEDS) {
        const ipeds = _cleanUrl(collegeIPEDS.WEBSITE);
        const ncaa = _cleanUrl(collegeNCAA.webSiteUrl);
        if (ipeds === ncaa) {
          collegeIPEDS.matched = true;
          collegeNCAA.matched = true;
          _.assign(collegeNCAA, collegeIPEDS);
          return true;
        }
        return false;
      });
    }
    if (!exists) {
      exists = _.find(collegesIPEDS, function(collegeIPEDS) {
        if (
          collegeIPEDS.STATE === collegeNCAA.memberOrgAddress.state &&
          !collegeIPEDS.matched
        ) {
          const ipeds = _prepareForComparison(collegeIPEDS.NAME);
          const ncaa = _prepareForComparison(collegeNCAA.nameOfficial);
          if (ipeds === ncaa) {
            collegeIPEDS.matched = true;
            collegeNCAA.matched = true;
            _.assign(collegeNCAA, collegeIPEDS);
            return true;
          };
        }
        return false;
      });
    }
    if (!exists) {
      const collegeCross = _.find(collegesCrosswalk, ["ncaa_name", collegeNCAA.nameOfficial]);
      const collegeIPEDS = _.find(collegesIPEDS, ["IPEDSID", collegeCross.ipeds_id.toString()]);
      if (collegeIPEDS) {
        collegeIPEDS.matched = true;
        collegeNCAA.matched = true;
        _.assign(collegeNCAA, collegeIPEDS);
        exists = true;
      }
    }
    if (exists) {
      const collegeMatched = _cleanCollegeProperties(collegeNCAA);
      collegesMatched.push(collegeMatched);
      matched++;
    } else {
      console.log("NOT FOUND", collegeNCAA.nameOfficial, collegeNCAA.webSiteUrl);
      // crosswalks.push(`{"ipeds_id": null, "ipeds_name": "", "ncaa_name": "${collegeNCAA.nameOfficial}", "ncaa_url": "${collegeNCAA.webSiteUrl}"}`);
    }
  }

  // await fs.writeFileSync("./data/colleges_crosswalk_ncaa_ipeds.json", crosswalks.join(",\n"));

  // let collegesNotMatchedNCAA = [];
  // collegesNCAA.forEach((collegeNCAA) => {
  //   if (!collegeNCAA.matched) {
  //     collegesNotMatchedNCAA.push({"state": collegeNCAA.memberOrgAddress.state, "name": collegeNCAA.nameOfficial});
  //   }
  // });
  // collegesNotMatchedNCAA = _.orderBy(collegesNotMatchedNCAA, ["memberOrgAddress.state", "name"]);
  // console.log("NCAA NOT MATCHED", collegesNotMatchedNCAA.length, "OUT OF", collegesNCAA.length);
  // await fs.writeFileSync("./data/colleges_ncaa_not_matched.json", JSON.stringify(collegesNotMatchedNCAA));

  collegesMatched = _.orderBy(collegesMatched, ["address_state", "ncaa_name"]);
  console.log("TOTAL MATCHED", collegesMatched.length, "OUT OF", collegesNCAA.length);
  await fs.writeFileSync("./data/colleges_matched.json", JSON.stringify(collegesMatched));

  const geojson = _buildGeoJson(collegesMatched);
  await fs.writeFileSync("./data/colleges_matched.geojson", JSON.stringify(geojson));
};

const _cleanCollegeProperties = (college) => {
  return {
    ipeds_id: parseInt(college.IPEDSID),
    ipeds_name: college.NAME,
    ipeds_naics_code: parseInt(college.NAICS_CODE),
    ipeds_naics_desc: college.NAICS_DESC,

    ncaa_name: college.nameOfficial,
    ncaa_org_id: college.orgId,
    ncaa_division: college.division,
    ncaa_conf_id: college.conferenceId,
    ncaa_conf_name: college.conferenceName,
    ncaa_region: college.sportRegion,

    address_street: college.ADDRESS,
    address_city: college.CITY,
    address_state: college.STATE,
    address_zip: parseInt(college.ZIP),

    is_private: college.privateFlag && college.privateFlag === "Y",
    is_hist_black: college.historicallyBlackFlag && college.historicallyBlackFlag === "Y",
    total_enrollment: parseInt(college.TOT_ENROLL),
    website_athletic: college.athleticWebUrl,
    website_main: college.WEBSITE,
    latitude: parseFloat(parseFloat(college.LATITUDE).toFixed(5)),
    longitude: parseFloat(parseFloat(college.LONGITUDE).toFixed(5)),
  };
};

const _cleanUrl = (url) => {
  if (url.substring(url.length-1) === "/") {
    url = url.slice(0, url.length - 1);
  }
  return url.replace("https://", "").replace("http://", "").toLowerCase();
};

const _prepareForComparison = (str) => {
  return str ? str.toLowerCase()
    .replace(/\s/g, "")
    .replace(/-/g,"")
    .replace(/-/g,"")
    .replace(/–/g,"")
    .replace(/&/g,"")
    .replace(/'/g,"")
    .replace(/\(/g,"")
    .replace(/\)/g,"")
    .replace(/\./g,"") : null;
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

(async () => {
  await _process();
})();
