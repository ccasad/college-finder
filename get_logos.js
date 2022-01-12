// https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_institutions
// https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_institutions
// https://en.wikipedia.org/wiki/List_of_NCAA_Division_III_institutions

// * grab HTML from page
// * grab all <tr>s inside of <tbody>s
// * loop through the rows
// * grab data from <th> which is school full name
// * grab data from first <td> which is school short name
// * grab data from second <td> which is school mascot name and url
// * once done loop through the new data and use the url to pull each schools wiki page
// * on the wiki page look for: <td colspan="2" class="infobox-image"> which will have a url to the logo svg
// * make a call to download the logo svg using the url and save it somewhere (would be nice to save it using the ipeds id)

const _ = require("lodash");
const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const _process = async () => {
  let result;

  const urlsDivision = [
    { division: "D1", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_institutions"},
    { division: "D2", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_institutions"},
    { division: "D3", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_III_institutions"},
  ];
  let schools = [];
  for (let i = 0; i < urlsDivision.length; i++) {
    result = await fetch(urlsDivision[i].url);
    const html = await result.text();
    const newSchools = await _parseHtmlFile(html, urlsDivision[i].division);
    schools = schools.concat(newSchools);
  }
  await fs.writeFileSync("./data/colleges_with_team_info.json", JSON.stringify(schools));
  console.log("Team info file for colleges written, total schools", schools.length);

  result = await fs.readFileSync("./data/colleges_with_distance.json", "utf8");
  let allColleges = JSON.parse(result);

  result = await fs.readFileSync("./data/colleges_with_team_info.json", "utf8");
  let teamInfo = JSON.parse(result);
  let found = 0;
  let notFound = 0;
  const statesInterestedIn = ["VIRGINIA", "MARYLAND", "WEST VIRGINIA", "NORTH CAROLINA", "PENNSYLVANIA", "NEW YORK", "NEW JERSEY", "DELAWARE", "DISTRICT OF COLUMBIA"];
  teamInfo = _.orderBy(teamInfo, "long_name", "asc");
  const lenTeams = teamInfo.length;
  for (let j = 0; j < lenTeams; j++) {
    const team = teamInfo[j];
    if (!team.state && team.division !== "D2") {
      console.log("NO STATE", team.long_name, team.division);
    }
    if (team.state && statesInterestedIn.includes(team.state.toUpperCase())) {
      const teamLongNameCondensed = _prepareForComparison(team.long_name);
      const teamShortNameCondensed = _prepareForComparison(team.short_name);
      const exists = _.find(allColleges, function(o) {
        const nameCondensed = _prepareForComparison(o.name);
        return nameCondensed === teamLongNameCondensed || nameCondensed === teamShortNameCondensed
      });
      if (exists) {
        found++;
      } else {
        notFound++;
        console.log("NOT FOUND", team.long_name, team.short_name);
      }
    }
  }
  console.log("DONE found", found, "not found", notFound);
};

const _prepareForComparison = (str) => {
  return str ? str.toLowerCase()
    .replace(/\s/g, "")
    .replace(/-/g,"")
    .replace(/&/g,"")
    .replace(/'/g,"")
    .replace(/\./g,"") : null;
};

const _parseHtmlFile = async (data, division) => {
  const $ = cheerio.load(data);
  const rows = $("tr");
  const schools = [];
  const len = rows.length;
  const teamNameIndex = division === "D1" ? 5 : 3;
  const cityNameIndex = division === "D1" ? 7 : 5;
  const stateNameIndex = division === "D1" ? 9 : 5;
  for (let i = 0; i < len; i++) {
    const row = rows[i];
    if (_.get(row, "children[1].children.length") === 2) {
      const school = {};
      if (_.get(row, "children[1].children[0].children[0].data")) {
        school.long_name = row.children[1].children[0].children[0].data;
      } else if (_.get(row, "children[1].children[0].children[0].children[0].data")) {
        school.long_name = row.children[1].children[0].children[0].children[0].data;
      }
if (
  school.long_name === "Webster University" ||
  school.long_name === "St. Catherine University" ||
  school.long_name === "Fontbonne University"
) {
  console.log(school);
}
      school.short_name = null;
      if (division === "D1") {
        if (_.get(row, "children[3].children[0].data")) {
          school.short_name = row.children[3].children[0].data;
        }
      }
      
      if (_.get(row, `children[${teamNameIndex}].children[0].children[0].data`)) {
        school.team_name = row.children[teamNameIndex].children[0].children[0].data;
      }
      if (_.get(row, `children[${teamNameIndex}].children[0].attribs.href`)) {
        school.team_url = row.children[teamNameIndex].children[0].attribs.href;
      }
      if (_.get(row, `children[${cityNameIndex}].children[0].children[0].data`)) {
        school.city = row.children[cityNameIndex].children[0].children[0].data;
      }
      if (_.get(row, `children[${stateNameIndex}].children[0].children[0].data`)) {
        school.state = row.children[stateNameIndex].children[0].children[0].data;
      }
      school.division = division;
      schools.push(school);
    }
  }
  console.log("SCHOOLS PARSED", schools.length);
  return schools;
};

(async () => {
  await _process();
})();
