/**
 * Expression Builder → Nancy OS 数据迁移脚本
 *
 * 用法:
 *   1. 设置环境变量 OLD_DATABASE_URL 指向旧 PostgreSQL (Render)
 *   2. 设置环境变量 SUPABASE_URL + SUPABASE_SERVICE_KEY 指向 Nancy OS Supabase
 *   3. pnpm tsx scripts/migrate-expressions.ts
 *
 * 迁移内容:
 *   old: expressions (INTEGER id)         → new: expressions (UUID id)
 *   old: speaking_sessions (INTEGER id)   → new: speaking_sessions (UUID id)
 *   old: speaking_attempts (INTEGER id)   → new: speaking_attempts (UUID id)
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// ── Config ──

const OLD_DB = process.env.OLD_DATABASE_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const TARGET_USER_ID = process.env.TARGET_USER_ID!;

if (!OLD_DB || !SUPABASE_URL || !SUPABASE_KEY || !TARGET_USER_ID) {
  console.error("Missing required env vars: OLD_DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, TARGET_USER_ID");
  console.error("TARGET_USER_ID: The UUID of the Nancy OS user to assign all migrated data to.");
  process.exit(1);
}

const oldDb = postgres(OLD_DB);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── ID Mapping ──
const expressionIdMap = new Map<number, string>(); // old int → new uuid
const sessionIdMap = new Map<number, string>();

// ── UUID Generator (deterministic from old id) ──
function oldIdToUuid(table: string, oldId: number): string {
  const hex = `${table}_${oldId}`
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0).toString(16), "")
    .slice(0, 32)
    .padEnd(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── Helpers ──

function safeStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v || null;
  return String(v);
}

function safeInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function safeDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ═══════════════════════════════════════════
// Step 1: Migrate expressions
// ═══════════════════════════════════════════

async function migrateExpressions() {
  console.log("📦 Migrating expressions...");

  const rows = await oldDb`SELECT * FROM expressions ORDER BY id`;

  let count = 0;
  for (const row of rows) {
    const newId = oldIdToUuid("expr", row.id);
    expressionIdMap.set(row.id, newId);

    const { error } = await supabase.from("expressions").upsert({
      id: newId,
      user_id: TARGET_USER_ID,
      english: row.english,
      chinese: row.chinese,
      type: row.type,
      pronunciation: safeStr(row.pronunciation),
      example_sentence: safeStr(row.example_sentence),
      scene: row.scene || "daily life",
      usefulness_level: safeInt(row.usefulness_level) ?? 3,
      status: row.status || "new",
      mastery_level: 0,
      next_review_date: safeDate(row.next_review_date),
      review_count: safeInt(row.review_count) ?? 0,
      streak: 0,
      source_text: safeStr(row.source_text),
      notes: safeStr(row.notes),
      synonyms: safeStr(row.synonyms),
      english_explanation: safeStr(row.english_explanation),
      native_usage: safeStr(row.native_usage),
      situation: safeStr(row.situation),
      formality: safeStr(row.formality),
      topic: safeStr(row.topic),
      imported_from: safeStr(row.imported_from),
      source: safeStr(row.source),
      archived: row.archived ?? false,
      created_at: safeDate(row.created_at),
      updated_at: safeDate(row.updated_at),
    });

    if (error) {
      console.error(`  ❌ Expression ${row.id} failed:`, error.message);
    } else {
      count++;
      if (count % 500 === 0) console.log(`  ✓ ${count} expressions migrated...`);
    }
  }

  console.log(`✅ Migrated ${count} expressions`);
}

// ═══════════════════════════════════════════
// Step 2: Migrate speaking_sessions
// ═══════════════════════════════════════════

async function migrateSpeakingSessions() {
  console.log("\n📦 Migrating speaking_sessions...");

  const rows = await oldDb`SELECT * FROM speaking_sessions ORDER BY id`;

  let count = 0;
  for (const row of rows) {
    const newId = oldIdToUuid("sess", row.id);
    sessionIdMap.set(row.id, newId);

    // Convert old expression_ids (JSON array of ints → JSON array of UUID strings)
    let newExprIds = "[]";
    let newExprSnapshot = "[]";
    try {
      const oldIds: number[] = JSON.parse(row.expression_ids || "[]");
      newExprIds = JSON.stringify(oldIds.map((id) => expressionIdMap.get(id) || String(id)));
    } catch { /* keep default */ }

    try {
      const oldSnapshot = JSON.parse(row.expressions_snapshot || "[]");
      newExprSnapshot = JSON.stringify(
        oldSnapshot.map((e: { id: number }) => ({
          ...e,
          id: expressionIdMap.get(e.id) || String(e.id),
        })),
      );
    } catch { /* keep default */ }

    const { error } = await supabase.from("speaking_sessions").upsert({
      id: newId,
      user_id: TARGET_USER_ID,
      prompt: row.prompt || "",
      context: safeStr(row.context),
      expression_ids: newExprIds,
      expressions_snapshot: newExprSnapshot,
      status: row.status || "saved",
      created_at: safeDate(row.created_at),
      updated_at: safeDate(row.updated_at),
    });

    if (error) {
      console.error(`  ❌ Session ${row.id} failed:`, error.message);
    } else {
      count++;
    }
  }

  console.log(`✅ Migrated ${count} speaking_sessions`);
}

// ═══════════════════════════════════════════
// Step 3: Migrate speaking_attempts
// ═══════════════════════════════════════════

async function migrateSpeakingAttempts() {
  console.log("\n📦 Migrating speaking_attempts...");

  const rows = await oldDb`SELECT * FROM speaking_attempts ORDER BY id`;

  let count = 0;
  for (const row of rows) {
    const newSessionId = sessionIdMap.get(row.session_id);
    if (!newSessionId) {
      console.warn(`  ⚠️  Attempt ${row.id}: session ${row.session_id} not found, skipping`);
      continue;
    }

    const { error } = await supabase.from("speaking_attempts").upsert({
      id: oldIdToUuid("att", row.id),
      user_id: TARGET_USER_ID,
      session_id: newSessionId,
      answer: row.answer || "",
      natural_version: row.natural_version || "",
      // Old combined feedback → split into new structured fields
      combined_feedback: row.feedback || "",
      created_at: safeDate(row.created_at),
    });

    if (error) {
      console.error(`  ❌ Attempt ${row.id} failed:`, error.message);
    } else {
      count++;
    }
  }

  console.log(`✅ Migrated ${count} speaking_attempts`);
}

// ═══════════════════════════════════════════
// Step 4: Migrate expression_reviews (derive from expressions.review_history)
// ═══════════════════════════════════════════
// Note: Old system didn't have a separate reviews table; SRS state was
// tracked directly on expressions. New reviews are generated fresh via the app.

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════

async function main() {
  console.log("🚀 Starting Expression Builder → Nancy OS migration\n");
  console.log(`   Old DB: ${OLD_DB?.replace(/\/\/.*@/, "//***@")}`);
  console.log(`   New DB: ${SUPABASE_URL}\n`);

  try {
    await migrateExpressions();
    await migrateSpeakingSessions();
    await migrateSpeakingAttempts();

    console.log("\n🎉 Migration complete!");
    console.log(`   Expressions: ${expressionIdMap.size} mapped`);
    console.log(`   Sessions: ${sessionIdMap.size} mapped`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await oldDb.end();
  }
}

main();
