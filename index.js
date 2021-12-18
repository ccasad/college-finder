const _ = require("lodash");
const fs = require("fs");

// * DONE export each distance buffer layer into it's own geojson file
// * loop through all the colleges in colleges.geojson to find which ones are within each distance buffer
//   

// https://docs.traveltime.com/api/reference/isochrones
// Application ID: 36c52bfc
// API key:  b1a8a6f648bb1e3b030825f152df8177

const data = await fs.readFileSync("./colleges.geojson", "utf8");
console.log(data);
