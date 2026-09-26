

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET_KEY"; // must match server.js's jwt.sign call

function resolveSession(req, res, next) {
  let sessionId = req.headers["x-session-id"];
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.setHeader("X-Session-Id", sessionId);
  }

  let userId = null;
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET);
      userId = decoded.id; // matches jwt.sign({ id: user._id, ... }) in server.js
    } catch (err) {
      // Expired or invalid token — proceed as anonymous rather than
      // failing the whole request; search/browse should still work.
      console.warn("[session] invalid/expired token, proceeding as anonymous:", err.message);
    }
  }

  req.sessionId = sessionId;
  req.userId = userId;
  next();
}

module.exports = { resolveSession };