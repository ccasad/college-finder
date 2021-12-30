const _ = require("lodash");
const fs = require("fs");
const turf = require("@turf/turf");
const tokml = require("geojson-to-kml");

const _process = async () => {
  let result = await fs.readFileSync("./data/colleges.geojson", "utf8");
  let allColleges = JSON.parse(result);
  allColleges.features = _.orderBy(allColleges.features, "properties.name", "asc");

  const collegesWithDistance = [];
  const hours = 5;
  for (let x = hours; x > 0; x--) {
    result = await fs.readFileSync(`./data/hour-${x}-distance.geojson`, "utf8");
    const distanceHour = JSON.parse(result);
    const colleges = x === hours ? allColleges.features : collegesWithDistance;
    const len = colleges.length;
    const collegesCollection = turf.featureCollection(colleges);
    const points = turf.pointsWithinPolygon(collegesCollection, distanceHour);
    let found = 0;
    for (let j = 0; j < len; j++) {
      const college = collegesCollection.features[j];
      const exists = _.find(points.features, ["properties.ipedsid", college.properties.ipedsid])
      if (exists) {
        college.properties.within_hours_away = x;
        _cleanProperties(college);
        if (x === hours) {
          collegesWithDistance.push(college);
        }
        console.log(`${college.properties.within_hours_away}hr - ${college.properties.name} in ${college.properties.city}, ${college.properties.state} (${college.properties.division})`);
        found++;
      }
    }
    console.log(`${found} found within ${x} hours away`);
  }
  console.log(`${collegesWithDistance.length} total found within ${hours} hours`);

  await _updateJsonData(collegesWithDistance);

  const collegesWithDistanceCollection = turf.featureCollection(collegesWithDistance);
  await fs.writeFileSync("./data/colleges_with_distance.geojson", JSON.stringify(collegesWithDistanceCollection));
  console.log("Geojson file for colleges with distance written");

  const kmlDocument = tokml(collegesWithDistanceCollection, {
    name: "name",
    description: "division",
    documentName: `Colleges within ${hours}hrs`,
    documentDescription: `All colleges within ${hours}hrs of Aldie, Va that have a baseball program (D1, D2, D3, JUCO, NAIA)`,
  });
  await fs.writeFileSync("./data/colleges_with_distance.kml", kmlDocument);
  console.log(`KML file written`);
  console.log("DONE");
};

const _updateJsonData = async (collegesWithDistance) => {
  const lenCwd = collegesWithDistance.length;
  const result = await fs.readFileSync("./data/colleges.json", "utf8");
  const origColleges = JSON.parse(result);
  const lenOrigColleges = origColleges.length;
  const colleges = [];
  for (let i = 0; i < lenOrigColleges; i++) {
    const origCollege = origColleges[i];
    for (let j = 0; j < lenCwd; j++) {
      const cwdCollege = collegesWithDistance[j];
      if (
        _.get(origCollege, "ipedsid") &&
        _.get(cwdCollege, "properties.ipedsid") &&
        origCollege.ipedsid === cwdCollege.properties.ipedsid
      ) {
        colleges.push(origCollege);
      }
    }
  }
  await fs.writeFileSync("./data/colleges_with_distance.json", JSON.stringify(colleges));
  console.log("Json file for colleges with distance written", colleges.length);
};

const _cleanProperties = (college) => {
  if (_.get(college, "properties.latitude")) {
    college.properties.latitude = parseFloat(college.properties.latitude).toFixed(5);
  }
  if (_.get(college, "properties.longitude")) {
    college.properties.longitude = parseFloat(college.properties.longitude).toFixed(5);
  }
  if (_.get(college, "properties.zip4")) {
    delete college.properties.zip4;
  }
  if (_.get(college, "properties.telephone")) {
    delete college.properties.telephone;
  }
  if (_.get(college, "properties.country")) {
    delete college.properties.country;
  }
  if (_.get(college, "properties.objectid")) {
    delete college.properties.objectid;
  }
  if (_.get(college, "properties.x")) {
    delete college.properties.x;
  }
  if (_.get(college, "properties.y")) {
    delete college.properties.y;
  }
  if (_.get(college, "properties.sourcedate")) {
    delete college.properties.sourcedate;
  }
  if (_.get(college, "properties.val_method")) {
    delete college.properties.val_method;
  }
  if (_.get(college, "properties.val_date")) {
    delete college.properties.val_date;
  }
  if (_.get(college, "properties.merge_id")) {
    delete college.properties.merge_id;
  }
  if (_.get(college, "properties.close_date")) {
    delete college.properties.close_date;
  }
  if (_.get(college, "properties.locale")) {
    delete college.properties.locale;
  }
};

(async () => {
  await _process();
})();

