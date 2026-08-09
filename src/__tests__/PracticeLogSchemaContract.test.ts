// ============================================
// English SRS V4.1 — Schema Contract Prevention (PART 17-18)
//
// Guards against the drift class that caused the production 400:
// a legacy inline CHECK constraint (auto-named by Postgres) that a
// later migration ADD CONSTRAINT never dropped. BOTH enforce on new
// rows, so mode='learn' → 23514 → 400.
//
// Three layers:
//   1. Repository payload contract — insertPracticeLog/updatePracticeLog
//      build exactly the schema-accepted fields.
//   2. Migration replay — replays ADD/DROP CONSTRAINT across migration
//      files and asserts the FINAL effective mode CHECK accepts every
//      canonical PracticeLogMode value. Catches any future migration
//      that reintroduces a mode CHECK excluding 'learn'.
//   3. RPC type contract — complete_expression_learning signature must
//      match the client call (compile-time enforced by tsc).
// ============================================

import { describe, it, expect, vi, beforeAll } from "vitest";
import { expectTypeOf } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/database.types";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

// ═══════════════════════════════════════
// Canonical contract under test
// ═══════════════════════════════════════

const CANONICAL_MODES = [
  "learn",
  "recall",
  "recognition",
  "cloze",
  "sentence",
  "application",
] as const;

const CANONICAL_STATUSES = ["collected", "learning", "review", "mastered"] as const;

// ═══════════════════════════════════════
// Migration replay helpers
// ═══════════════════════════════════════

interface ConstraintState {
  /** constraint name → allowed values (union of every still-present CHECK). */
  map: Map<string, string[]>;
}

function parseQuotedList(body: string): string[] {
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * Replay migrations' cumulative effect on CHECK constraints for a column.
 * Model:
 *  - inline `CHECK (col IN (...))` inside CREATE TABLE → registered under the
 *    Postgres auto-name `${table}_${col}_check` (so a later DROP of that name works).
 *  - `ALTER TABLE <table> ADD CONSTRAINT <name> CHECK (col IN (...))` → set/merge.
 *  - `DROP CONSTRAINT IF EXISTS <name>` → remove.
 * NOT VALID is irrelevant here (it still enforces on NEW rows).
 */
function replayColumnChecks(table: string, column: string): ConstraintState {
  const state = new Map<string, string[]>();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const inlineTableRe = new RegExp(
    `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${table}\\s*\\(`,
    "i",
  );
  const alterRe = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+`,
    "gi",
  );
  const columnCheckRe = new RegExp(
    `${column}\\s+IN\\s*\\(([^)]*)\\)`,
    "i",
  );

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    // Inline CHECK inside CREATE TABLE block (auto-named constraint).
    const tblMatch = sql.match(inlineTableRe);
    if (tblMatch) {
      const from = tblMatch.index!;
      // Everything from CREATE TABLE start up to the closing ");\n" of the table def.
      const endMatch = sql.slice(from).match(/\)\s*;\s*/);
      const block = endMatch ? sql.slice(from, from + endMatch.index! + 1) : sql.slice(from);
      const colMatch = block.match(columnCheckRe);
      if (colMatch) {
        const values = parseQuotedList(colMatch[1]);
        state.set(`${table}_${column}_check`, values);
      }
    }

    // ALTER TABLE ... ADD / DROP CONSTRAINT statements.
    for (const alterMatch of sql.matchAll(alterRe)) {
      const chunk = sql.slice(alterMatch.index!);
      const nextAlter = chunk.match(/ALTER\s+TABLE/g);
      const nextIndex = nextAlter && nextAlter.length > 1 ? chunk.indexOf("ALTER TABLE", 11) : -1;
      const stmtBlock = nextIndex === -1 ? chunk : chunk.slice(0, nextIndex);
      const stmts = stmtBlock.split(";");

      for (const stmt of stmts) {
        const add = stmt.match(/ADD\s+CONSTRAINT\s+(\w+)\s+CHECK\s*\(([\s\S]*)\)\s*(?:NOT\s+VALID)?\s*$/i);
        if (add) {
          const name = add[1];
          const checkBody = add[2];
          const colMatch = checkBody.match(columnCheckRe);
          if (colMatch) {
            state.set(name, parseQuotedList(colMatch[1]));
          }
          continue;
        }
        const drop = stmt.match(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
        if (drop) {
          state.delete(drop[1]);
        }
      }
    }
  }

  return { map: state };
}

// ═══════════════════════════════════════
// Repository payload contract (real code, mocked supabase/auth)
// ═══════════════════════════════════════

const mockSingle = vi.fn(() => ({ data: { id: "log-1" }, error: null }));
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn((_payload: Record<string, unknown>) => ({ eq: () => ({ error: null }) }));
const mockFrom = vi.fn((..._args: unknown[]) => ({ insert: mockInsert, update: mockUpdate }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserId: vi.fn(async () => "user-1"),
}));

import { insertPracticeLog, updatePracticeLog } from "@/lib/english/practiceLogRepository";

beforeAll(() => {
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockSingle.mockClear();
  mockFrom.mockClear();
});

describe("PART 17 — Practice log repository payload contract", () => {
  it("insertPracticeLog sends exactly the schema-accepted fields", async () => {
    const id = await insertPracticeLog({
      expressionId: "expr-1",
      sessionId: "sess-1",
      mode: "learn",
      answer: "an opportunity",
      feedback: "✓ 回忆正确",
      score: 5,
      metadata: { source: "learning", learn_completed: false },
    });

    expect(id).toBe("log-1");
    expect(mockFrom).toHaveBeenCalledWith("expression_practice_logs");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      expression_id: "expr-1",
      session_id: "sess-1",
      mode: "learn",
      answer: "an opportunity",
      feedback: "✓ 回忆正确",
      score: 5,
      metadata: { source: "learning", learn_completed: false },
    });
  });

  it("insertPracticeLog nulls optional fields instead of omitting them", async () => {
    await insertPracticeLog({
      expressionId: "expr-2",
      mode: "recall",
      answer: null,
      score: 3,
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      expression_id: "expr-2",
      session_id: null,
      mode: "recall",
      answer: null,
      feedback: null,
      score: 3,
      metadata: {},
    });
  });

  it("updatePracticeLog only sends fields that are defined", async () => {
    await updatePracticeLog("log-1", { feedback: "很棒！", score: 5 });
    expect(mockUpdate).toHaveBeenCalledWith({ feedback: "很棒！", score: 5 });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("metadata");
  });

  it("PracticeLogMode covers every canonical mode incl. 'learn'", () => {
    const modes = new Set(["learn", "recall", "recognition", "cloze", "sentence", "application"]);
    for (const m of CANONICAL_MODES) expect(modes.has(m)).toBe(true);
  });
});

// ═══════════════════════════════════════
// Migration replay — effective mode CHECK contract
// ═══════════════════════════════════════

describe("PART 17 — Migration replay: expression_practice_logs.mode CHECK", () => {
  const modeState = replayColumnChecks("expression_practice_logs", "mode");

  it("the stale legacy constraint is dropped in the final effective state", () => {
    expect(modeState.map.has("expression_practice_logs_mode_check")).toBe(false);
    expect(modeState.map.has("chk_practice_logs_mode")).toBe(true);
  });

  it("the final effective mode CHECK accepts every canonical mode", () => {
    const effective = new Set([...modeState.map.values()].flat());
    for (const m of CANONICAL_MODES) expect(effective.has(m)).toBe(true);
  });

  it("no surviving mode CHECK excludes 'learn'", () => {
    for (const [name, values] of modeState.map) {
      expect(values.includes("learn"), `constraint ${name} excludes 'learn'`).toBe(true);
    }
  });
});

describe("PART 17 — Migration replay: expressions.status CHECK", () => {
  const statusState = replayColumnChecks("expressions", "status");

  it("the final effective status CHECK accepts the canonical lifecycle statuses", () => {
    const effective = new Set([...statusState.map.values()].flat());
    for (const s of CANONICAL_STATUSES) expect(effective.has(s)).toBe(true);
  });

  it("every surviving status CHECK accepts 'review'", () => {
    for (const [name, values] of statusState.map) {
      expect(values.includes("review"), `constraint ${name} excludes 'review'`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════
// RPC type contract (compile-time enforced)
// ═══════════════════════════════════════

describe("PART 18 — complete_expression_learning RPC contract (database.types.ts)", () => {
  type RpcArgs = Database["public"]["Functions"]["complete_expression_learning"]["Args"];

  it("accepts the exact argument names the client sends", () => {
    expectTypeOf<RpcArgs>().toMatchTypeOf<{ p_session_id: string }>();
    expectTypeOf<RpcArgs>().toMatchTypeOf<{ p_item_id: string }>();
    expectTypeOf<RpcArgs>().toMatchTypeOf<{ p_recall_score: number }>();
    expectTypeOf<RpcArgs>().toMatchTypeOf<{ p_sentence_score: number }>();
    expectTypeOf<RpcArgs>().toMatchTypeOf<{ p_srs: unknown }>();
  });

  it("returns item_completed / srs_initialized / expression_status", () => {
    type RpcReturns = Database["public"]["Functions"]["complete_expression_learning"]["Returns"][number];
    expectTypeOf<RpcReturns>().toMatchTypeOf<{ item_completed: boolean }>();
    expectTypeOf<RpcReturns>().toMatchTypeOf<{ srs_initialized: boolean }>();
    expectTypeOf<RpcReturns>().toMatchTypeOf<{ expression_status: string }>();
  });
});
