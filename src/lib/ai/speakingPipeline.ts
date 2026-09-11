import type { ChatCompletionOptions, ChatCompletionResponse } from "./client";
import {
  SPEAKING_DIAGNOSIS_PROMPT, SPEAKING_RECONSTRUCTION_PROMPT, SPEAKING_MODEL_ANSWER_PROMPT,
  SPEAKING_INDEPENDENCE_CHECK_PROMPT, SPEAKING_FIDELITY_CHECK_PROMPT,
  buildFeedbackPrompt, buildReconstructionPrompt, buildRetryFeedbackPrompt,
} from "./prompts";
import { normalizeSpeakingFeedback, parseSpeakingResponse } from "../english/speakingFeedback";

type Call = (options: ChatCompletionOptions) => Promise<ChatCompletionResponse>;
export interface SpeakingPipelineOptions {
  onProgress?: (message: string) => void;
  questionContext?: { mode?: string; topic?: string; part?: string; scenario?: string };
  targetLevel?: string;
  retryContext?: Parameters<typeof buildRetryFeedbackPrompt>[0];
}

function parseObject(content: string): Record<string, unknown> | null {
  try {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end < start) return null;
    const value = JSON.parse(content.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Diagnosis runs first; My Best Version explicitly consumes it. The model answer never sees learner content. */
export async function runSpeakingPipeline(call: Call, question: string, transcript: string, targets: string[], authToken: string, options?: SpeakingPipelineOptions) {
  const ask = (system: string, user: string, maxTokens = 4096) => call({
    model: system === SPEAKING_FIDELITY_CHECK_PROMPT || system === SPEAKING_INDEPENDENCE_CHECK_PROMPT ? "deepseek-v4-pro" : "deepseek-chat",
    maxTokens: system === SPEAKING_FIDELITY_CHECK_PROMPT || system === SPEAKING_INDEPENDENCE_CHECK_PROMPT ? 4096 : maxTokens,
    temperature: 0.3, speakingFeedback: true, injectContext: false, authToken,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });

  if (options?.retryContext) {
    options.onProgress?.("正在分析本次复述…");
    return parseSpeakingResponse((await ask(buildRetryFeedbackPrompt(options.retryContext),
      buildFeedbackPrompt(question, transcript, targets, options.questionContext))).content);
  }

  const priorReferences: string[] = [];
  const generateReference = (previous?: string) => {
    if (previous) priorReferences.push(previous);
    return ask(SPEAKING_MODEL_ANSWER_PROMPT, JSON.stringify({
      speaking_question: question,
      scenario: options?.questionContext?.scenario || "",
      question_type: options?.questionContext,
      target_level: options?.targetLevel || "IELTS Speaking 7.0–8.0",
      ...(previous ? { previous_model_answers: priorReferences,
        instruction: "Reject all central and supporting reasons from all previous answers. Choose one new concrete route and still answer directly." } : {}),
    }), 1800);
  };

  options?.onProgress?.("正在分析内容、结构与语言问题…");
  const [diagnosisResponse, reference] = await Promise.allSettled([
    ask(SPEAKING_DIAGNOSIS_PROMPT, buildFeedbackPrompt(question, transcript, targets, options?.questionContext)),
    generateReference(),
  ]);
  if (diagnosisResponse.status === "rejected") throw diagnosisResponse.reason;
  const diagnosisRaw = parseObject(diagnosisResponse.value.content);
  if (!diagnosisRaw) throw new Error("AI 诊断返回格式不完整，请重新分析。");
  const diagnosis = normalizeSpeakingFeedback(diagnosisRaw);

  options?.onProgress?.("正在根据诊断重新组织最佳表达…");
  let reconstructionResponse = await ask(SPEAKING_RECONSTRUCTION_PROMPT, buildReconstructionPrompt({
    question, transcript, diagnosis: diagnosis.reconstruction_diagnosis || diagnosisRaw,
    questionContext: options?.questionContext,
  }), 2200);
  let reconstructionRaw = parseObject(reconstructionResponse.content);
  let malformed = !reconstructionRaw;
  let result = normalizeSpeakingFeedback({
    ...diagnosisRaw, ...(reconstructionRaw || {}),
    reconstruction_diagnosis: diagnosis.reconstruction_diagnosis,
    answer_structure: diagnosis.reconstruction_diagnosis?.recommendedStructure || diagnosis.answer_structure,
  });

  if (result.final_upgraded_answer) {
    options?.onProgress?.("正在核对答案是否执行诊断…");
    let approved = false;
    let currentRejected = false;
    result.answer_status = "unchecked";
    for (let attempt = 0; attempt < 3; attempt++) {
      let verdict: Record<string, unknown> | null = null;
      try {
        const review = await ask(SPEAKING_FIDELITY_CHECK_PROMPT, JSON.stringify({
          learner_transcript: transcript, original_question: question,
          scenario: options?.questionContext?.scenario || "",
          structured_diagnosis: result.reconstruction_diagnosis,
          candidate_answer: result.final_upgraded_answer,
        }), 1800);
        verdict = parseObject(review.content);
      } catch { break; }
      if (!verdict) break;
      const rawPolicyViolations = verdict.policy_violations;
      const rawDiagnosisMisses = verdict.diagnosis_misses;
      const policyViolations = Array.isArray(rawPolicyViolations) ? rawPolicyViolations : [];
      const diagnosisMisses = Array.isArray(rawDiagnosisMisses) ? rawDiagnosisMisses : [];
      const validLists = [rawPolicyViolations, rawDiagnosisMisses, verdict.issues].every(value =>
        value === undefined || (Array.isArray(value) && value.every(item => typeof item === "string")));
      const rejected = verdict.faithful === false || policyViolations.length > 0 || diagnosisMisses.length > 0;
      currentRejected = rejected;
      if (!malformed && validLists && verdict.faithful === true && !rejected) {
        result = normalizeSpeakingFeedback({ ...result, revision_mode: result.revision_mode || verdict.revision_mode, answer_status: "verified" });
        approved = true;
        break;
      }
      if (!rejected && !malformed) break;
      if (attempt < 2) {
        options?.onProgress?.("发现答案未完全执行诊断，正在修复…");
        try {
          const requiredFixes = malformed ? ["上次 JSON 无法解析，请输出完整有效的 JSON。"]
            : [...policyViolations, ...diagnosisMisses, ...(Array.isArray(verdict.issues) ? verdict.issues : [])]
              .filter((item): item is string => typeof item === "string");
          reconstructionResponse = await ask(SPEAKING_RECONSTRUCTION_PROMPT, buildReconstructionPrompt({
            question, transcript, diagnosis: result.reconstruction_diagnosis || diagnosisRaw,
            questionContext: options?.questionContext, previousAnswer: result.final_upgraded_answer, requiredFixes,
          }), 2200);
          reconstructionRaw = parseObject(reconstructionResponse.content);
          malformed = !reconstructionRaw;
          result = normalizeSpeakingFeedback({
            ...diagnosisRaw, ...(reconstructionRaw || {}),
            reconstruction_diagnosis: diagnosis.reconstruction_diagnosis,
            answer_structure: diagnosis.reconstruction_diagnosis?.recommendedStructure || diagnosis.answer_structure,
            answer_status: "unchecked",
          });
          currentRejected = false;
        } catch { break; }
      }
    }
    if (!approved && (currentRejected || malformed)) {
      result = { ...result, final_upgraded_answer: "", answer_status: "unavailable", takeaway_expressions: [] };
    }
  }

  result.corrections = result.corrections.filter(c => transcript.includes(c.original));
  result.reference_answer = "";
  result.reference_angle_summary = "";
  result.reference_status = "unavailable";
  if (!result.final_upgraded_answer || reference.status === "rejected") return result;

  let candidate = parseSpeakingResponse(reference.value.content);
  options?.onProgress?.("正在检查参考答案是否采用独立思路…");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!candidate.reference_answer) break;
    try {
      const review = await ask(SPEAKING_INDEPENDENCE_CHECK_PROMPT, JSON.stringify({
        speaking_question: question, user_transcript: transcript,
        my_best_version: result.final_upgraded_answer, ai_model_answer: candidate.reference_answer,
      }), 600);
      const verdict = parseObject(review.content) || {};
      if (verdict.independent === true && !(Array.isArray(verdict.overlapping_arguments) && verdict.overlapping_arguments.length)) {
        return normalizeSpeakingFeedback({
          ...result, reference_answer: candidate.reference_answer,
          reference_angle_summary: candidate.reference_angle_summary, reference_status: "verified",
          takeaway_expressions: [...result.takeaway_expressions, ...candidate.takeaway_expressions],
        });
      }
      if (attempt < 2) candidate = parseSpeakingResponse((await generateReference(candidate.reference_answer)).content);
    } catch { break; }
  }
  return result;
}
