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

const { setTimeout } = require("timers/promises");
const _ = require("lodash");
const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

let noSealLogo = [];
let noTeamLogo = [];
let noWebsite = [];
let noColors = [];

const _process = async () => {
  let result;

  const urlsDivision = [
    // { division: "D1", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_institutions"},
    { division: "D2", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_institutions"},
    { division: "D3", url: "https://en.wikipedia.org/wiki/List_of_NCAA_Division_III_institutions"},
  ];

  for (let i = 0; i < urlsDivision.length; i++) {
    console.log("Starting", urlsDivision[i].division);
    result = await fetch(urlsDivision[i].url);
    const html = await result.text();
    let schools = await _parseHtmlFile(html, urlsDivision[i].division);
    await fs.writeFileSync(`./data/colleges_division_${urlsDivision[i].division}_from_wiki.json`, JSON.stringify(schools));
    console.log(`${urlsDivision[i].division} DONE - Total ${schools.length}`);
    schools = [];
  }
  
  if (noSealLogo.length) {
    await fs.writeFileSync("./data/colleges_divisions_from_wiki_no_seal_logo.json", JSON.stringify(noSealLogo));
  }
  if (noTeamLogo.length) {
    await fs.writeFileSync("./data/colleges_divisions_from_wiki_no_team_logo.json", JSON.stringify(noTeamLogo));
  }
  if (noWebsite.length) {
    await fs.writeFileSync("./data/colleges_divisions_from_wiki_no_website.json", JSON.stringify(noWebsite));
  }
  if (noColors.length) {
    await fs.writeFileSync("./data/colleges_divisions_from_wiki_no_colors.json", JSON.stringify(noColors));
  }

  console.log("ALL DONE");
};

const _parseHtmlFile = async (data, division) => {
  const $ = cheerio.load(data);
  const rows = $("tr");
  const schools = [];
  const len = rows.length;
  const teamNameIndex = division === "D1" ? 5 : 3;
  const cityNameIndex = division === "D1" ? 7 : 5;
  const stateNameIndex = division === "D1" ? 9 : 7;
  const confNameIndex = division === "D1" ? 15 : (division === "D2" ? 11 : 9);

  for (let i = 0; i < len; i++) {
    if (i % 25 === 0) {
      console.log(`${division} - ${i+1} out of ${len}`);
    }
    const row = rows[i];
    if (_.get(row, "children[1].children.length") === 2) {
      const school = {};
      if (_.get(row, "children[1].children[0].children[0].data")) {
        school.long_name = row.children[1].children[0].children[0].data;
        school.school_wiki_url = row.children[1].children[0].attribs.href;
      } else if (_.get(row, "children[1].children[0].children[0].children[0].data")) {
        school.long_name = row.children[1].children[0].children[0].children[0].data;
        school.school_wiki_url = row.children[1].children[0].children[0].attribs.href;
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
      if (_.get(row, `children[${confNameIndex}].children[0].children[0].data`)) {
        school.conference = row.children[confNameIndex].children[0].children[0].data;
      }
      school.division = division;
      await _getAdditionalInfo(school);
      await _getTeamSvgUrl(school);
      schools.push(school);
      await setTimeout(2000);
    }
  }
  console.log("SCHOOLS PARSED", schools.length);
  return schools;
};

// school website
// <span class="official-website"><span class="url"><a rel="nofollow" class="external text" href="http://www.acu.edu/">Official website</a></span></span>
// official colors
// <span class="legend-color" style="background-color:#461D7C; color:white;">&nbsp;</span>
// seal logo svg
// <script type="application/ld+json">{"@context":"https:\/\/schema.org","@type":"Article","name":"Abilene Christian University","url":"https:\/\/en.wikipedia.org\/wiki\/Abilene_Christian_University","sameAs":"http:\/\/www.wikidata.org\/entity\/Q1805145","mainEntity":"http:\/\/www.wikidata.org\/entity\/Q1805145","author":{"@type":"Organization","name":"Contributors to Wikimedia projects"},"publisher":{"@type":"Organization","name":"Wikimedia Foundation, Inc.","logo":{"@type":"ImageObject","url":"https:\/\/www.wikimedia.org\/static\/images\/wmf-hor-googpub.png"}},"datePublished":"2005-02-07T15:39:58Z","dateModified":"2022-01-31T12:17:51Z","image":"https:\/\/upload.wikimedia.org\/wikipedia\/en\/2\/28\/Abilene_Christian_University_seal.svg","headline":"private Christian university in Abilene, Texas"}</script>
const _getAdditionalInfo = async (school) => {
  school.school_website_url = null;
  school.school_seal_svg_url = null;
  school.official_colors = null;
  try {
    if (school.school_wiki_url) {
      const result = await fetch(`https://en.wikipedia.org${school.school_wiki_url}`);
      let html = await result.text();
      html = html.replace( /[\r\n]+/gm, "" );
      const $ = cheerio.load(html);

      // get school website url
      const websiteLink = $(".official-website .external.text");
      if (websiteLink && websiteLink[0]) {
        const url = websiteLink[0].attribs.href;
        school.school_website_url = url ? url : null;
      }

      // get school official colors
      const colors = [];
      $(".legend-color").each(function(i, elm) {
        const style = elm.attribs.style;
        if (style) {
          const styleParts = style.split(";");
          if (styleParts && Array.isArray(styleParts)) {
            const bgParts = styleParts[0].split("background-color:");
            if (bgParts && Array.isArray(bgParts) && bgParts[1]) {
              colors.push(bgParts[1]);
            }
          }
        }
      });
      if (colors.length) {
        school.official_colors = colors;
        // console.log("COLORS", JSON.stringify(colors));
      }

      // get seal svg logo
      const start = `<script type="application/ld+json">`; 
      const end = `}</script>`;
      const part = html.substring(
        html.lastIndexOf(start) + start.length, 
        html.lastIndexOf(end) + 1
      );
      const obj = JSON.parse(part);
      if (obj && obj.image) {
        school.school_seal_svg_url = obj.image;
        // console.log("SVG", school.school_seal_svg_url);
      }
    }
  } catch (err) {
    // 
  } finally {
    if (!school.school_website_url) {
      noWebsite.push(school);
      console.log("MISSING SCHOOL WEBSITE", school.long_name);
    }
    if (!school.official_colors) {
      noColors.push(school);
      console.log("MISSING COLORS", school.long_name);
    }
    if (!school.school_seal_svg_url) {
      noSealLogo.push(school);
      console.log("MISSING SEAL SVG", school.long_name);
    }
  }
};

const _getTeamSvgUrl = async (school) => {
  school.team_svg_url = null;
  try {
    if (school.team_url) {
      const result = await fetch(`https://en.wikipedia.org${school.team_url}`);
      let html = await result.text();
      html = html.replace( /[\r\n]+/gm, "" );

      const start = `<script type="application/ld+json">`; 
      const end = `}</script>`;

      const part = html.substring(
        html.lastIndexOf(start) + start.length, 
        html.lastIndexOf(end) + 1
      );
      const obj = JSON.parse(part);
      if (obj && obj.image) {
        school.team_svg_url = obj.image;
        // console.log("SVG", school.team_svg_url);
      }
    }
  } catch (err) {
    console.log("MISSING TEAM SVG", school.long_name);
    noTeamLogo.push(school);
  }
};

(async () => {
  await _process();
})();
