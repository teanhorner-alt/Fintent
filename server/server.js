require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(cookieParser());

const isProd = process.env.NODE_ENV === "production";
const COOKIE_NAME = "fintent_session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

function setSessionCookie(res, email, sessionVersion) {
  const token = jwt.sign({ email, v: sessionVersion || 0 }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function publicAccount(a) {
  if (!a) return null;
  const { passwordHash, sessionVersion, ...safe } = a;
  return safe;
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.email = decoded.email;
    req.tokenVersion = decoded.v || 0;
    next();
  } catch (_) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

async function loadAuthedAccount(req, res) {
  const account = await db.getAccount(req.email);
  if (!account) {
    res.status(401).json({ error: "Account no longer exists." });
    return null;
  }
  if ((account.sessionVersion || 0) !== req.tokenVersion) {
    res.status(401).json({ error: "Session expired. Please sign in again." });
    return null;
  }
  return account;
}

// Internal endpoints (counts / seed) are gated behind a shared secret header,
// not exposed in the UI. Set ADMIN_KEY in the environment to use them.
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: "ADMIN_KEY is not configured on the server." });
  if (req.get("x-admin-key") !== ADMIN_KEY) return res.status(401).json({ error: "Invalid admin key." });
  next();
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

app.post("/api/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
    return res.status(400).json({ error: "Fill in every field before you continue." });
  }
  const normEmail = (email || "").trim().toLowerCase();
  if (!isValidEmail(normEmail)) return res.status(400).json({ error: "That doesn't look like a valid email address." });
  if (!password || password.length < 6) return res.status(400).json({ error: "Your password needs at least 6 characters." });

  const existing = await db.getAccount(normEmail);
  if (existing) return res.status(409).json({ error: "An account with that email already exists. Try logging in instead." });

  const account = {
    email: normEmail,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    passwordHash: await bcrypt.hash(password, 10),
    sessionVersion: 0,
  };
  await db.saveAccount(account);
  await db.saveUserData(normEmail, { transactions: [], goals: [], bills: [] });
  setSessionCookie(res, account.email, account.sessionVersion);
  res.status(201).json({ user: publicAccount(account) });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail || !password) return res.status(400).json({ error: "Enter your email and password to log in." });

  const account = await db.getAccount(normEmail);
  if (!account) return res.status(401).json({ error: "We couldn't find an account with that email and password." });

  const ok = await bcrypt.compare(password, account.passwordHash);
  if (!ok) return res.status(401).json({ error: "We couldn't find an account with that email and password." });

  setSessionCookie(res, account.email, account.sessionVersion || 0);
  res.json({ user: publicAccount(account) });
});

app.post("/api/logout", requireAuth, async (req, res) => {
  const account = await db.getAccount(req.email);
  if (account) {
    account.sessionVersion = (account.sessionVersion || 0) + 1;
    await db.saveAccount(account);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const account = await loadAuthedAccount(req, res);
  if (!account) return;
  res.json({ user: publicAccount(account) });
});

app.get("/api/data", requireAuth, async (req, res) => {
  const account = await loadAuthedAccount(req, res);
  if (!account) return;
  const data = await db.getUserData(account.email);
  res.json({ data });
});

app.patch("/api/data", requireAuth, async (req, res) => {
  const account = await loadAuthedAccount(req, res);
  if (!account) return;
  const incoming = req.body || {};
  const data = {
    transactions: Array.isArray(incoming.transactions) ? incoming.transactions : [],
    goals: Array.isArray(incoming.goals) ? incoming.goals : [],
    bills: Array.isArray(incoming.bills) ? incoming.bills : [],
  };
  await db.saveUserData(account.email, data);
  res.json({ data });
});

// Internal — not linked anywhere in the UI. Requires the x-admin-key header.
app.get("/api/_internal/counts", requireAdmin, async (req, res) => {
  const accounts = await db.accountCount();
  const totals = await db.totals();
  res.json({ accounts, ...totals });
});

app.get("/api/_internal/accounts", requireAdmin, async (req, res) => {
  const accounts = await db.allAccountsBasic();
  res.json({ accounts });
});

app.post("/api/_internal/seed", requireAdmin, async (req, res) => {
  const count = Math.min(parseInt(req.body?.count, 10) || 130, 500);
  const result = await require("./seed").seed(count);
  res.json(result);
});

// Serve the built React app for everything else.
const buildDir = path.join(__dirname, "..", "build");
app.use(express.static(buildDir));
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  (async () => {
    await db.init();
    app.listen(PORT, () => console.log(`Fintent server running on port ${PORT}`));
  })();
}
module.exports = app;
