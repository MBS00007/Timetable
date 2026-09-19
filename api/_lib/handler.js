/**
 * Shared handler utilities for Vercel serverless functions.
 * Provides CORS, JSON body parsing, and error handling.
 */

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  setCorsHeaders(res);
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

/**
 * Parse JSON body from the request.
 * Vercel may already parse it; this handles both cases.
 */
async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

module.exports = { setCorsHeaders, sendJson, sendError, parseBody };
