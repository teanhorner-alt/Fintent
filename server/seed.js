const bcrypt = require("bcryptjs");
const db = require("./db");

const SEED_PASSWORD = "Seed123!";

const FIRST_NAMES = [
  "James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth",
  "William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
  "Daniel","Nancy","Matthew","Lisa","Anthony","Betty","Mark","Margaret","Donald","Sandra",
  "Steven","Ashley","Paul","Kimberly","Andrew","Emily","Joshua","Donna","Kenneth","Michelle",
];
const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
];

const EXPENSE_CATEGORIES = ["Groceries","Rent","Utilities","Transportation","Dining","Entertainment","Health","Shopping","Other"];
const INCOME_CATEGORIES = ["Salary","Freelance","Gift","Investment","Other"];
const EXPENSE_DESCRIPTIONS = {
  Groceries: ["Weekly grocery run","Farmers market","Costco haul","Corner store"],
  Rent: ["Monthly rent","Rent payment"],
  Utilities: ["Electric bill","Water bill","Internet bill","Gas bill"],
  Transportation: ["Gas fill-up","Train pass","Rideshare","Car maintenance"],
  Dining: ["Lunch out","Coffee shop","Dinner with friends","Takeout"],
  Entertainment: ["Movie night","Streaming subscription","Concert tickets","Video game"],
  Health: ["Pharmacy","Gym membership","Doctor visit copay","Dentist"],
  Shopping: ["Clothing","Home goods","Electronics","Online order"],
  Other: ["Miscellaneous","Cash withdrawal","Bank fee"],
};
const INCOME_DESCRIPTIONS = {
  Salary: ["Biweekly paycheck","Monthly salary"],
  Freelance: ["Freelance project","Contract work"],
  Gift: ["Birthday gift","Holiday gift"],
  Investment: ["Dividend payout","Stock sale"],
  Other: ["Refund","Side income"],
};
const GOAL_TEMPLATES = [
  { name: "Emergency fund", target: [2000, 8000] },
  { name: "Vacation", target: [800, 3000] },
  { name: "New laptop", target: [900, 2200] },
  { name: "Car down payment", target: [2000, 6000] },
  { name: "Wedding fund", target: [3000, 10000] },
  { name: "Home renovation", target: [1500, 7000] },
  { name: "Holiday gifts", target: [300, 1200] },
];
const BILL_TEMPLATES = [
  { name: "Rent", amount: [900, 2200], frequency: "monthly" },
  { name: "Electric", amount: [40, 160], frequency: "monthly" },
  { name: "Internet", amount: [45, 90], frequency: "monthly" },
  { name: "Phone plan", amount: [35, 90], frequency: "monthly" },
  { name: "Car insurance", amount: [70, 180], frequency: "monthly" },
  { name: "Streaming bundle", amount: [15, 35], frequency: "monthly" },
  { name: "Gym membership", amount: [20, 60], frequency: "monthly" },
  { name: "Property tax", amount: [400, 1800], frequency: "yearly" },
];

let uidCounter = 0;
const uid = () => { uidCounter += 1; return `${Date.now()}-seed-${uidCounter}-${Math.floor(Math.random()*1e6)}`; };
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toDateStr(d); };

function makeTransactions() {
  const count = randInt(15, 35);
  const list = [];
  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() < 0.25;
    const category = isIncome ? pick(INCOME_CATEGORIES) : pick(EXPENSE_CATEGORIES);
    const descPool = isIncome ? INCOME_DESCRIPTIONS[category] : EXPENSE_DESCRIPTIONS[category];
    const amount = isIncome ? Math.round(rand(200, 3200) * 100) / 100 : Math.round(rand(5, 400) * 100) / 100;
    list.push({
      id: uid(),
      type: isIncome ? "income" : "expense",
      category,
      amount,
      date: daysAgo(randInt(0, 150)),
      description: pick(descPool),
    });
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function makeGoals() {
  const count = randInt(1, 3);
  const used = new Set();
  const list = [];
  while (list.length < count) {
    const t = pick(GOAL_TEMPLATES);
    if (used.has(t.name)) continue;
    used.add(t.name);
    const target = Math.round(rand(t.target[0], t.target[1]));
    const current = Math.round(rand(0, target * 0.7));
    const hasDeadline = Math.random() < 0.6;
    list.push({
      id: uid(),
      name: t.name,
      target,
      current,
      deadline: hasDeadline ? daysFromNow(randInt(30, 400)) : null,
      startDate: hasDeadline ? daysAgo(randInt(1, 60)) : null,
    });
  }
  return list;
}

function makeBills() {
  const count = randInt(2, 5);
  const used = new Set();
  const list = [];
  while (list.length < count) {
    const t = pick(BILL_TEMPLATES);
    if (used.has(t.name)) continue;
    used.add(t.name);
    list.push({
      id: uid(),
      name: t.name,
      amount: Math.round(rand(t.amount[0], t.amount[1]) * 100) / 100,
      dueDate: Math.random() < 0.5 ? daysFromNow(randInt(1, 25)) : daysAgo(randInt(1, 10)),
      frequency: t.frequency,
      paid: Math.random() < 0.4,
    });
  }
  return list;
}

async function seed(count = 130) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  let firstIdx = 0, lastIdx = 0;
  let created = 0;
  const sample = [];

  for (let i = 0; created < count && i < count * 3; i++) {
    const first = FIRST_NAMES[firstIdx % FIRST_NAMES.length];
    const last = LAST_NAMES[lastIdx % LAST_NAMES.length];
    lastIdx++;
    if (lastIdx % LAST_NAMES.length === 0) firstIdx++;

    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@seed.fintent.test`;
    const existing = await db.getAccount(email);
    if (existing) continue;

    await db.saveAccount({ email, firstName: first, lastName: last, passwordHash, sessionVersion: 0 });
    await db.saveUserData(email, {
      transactions: makeTransactions(),
      goals: makeGoals(),
      bills: makeBills(),
    });
    created++;
    if (sample.length < 10) sample.push({ email, firstName: first, lastName: last });
  }

  return { created, password: SEED_PASSWORD, sample };
}

module.exports = { seed };

if (require.main === module) {
  (async () => {
    await db.init();
    const n = parseInt(process.argv[2], 10) || 130;
    const result = await seed(n);
    console.log(`Seeded ${result.created} accounts. Password for all: ${result.password}`);
    console.table(result.sample);
    await db.pool.end();
  })();
}
