// ============================================
// Habit Lab — demo seed data
// Creates 3 example sprints (Reading history, English running,
// Stretch started today) + 3 rewards for a target account.
//
// Usage:
//   node scripts/seed-habit-lab.mjs <email> [--force]
// Safe to re-run with --force (upserts would otherwise be skipped).
// ============================================

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const email = process.argv[2];
const force = process.argv.includes("--force");
if (!email) {
  console.error("Usage: node scripts/seed-habit-lab.mjs <email> [--force]");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Beijing "today" + calendar helpers ──
const pad = (n) => String(n).padStart(2, "0");
function beijingToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function addDays(date, days) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const today = beijingToday();

// ── Supabase runner ──
function run(sql) {
  const file = path.join(root, ".tmp-seed-habit-lab.sql");
  writeFileSync(file, sql, "utf8");
  try {
    execSync(`npx supabase db query --linked -f "${file}"`, {
      cwd: root, stdio: "inherit", shell: true, env: { ...process.env, NO_COLOR: "1" },
    });
  } finally {
    if (existsSync(file)) unlinkSync(file);
  }
}

const UQ = `(SELECT id FROM auth.users WHERE email = '${email}')`;

function runProbe(sql) {
  const file = path.join(root, ".tmp-probe.sql");
  writeFileSync(file, sql, "utf8");
  try {
    return execSync(`npx supabase db query --linked -f "${file}"`, {
      cwd: root, shell: true, encoding: "utf8",
    });
  } finally {
    if (existsSync(file)) unlinkSync(file);
  }
}

if (!force) {
  const res = runProbe(`SELECT COUNT(*) AS n FROM habit_sprints WHERE user_id = ${UQ};`);
  if (/\"n\":\s*[1-9]/.test(res)) {
    console.error("Habit Lab already has sprints for this user. Re-run with --force to seed anyway.");
    process.exit(0);
  }
}

// ── Build the three sprints ──
const sprints = [
  {
    key: "reading", title: "阅读实验", icon: "BookOpen",
    cue_sentence: "每当我喝完晨间咖啡后，我会打开书读一页。",
    trigger: "喝完晨间咖啡", location: "书房",
    minimum_action: "打开书读一页",
    identity_statement: "我是一个每天都会读点书的人",
    start: addDays(today, -28), status: "completed",
    days: "ccccccccc s ccc m ccccc s c".split(" ").join("").split(""),
  },
  {
    key: "english", title: "英语表达", icon: "Languages",
    cue_sentence: "每当我打开英语练习 App 后，我会开口说一句英语。",
    trigger: "打开英语练习 App", location: null,
    minimum_action: "开口说一句英语",
    identity_statement: "我是一个能自然开口说英语的人",
    start: addDays(today, -4), status: "active",
    days: "ccc s".split(" ").join("").split(""),
  },
  {
    key: "stretch", title: "拉伸放松", icon: "Footprints",
    cue_sentence: "每当我晚上洗漱完后，我会做 5 分钟拉伸。",
    trigger: "晚上洗漱完", location: "床边",
    minimum_action: "做 5 分钟拉伸",
    identity_statement: "我是一个在意身体感受的人",
    start: addDays(today, 0), status: "active",
    days: "c".split(""),
  },
];

const sql = [];
sql.push("BEGIN;");

// 1) sprints + logs
for (const s of sprints) {
  const sprintId = randomUUID();
  const now = new Date().toISOString();
  sql.push(`INSERT INTO habit_sprints
    (id, user_id, title, icon, cue_sentence, trigger, location, minimum_action,
     identity_statement, duration_days, start_date, status, completed_at, created_at, updated_at)
  VALUES
    ('${sprintId}', ${UQ}, '${s.title}', '${s.icon}', '${s.cue_sentence}', '${s.trigger}',
     ${s.location ? `'${s.location}'` : "NULL"}, '${s.minimum_action}', '${s.identity_statement}',
     21, '${s.start}', '${s.status}',
     ${s.status === "completed" ? `'${now}'` : "NULL"}, '${now}', '${now}');`);

  const dayStatuses = s.days; // 'c' | 's' | 'm'
  for (let i = 0; i < dayStatuses.length; i++) {
    const st = dayStatuses[i];
    if (st === "m") continue; // missed is inferred, never stored
    sql.push(`INSERT INTO habit_sprint_logs (id, sprint_id, user_id, date, status, note, created_at, updated_at)
      VALUES ('${randomUUID()}', '${sprintId}', ${UQ}, '${addDays(s.start, i)}', '${st === "c" ? "completed" : "skipped"}',
              NULL, '${now}', '${now}');`);
  }

  // review snapshot for the finalized reading sprint
  if (s.status === "completed") {
    sql.push(`INSERT INTO habit_sprint_reviews
      (id, sprint_id, user_id, completed_days, total_days, completion_rate, longest_streak, points_earned,
       easiest_context, primary_friction, next_action, created_at)
    VALUES
      ('${randomUUID()}', '${sprintId}', ${UQ}, 18, 21, 85.71, 9, 320,
       '早晨喝完咖啡坐在书桌前时最轻松，光线和安静都在帮我把书翻开。',
       '晚上到家太累时容易跳过，哪怕当天白天已经看过书，睡前也想不起来。',
       '把时间固定到早晨书桌前，开始新一轮 21 天阅读实验。', '${now}');`);
  }
}

// 2) rewards
const rewards = [
  { name: "一杯手冲咖啡", icon: "Coffee", points_required: 50 },
  { name: "一块甜品", icon: "Cake", points_required: 150 },
  { name: "看一场电影", icon: "Popcorn", points_required: 300 },
];
const now = new Date().toISOString();
for (let i = 0; i < rewards.length; i++) {
  const r = rewards[i];
  sql.push(`INSERT INTO habit_rewards (id, user_id, name, icon, points_required, status, redeemed_at, sort_order, created_at, updated_at)
    VALUES ('${randomUUID()}', ${UQ}, '${r.name}', '${r.icon}', ${r.points_required}, 'active', NULL, ${i}, '${now}', '${now}');`);
}

sql.push("COMMIT;");
run(sql.join("\n"));
console.log("Seeded Habit Lab demo data for", email);
