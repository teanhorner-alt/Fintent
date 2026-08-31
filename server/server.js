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

// A private, browser-viewable dashboard for the counts above. Not linked
// anywhere in the app's UI — you have to know this exact URL. It asks for
// your admin key client-side and only then calls the JSON endpoints above.
app.get("/admin", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Fintent — internal counts</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #111; color: #eee; padding: 40px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { color: #999; margin-top: 0; font-size: 13px; }
  input, button { font-size: 14px; padding: 8px 10px; border-radius: 6px; border: 1px solid #444; background: #1b1b1b; color: #eee; }
  button { cursor: pointer; background: #d4af37; color: #1b1508; font-weight: 600; border: none; }
  .row { display: flex; gap: 8px; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid #333; border-radius: 8px; padding: 16px; }
  .card .n { font-size: 28px; font-weight: 700; }
  .card .label { color: #999; font-size: 13px; }
  #error { color: #ff6b6b; font-size: 13px; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #222; }
  th { color: #999; font-weight: 500; }
</style>
</head>
<body>
  <h1>Fintent — internal counts</h1>
  <p class="sub">Private dashboard. Nobody sees this without your admin key.</p>
  <div class="row">
    <input id="key" type="password" placeholder="Admin key" style="flex:1" />
    <button onclick="load()">View</button>
  </div>
  <div id="error"></div>
  <div id="results"></div>

  <script>
    const savedKey = sessionStorage.getItem('fintent_admin_key');
    if (savedKey) document.getElementById('key').value = savedKey;

    async function load() {
      const key = document.getElementById('key').value.trim();
      const errorEl = document.getElementById('error');
      const resultsEl = document.getElementById('results');
      errorEl.textContent = '';
      resultsEl.innerHTML = '';
      if (!key) { errorEl.textContent = 'Enter your admin key.'; return; }
      sessionStorage.setItem('fintent_admin_key', key);

      try {
        const countsRes = await fetch('/api/_internal/counts', { headers: { 'x-admin-key': key } });
        const counts = await countsRes.json();
        if (!countsRes.ok) { errorEl.textContent = counts.error || 'Request failed.'; return; }

        resultsEl.innerHTML = \`
          <div class="cards">
            <div class="card"><div class="n">\${counts.accounts}</div><div class="label">accounts</div></div>
            <div class="card"><div class="n">\${counts.transactions}</div><div class="label">transactions</div></div>
            <div class="card"><div class="n">\${counts.goals}</div><div class="label">goals</div></div>
            <div class="card"><div class="n">\${counts.bills}</div><div class="label">bills</div></div>
          </div>
        \`;

        const accountsRes = await fetch('/api/_internal/accounts', { headers: { 'x-admin-key': key } });
        const accountsData = await accountsRes.json();
        if (accountsRes.ok && Array.isArray(accountsData.accounts)) {
          const rows = accountsData.accounts
            .slice()
            .reverse()
            .slice(0, 25)
            .map(a => \`<tr><td>\${a.firstName} \${a.lastName}</td><td>\${a.email}</td><td>\${new Date(a.createdAt).toLocaleString()}</td></tr>\`)
            .join('');
          resultsEl.innerHTML += \`
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Created</th></tr></thead>
              <tbody>\${rows}</tbody>
            </table>
            <p class="sub">Showing the 25 most recent of \${accountsData.accounts.length} accounts.</p>
          \`;
        }
      } catch (e) {
        errorEl.textContent = 'Could not reach the server.';
      }
    }

    if (savedKey) load();
  </script>
</body>
</html>`);
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
