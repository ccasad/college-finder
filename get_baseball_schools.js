// https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_institutions
// https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_institutions
// https://en.wikipedia.org/wiki/List_of_NCAA_Division_III_institutions

// Combine data from colleges_with_baseball_from_ipeds.csv and 
// the wikipedia data for divisions

const _ = require("lodash");
const fs = require("fs");
const cheerio = require("cheerio");
const csvtojson = require("csvtojson");

let states;

const statesInt = [
  "VA", // "VIRGINIA",
  "MD", // "MARYLAND",
  "WV", // "WEST VIRGINIA",
  "NC", // "NORTH CAROLINA",
  "PA", // "PENNSYLVANIA",
  "NJ", // "NEW JERSEY",
  "DE", // "DELAWARE",
  "DC", // "DISTRICT OF COLUMBIA",
  "SC", // "SOUTH CAROLINA",
  // "OH", // "OHIO",
  // "TN", // "TENNESSEE",
  // "KY", // "KENTUCKY"
  // "NY", // "NEW YORK",
];

const _process = async () => {
  let result = await fs.readFileSync("./states.json", "utf8");
  states = JSON.parse(result);

  const collegesIPEDS = await csvtojson().fromFile("./data/colleges.csv"); // colleges_with_baseball_from_ipeds
// {
//   city:'Montgomery'
//   ipeds_id:'101189'
//   latitude:'32.384181'
//   longitude:'-86.21641'
//   name:'Faulkner University'
//   organization:'NAIA'
//   state:'AL'
//   web_address:'www.faulkner.edu/'
// }

  result = await fs.readFileSync("./data/colleges_divisions_from_ncaa.json", "utf8");
  const collegesNCAA = JSON.parse(result);

  let crosswalks = [];

  let matched = 0;
  const lenCollegesIPEDS = collegesIPEDS.length;
  for (let j = 0; j < lenCollegesIPEDS; j++) {
    const collegeIPEDS = collegesIPEDS[j];
    let exists;
    // if (collegeIPEDS.organization === "NCAA") {
      if (collegeIPEDS.WEBSITE) { // web_address
        exists = _.find(collegesNCAA, function(collegeNCAA) {
          const ipeds = _cleanUrl(collegeIPEDS.WEBSITE); // web_address
          const ncaa = _cleanUrl(collegeNCAA.webSiteUrl);
          if (ipeds === ncaa) {
            collegeIPEDS.matched = true;
            collegeNCAA.matched = true;
            return true;
          }
          return false;
        });
      }
      if (!exists) {
        exists = _.find(collegesNCAA, function(collegeNCAA) {
          if (
            collegeIPEDS.STATE === collegeNCAA.memberOrgAddress.state &&
            !collegeIPEDS.matched
          ) {
            const ipeds = _prepareForComparison(collegeIPEDS.NAME);
            const ncaa = _prepareForComparison(collegeNCAA.nameOfficial);
            if (ipeds === ncaa) {
              collegeIPEDS.matched = true;
              collegeNCAA.matched = true;
              return true;
            };
          }
          return false;
        });
      }
      if (exists) {
        matched++;
      } else {
        console.log("NOT FOUND", collegeIPEDS.NAME, collegeIPEDS.WEBSITE); // web_address
        crosswalks.push(`{"ipeds_id": ${collegeIPEDS.ipeds_id}, "ipeds_name": "${collegeIPEDS.NAME}", "ncaa_name": ""}`);
      }
    // }
  }

  await fs.writeFileSync("./data/colleges_crosswalk_ncaa_ipeds.json", crosswalks.join(",\n"));

  let collegesNotMatchedIPEDS = [];
  collegesIPEDS.forEach((collegeIPEDS) => {
    if (!collegeIPEDS.matched) {
      collegesNotMatchedIPEDS.push({"state": collegeIPEDS.STATE, "name": collegeIPEDS.NAME, "ipeds_id": collegeIPEDS.ipeds_id});
    }
  });
  collegesNotMatchedIPEDS = _.orderBy(collegesNotMatchedIPEDS, ["STATE", "NAME"]);
  console.log("IPEDS NOT MATCHED", collegesNotMatchedIPEDS.length, "OUT OF", collegesIPEDS.length);
  await fs.writeFileSync("./data/colleges_ipeds_not_matched.json", JSON.stringify(collegesNotMatchedIPEDS));

  let collegesNotMatchedNCAA = [];
  collegesNCAA.forEach((collegeNCAA) => {
    if (!collegeNCAA.matched) {
      collegesNotMatchedNCAA.push({"state": collegeNCAA.memberOrgAddress.state, "name": collegeNCAA.nameOfficial});
    }
  });
  collegesNotMatchedNCAA = _.orderBy(collegesNotMatchedNCAA, ["memberOrgAddress.state", "name"]);
  console.log("NCAA NOT MATCHED", collegesNotMatchedNCAA.length, "OUT OF", collegesNCAA.length);
  await fs.writeFileSync("./data/colleges_ncaa_not_matched.json", JSON.stringify(collegesNotMatchedNCAA));

  console.log("TOTAL MATCHED", matched);
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

// const _parseHtmlFile = async (data, division) => {
//   const $ = cheerio.load(data);
//   const rows = $("tr");
//   const schools = [];
//   const len = rows.length;
//   const teamNameIndex = division === "D1" ? 5 : 3;
//   const cityNameIndex = division === "D1" ? 7 : 5;
//   const stateNameIndex = division === "D1" ? 9 : 7;
//   for (let i = 0; i < len; i++) {
//     const row = rows[i];
//     if (_.get(row, "children[1].children.length") === 2) {
//       const school = {};
//       if (_.get(row, "children[1].children[0].children[0].data")) {
//         school.long_name = row.children[1].children[0].children[0].data;
//       } else if (_.get(row, "children[1].children[0].children[0].children[0].data")) {
//         school.long_name = row.children[1].children[0].children[0].children[0].data;
//       }

//       school.short_name = null;
//       if (division === "D1") {
//         if (_.get(row, "children[3].children[0].data")) {
//           school.short_name = row.children[3].children[0].data;
//         }
//       }
      
//       if (_.get(row, `children[${teamNameIndex}].children[0].children[0].data`)) {
//         school.team_name = row.children[teamNameIndex].children[0].children[0].data;
//       }
//       if (_.get(row, `children[${teamNameIndex}].children[0].attribs.href`)) {
//         school.team_url = row.children[teamNameIndex].children[0].attribs.href;
//       }
//       if (_.get(row, `children[${cityNameIndex}].children[0].children[0].data`)) {
//         school.city = row.children[cityNameIndex].children[0].children[0].data;
//       }
//       if (_.get(row, `children[${stateNameIndex}].children[0].children[0].data`)) {
//         const state = _.find(states, (state) => {
//           return state.State.toLowerCase() === row.children[stateNameIndex].children[0].children[0].data.replace("'", "").toLowerCase();
//         });
//         if (state && state.Code) {
//           school.state = state.Code;
//         }
//       }
//       school.division = division;

//       schools.push(school);

//       if (
//         school.long_name === "Young Harris College" ||
//         school.long_name === "York College of Pennsylvania"
//       ) {
//         break;
//       }
//     }
//   }
//   console.log("SCHOOLS PARSED", schools.length);
//   return schools;
// };

(async () => {
  await _process();
})();
