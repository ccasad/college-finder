const _ = require("lodash");
const fs = require("fs");

const _process = async () => {
  const result = await fs.readFileSync("./data/colleges_with_distance.json", "utf8");
  const allColleges = JSON.parse(result);
  let data = "ipeds_id,school_name,school_url\n";

  allColleges.forEach((college) => {
    data += `${college.ipedsid},${college.name},${college.website}\n`;
  });
  
  await fs.writeFileSync("./data/partial.csv", data);
  console.log("DONE");
};

(async () => {
  await _process();
})();

