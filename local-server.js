const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const dataPath = path.join(__dirname, "data.json");
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function readData() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}
function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(body));
}
function serveFile(response, requestPath) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(__dirname, safePath);
  if (
    !filePath.startsWith(__dirname) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    sendJson(response, 404, { error: "File not found" });
    return;
  }
  response.writeHead(200, {
    "Content-Type":
      mimeTypes[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}
const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/api/health")
    return sendJson(response, 200, {
      ok: true,
      service: "Northwest University timetable",
    });
  if (request.method === "GET" && url.pathname === "/api/timetable")
    return sendJson(response, 200, readData().timetable);
  if (request.method === "GET" && url.pathname === "/api/announcements")
    return sendJson(response, 200, readData().announcements);
  if (request.method === "GET" && url.pathname === "/api/settings")
    return sendJson(response, 200, readData().settings);
  if (request.method === "GET")
    return serveFile(response, decodeURIComponent(url.pathname));
  response.writeHead(405, { Allow: "GET" });
  response.end("Method Not Allowed");
});
server.listen(port, () =>
  console.log(`Timetable server running at http://localhost:${port}`),
);
