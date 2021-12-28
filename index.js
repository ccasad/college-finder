const _ = require("lodash");
const fs = require("fs");
const turf = require("@turf/turf");

const tgm = require("@targomo/core");

// https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=232186
// https://www.collegedata.com/

// https://docs.traveltime.com/api/reference/isochrones
// Application ID: 36c52bfc
// API key:  b1a8a6f648bb1e3b030825f152df8177

// https://dashboard.targomo.com/home
// API key: UGRSCPKRLESRJXPQ2YTJ
const _process = async () => {
  let result = await fs.readFileSync("./data/colleges.geojson", "utf8");
  let colleges = JSON.parse(result);
  colleges.features = _.orderBy(colleges.features, "properties.name", "asc");
  const len = colleges.features.length;
  result = await fs.readFileSync("./data/hour-1-distance.geojson", "utf8");
  const distanceHour1 = JSON.parse(result);
  result = await fs.readFileSync("./data/hour-2-distance.geojson", "utf8");
  const distanceHour2 = JSON.parse(result);
  result = await fs.readFileSync("./data/hour-3-distance.geojson", "utf8");
  const distanceHour3 = JSON.parse(result);
  result = await fs.readFileSync("./data/hour-4-distance.geojson", "utf8");
  const distanceHour4 = JSON.parse(result);
  result = await fs.readFileSync("./data/hour-5-distance.geojson", "utf8");
  const distanceHour5 = JSON.parse(result);

  const pointsWithinHour1 = turf.pointsWithinPolygon(colleges, distanceHour1);
  const pointsWithinHour2 = turf.pointsWithinPolygon(colleges, distanceHour2);
  const pointsWithinHour3 = turf.pointsWithinPolygon(colleges, distanceHour3);
  const pointsWithinHour4 = turf.pointsWithinPolygon(colleges, distanceHour4);
  const pointsWithinHour5 = turf.pointsWithinPolygon(colleges, distanceHour5);

  // To help speed things up should run biggest hour polygon first to get all colleges within it.
  // Then we'd be able to throw out all colleges that don't fall within that polygon
  // since the other hour polygons are smaller.
  
  const arr = [pointsWithinHour1, pointsWithinHour2, pointsWithinHour3, pointsWithinHour4, pointsWithinHour5];
  const collegesWithDistance = [];

  let total = 0;
  for (let i = 0; i < arr.length; i++) {
    const points = arr[i];
    let found = 0;
    for (let j = 0; j < len; j++) {
      const college = colleges.features[j];
      const exists = _.find(points.features, ["properties.ipedsid", college.properties.ipedsid])
      if (exists && !_.get(college, "properties.within_hours_away")) {
        college.properties.within_hours_away = i + 1;
        collegesWithDistance.push(college);
        console.log(`${college.properties.within_hours_away}hr - ${college.properties.name} in ${college.properties.city}, ${college.properties.state} (${college.properties.division})`);
        found++;
      }
    }
    total += found;
    console.log(`${found} found within ${i+1} hours away`);
  }
  await fs.writeFileSync("./data/colleges_with_distance.geojson", JSON.stringify(collegesWithDistance));
  console.log(`${total} total found within 5 hours`);
};

(async () => {
  await _process();
})();

