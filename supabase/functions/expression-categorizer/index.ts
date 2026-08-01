// ============================================
// Nancy OS — Expression Categorizer Agent
// Re-categorizes existing expressions using AI.
// Batch processing to stay under model input limits.
//
// Input: { mode: "re categorize" }
// Output: { total, categorized, errors, per_category: { name: count } }
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepSeek, safeJsonParse } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const BATCH_SIZE = 30;

const CATEGORIES = ["生活", "工作", "社交", "情绪", "旅行", "学习", "商务", "影视"] as const;

const CLASSIFY_PROMPT = `You are an English learning classifier. For each expression below, assign it to exactly ONE category.

Categories: ${CATEGORIES.join(", ")}

Classification rules:
- 生活 (Daily Life): daily routines, food, shopping, health, housing, family, household
- 工作 (Work): office, career, meetings, interviews, internships, workplace communication
- 社交 (Social): friends, relationships, greetings, parties, networking, small talk
- 情绪 (Emotions): feelings, moods, stress, happiness, sadness, psychological states
- 旅行 (Travel): transportation, hotels, sightseeing, commuting, airports, directions
- 学习 (Study): academic, exams, university, courses, research, campus life
- 商务 (Business): negotiations, presentations, finance, marketing, contracts, deals
- 影视 (Entertainment): movies, TV shows, music, media, pop culture

Return ONLY valid JSON:
{
  "results": [
    { "id": "<expression_uuid>", "category": "<category_name>" }
  ]
}`;

interface ExpressionRow {
  id: string;
  english: string;
  chinese: string | null;
  type: string | null;
  scene: string | null;
  topic: string | null;
}

interface ClassifyResult {
  id: string;
  category: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    // Parse body
    let body: { mode?: string } = {};
    try { body = await req.json(); } catch { /* defaults */ }

    // Fetch uncategorized expressions
    const { data: expressions, error: fetchErr } = await supabase
      .from("expressions")
      .select("id, english, chinese, type, scene, topic")
      .eq("user_id", userId)
      .eq("archived", false)
      .is("category_id", null)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      return new Response(JSON.stringify({ error: `Database error: ${fetchErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!expressions || expressions.length === 0) {
      return new Response(JSON.stringify({
        total: 0,
        categorized: 0,
        message: "No uncategorized expressions found.",
      }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const rows = expressions as ExpressionRow[];
    let totalCategorized = 0;
    let errors = 0;
    const perCategory: Record<string, number> = {};
    const failed: string[] = [];

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

      console.log(`[categorizer] Batch ${batchNum}/${totalBatches}: ${batch.length} expressions`);

      // Build prompt with expression list
      const exprList = batch.map((e, idx) =>
        `${idx + 1}. [${e.id}] "${e.english}" | CN: ${e.chinese || ""} | scene: ${e.scene || ""} | topic: ${e.topic || ""} | type: ${e.type || ""}`
      ).join("\n");

      const result = await callDeepSeek([
        { role: "system", content: CLASSIFY_PROMPT },
        { role: "user", content: `Classify these expressions:\n\n${exprList}` },
      ], { temperature: 0.3, maxTokens: 2048 });

      if (!result.success) {
        console.error(`[categorizer] Batch ${batchNum} AI failed: ${result.error}`);
        errors += batch.length;
        failed.push(`Batch ${batchNum}: ${result.error}`);
        continue;
      }

      const parsed = safeJsonParse<{ results: ClassifyResult[] }>(result.data);
      if (!parsed.success) {
        console.error(`[categorizer] Batch ${batchNum} parse failed: ${parsed.error}`);
        errors += batch.length;
        continue;
      }

      const classifications = parsed.data.results || [];

      // Build a map for fast lookup
      const classMap = new Map(classifications.map((c) => [c.id, c.category]));

      // Resolve category UUIDs for this batch (one query, not per-expression)
      const catNames = [...new Set(classifications.map((c) => c.category))];
      const { data: catRows } = await supabase
        .from("categories")
        .select("id, name")
        .eq("scope", "expression")
        .eq("user_id", userId)
        .in("name", catNames);
      const catIdMap = new Map((catRows || []).map((c: { id: string; name: string }) => [c.name, c.id]));

      // Update each expression
      for (const expr of batch) {
        const category = classMap.get(expr.id);
        if (!category || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
          errors++;
          continue;
        }

        const catId = catIdMap.get(category);
        if (!catId) {
          errors++;
          console.error(`[categorizer] Category not found: ${category}`);
          continue;
        }

        const { error: upErr } = await supabase
          .from("expressions")
          .update({ category_id: catId })
          .eq("id", expr.id);

        if (upErr) {
          errors++;
          console.error(`[categorizer] Update failed for ${expr.id}: ${upErr.message}`);
        } else {
          totalCategorized++;
          perCategory[category] = (perCategory[category] || 0) + 1;
        }
      }
    }

    // Log the run
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "expression_categorizer",
      action: "re categorize",
      input_data: { total_uncategorized: rows.length, batch_size: BATCH_SIZE },
      output_data: { total_categorized: totalCategorized, errors, per_category: perCategory },
    });

    return new Response(JSON.stringify({
      total: rows.length,
      categorized: totalCategorized,
      errors,
      per_category: perCategory,
      ...(failed.length > 0 ? { failed_batches: failed } : {}),
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(`[categorizer] Unhandled: ${(err as Error).message}`);
    return new Response(JSON.stringify({
      error: (err as Error).message || "Internal error",
    }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
