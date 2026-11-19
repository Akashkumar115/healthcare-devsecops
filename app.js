const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// Justification: API uses Bearer-token (Authorization header) auth, not cookies, so CSRF does not apply.
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

// Secret comes from the environment (a Kubernetes Secret in production), never hard-coded
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

// Rate limiting: slows brute-force attacks
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100 }));
const loginLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5 });

// Demo users (passwords are stored as bcrypt hashes, never as plain text)
const users = [
  { username: "dr.smith", role: "doctor", hash: bcrypt.hashSync("Doctor@123", 10) },
  { username: "nurse.jones", role: "nurse", hash: bcrypt.hashSync("Nurse@123", 10) },
  { username: "admin.lee", role: "admin", hash: bcrypt.hashSync("Admin@123", 10) },
];

// FAKE patient data for demonstration only
const patients = [
  { id: 1, name: "Test Patient A", diagnosis: "Hypertension" },
  { id: 2, name: "Test Patient B", diagnosis: "Type 2 Diabetes" },
];

// Audit log: who did what, when (HIPAA audit controls)
function audit(req, action, outcome) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    user: req.user ? req.user.username : "anonymous",
    ip: req.ip,
    action,
    outcome,
  }));
}

// Authentication middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    audit(req, "access " + req.path, "denied: no token");
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    audit(req, "access " + req.path, "denied: bad token");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Role-based access control
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      audit(req, "access " + req.path, "denied: role " + req.user.role);
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username);
  if (!user || typeof password !== "string" || !bcrypt.compareSync(password, user.hash)) {
    audit(req, "login " + username, "failed");
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
  audit({ user, ip: req.ip }, "login", "success");
  res.json({ token });
});

// Doctors and nurses can read patient records
app.get("/patients", authenticate, requireRole("doctor", "nurse"), (req, res) => {
  audit(req, "read patients", "allowed");
  res.json(patients);
});

// Only doctors can add or change records
app.post("/patients", authenticate, requireRole("doctor"), (req, res) => {
  const { name, diagnosis } = req.body || {};
  if (typeof name !== "string" || typeof diagnosis !== "string" || !name || !diagnosis) {
    return res.status(400).json({ error: "name and diagnosis are required strings" });
  }
  const patient = { id: patients.length + 1, name: name.slice(0, 100), diagnosis: diagnosis.slice(0, 200) };
  patients.push(patient);
  audit(req, "create patient " + patient.id, "allowed");
  res.status(201).json(patient);
});

app.listen(3000, () => console.log("Healthcare API running on 3000"));