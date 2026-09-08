# Speaking Feedback Simplification Audit

## A. Current flow

EnglishSpeaking.tsx: recording → ASR/transcript confirmation → analyzeSpeaking → results → saveFirstAttempt → retry recording → analyzeSpeaking with retryContext → save Round 2. Audio and transcription are separate from AI text feedback.

englishCoach.ts sends browser-owned prompts via callAI to english-coach Edge Function. Its normal coaching branch forwards messages to aiRuntime (raw text), injecting learning/profile/story context; it does not enforce a speaking JSON schema. The unrelated sentence-evaluation branch has its own schema and must remain untouched.

## B. Current response schema

Main call: naturalVersion, fluencyScore, grammarScore, vocabularyScore, naturalnessScore, mainProblems, usefulCorrections, betterChunks, oneBetterExample, expressionsUsed, expressionsMissed, expressionUpgrade, contentAnalysis, answerStructure, finalHighScoreAnswer (older alias structuredBetterAnswer), diagnosis, keyImprovements, keyUpgrades.

naturalVersion explicitly preserves content order and only repairs language. finalHighScoreAnswer reorganizes content toward a higher band. oneBetterExample is another 4–5 sentence answer with similar ideas. A second generateReferenceAnswer call returns referenceAnswer using only the question. Thus four generated answer texts, not three; no current standalone optimized_version field. The first three share a call. Retry extends the entire first-round prompt and explicitly demands the same detail, causing version proliferation again.

## C. Current UI

EnglishSpeaking results renders four score bars, natural answer, expression usage, detailed corrections, expression-upgrade cards, three content scores, requirements/problems, structure, diagnosis, high-score answer, improvements, key upgrades, and oneBetterExample. The separately generated reference is saved but not displayed in live results. SessionDetail shows natural answer, reference, structured high-score answer and extensive analysis. Retry offers structure/full/hidden reference modes and seven comparison scores. These are stacked cards on mobile too.

## D. Duplicate fields

naturalVersion / finalHighScoreAnswer / oneBetterExample repeat answers; betterChunks / expressionUpgrade / keyUpgrades repeat learning expressions; mainProblems / diagnosis / contentAnalysis / keyImprovements repeat explanation. Keep scores, original transcript/audio/question, target-expression usage, corrections and detailed content diagnostics. Remove extra answer generation and duplicate display. Keep legacy aliases only in the historical reader, never generate more versions for compatibility.

## E. Historical compatibility

speaking_attempts stores natural_version, structured_better_answer, reference_answer, combined_feedback and dimension columns. Migrations 063/064/066 add content_analysis JSONB, answer_structure, key_upgrades, diagnosis, key_improvements. useCreateSpeakingAttempt inserts supplied columns; useSpeakingSession reads complete attempts. No other current frontend consumes SpeakingFeedback or generateBetterVersion. History and speaking statistics rely on existing score columns; preserve those writes. Existing records must not be rewritten.

## F. Proposed target schema

overall_score, target_score (nullable), key_issues (up to 3), revision_mode (light/structure/expand/trim/rewrite), optimization_summary, final_upgraded_answer, reference_answer, takeaway_expressions (up to 4), detailed_analysis (scores/content diagnostics/corrections/target-expression usage). Explicit expansion_notice marks any proposed expansion as reference material rather than a personal fact. Retry returns performance and retry_checks only, preserving the original learning target locally.

## G. Proposed UI

Shared feedback component for current results/history: 本轮表现 → 优化思路 → prominent 最终优化表达 → optional 可带走的表达 → collapsed AI 参考答案. Show estimated overall level and at most three issues; keep detailed metrics stored. Retry targets only final_upgraded_answer and checks completeness, core expression retention, language and naturalness without new answers.

## H. Migration requirement

No SQL migration, backfill or deletion needed. Store the versioned canonical feedback inside existing content_analysis.feedback_v2, with detailed content metrics retained alongside it. Existing natural_version remains an empty compatibility column for new writes; structured_better_answer can hold the single canonical answer for older readers. Read canonical first, then high_score_version/finalHighScoreAnswer/structured_better_answer/structuredBetterAnswer, optimized_version, natural_version/naturalVersion. Do not reinterpret independent reference as the user's answer.

## I. Risks

Type assertions currently accept malformed arrays/objects and can crash rendering. Replace them with a defensive speaking-only normalizer. Edge currently injects profile/story context regardless of inject_context; a narrowly scoped speaking request flag must suppress these injections so the current transcript is the only personal-fact source. LLM adherence (light edits, truthful expansion, distinct reference) requires separate semantic evaluation; fixture tests cannot prove live model behavior. Current working tree has unrelated changes; leave them untouched. No deploy or push authorized.
