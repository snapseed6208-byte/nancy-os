// ============================================
// Nancy OS — Asset Mining Agent v1
// Phase 3.5: Extracts expression asset candidates
// from user-generated text across all modules.
//
// Actions:
//   mine_from_text  — AI extracts candidates from raw text
//   save_candidates — User-confirmed candidates → INSERT into expression_assets
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateRequest,
  getCorsHeaders,
  jsonResponse,
  mineAssetCandidates,
} from "../_shared/nancy-context.ts";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req, ALLOWED_ORIGINS) });
  }

  const startTime = Date.now();

  try {
    const corsHeaders = getCorsHeaders(req, ALLOWED_ORIGINS);
    const auth = await authenticateRequest(req);
    if (!auth) return jsonResponse({ error: "未登录" }, corsHeaders, 401);
    const { supabase, userId } = auth;

    const body = await req.json();
    const action = (body.action as string) || "";

    switch (action) {

      // ═══════════════════════════════════════
      // mine_from_text: AI extracts candidates
      // ═══════════════════════════════════════
      case "mine_from_text": {
        const text = (body.text as string) || "";
        const sourceType = (body.source_type as string) || "manual";
        const sourceRefId = (body.source_ref_id as string) || undefined;
        const maxCandidates = (body.max_candidates as number) || 3;

        if (!text || text.trim().length < 30) {
          return jsonResponse({
            success: true,
            candidates: [],
            message: "文本太短，无法提取资产（至少需要30字）",
          }, corsHeaders);
        }

        console.log(`[asset-mining-agent] mine_from_text source=${sourceType} textLen=${text.length}`);

        const candidates = await mineAssetCandidates(supabase, userId, text, {
          sourceType,
          sourceRefId,
          maxCandidates,
        });

        const duration = Date.now() - startTime;
        console.log(`[asset-mining-agent] mine_from_text done found=${candidates.length} duration=${duration}ms`);

        return jsonResponse({
          success: true,
          candidates,
          source_type: sourceType,
          source_ref_id: sourceRefId,
          duration_ms: duration,
        }, corsHeaders);
      }

      // ═══════════════════════════════════════
      // save_candidates: User confirmed → INSERT
      // ═══════════════════════════════════════
      case "save_candidates": {
        const candidates = (body.candidates as Array<Record<string, unknown>>) || [];

        if (!Array.isArray(candidates) || candidates.length === 0) {
          return jsonResponse({
            error: "candidates array is required and must be non-empty",
          }, corsHeaders, 400);
        }

        console.log(`[asset-mining-agent] save_candidates count=${candidates.length}`);

        const inserted: Array<Record<string, unknown>> = [];
        const errors: Array<{ index: number; error: string }> = [];

        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i];
          try {
            const { data, error: insErr } = await supabase
              .from("expression_assets")
              .insert({
                user_id: userId,
                asset_type: c.asset_type,
                title: c.title,
                asset_data: c.asset_data || {},
                extracted_from_transcript: c.evidence_quote || "",
                evidence_quote: c.evidence_quote || "",
                confidence: (c.confidence as number) >= 0.7 ? "high" : "medium",
                fact_status: "ai_suggested",
                tags: Array.isArray(c.tags) ? c.tags : [],
                quality_score: {
                  completeness: Math.round((c.confidence as number || 0.5) * 100),
                  authenticity: 100, // directly from user text
                  reusability: 50,
                },
                source_type: c.source || body.source_type || "manual",
                source_ref_id: c.source_ref_id || body.source_ref_id || null,
              })
              .select("id,title,asset_type")
              .single();

            if (insErr) {
              errors.push({ index: i, error: insErr.message });
            } else if (data) {
              inserted.push(data as Record<string, unknown>);
            }
          } catch (err) {
            errors.push({ index: i, error: (err as Error).message });
          }
        }

        // Log
        if (inserted.length > 0) {
          await supabase.from("agent_logs").insert({
            user_id: userId,
            agent_type: "asset_mining",
            action: "save_candidates",
            input_data: {
              candidate_count: candidates.length,
              source_type: body.source_type || "manual",
            },
            output_data: {
              inserted_count: inserted.length,
              error_count: errors.length,
              inserted_ids: inserted.map((r) => r.id),
            },
            model: "none",
            tokens_used: 0,
          });
        }

        const duration = Date.now() - startTime;
        return jsonResponse({
          success: errors.length === 0,
          inserted,
          inserted_count: inserted.length,
          errors: errors.length > 0 ? errors : undefined,
          duration_ms: duration,
        }, corsHeaders, errors.length > 0 ? 207 : 200);
      }

      default: {
        return jsonResponse({
          error: `Unknown action: ${action}`,
          valid_actions: ["mine_from_text", "save_candidates"],
        }, corsHeaders, 400);
      }
    }
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    }, 500);
  }
});
