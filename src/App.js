import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  Receipt,
  TrendingUp,
  User,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------
const C = {
  ink: "#1c4f70",
  inkSoft: "#256589",
  inkLine: "#3a84ab",
  parchment: "#e9f4fb",
  parchmentSoft: "#ffffff",
  parchmentLine: "#cbe3f0",
  gold: "#1f8fd6",
  goldSoft: "#bfe4fa",
  teal: "#12967a",
  tealSoft: "#d6efe9",
  brick: "#e0543a",
  brickSoft: "#fbdcd5",
  textDark: "#122c3d",
  textLight: "#eaf6fc",
  muted: "#4c7690",
  mutedLight: "#8fb9cf",
};

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transportation",
  "Dining",
  "Entertainment",
  "Health",
  "Shopping",
  "Other",
];
const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other",
];

const CATEGORY_COLORS = {
  Groceries: "#3f6b64",
  Rent: "#a8452f",
  Utilities: "#c99a3b",
  Transportation: "#5b7ea3",
  Dining: "#8a5b8f",
  Entertainment: "#b57b3f",
  Health: "#4f8a6d",
  Shopping: "#a35b7e",
  Other: "#8a8272",
};

const money = (n) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const todayStr = () => toDateStr(new Date());

let uidCounter = 0;
const uid = () => {
  uidCounter += 1;
  return `${Date.now()}-${uidCounter}`;
};

const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
};

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------
function withTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function storageGet(key) {
  try {
    const res = await withTimeout(window.storage.get(key, false));
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch {
    // ignore, app still works in-memory for this session
  }
}
async function storageDelete(key) {
  try {
    await window.storage.delete(key, false);
  } catch {
    // ignore
  }
}

function emptyUserData() {
  return { transactions: [], goals: [], bills: [], timelineGoals: [] };
}

// ---------------------------------------------------------------------------
// small shared bits
// ---------------------------------------------------------------------------
function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span
        className="block text-xs uppercase tracking-wide mb-1.5"
        style={{
          color: C.mutedLight,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  background: C.inkSoft,
  border: `1px solid ${C.inkLine}`,
  color: C.textLight,
  borderRadius: "6px",
  padding: "10px 12px",
  fontSize: "14px",
  outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function SelectInput(props) {
  return (
    <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />
  );
}

function Stamp({ text, color }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.03em",
        color: color,
        border: `1px dashed ${color}`,
        borderRadius: "4px",
        padding: "2px 8px",
        transform: "rotate(-1.5deg)",
        background: "rgba(255,255,255,0.35)",
      }}
    >
      {text}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.parchmentSoft,
        border: `1px solid ${C.parchmentLine}`,
        borderRadius: "10px",
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionIntro({ title, text }) {
  return (
    <div className="mb-6">
      <h1
        style={{
          fontFamily: "'Zilla Slab', serif",
          color: C.textDark,
          fontSize: "28px",
          fontWeight: 600,
          marginBottom: "6px",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          color: C.muted,
          fontSize: "14.5px",
          maxWidth: "620px",
          lineHeight: 1.5,
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// auth screen
// ---------------------------------------------------------------------------
function AuthScreen({ users, onSignup, onLogin }) {
  const [mode, setMode] = useState("login");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const submit = async () => {
    setError("");
    const email = form.email.trim().toLowerCase();

    if (mode === "signup") {
      if (
        !form.firstName.trim() ||
        !form.lastName.trim() ||
        !email ||
        !form.password
      ) {
        setError("Fill in every field before you continue.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("That doesn't look like a valid email address.");
        return;
      }
      if (form.password.length < 6) {
        setError("Your password needs at least 6 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Those two passwords don't match.");
        return;
      }
      const freshUsers = (await storageGet("users")) || users;
      if (freshUsers.some((u) => u.email === email)) {
        setError(
          "An account with that email already exists. Try logging in instead."
        );
        return;
      }
      onSignup({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email,
        password: form.password,
      });
    } else {
      if (!email || !form.password) {
        setError("Enter your email and password to log in.");
        return;
      }
      const freshUsers = (await storageGet("users")) || users;
      const match = freshUsers.find(
        (u) => u.email === email && u.password === form.password
      );
      if (!match) {
        setError("We couldn't find an account with that email and password.");
        return;
      }
      onLogin(match);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: C.ink }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            style={{
              fontFamily: "'Zilla Slab', serif",
              fontSize: "34px",
              fontWeight: 700,
              color: C.textLight,
              letterSpacing: "-0.01em",
            }}
          >
            Fint<span style={{ color: C.gold }}>ent</span>
          </div>
          <p
            style={{
              color: C.mutedLight,
              fontSize: "13.5px",
              marginTop: "6px",
            }}
          >
            Track your income and expenses, all in one place.
          </p>
        </div>

        <div
          style={{
            background: C.inkSoft,
            border: `1px solid ${C.inkLine}`,
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <div
            className="flex mb-6"
            style={{ borderBottom: `1px solid ${C.inkLine}` }}
          >
            {["login", "signup"].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: mode === m ? C.gold : C.mutedLight,
                  borderBottom:
                    mode === m
                      ? `2px solid ${C.gold}`
                      : "2px solid transparent",
                  marginBottom: "-1px",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div onKeyDown={(e) => e.key === "Enter" && submit()}>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <TextInput
                    value={form.firstName}
                    onChange={update("firstName")}
                  />
                </Field>
                <Field label="Last name">
                  <TextInput
                    value={form.lastName}
                    onChange={update("lastName")}
                  />
                </Field>
              </div>
            )}

            <Field label="Email">
              <TextInput
                type="email"
                value={form.email}
                onChange={update("email")}
              />
            </Field>

            <Field label="Password">
              <TextInput
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
              />
            </Field>

            {mode === "signup" && (
              <Field label="Confirm password">
                <TextInput
                  type={showPw ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                />
              </Field>
            )}

            <label
              className="flex items-center gap-2 mb-4"
              style={{
                fontSize: "12.5px",
                color: C.mutedLight,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={showPw}
                onChange={() => setShowPw((s) => !s)}
                style={{ cursor: "pointer" }}
              />
              Show password
            </label>

            {error && (
              <div
                style={{
                  color: C.brick,
                  background: "rgba(168,69,47,0.12)",
                  border: `1px solid ${C.brick}`,
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              style={{
                width: "100%",
                background: C.gold,
                color: "#1b1508",
                fontWeight: 700,
                padding: "11px 0",
                borderRadius: "6px",
                fontSize: "14.5px",
                cursor: "pointer",
              }}
            >
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </div>
        </div>

        <p
          style={{
            color: C.mutedLight,
            fontSize: "12px",
            textAlign: "center",
            marginTop: "18px",
          }}
        >
          Built by Dhyan Subramani.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------
function Dashboard({ transactions }) {
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const netWorth = totalIncome - totalExpense;

  const byMonth = {};
  transactions.forEach((t) => {
    const ym = t.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = { ym, income: 0, expense: 0 };
    byMonth[ym][t.type] += t.amount;
  });
  let monthly = Object.values(byMonth)
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .slice(-8)
    .map((m) => ({ ...m, label: monthLabel(m.ym) }));

  // a single point can't draw a line, so give it a zero baseline the month
  // before so the chart always shows an actual, readable line
  if (monthly.length === 1) {
    const [y, m] = monthly[0].ym.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevYm = `${prev.getFullYear()}-${String(
      prev.getMonth() + 1
    ).padStart(2, "0")}`;
    monthly = [
      { ym: prevYm, income: 0, expense: 0, label: monthLabel(prevYm) },
      ...monthly,
    ];
  }

  const byCategory = {};
  expenses.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const stat = (label, value, icon, color, big) => (
    <Card style={{ flex: 1 }}>
      <div className="flex items-center justify-between mb-2">
        <span
          style={{
            fontSize: "12.5px",
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: big ? "34px" : "24px",
          fontWeight: 600,
          color: C.textDark,
        }}
      >
        {money(value)}
      </div>
    </Card>
  );

  return (
    <div>
      <SectionIntro
        title="Dashboard"
        text="This is the quick look at where things stand. It pulls straight from what you log in the tracker, so it changes as your numbers do."
      />

      <div className="mb-4">
        {stat("Cash left", netWorth, <Wallet size={20} />, C.gold, true)}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {stat("Total income", totalIncome, <ArrowUpRight size={18} />, C.teal)}
        {stat(
          "Total expenses",
          totalExpense,
          <ArrowDownRight size={18} />,
          C.brick
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3
            style={{
              fontFamily: "'Zilla Slab', serif",
              fontSize: "17px",
              color: C.textDark,
              marginBottom: "4px",
            }}
          >
            Income and expenses over time
          </h3>
          <p
            style={{ fontSize: "12.5px", color: C.muted, marginBottom: "10px" }}
          >
            Each point is a month you have entries for.
          </p>
          {monthly.length === 0 ? (
            <EmptyNote text="Add a few entries in the tracker and this chart will fill in." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly}>
                <CartesianGrid stroke={C.parchmentLine} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: C.muted }}
                  axisLine={{ stroke: C.parchmentLine }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(v) => money(v)}
                  contentStyle={{
                    fontSize: 13,
                    borderRadius: 8,
                    borderColor: C.parchmentLine,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke={C.teal}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke={C.brick}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3
            style={{
              fontFamily: "'Zilla Slab', serif",
              fontSize: "17px",
              color: C.textDark,
              marginBottom: "4px",
            }}
          >
            Where expenses are going
          </h3>
          <p
            style={{ fontSize: "12.5px", color: C.muted, marginBottom: "10px" }}
          >
            Every expense you've logged, grouped by category.
          </p>
          {pieData.length === 0 ? (
            <EmptyNote text="No expenses logged yet, so there's nothing to break down." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={CATEGORY_COLORS[entry.name] || C.muted}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => money(v)}
                  contentStyle={{
                    fontSize: 13,
                    borderRadius: 8,
                    borderColor: C.parchmentLine,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div
      style={{
        height: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.muted,
        fontSize: "13.5px",
        textAlign: "center",
        border: `1px dashed ${C.parchmentLine}`,
        borderRadius: "8px",
        padding: "0 20px",
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// tracker
// ---------------------------------------------------------------------------
function Tracker({ transactions, setTransactions }) {
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("all");
  const [formError, setFormError] = useState("");

  const categories =
    type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const changeType = (t) => {
    setType(t);
    setCategory(t === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const addTransaction = () => {
    setFormError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!date) {
      setFormError("Pick a date for this entry.");
      return;
    }
    if (date > todayStr()) {
      setFormError("You can't log something that hasn't happened yet.");
      return;
    }
    setTransactions((prev) => [
      {
        id: uid(),
        type,
        category,
        amount: amt,
        date,
        description: description.trim(),
      },
      ...prev,
    ]);
    setAmount("");
    setDescription("");
  };

  const remove = (id) =>
    setTransactions((prev) => prev.filter((t) => t.id !== id));

  const now = new Date();
  const thisMonth = toDateStr(now).slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = toDateStr(lastMonthDate).slice(0, 7);

  const filtered = transactions
    .filter((t) => {
      if (filter === "this") return t.date.slice(0, 7) === thisMonth;
      if (filter === "last") return t.date.slice(0, 7) === lastMonth;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <SectionIntro
        title="Tracker"
        text="Log money as it comes in or goes out. Pick a type, a category, an amount, and a date, and it lands in the list below right away."
      />

      <Card style={{ marginBottom: "20px" }}>
        <div onKeyDown={(e) => e.key === "Enter" && addTransaction()}>
          <div className="flex gap-2 mb-4">
            {["expense", "income"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    type === t
                      ? t === "expense"
                        ? C.brick
                        : C.teal
                      : "transparent",
                  color: type === t ? "#fff" : C.textDark,
                  border: `1px solid ${
                    type === t ? "transparent" : C.parchmentLine
                  }`,
                }}
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <div>
              <span
                style={{
                  fontSize: "12px",
                  color: C.muted,
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Category
              </span>
              <SelectInput
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={darkToLight()}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <span
                style={{
                  fontSize: "12px",
                  color: C.muted,
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Amount
              </span>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={darkToLight()}
              />
            </div>
            <div>
              <span
                style={{
                  fontSize: "12px",
                  color: C.muted,
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Date
              </span>
              <TextInput
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                style={darkToLight()}
              />
            </div>
            <div>
              <span
                style={{
                  fontSize: "12px",
                  color: C.muted,
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                What was it
              </span>
              <TextInput
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={darkToLight()}
              />
            </div>
          </div>

          {formError && (
            <div
              style={{ color: C.brick, fontSize: "13px", marginTop: "10px" }}
            >
              {formError}
            </div>
          )}

          <button
            type="button"
            onClick={addTransaction}
            className="flex items-center gap-2"
            style={{
              marginTop: "14px",
              background: C.textDark,
              color: C.parchmentSoft,
              padding: "9px 18px",
              borderRadius: "6px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={15} /> Add entry
          </button>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h3
          style={{
            fontFamily: "'Zilla Slab', serif",
            fontSize: "17px",
            color: C.textDark,
          }}
        >
          Everything you've logged
        </h3>
        <SelectInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...darkToLight(), width: "auto" }}
        >
          <option value="all">All time</option>
          <option value="this">This month</option>
          <option value="last">Last month</option>
        </SelectInput>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "30px" }}>
            <EmptyNote text="Nothing here yet for this range. Add your first entry above." />
          </div>
        ) : (
          <div>
            {filtered.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between"
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    i === filtered.length - 1
                      ? "none"
                      : `1px solid ${C.parchmentLine}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Stamp
                    text={t.category}
                    color={CATEGORY_COLORS[t.category] || C.muted}
                  />
                  <div>
                    <div style={{ fontSize: "14px", color: C.textDark }}>
                      {t.description || t.category}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: C.muted,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {t.date}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                      color: t.type === "income" ? C.teal : C.brick,
                    }}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {money(t.amount)}
                  </span>
                  <button
                    onClick={() => remove(t.id)}
                    style={{ color: C.muted, background: "none" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// inputs inside light cards need a light variant
function darkToLight() {
  return {
    background: "#fff",
    border: `1px solid ${C.parchmentLine}`,
    color: C.textDark,
  };
}

// ---------------------------------------------------------------------------
// savings goals
// ---------------------------------------------------------------------------
function Savings({ goals, setGoals }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [contribInputs, setContribInputs] = useState({});

  const addGoal = () => {
    setError("");
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) {
      setError("Give your goal a name and a target above zero.");
      return;
    }
    if (deadline && deadline < todayStr()) {
      setError(
        "That date is in the past. Pick one that's still ahead of you, or leave it blank."
      );
      return;
    }
    setGoals((prev) => [
      ...prev,
      {
        id: uid(),
        name: name.trim(),
        target: t,
        current: 0,
        deadline: deadline || null,
        startDate: deadline ? todayStr() : null,
      },
    ]);
    setName("");
    setTarget("");
    setDeadline("");
  };

  const contribute = (id) => {
    const amt = parseFloat(contribInputs[id]);
    if (!amt || amt <= 0) return;
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, current: g.current + amt } : g))
    );
    setContribInputs((c) => ({ ...c, [id]: "" }));
  };

  const remove = (id) => setGoals((prev) => prev.filter((g) => g.id !== id));

  return (
    <div>
      <SectionIntro
        title="Savings goals"
        text="Set a target for whatever you're saving toward and add to it whenever you have money to put away. Give it a date too if it's something like a vacation or a car, and Fintent will work out how much to save each month and let you know if you're falling behind."
      />

      <Card style={{ marginBottom: "20px" }}>
        <div
          onKeyDown={(e) => e.key === "Enter" && addGoal()}
          className="flex flex-wrap gap-3 items-end"
        >
          <div style={{ flex: "2 1 200px" }}>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Goal name
            </span>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Target amount
            </span>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Have it by (optional)
            </span>
            <TextInput
              type="date"
              min={todayStr()}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <button
            type="button"
            onClick={addGoal}
            className="flex items-center gap-2"
            style={{
              background: C.textDark,
              color: C.parchmentSoft,
              padding: "9px 18px",
              borderRadius: "6px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
              height: "40px",
            }}
          >
            <Plus size={15} /> Add goal
          </button>
        </div>
        {error && (
          <div style={{ color: C.brick, fontSize: "13px", marginTop: "10px" }}>
            {error}
          </div>
        )}
      </Card>

      {goals.length === 0 ? (
        <Card>
          <EmptyNote text="You haven't set up a savings goal yet. Add one above to start." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current / g.target) * 100);
            const reached = g.current >= g.target;

            let daysLeft = null,
              behind = false,
              overdue = false,
              perMonth = 0,
              remaining = 0;
            if (g.deadline) {
              const targetDate = new Date(g.deadline + "T00:00:00");
              const start = new Date((g.startDate || todayStr()) + "T00:00:00");
              const now = new Date(todayStr() + "T00:00:00");
              const totalDays = Math.max(1, (targetDate - start) / 86400000);
              daysLeft = Math.ceil((targetDate - now) / 86400000);
              const elapsedDays = Math.min(
                totalDays,
                Math.max(0, (now - start) / 86400000)
              );
              const expectedPct = Math.min(
                100,
                (elapsedDays / totalDays) * 100
              );
              overdue = !reached && daysLeft < 0;
              behind = !reached && daysLeft >= 0 && pct + 5 < expectedPct;
              remaining = Math.max(0, g.target - g.current);
              const monthsLeft = daysLeft > 0 ? daysLeft / 30.44 : 0.03;
              perMonth = daysLeft > 0 ? remaining / monthsLeft : remaining;
            }

            return (
              <Card key={g.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3
                    style={{
                      fontFamily: "'Zilla Slab', serif",
                      fontSize: "16.5px",
                      color: C.textDark,
                    }}
                  >
                    {g.name}
                  </h3>
                  <button
                    onClick={() => remove(g.id)}
                    style={{ color: C.muted, background: "none" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: C.muted,
                    marginBottom: "8px",
                  }}
                >
                  {money(g.current)} saved toward {money(g.target)}
                  {reached && (
                    <span style={{ color: C.teal, marginLeft: "8px" }}>
                      <CheckCircle2
                        size={13}
                        style={{ display: "inline", marginBottom: "2px" }}
                      />{" "}
                      reached
                    </span>
                  )}
                </div>
                <div
                  style={{
                    background: "#e5ddc8",
                    borderRadius: "999px",
                    height: "10px",
                    overflow: "hidden",
                    marginBottom: g.deadline ? "10px" : "12px",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      background: reached
                        ? C.teal
                        : behind || overdue
                        ? C.brick
                        : C.gold,
                      height: "100%",
                    }}
                  />
                </div>

                {g.deadline && (
                  <div
                    className="flex items-center gap-2 mb-2"
                    style={{ fontSize: "12.5px" }}
                  >
                    <CalendarClock size={14} color={C.muted} />
                    <span style={{ color: C.muted }}>
                      {reached
                        ? `Set for ${g.deadline}`
                        : overdue
                        ? `Was due ${g.deadline}`
                        : daysLeft === 0
                        ? "Due today"
                        : `${daysLeft} day${
                            daysLeft === 1 ? "" : "s"
                          } left, due ${g.deadline}`}
                    </span>
                  </div>
                )}

                {g.deadline && !reached && (
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: overdue || behind ? C.brick : C.teal,
                      background:
                        overdue || behind
                          ? "rgba(224,84,58,0.1)"
                          : "rgba(18,150,122,0.1)",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      marginBottom: "12px",
                    }}
                  >
                    {overdue
                      ? `This one's past its date and still short by ${money(
                          remaining
                        )}.`
                      : behind
                      ? `You're behind pace. Save about ${money(
                          perMonth
                        )} a month to catch up by the date.`
                      : `On pace. About ${money(
                          perMonth
                        )} a month keeps you on track.`}
                  </div>
                )}

                <span
                  style={{
                    fontSize: "12px",
                    color: C.muted,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Put money toward this goal
                </span>
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={contribInputs[g.id] || ""}
                    onChange={(e) =>
                      setContribInputs((c) => ({
                        ...c,
                        [g.id]: e.target.value,
                      }))
                    }
                    style={{ ...darkToLight(), flex: 1 }}
                  />
                  <button
                    onClick={() => contribute(g.id)}
                    style={{
                      background: C.teal,
                      color: "#fff",
                      padding: "0 16px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add money
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// bills
// ---------------------------------------------------------------------------
function Bills({ bills, setBills }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayStr());
  const [frequency, setFrequency] = useState("monthly");
  const [error, setError] = useState("");

  const addBill = () => {
    setError("");
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0 || !dueDate) {
      setError("Fill in a name, an amount, and a due date.");
      return;
    }
    setBills((prev) => [
      ...prev,
      {
        id: uid(),
        name: name.trim(),
        amount: amt,
        dueDate,
        frequency,
        paid: false,
      },
    ]);
    setName("");
    setAmount("");
  };

  const remove = (id) => setBills((prev) => prev.filter((b) => b.id !== id));

  const advance = (id) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.frequency === "one-time") return { ...b, paid: true };
        const d = new Date(b.dueDate + "T00:00:00");
        const day = d.getDate();
        if (b.frequency === "weekly") {
          d.setDate(day + 7);
        } else if (b.frequency === "monthly") {
          d.setDate(1);
          d.setMonth(d.getMonth() + 1);
          const lastDay = new Date(
            d.getFullYear(),
            d.getMonth() + 1,
            0
          ).getDate();
          d.setDate(Math.min(day, lastDay));
        } else if (b.frequency === "yearly") {
          const targetYear = d.getFullYear() + 1;
          const lastDay = new Date(targetYear, d.getMonth() + 1, 0).getDate();
          d.setFullYear(targetYear);
          d.setDate(Math.min(day, lastDay));
        }
        return { ...b, dueDate: toDateStr(d) };
      })
    );
  };

  const sorted = [...bills].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return (
    <div>
      <SectionIntro
        title="Bills and recurring payments"
        text="Keep everything that repeats in one spot, rent, subscriptions, utilities, whatever it is. Anything due within a week gets flagged so it doesn't sneak past you."
      />

      <Card style={{ marginBottom: "20px" }}>
        <div
          onKeyDown={(e) => e.key === "Enter" && addBill()}
          className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
        >
          <div style={{ gridColumn: "span 2" }}>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Bill name
            </span>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <div>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Amount
            </span>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <div>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Due date
            </span>
            <TextInput
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={darkToLight()}
            />
          </div>
          <div>
            <span
              style={{
                fontSize: "12px",
                color: C.muted,
                display: "block",
                marginBottom: "5px",
              }}
            >
              Repeats
            </span>
            <SelectInput
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={darkToLight()}
            >
              <option value="one-time">One time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </SelectInput>
          </div>
          <button
            type="button"
            onClick={addBill}
            className="flex items-center gap-2 justify-center"
            style={{
              gridColumn: "span 1",
              background: C.textDark,
              color: C.parchmentSoft,
              padding: "9px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              height: "40px",
            }}
          >
            <Plus size={15} /> Add
          </button>
        </div>
        {error && (
          <div style={{ color: C.brick, fontSize: "13px", marginTop: "10px" }}>
            {error}
          </div>
        )}
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <EmptyNote text="No bills on the books yet. Add one above to keep track of it." />
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {sorted.map((b, i) => {
            const days = Math.ceil(
              (new Date(b.dueDate + "T00:00:00") -
                new Date(todayStr() + "T00:00:00")) /
                86400000
            );
            const overdue = days < 0 && !b.paid;
            const dueSoon = days >= 0 && days <= 7 && !b.paid;
            return (
              <div
                key={b.id}
                className="flex items-center justify-between"
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    i === sorted.length - 1
                      ? "none"
                      : `1px solid ${C.parchmentLine}`,
                  borderLeft: overdue
                    ? `3px solid ${C.brick}`
                    : dueSoon
                    ? `3px solid ${C.gold}`
                    : "3px solid transparent",
                  opacity: b.paid ? 0.55 : 1,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: C.textDark,
                      fontWeight: 500,
                    }}
                  >
                    {b.name}{" "}
                    {overdue && (
                      <span
                        style={{
                          color: C.brick,
                          fontSize: "12px",
                          marginLeft: "6px",
                        }}
                      >
                        overdue
                      </span>
                    )}
                    {dueSoon && (
                      <span
                        style={{
                          color: "#8a6a1e",
                          fontSize: "12px",
                          marginLeft: "6px",
                        }}
                      >
                        due soon
                      </span>
                    )}
                    {b.paid && (
                      <span
                        style={{
                          color: C.teal,
                          fontSize: "12px",
                          marginLeft: "6px",
                        }}
                      >
                        paid
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    due {b.dueDate} · {b.frequency}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                      color: C.textDark,
                    }}
                  >
                    {money(b.amount)}
                  </span>
                  {!b.paid && (
                    <button
                      onClick={() => advance(b.id)}
                      style={{
                        fontSize: "12.5px",
                        color: C.teal,
                        background: "none",
                        fontWeight: 600,
                      }}
                    >
                      Mark paid
                    </button>
                  )}
                  <button
                    onClick={() => remove(b.id)}
                    style={{ color: C.muted, background: "none" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// insights
// ---------------------------------------------------------------------------
function Insights({ transactions }) {
  const byMonth = {};
  transactions.forEach((t) => {
    const ym = t.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = { ym, income: 0, expense: 0 };
    byMonth[ym][t.type] += t.amount;
  });
  const monthly = Object.values(byMonth)
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .slice(-6)
    .map((m) => ({ ...m, label: monthLabel(m.ym) }));

  const now = new Date();
  const thisYm = toDateStr(now).slice(0, 7);
  const lastYm = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - 1, 1)
  ).slice(0, 7);

  const thisMonthExpenses = transactions.filter(
    (t) => t.type === "expense" && t.date.slice(0, 7) === thisYm
  );
  const lastMonthExpenses = transactions.filter(
    (t) => t.type === "expense" && t.date.slice(0, 7) === lastYm
  );
  const thisTotal = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastMonthExpenses.reduce((s, t) => s + t.amount, 0);

  const catTotals = {};
  thisMonthExpenses.forEach(
    (t) => (catTotals[t.category] = (catTotals[t.category] || 0) + t.amount)
  );
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const daysElapsed = now.getDate();
  const avgDaily = daysElapsed > 0 ? thisTotal / daysElapsed : 0;

  const diff = thisTotal - lastTotal;

  return (
    <div>
      <SectionIntro
        title="Insights"
        text="A longer look back at your months, so the patterns that don't show up day to day have a place to surface."
      />

      <Card style={{ marginBottom: "20px" }}>
        <h3
          style={{
            fontFamily: "'Zilla Slab', serif",
            fontSize: "17px",
            color: C.textDark,
            marginBottom: "4px",
          }}
        >
          Income against expenses, month by month
        </h3>
        <p style={{ fontSize: "12.5px", color: C.muted, marginBottom: "10px" }}>
          Last six months with any activity.
        </p>
        {monthly.length === 0 ? (
          <EmptyNote text="Log a few months of entries and the comparison will show up here." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid stroke={C.parchmentLine} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: C.muted }}
                axisLine={{ stroke: C.parchmentLine }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: C.muted }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v) => money(v)}
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 8,
                  borderColor: C.parchmentLine,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="income"
                fill={C.teal}
                name="Income"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expense"
                fill={C.brick}
                name="Expenses"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div
            style={{ fontSize: "12.5px", color: C.muted, marginBottom: "6px" }}
          >
            Biggest category this month
          </div>
          <div
            style={{
              fontFamily: "'Zilla Slab', serif",
              fontSize: "20px",
              color: C.textDark,
            }}
          >
            {topCat ? topCat[0] : "None yet"}
          </div>
          {topCat && (
            <div
              style={{
                fontSize: "13px",
                color: C.muted,
                marginTop: "2px",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {money(topCat[1])} so far
            </div>
          )}
        </Card>
        <Card>
          <div
            style={{ fontSize: "12.5px", color: C.muted, marginBottom: "6px" }}
          >
            Average spent per day this month
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "22px",
              color: C.textDark,
              fontWeight: 600,
            }}
          >
            {money(avgDaily)}
          </div>
        </Card>
        <Card>
          <div
            style={{ fontSize: "12.5px", color: C.muted, marginBottom: "6px" }}
          >
            Compared to last month
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "20px",
              color: diff > 0 ? C.brick : C.teal,
              fontWeight: 600,
            }}
          >
            {diff === 0 ? "About even" : `${diff > 0 ? "+" : ""}${money(diff)}`}
          </div>
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
            {thisYm} vs {lastYm}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------
function Profile({ user, onLogout }) {
  return (
    <div>
      <SectionIntro
        title="Profile"
        text="Your account, at a glance. Log out here whenever you're done for the day."
      />
      <Card style={{ maxWidth: "420px" }}>
        <div className="flex items-center gap-4 mb-6">
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: C.gold,
              color: "#1b1508",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Zilla Slab', serif",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Zilla Slab', serif",
                fontSize: "19px",
                color: C.textDark,
              }}
            >
              {user.firstName} {user.lastName}
            </div>
            <div style={{ fontSize: "13.5px", color: C.muted }}>
              {user.email}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-2"
          style={{
            background: "transparent",
            border: `1px solid ${C.brick}`,
            color: C.brick,
            padding: "9px 18px",
            borderRadius: "6px",
            fontSize: "13.5px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <LogOut size={15} /> Log out
        </button>
      </Card>

      <p style={{ fontSize: "12.5px", color: C.muted, marginTop: "24px" }}>
        Fintent was built by Dhyan Subramani.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// app shell
// ---------------------------------------------------------------------------
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "tracker", label: "Tracker", icon: Wallet },
  { key: "savings", label: "Savings goals", icon: PiggyBank },
  { key: "bills", label: "Bills", icon: Receipt },
  { key: "insights", label: "Insights", icon: TrendingUp },
  { key: "profile", label: "Profile", icon: User },
];

export default function Fintent() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [section, setSection] = useState("dashboard");

  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [bills, setBills] = useState([]);
  const dataLoaded = useRef(false);

  // load users and any existing session in the background, never blocking the UI
  useEffect(() => {
    (async () => {
      const storedUsers = (await storageGet("users")) || [];
      setUsers(storedUsers);
      const session = await storageGet("session");
      if (session && session.email) {
        const match = storedUsers.find((u) => u.email === session.email);
        if (match) setCurrentUser(match);
      }
    })();
  }, []);

  // load that user's data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    dataLoaded.current = false;
    (async () => {
      const data =
        (await storageGet(`data:${currentUser.email}`)) || emptyUserData();
      // older saves kept deadline goals in a separate list, fold them back in
      setTransactions(data.transactions || []);
      setGoals([...(data.goals || []), ...(data.timelineGoals || [])]);
      setBills(data.bills || []);
      dataLoaded.current = true;
    })();
  }, [currentUser]);

  // persist that user's data whenever it changes
  useEffect(() => {
    if (!currentUser || !dataLoaded.current) return;
    storageSet(`data:${currentUser.email}`, { transactions, goals, bills });
  }, [transactions, goals, bills, currentUser]);

  const handleSignup = async (newUser) => {
    // read the freshest copy from storage right before writing, so a stale
    // in-memory list can never blow away accounts that already exist there
    const latestUsers = (await storageGet("users")) || users;
    if (latestUsers.some((u) => u.email === newUser.email)) {
      setUsers(latestUsers);
      return;
    }
    const nextUsers = [...latestUsers, newUser];
    setUsers(nextUsers);
    setCurrentUser(newUser);
    setSection("dashboard");
    storageSet("users", nextUsers);
    storageSet("session", { email: newUser.email });
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setSection("dashboard");
    storageSet("session", { email: user.email });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setTransactions([]);
    setGoals([]);
    setBills([]);
    storageDelete("session");
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        input:focus, select:focus, button:focus-visible {
          outline: 2px solid ${C.gold};
          outline-offset: 1px;
        }
        button { cursor: pointer; }
      `}</style>

      {!currentUser ? (
        <AuthScreen
          users={users}
          onSignup={handleSignup}
          onLogin={handleLogin}
        />
      ) : (
        <div className="flex" style={{ minHeight: "100vh" }}>
          <aside
            style={{
              width: "220px",
              background: C.ink,
              padding: "24px 14px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily: "'Zilla Slab', serif",
                fontSize: "22px",
                fontWeight: 700,
                color: C.textLight,
                padding: "0 10px",
                marginBottom: "28px",
              }}
            >
              Fint<span style={{ color: C.gold }}>ent</span>
            </div>
            <nav style={{ flex: 1 }}>
              {NAV.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className="flex items-center gap-3 w-full"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "7px",
                    marginBottom: "4px",
                    background: section === key ? C.inkSoft : "transparent",
                    color: section === key ? C.gold : C.mutedLight,
                    fontSize: "13.5px",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>
            <div
              style={{
                padding: "0 10px",
                fontSize: "11.5px",
                color: "#5c6472",
              }}
            >
              Signed in as {currentUser.firstName}
            </div>
          </aside>

          <main
            style={{
              flex: 1,
              background: C.parchment,
              padding: "32px 40px",
              overflowY: "auto",
            }}
          >
            {section === "dashboard" && (
              <Dashboard transactions={transactions} />
            )}
            {section === "tracker" && (
              <Tracker
                transactions={transactions}
                setTransactions={setTransactions}
              />
            )}
            {section === "savings" && (
              <Savings goals={goals} setGoals={setGoals} />
            )}
            {section === "bills" && <Bills bills={bills} setBills={setBills} />}
            {section === "insights" && <Insights transactions={transactions} />}
            {section === "profile" && (
              <Profile user={currentUser} onLogout={handleLogout} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
