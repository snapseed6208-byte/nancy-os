// ============================================
// Nancy OS — Question Import Agent
// Extracts IELTS / speaking questions from text via DeepSeek
// Supports chunked processing for large inputs
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import type { AIRuntimeResult } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const MAX_TEXT_LENGTH = 20000;
const CHUNK_SIZE = 3500;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const EXTRACT_PROMPT = `You are an IELTS speaking examiner and English language assessment expert. Your task is to extract speaking practice questions from text.

## Question types to extract:

### IELTS Speaking (mode: "ielts")
- Part 1 (part1): Personal introduction questions — "Do you like...", "How often do you...", "What is your favorite..."
- Part 2 (part2): Cue card topics — "Describe a...", "Talk about a...", long-form topics with bullet points
- Part 3 (part3): Discussion/opinion questions — "Do you think...", "In your opinion...", "How has... changed..."

### Daily Conversation (mode: "daily")
- Everyday small talk: routines, hobbies, preferences, plans

### Professional (mode: "professional")
- Workplace, career, interview, business communication

### Personal Growth (mode: "personal_growth")
- Self-reflection, goals, values, life experiences, emotions

## For each question, provide:

1. **question**: The exact question text (clean it up, fix typos, but preserve meaning)
2. **mode**: "ielts" | "daily" | "professional" | "personal_growth"
3. **topic**: One of:
   - life_routine, food_health, travel_culture, people_relationships
   - study_learning, work_career, technology, entertainment
   - emotions, goals_future, experiences, opinions
4. **part**: "part1" | "part2" | "part3" | null (required for IELTS, null for non-IELTS)
5. **context**: Brief note about where this question appears (e.g., "IELTS Speaking Part 1 — Hometown", "Job interview — strengths and weaknesses", or null)
6. **cue_points**: For Part 2 only — an array of cue card bullet points as strings, e.g. ["what it is", "where you got it", "why you like it"]. null for non-Part-2.
7. **tags**: 2-5 short tags in English describing the question, e.g. ["hometown", "weather", "preferences"]
8. **difficulty**: "easy" | "medium" | "hard"

## Rules:
- Extract ALL speaking questions you find. Don't skip any.
- If a question has cue card bullet points (Part 2), extract them as cue_points array.
- If text contains dialogue or example answers, extract only the QUESTIONS, not the answers.
- If you see numbered questions like "1. What is..." or "Q: ...", extract the question part.
- Difficulty: easy = simple personal question, medium = requires some reasoning, hard = abstract/analytical
- IMPORTANT: Return ONLY questions that are suitable for speaking practice. Skip reading comprehension questions, grammar exercises, etc.

## Deduplication info:
For each question, also compute:
- **normalized_question**: lowercase, remove punctuation, collapse whitespace, remove leading "question" / "q:" / numbers
- **content_hash**: we will compute this server-side

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "What do you usually do in your free time?",
      "mode": "ielts",
      "topic": "life_routine",
      "part": "part1",
      "context": "IELTS Speaking Part 1 — Free Time",
      "cue_points": null,
      "tags": ["free time", "hobbies", "daily routine"],
      "difficulty": "easy",
      "normalized_question": "what do you usually do in your free time"
    }
  ]
}`;

const SEMANTIC_DEDUP_PROMPT = `You are a precise question similarity analyzer. Compare the NEW question against a list of EXISTING questions in the database.

For each existing question, determine if the new question is:
- "duplicate": Same question, just rephrased slightly (e.g., "What do you do in free time?" vs "What do you usually do in your free time?")
- "variant": Related but different angle (e.g., "What do you do in free time?" vs "How do you spend your weekends?")
- "new": Different topic entirely

Return ONLY valid JSON:
{
  "results": [
    {"existing_id": "uuid-of-existing", "status": "duplicate"},
    {"existing_id": "uuid-of-existing", "status": "variant"}
  ]
}

Rules:
- "duplicate" means the questions are functionally the same — they would elicit the same answer
- "variant" means they're in the same topic area but ask for different information
- If unsure between duplicate and variant, choose variant (safer — let user decide)
- Return an empty array if no matches found.`;

function errResponse(body: Record<string, unknown>, req: Request, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = pos + size;
    if (end < text.length) {
      // Try to break at a double newline
      const search = text.slice(pos, end + 200);
      const breakPt = search.lastIndexOf("\n\n");
      if (breakPt > size * 0.5) {
        end = pos + breakPt;
      } else {
        // Try to break at a single newline
        const nl = search.lastIndexOf("\n");
        if (nl > size * 0.5) end = pos + nl;
      }
    }
    chunks.push(text.slice(pos, end).trim());
    pos = end;
  }
  return chunks.filter((c) => c.length > 0);
}

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/^[\d]+[.)]\s*/, "")       // Remove leading numbers like "1."
    .replace(/^(q|question)[:.\s]*/i, "") // Remove "Q:" or "Question:"
    .replace(/[^\w\s]/g, "")             // Remove punctuation
    .replace(/\s+/g, " ")                // Collapse whitespace
    .trim();
}

async function computeHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ExtractedQuestion {
  question: string;
  mode: string;
  topic: string;
  part: string | null;
  context: string | null;
  cue_points: string[] | null;
  tags: string[];
  difficulty: string;
  normalized_question: string;
}

interface DedupResult {
  existing_id: string;
  status: "duplicate" | "variant" | "new";
}

const VALID_MODES = ["ielts", "daily", "professional", "personal_growth"];
const VALID_TOPICS = [
  "life_routine", "food_health", "travel_culture", "people_relationships",
  "study_learning", "work_career", "technology", "entertainment",
  "emotions", "goals_future", "experiences", "opinions",
];
const VALID_PARTS = ["part1", "part2", "part3"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

function validateQuestion(q: Record<string, unknown>): string | null {
  if (!q.question || typeof q.question !== "string" || q.question.trim().length < 5) {
    return "question must be a non-empty string (min 5 chars)";
  }
  if (!VALID_MODES.includes(q.mode as string)) {
    return `invalid mode: ${q.mode}`;
  }
  if (!VALID_TOPICS.includes(q.topic as string)) {
    return `invalid topic: ${q.topic}`;
  }
  if (q.part !== null && q.part !== undefined && !VALID_PARTS.includes(q.part as string)) {
    return `invalid part: ${q.part}`;
  }
  if (q.difficulty && !VALID_DIFFICULTIES.includes(q.difficulty as string)) {
    return `invalid difficulty: ${q.difficulty}`;
  }
  if (q.tags && !Array.isArray(q.tags)) {
    return "tags must be an array";
  }
  if (q.cue_points !== null && q.cue_points !== undefined && !Array.isArray(q.cue_points)) {
    return "cue_points must be an array or null";
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // ── Parse body ──
    let body: { text?: string; existing_ids?: string[]; mode_filter?: string; topic_filter?: string };
    try {
      body = await req.json() as typeof body;
    } catch {
      return errResponse({ stage: "payload", error: "请求格式错误，无法解析 JSON" }, req, 400);
    }

    const text = (body.text || "").trim();
    if (!text || text.length === 0) {
      return errResponse({ stage: "payload", error: "请提供文本内容" }, req, 400);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return errResponse({
        stage: "payload",
        error: `文本过长 (${text.length} 字符)，上限 ${MAX_TEXT_LENGTH} 字符。请拆分后分批导入。`,
      }, req, 400);
    }

    // ── Auth ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let user: { id: string };
    try {
      const authResult = await supabase.auth.getUser(token);
      if (authResult.error || !authResult.data?.user) {
        return errResponse({ stage: "auth", error: "Unauthorized" }, req, 401);
      }
      user = authResult.data.user;
    } catch (authCatchErr) {
      console.error(`[question-import-agent] Auth error: ${(authCatchErr as Error).message}`);
      return errResponse({ stage: "auth", error: "认证服务异常" }, req, 500);
    }

    // ── Phase 1: Extract questions from text ──
    const chunks = chunkText(text, CHUNK_SIZE);
    console.log(`[question-import-agent] Processing ${chunks.length} chunks, total ${text.length} chars`);

    const allQuestions: ExtractedQuestion[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkLabel = chunks.length > 1 ? ` (chunk ${i + 1}/${chunks.length})` : "";

      const aiResult = await aiRuntime<{ questions: ExtractedQuestion[] }>(
        [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: `Extract ALL speaking practice questions from this text${chunkLabel}:\n\n${chunk}` },
        ],
        { agentName: "question-import", maxTokens: 4096, temperature: 0.3 },
      );

      if (!aiResult.success) {
        return errResponse({
          stage: aiResult.stage,
          error: aiResult.error,
          detail: aiResult.detail,
          chunk: chunks.length > 1 ? i + 1 : undefined,
          total_chunks: chunks.length > 1 ? chunks.length : undefined,
        }, req, 500);
      }

      const parsed = aiResult.data as unknown as Record<string, unknown>;
      const questions = (parsed.questions as Array<Record<string, unknown>>) || [];

      // Validate each question
      for (const q of questions) {
        const err = validateQuestion(q);
        if (err) {
          console.warn(`[question-import-agent] Skipping invalid question in chunk ${i + 1}: ${err}`, q);
          continue;
        }
        // Compute server-side normalized_question (overwrite AI's)
        const norm = normalizeQuestion(q.question as string);
        allQuestions.push({
          question: (q.question as string).trim(),
          mode: q.mode as string,
          topic: q.topic as string,
          part: (q.part as string) || null,
          context: (q.context as string) || null,
          cue_points: Array.isArray(q.cue_points) ? q.cue_points as string[] : null,
          tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
          difficulty: (q.difficulty as string) || "medium",
          normalized_question: norm,
        });
      }
    }

    if (allQuestions.length === 0) {
      return errResponse({
        stage: "parse",
        error: "未能从文本中提取到任何口语题目。请确认文件包含口语练习题或对话话题。如果是扫描版 PDF，当前不支持 OCR 文字识别。",
        questions_found: 0,
      }, req, 422);
    }

    // ── Phase 2: Dedup — compute content hashes & check DB ──
    const questionsWithHash = await Promise.all(
      allQuestions.map(async (q) => ({
        ...q,
        content_hash: await computeHash(q.normalized_question),
      }))
    );

    // Check exact duplicates in DB
    const hashes = questionsWithHash.map((q) => q.content_hash);
    const { data: existingExact, error: exactErr } = await supabase
      .from("speaking_questions")
      .select("id, content_hash, question, mode, topic")
      .eq("user_id", user.id)
      .in("content_hash", hashes);

    if (exactErr) {
      console.error(`[question-import-agent] DB exact dedup query failed: ${exactErr.message}`);
    }

    const exactHashSet = new Set((existingExact || []).map((e: { content_hash: string }) => e.content_hash));

    // Mark exact duplicates
    const dedupResults = new Map<string, DedupResult>(); // keyed by question text (temp ID)
    const tempIdMap = new Map<string, string>(); // question text → index

    questionsWithHash.forEach((q, idx) => {
      const tempId = `q_${idx}`;
      tempIdMap.set(tempId, q.question);

      if (exactHashSet.has(q.content_hash)) {
        const existing = (existingExact || []).find((e: { content_hash: string }) => e.content_hash === q.content_hash);
        dedupResults.set(tempId, {
          existing_id: existing?.id || "",
          status: "duplicate",
        });
      }
    });

    // ── Phase 3: Semantic dedup for remaining new questions ──
    const newQuestions = questionsWithHash.filter((_, idx) => {
      const r = dedupResults.get(`q_${idx}`);
      return !r || r.status !== "duplicate";
    });

    if (newQuestions.length > 0) {
      // Fetch candidate existing questions with same mode/topic for semantic comparison
      const modes = [...new Set(newQuestions.map((q) => q.mode))];
      const topics = [...new Set(newQuestions.map((q) => q.topic))];

      const { data: candidates } = await supabase
        .from("speaking_questions")
        .select("id, question, normalized_question, mode, topic")
        .eq("user_id", user.id)
        .in("mode", modes)
        .in("topic", topics)
        .limit(100);

      if (candidates && candidates.length > 0) {
        // For each new question, ask AI to compare against up to 10 most relevant candidates
        for (let i = 0; i < newQuestions.length; i++) {
          const nq = newQuestions[i];
          const relevantCandidates = candidates
            .filter((c: { mode: string; topic: string }) => c.mode === nq.mode && c.topic === nq.topic)
            .slice(0, 10);

          if (relevantCandidates.length === 0) continue;

          const candidateList = relevantCandidates
            .map((c: { id: string; question: string }) => `ID: ${c.id}\nQuestion: ${c.question}`)
            .join("\n\n");

          const semResult = await aiRuntime<{ results: Array<{ existing_id: string; status: string }> }>(
            [
              { role: "system", content: SEMANTIC_DEDUP_PROMPT },
              {
                role: "user",
                content: `NEW QUESTION: "${nq.question}"\nMode: ${nq.mode}\nTopic: ${nq.topic}\n\nEXISTING QUESTIONS:\n${candidateList}`,
              },
            ],
            { agentName: "question-import-dedup", maxTokens: 1024, temperature: 0.1 },
          );

          if (semResult.success) {
            const semData = semResult.data as unknown as { results?: Array<{ existing_id: string; status: string }> };
            for (const r of (semData.results || [])) {
              if (r.status === "duplicate" || r.status === "variant") {
                const origIdx = questionsWithHash.indexOf(nq);
                dedupResults.set(`q_${origIdx}`, {
                  existing_id: r.existing_id,
                  status: r.status as "duplicate" | "variant",
                });
              }
            }
          } else {
            // AI dedup failed — mark as needs_review rather than failing the whole import
            const origIdx = questionsWithHash.indexOf(nq);
            dedupResults.set(`q_${origIdx}`, {
              existing_id: "",
              status: "needs_review" as unknown as "duplicate",
            });
          }
        }
      }
    }

    // ── Build final output ──
    const output = questionsWithHash.map((q, idx) => {
      const tempId = `q_${idx}`;
      const dedup = dedupResults.get(tempId);
      const status = dedup?.status || "new";
      const duplicate_of = dedup?.existing_id || null;

      return {
        temp_id: tempId,
        question: q.question,
        normalized_question: q.normalized_question,
        content_hash: q.content_hash,
        mode: q.mode,
        topic: q.topic,
        part: q.part,
        context: q.context,
        cue_points: q.cue_points,
        tags: q.tags,
        difficulty: q.difficulty,
        status,
        duplicate_of,
      };
    });

    // ── Log ──
    try {
      await supabase.from("agent_logs").insert({
        user_id: user.id,
        agent_type: "question_import",
        action: "extract_questions",
        input_data: { text_length: text.length, chunks: chunks.length },
        output_data: {
          questions_found: output.length,
          new_count: output.filter((o) => o.status === "new").length,
          duplicate_count: output.filter((o) => o.status === "duplicate").length,
          variant_count: output.filter((o) => o.status === "variant").length,
          needs_review: output.filter((o) => o.status === "needs_review").length,
        },
        model: "deepseek-chat",
      });
    } catch (dbErr) {
      console.error(`[question-import-agent] DB log insert failed: ${(dbErr as Error).message}`);
    }

    return new Response(JSON.stringify({
      questions: output,
      stats: {
        total: output.length,
        new_count: output.filter((o) => o.status === "new").length,
        duplicate_count: output.filter((o) => o.status === "duplicate").length,
        variant_count: output.filter((o) => o.status === "variant").length,
        needs_review: output.filter((o) => o.status === "needs_review").length,
      },
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(`[question-import-agent] UNHANDLED exception: ${(err as Error).message}`, (err as Error).stack);
    return errResponse({
      stage: "internal",
      error: (err as Error).message || "服务器内部错误",
    }, req, 500);
  }
});
