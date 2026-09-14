const fs = require("node:fs");
const path = require("node:path");

function readData() {
  const dataPath = path.join(process.cwd(), "data.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end("Method Not Allowed");
    return;
  }

  const data = readData();
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(data.settings || {}));
};
