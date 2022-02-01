const _ = require("lodash");
const fs = require("fs");
const csvtojson = require("csvtojson");
const { toDecimal } = require("geolib");

// colleges_matched.json
// {
// 	"ipeds_id": 100654,
// 	"ipeds_name": "ALABAMA A & M UNIVERSITY",
// 	"ipeds_naics_code": 611310,
// 	"ipeds_naics_desc": "COLLEGES, UNIVERSITIES, AND PROFESSIONAL SCHOOLS",
// 	"ncaa_name": "Alabama A&M University",
// 	"ncaa_org_id": 6,
// 	"ncaa_division": 1,
// 	"ncaa_conf_id": 916,
// 	"ncaa_conf_name": "Southwestern Athletic Conf.",
// 	"ncaa_region": "SOUTH REGION",
// 	"address_street": "4900 MERIDIAN STREET",
// 	"address_city": "NORMAL",
// 	"address_state": "AL",
// 	"address_zip": 35762,
// 	"is_private": false,
// 	"is_hist_black": true,
// 	"total_enrollment": 6106,
// 	"website_athletic": "www.aamusports.com",
// 	"website_main": "www.aamu.edu/",
// 	"latitude": 34.78333,
// 	"longitude": -86.56853
// }

// colleges_division_X_from_wiki.json
// {
// 	"long_name": "Abilene Christian University",
// 	"school_wiki_url": "/wiki/Abilene_Christian_University",
// 	"short_name": "Abilene Christian",
// 	"team_name": "Wildcats",
// 	"team_url": "/wiki/Abilene_Christian_Wildcats",
// 	"city": "Abilene",
// 	"state": "Texas",
// 	"conference": "Western Athletic Conference",
// 	"division": "D1",
// 	"school_website_url": "http://www.acu.edu/",
// 	"school_seal_svg_url": "https://upload.wikimedia.org/wikipedia/en/2/28/Abilene_Christian_University_seal.svg",
// 	"official_colors": ["#461D7C", "#FFFFFF"],
// 	"team_svg_url": "https://upload.wikimedia.org/wikipedia/en/6/6c/Abilene_Christian_Wildcats_logo.svg"
// }

const _process = async () => {
  let result = await fs.readFileSync("./states.json", "utf8");
  const states = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_matched.json", "utf8");
  const collegesNCAA = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_division_D1_from_wiki.json", "utf8");
  const collegesWikiD1 = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_division_D2_from_wiki.json", "utf8");
  const collegesWikiD2 = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_division_D3_from_wiki.json", "utf8");
  const collegesWikiD3 = JSON.parse(result);

  let collegesWiki = [];
  collegesWiki = collegesWiki.concat(collegesWikiD1, collegesWikiD2, collegesWikiD3);

  let crosswalks = [];
  let collegesMatched = [];
  const lenCollegesNCAA = collegesNCAA.length;

  for (let j = 0; j < lenCollegesNCAA; j++) {
    const collegeNCAA = collegesNCAA[j];
    let exists;
    if (collegeNCAA.webSiteUrl) {
      exists = _.find(collegesWiki, function(collegeWiki) {
        const wiki = _cleanUrl(collegeWiki.school_website_url);
        const ncaa = _cleanUrl(collegeNCAA.website_main);
        if (wiki === ncaa) {
          collegeWiki.matched = true;
          collegeNCAA.matched = true;
          _.assign(collegeNCAA, collegeWiki);
          return true;
        }
        return false;
      });
    }
    if (!exists) {
      exists = _.find(collegesWiki, function(collegeWiki) {
        const wikiState = _.find(states, (state) => {
          if (collegeWiki.state) {
            return state.State.toLowerCase() === collegeWiki.state.replace("'", "").toLowerCase();
          }
          return false;
        });
        if (wikiState) {
          if (
            wikiState.Code === collegeNCAA.address_state &&
            !collegeWiki.matched
          ) {
            const wikiLong = _prepareForComparison(collegeWiki.long_name);
            const wikiShort = _prepareForComparison(collegeWiki.short_name);
            const ncaa = _prepareForComparison(collegeNCAA.ncaa_name);
            const ipeds = _prepareForComparison(collegeNCAA.ipeds_name);
            if (wikiLong === ncaa || wikiShort === ncaa || wikiLong === ipeds || wikiShort === ipeds) {
              collegeWiki.matched = true;
              collegeNCAA.matched = true;
              _.assign(collegeNCAA, collegeWiki);
              return true;
            };
          }
        } else {
          console.log(collegeWiki.state, collegeWiki.division, collegeWiki.long_name);
        }
        return false;
      });
    }
    // if (!exists) {
    //   const collegeCross = _.find(collegesCrosswalk, ["ncaa_name", collegeNCAA.ncaa_name]);
    //   const collegeWiki = _.find(collegesWiki, ["IPEDSID", collegeCross.ipeds_id.toString()]);
    //   if (collegeWiki) {
    //     collegeWiki.matched = true;
    //     collegeNCAA.matched = true;
    //     _.assign(collegeNCAA, collegeWiki);
    //     exists = true;
    //   }
    // }
    if (exists) {
      const collegeMatched = _cleanCollegeProperties(collegeNCAA);
      collegesMatched.push(collegeMatched);
    } else {
      console.log("NOT FOUND", collegeNCAA.ncaa_name, collegeNCAA.website_main);
      crosswalks.push(`{"ipeds_id": null, "wiki_name": "", "ncaa_name": "${collegeNCAA.ncaa_name}", "ncaa_url": "${collegeNCAA.website_main}"}`);
    }
  }

  await fs.writeFileSync("./data/colleges_crosswalk_ncaa_wiki.json", crosswalks.join(",\n"));

  let collegesNotMatchedNCAA = [];
  collegesNCAA.forEach((collegeNCAA) => {
    if (!collegeNCAA.matched) {
      collegesNotMatchedNCAA.push({"state": collegeNCAA.address_state, "name": collegeNCAA.ncaa_name});
    }
  });
  collegesNotMatchedNCAA = _.orderBy(collegesNotMatchedNCAA, ["memberOrgAddress.state", "name"]);
  console.log("NCAA NOT MATCHED", collegesNotMatchedNCAA.length, "OUT OF", collegesNCAA.length);
  await fs.writeFileSync("./data/colleges_ncaa_not_matched_to_wiki.json", JSON.stringify(collegesNotMatchedNCAA));

  collegesMatched = _.orderBy(collegesMatched, ["address_state", "ncaa_name"]);
  console.log("TOTAL MATCHED", collegesMatched.length, "OUT OF", collegesNCAA.length);
  await fs.writeFileSync("./data/colleges_matched_to_wiki.json", JSON.stringify(collegesMatched));

  const geojson = _buildGeoJson(collegesMatched);
  await fs.writeFileSync("./data/colleges_matched_to_wiki.geojson", JSON.stringify(geojson));
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

    wiki_team: college.team_name,
    wiki_team_svg: college.team_svg_url,
    wiki_school_seal_svg: college.school_seal_svg_url,
    wiki_official_colors: college.official_colors,

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
