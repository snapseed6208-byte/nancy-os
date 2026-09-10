import type { ChatCompletionOptions, ChatCompletionResponse } from "./client";
import { SPEAKING_FEEDBACK_PROMPT, SPEAKING_MODEL_ANSWER_PROMPT, SPEAKING_INDEPENDENCE_CHECK_PROMPT, SPEAKING_FIDELITY_CHECK_PROMPT, buildFeedbackPrompt, buildRetryFeedbackPrompt } from "./prompts";
import { normalizeSpeakingFeedback, parseSpeakingResponse } from "../english/speakingFeedback";

type Call = (options: ChatCompletionOptions) => Promise<ChatCompletionResponse>;
export interface SpeakingPipelineOptions {
  onProgress?: (message: string) => void;
  questionContext?: { mode?: string; topic?: string; part?: string };
  targetLevel?: string;
  retryContext?: Parameters<typeof buildRetryFeedbackPrompt>[0];
}

/** The answer generator never sees the transcript; the reviewer cannot author answers. */
export async function runSpeakingPipeline(call: Call, question: string, transcript: string, targets: string[], authToken: string, options?: SpeakingPipelineOptions) {
  options?.onProgress?.("正在生成反馈与独立示范…");
  const ask = (system: string, user: string, maxTokens = 4096) => call({
    model: system === SPEAKING_FIDELITY_CHECK_PROMPT || system === SPEAKING_INDEPENDENCE_CHECK_PROMPT ? "deepseek-v4-pro" : "deepseek-chat",
    maxTokens: system === SPEAKING_FIDELITY_CHECK_PROMPT || system === SPEAKING_INDEPENDENCE_CHECK_PROMPT ? 4096 : maxTokens,
    temperature: 0.3, speakingFeedback: true, injectContext: false, authToken,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  const mainPromise = ask(options?.retryContext ? buildRetryFeedbackPrompt(options.retryContext) : SPEAKING_FEEDBACK_PROMPT,
    buildFeedbackPrompt(question, transcript, targets, options?.questionContext));
  if (options?.retryContext) return parseSpeakingResponse((await mainPromise).content);

  const priorReferences: string[] = [];
  const generateReference = (previous?: string) => {
    if (previous) priorReferences.push(previous);
    return ask(SPEAKING_MODEL_ANSWER_PROMPT, JSON.stringify({
    speaking_question: question, target_level: options?.targetLevel || "IELTS Speaking 7.0–8.0",
    part: options?.questionContext?.part,
    ...(previous ? { previous_model_answers: priorReferences, instruction: "Reject ALL central and supporting reasons from ALL your previous answers. Choose ONE new concrete route only. Do not mix in prior arguments as additional advantages. Consider a limitation, condition, trade-off, or change over time instead. Still answer the question directly." } : {}),
  }), 1800);
  };
  const [main, reference] = await Promise.allSettled([mainPromise, generateReference()]);
  if (main.status === "rejected") throw main.reason;
  let result = parseSpeakingResponse(main.value.content);
  let malformed = false;
  try { JSON.parse(main.value.content.slice(main.value.content.indexOf("{"), main.value.content.lastIndexOf("}") + 1)); } catch { malformed = true; }
  if (result.final_upgraded_answer) {
    options?.onProgress?.("正在逐项核对原意，请稍候…");
    let approved = false;
    let currentRejected = false;
    result.answer_status = "unchecked";
    for (let attempt = 0; attempt < 3; attempt++) {
      let verdict: any = null;
      try {
        const review = await ask(SPEAKING_FIDELITY_CHECK_PROMPT, JSON.stringify({user_transcript:transcript,speaking_question:question,candidate:{final_upgraded_answer:result.final_upgraded_answer,corrections:result.corrections,key_issues:result.key_issues,optimization_summary:result.optimization_summary}}), 1800);
        const match = review.content.match(/\{[\s\S]*\}/);
        verdict = match ? JSON.parse(match[0]) : null;
      } catch {
        // The audit call itself failed (timeout/network). That is not evidence of fabrication —
        // keep the student's best version instead of discarding it.
        break;
      }
      if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) break;
      // Only a real unfaithfulness verdict or unsupported content vetoes; teaching-field wording
      // inconsistencies (teaching_errors) are advisory and must not discard a faithful answer.
      const unfaithful = verdict.faithful === false || (verdict.unsupported_claims?.length ?? 0) > 0;
      currentRejected = unfaithful;
      const validLists = [verdict.unsupported_claims, verdict.teaching_errors].every(value => value === undefined || (Array.isArray(value) && value.every(item => typeof item === "string")));
      if (!malformed && validLists && verdict.faithful === true && !unfaithful) {
        result = normalizeSpeakingFeedback({...result,revision_mode:result.revision_mode || verdict.revision_mode,answer_status:"verified"});
        if (verdict.teaching_errors?.length) {
          // Keep the verified answer, but do not teach from explanations the audit rejected.
          result = {...result, teaching_status:"needs_review", corrections:[], key_issues:[], optimization_summary:"", content_diagnosis:"", structure_diagnosis:"", optimization_advice:"", answer_structure:[], takeaway_expressions:[], detailed_analysis:{}};
        }
        approved = true;
        break;
      }
      if (!unfaithful && !malformed) break;
      if (attempt < 2) {
        options?.onProgress?.("发现需要修正的内容，正在修复并重新核对…");
        try {
          const revision = await ask(SPEAKING_FEEDBACK_PROMPT, "优先修复以下审计问题，输出完整且严格有效的反馈 JSON。不要反复使用被拒绝的措辞。\n" + JSON.stringify({required_fixes:malformed?["上次 JSON 无法解析，请输出完整有效的 JSON，数组中的说明用中文引号。",...(verdict.issues||[])]:verdict.issues,previous_answer:result.final_upgraded_answer,previous_corrections:result.corrections}) + "\n" + buildFeedbackPrompt(question,transcript,targets,options?.questionContext));
          result = parseSpeakingResponse(revision.content);
          result.answer_status = "unchecked";
          currentRejected = false;
          try { JSON.parse(revision.content.slice(revision.content.indexOf("{"),revision.content.lastIndexOf("}")+1)); malformed=false; } catch { malformed=true; }
        } catch { break; }
      }
    }
    // A failed repair cannot erase a rejection of the current candidate.
    if (!approved && (currentRejected || malformed)) result = {...result,final_upgraded_answer:"",answer_status:"unavailable",takeaway_expressions:[],answer_structure:[]};
  }
  result.corrections = result.corrections.filter(c=>transcript.includes(c.original));
  // Never trust a reference produced by the transcript-aware main call.
  result.reference_answer = "";
  result.reference_angle_summary = "";
  result.reference_status = "unavailable";
  if (!result.final_upgraded_answer || reference.status === "rejected") return result;
  let candidate = parseSpeakingResponse(reference.value.content);
  options?.onProgress?.("正在检查示范是否采用独立思路…");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!candidate.reference_answer) break;
    try {
      const review = await ask(SPEAKING_INDEPENDENCE_CHECK_PROMPT, JSON.stringify({
        speaking_question: question, user_transcript: transcript, my_best_version: result.final_upgraded_answer,
        ai_model_answer: candidate.reference_answer,
      }), 600);
      const match = review.content.match(/\{[\s\S]*\}/);
      const verdict = match ? JSON.parse(match[0]) : {};
      if (verdict.independent === true && !(verdict.overlapping_arguments?.length)) {
        return normalizeSpeakingFeedback({ ...result, reference_answer: candidate.reference_answer,
          reference_angle_summary: candidate.reference_angle_summary, reference_status: "verified",
          takeaway_expressions: [...result.takeaway_expressions, ...candidate.takeaway_expressions],
        });
      }
      if (attempt < 2) candidate = parseSpeakingResponse((await generateReference(candidate.reference_answer)).content);
    } catch { break; } // Optional reference failures do not discard the student's best version.
  }
  return result;
}
