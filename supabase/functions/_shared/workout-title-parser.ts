export type WorkoutFactSource = "title" | "description" | "metadata";
export type WorkoutFactConfidence = "high";

export type CanonicalWorkoutType =
  | "stretching"
  | "warmup"
  | "strength"
  | "hiit"
  | "cardio"
  | "yoga"
  | "pilates"
  | "mobility"
  | "recovery"
  | "sculpt";

export type CanonicalDifficulty = "beginner" | "intermediate" | "advanced";

export interface Fact<T> {
  value: T;
  source: WorkoutFactSource;
  evidence: string;
  confidence: WorkoutFactConfidence;
}

export interface LockedWorkoutFacts {
  durationMinutes?: Fact<number>;
  trainingType?: Fact<CanonicalWorkoutType>;
  difficulty?: Fact<CanonicalDifficulty>;
  equipmentRequired?: Fact<boolean>;
  equipment?: Fact<string[]>;
  bodyParts?: Fact<string[]>;
  scenarios?: Fact<string[]>;
  creator?: Fact<string>;
}

export interface VideoSourceEvidence {
  platform: "bilibili" | "douyin" | "other";
  url: string;
  title?: string;
  description?: string;
  author?: string;
  coverUrl?: string;
  transcript?: string;
  pageText?: string;
  userContext?: string;
  sourceLevel:
    | "transcript"
    | "page_content"
    | "platform_metadata"
    | "database_metadata"
    | "title_only"
    | "url_only";
}

export interface WorkoutFactConflict {
  field: string;
  ai_value: unknown;
  locked_value: unknown;
  final_value: unknown;
  source: WorkoutFactSource;
  evidence: string;
}

type MatchRule<T> = { value: T; pattern: RegExp };

function highFact<T>(value: T, source: WorkoutFactSource, evidence: string): Fact<T> {
  return { value, source, evidence, confidence: "high" };
}

function findMatch<T>(text: string, rules: MatchRule<T>[]): { value: T; evidence: string } | null {
  let best: { value: T; evidence: string; index: number; ruleIndex: number } | null = null;
  rules.forEach((rule, ruleIndex) => {
    const match = text.match(rule.pattern);
    if (!match || match.index === undefined) return;
    if (!best || match.index < best.index || (match.index === best.index && ruleIndex < best.ruleIndex)) {
      best = { value: rule.value, evidence: match[0], index: match.index, ruleIndex };
    }
  });
  return best ? { value: best.value, evidence: best.evidence } : null;
}

function findFact<T>(
  title: string,
  description: string,
  rules: MatchRule<T>[],
): Fact<T> | undefined {
  const titleMatch = findMatch(title, rules);
  if (titleMatch) return highFact(titleMatch.value, "title", titleMatch.evidence);
  const descriptionMatch = findMatch(description, rules);
  if (descriptionMatch) return highFact(descriptionMatch.value, "description", descriptionMatch.evidence);
  return undefined;
}

function extractDuration(title: string, description: string): Fact<number> | undefined {
  const pattern = /(\d{1,3})\s*(?:mins?|minutes?)\b|(\d{1,3})\s*分钟/iu;
  for (const [source, text] of [["title", title], ["description", description]] as const) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1] || match[2]);
    if (Number.isFinite(value) && value >= 1 && value <= 300) {
      return highFact(value, source, match[0]);
    }
  }
  return undefined;
}

const TRAINING_TYPE_RULES: MatchRule<CanonicalWorkoutType>[] = [
  { value: "stretching", pattern: /拉伸|伸展|stretch(?:ing)?/iu },
  { value: "warmup", pattern: /热身|warm[\s-]?up/iu },
  { value: "recovery", pattern: /恢复|康复|recovery|rehab(?:ilitation)?/iu },
  { value: "mobility", pattern: /灵活性|柔韧性|活动度|flexibility|mobility/iu },
  { value: "hiit", pattern: /\bHIIT\b|高强度间歇|Tabata/iu },
  { value: "cardio", pattern: /有氧|cardio|aerobic/iu },
  { value: "strength", pattern: /力量|增力|strength|weight[\s-]?training/iu },
  { value: "yoga", pattern: /瑜伽|yoga/iu },
  { value: "pilates", pattern: /普拉提|pilates/iu },
  { value: "sculpt", pattern: /塑形|雕刻|sculpt(?:ing)?|toning/iu },
];

const DIFFICULTY_RULES: MatchRule<CanonicalDifficulty>[] = [
  { value: "beginner", pattern: /初级|入门|新手(?:友好)?|beginner/iu },
  { value: "intermediate", pattern: /中级|进阶|intermediate/iu },
  { value: "advanced", pattern: /高级|高阶|advanced/iu },
];

const NO_EQUIPMENT_RULES: MatchRule<boolean>[] = [
  { value: false, pattern: /无器械|徒手|自重|no[\s-]?equipment|bodyweight|no[\s-]?weights?/iu },
];

const EQUIPMENT_RULES: MatchRule<string>[] = [
  { value: "resistance_band", pattern: /弹力带|阻力带|resistance[\s-]?bands?/iu },
  { value: "dumbbell", pattern: /哑铃|dumbbells?/iu },
  { value: "barbell", pattern: /杠铃|barbells?/iu },
  { value: "kettlebell", pattern: /壶铃|kettlebells?/iu },
  { value: "yoga_mat", pattern: /瑜伽垫|yoga[\s-]?mat/iu },
  { value: "foam_roller", pattern: /泡沫轴|foam[\s-]?roller/iu },
  { value: "jump_rope", pattern: /跳绳|jump[\s-]?rope/iu },
];

const BODY_PART_RULES: MatchRule<string>[] = [
  { value: "calves", pattern: /小腿|腓肠肌|calves?|lower[\s-]?legs?/iu },
  { value: "glutes", pattern: /臀腿|臀部|臀肌|翘臀|蜜桃臀|glutes?|booty/iu },
  { value: "legs", pattern: /臀腿|腿部|大腿|下肢|瘦腿|美腿|legs?|lower[\s-]?body/iu },
  { value: "abs_core", pattern: /腰腹|腹部|腹肌|核心|马甲线|abs?|core/iu },
  { value: "back", pattern: /背部|瘦背|美背|back/iu },
  { value: "shoulders", pattern: /肩部|肩颈|直角肩|shoulders?/iu },
  { value: "arms", pattern: /手臂|上臂|麒麟臂|arms?/iu },
  { value: "upper_body", pattern: /上肢|上半身|upper[\s-]?body/iu },
  { value: "full_body", pattern: /全身|全身性|full[\s-]?body/iu },
];

const SCENARIO_RULES: MatchRule<string>[] = [
  { value: "post_workout", pattern: /运动后|训练后|练后|post[\s-]?workout|after[\s-]?(?:a[\s-]?)?workout/iu },
  { value: "before_sleep", pattern: /睡前|助眠|bedtime|before[\s-]?sleep/iu },
  { value: "morning", pattern: /清晨|晨间|早晨|早起|morning/iu },
  { value: "pre_workout", pattern: /运动前|训练前|练前|pre[\s-]?workout/iu },
  { value: "desk_break", pattern: /久坐|办公室|工位|desk[\s-]?break/iu },
];

function collectFacts(title: string, description: string, rules: MatchRule<string>[]): Fact<string[]> | undefined {
  for (const [source, text] of [["title", title], ["description", description]] as const) {
    const values: string[] = [];
    const evidence: string[] = [];
    for (const rule of rules) {
      const match = text.match(rule.pattern);
      if (match && !values.includes(rule.value)) {
        values.push(rule.value);
        evidence.push(match[0]);
      }
    }
    if (values.length > 0) return highFact(values, source, evidence.join(" | "));
  }
  return undefined;
}

function extractEquipment(title: string, description: string): Pick<LockedWorkoutFacts, "equipment" | "equipmentRequired"> {
  for (const [source, text] of [["title", title], ["description", description]] as const) {
    const noEquipment = findMatch(text, NO_EQUIPMENT_RULES);
    if (noEquipment) {
      return {
        equipmentRequired: highFact(false, source, noEquipment.evidence),
        equipment: highFact([], source, noEquipment.evidence),
      };
    }

    const items: string[] = [];
    const evidence: string[] = [];
    for (const rule of EQUIPMENT_RULES) {
      const match = text.match(rule.pattern);
      if (match && !items.includes(rule.value)) {
        items.push(rule.value);
        evidence.push(match[0]);
      }
    }
    if (items.length > 0) {
      const evidenceText = evidence.join(" | ");
      return {
        equipmentRequired: highFact(true, source, evidenceText),
        equipment: highFact(items, source, evidenceText),
      };
    }
  }
  return {};
}

function extractCreator(title: string): Fact<string> | undefined {
  const match = title.match(/^\s*([^\-—–|｜:：]{2,30})\s*[\-—–|｜:：]\s*/u);
  const creator = match?.[1]?.trim();
  return creator ? highFact(creator, "title", match[0].trim()) : undefined;
}

export function extractWorkoutFactsFromTitle(title: string, description = ""): LockedWorkoutFacts {
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();
  const equipmentFacts = extractEquipment(normalizedTitle, normalizedDescription);

  return {
    durationMinutes: extractDuration(normalizedTitle, normalizedDescription),
    trainingType: findFact(normalizedTitle, normalizedDescription, TRAINING_TYPE_RULES),
    difficulty: findFact(normalizedTitle, normalizedDescription, DIFFICULTY_RULES),
    ...equipmentFacts,
    bodyParts: collectFacts(normalizedTitle, normalizedDescription, BODY_PART_RULES),
    scenarios: collectFacts(normalizedTitle, normalizedDescription, SCENARIO_RULES),
    creator: extractCreator(normalizedTitle),
  };
}

const WORKOUT_TYPE_TO_DB: Record<CanonicalWorkoutType, string> = {
  stretching: "拉伸",
  warmup: "热身",
  strength: "力量训练",
  hiit: "HIIT",
  cardio: "有氧燃脂",
  yoga: "瑜伽",
  pilates: "普拉提",
  mobility: "灵活性训练",
  recovery: "康复",
  sculpt: "塑形训练",
};

const DIFFICULTY_TO_DB: Record<CanonicalDifficulty, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const BODY_PART_TO_DB: Record<string, string> = {
  glutes: "臀部",
  legs: "腿部",
  calves: "小腿",
  abs_core: "核心",
  back: "背部",
  shoulders: "肩部",
  arms: "手臂",
  upper_body: "上肢",
  full_body: "全身",
};

const EQUIPMENT_TO_DB: Record<string, string> = {
  resistance_band: "弹力带",
  dumbbell: "哑铃",
  barbell: "杠铃",
  kettlebell: "壶铃",
  yoga_mat: "瑜伽垫",
  foam_roller: "泡沫轴",
  jump_rope: "跳绳",
};

export function canonicalWorkoutTypeToDatabase(value: CanonicalWorkoutType): string {
  return WORKOUT_TYPE_TO_DB[value];
}

export function canonicalEquipmentToDatabase(values: string[], required?: boolean): string | null {
  if (required === false) return "无器械";
  const translated = values.map((value) => EQUIPMENT_TO_DB[value] || value);
  return translated.length > 0 ? translated.join("，") : null;
}

function canonicalCategory(bodyParts: string[], workoutType?: CanonicalWorkoutType): string | null {
  if (bodyParts.some((part) => ["glutes", "legs", "calves"].includes(part))) return "臀腿";
  if (bodyParts.includes("abs_core")) return "核心";
  if (bodyParts.includes("back")) return "背部";
  if (bodyParts.some((part) => ["shoulders", "arms", "upper_body"].includes(part))) return "肩胸";
  if (bodyParts.includes("full_body")) return "全身";
  if (workoutType === "cardio" || workoutType === "hiit") return "有氧";
  if (workoutType && ["stretching", "warmup", "mobility", "recovery", "yoga"].includes(workoutType)) return "拉伸";
  return null;
}

function normalizeWorkoutType(value: unknown): CanonicalWorkoutType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, CanonicalWorkoutType> = {
    stretching: "stretching", stretch: "stretching", "拉伸": "stretching",
    warmup: "warmup", "warm up": "warmup", "热身": "warmup",
    strength: "strength", "力量训练": "strength",
    hiit: "hiit",
    cardio: "cardio", "有氧": "cardio", "有氧燃脂": "cardio",
    yoga: "yoga", "瑜伽": "yoga",
    pilates: "pilates", "普拉提": "pilates",
    mobility: "mobility", "灵活性训练": "mobility",
    recovery: "recovery", rehab: "recovery", "康复": "recovery",
    sculpt: "sculpt", sculpting: "sculpt", "塑形训练": "sculpt",
  };
  return aliases[normalized] || null;
}

function normalizeDifficulty(value: unknown): CanonicalDifficulty | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, CanonicalDifficulty> = {
    beginner: "beginner", "初级": "beginner", "入门": "beginner",
    intermediate: "intermediate", "中级": "intermediate", "进阶": "intermediate",
    advanced: "advanced", "高级": "advanced", "高阶": "advanced",
  };
  return aliases[value.trim().toLowerCase()] || null;
}

function normalizeEquipment(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，]/) : [];
  const aliases: Record<string, string> = {
    "弹力带": "resistance_band", "阻力带": "resistance_band", "resistance band": "resistance_band",
    "哑铃": "dumbbell", dumbbell: "dumbbell",
    "杠铃": "barbell", barbell: "barbell",
    "壶铃": "kettlebell", kettlebell: "kettlebell",
    "瑜伽垫": "yoga_mat", "yoga mat": "yoga_mat",
    "泡沫轴": "foam_roller", "foam roller": "foam_roller",
    "跳绳": "jump_rope", "jump rope": "jump_rope",
  };
  if (values.some((item) => /无器械|徒手|自重|no[\s-]?equipment|bodyweight/iu.test(String(item)))) return [];
  return [...new Set(values.map((item) => aliases[String(item).trim().toLowerCase()] || String(item).trim()).filter(Boolean))];
}

function meaningfulArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sameArray(left: unknown[], right: unknown[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function detectWorkoutFactConflicts(
  aiResult: Record<string, unknown>,
  lockedFacts: LockedWorkoutFacts,
): WorkoutFactConflict[] {
  const conflicts: WorkoutFactConflict[] = [];
  const add = (field: string, aiValue: unknown, fact: Fact<unknown> | undefined, equal: boolean) => {
    if (!fact || aiValue === undefined || aiValue === null || equal) return;
    conflicts.push({
      field,
      ai_value: aiValue,
      locked_value: fact.value,
      final_value: fact.value,
      source: fact.source,
      evidence: fact.evidence,
    });
  };

  const aiDuration = aiResult.estimated_duration ?? aiResult.duration_minutes;
  add("duration_minutes", aiDuration, lockedFacts.durationMinutes, Number(aiDuration) === lockedFacts.durationMinutes?.value);

  const aiType = aiResult.workout_type ?? aiResult.training_type;
  add("workout_type", aiType, lockedFacts.trainingType, normalizeWorkoutType(aiType) === lockedFacts.trainingType?.value);

  add(
    "difficulty",
    aiResult.difficulty,
    lockedFacts.difficulty,
    normalizeDifficulty(aiResult.difficulty) === lockedFacts.difficulty?.value,
  );

  const aiEquipment = normalizeEquipment(aiResult.equipment);
  add(
    "equipment",
    aiResult.equipment,
    lockedFacts.equipment,
    aiEquipment !== null && sameArray(aiEquipment, lockedFacts.equipment?.value || []),
  );

  add(
    "equipment_required",
    aiResult.equipment_required,
    lockedFacts.equipmentRequired,
    aiResult.equipment_required === lockedFacts.equipmentRequired?.value,
  );

  const aiBodyParts = meaningfulArray(aiResult.body_parts);
  add("body_parts", aiResult.body_parts, lockedFacts.bodyParts, sameArray(aiBodyParts, lockedFacts.bodyParts?.value || []));
  const aiScenarios = meaningfulArray(aiResult.scenarios);
  add("scenarios", aiResult.scenarios, lockedFacts.scenarios, sameArray(aiScenarios, lockedFacts.scenarios?.value || []));
  return conflicts;
}

export function applyLockedWorkoutFacts(
  aiResult: Record<string, unknown>,
  lockedFacts: LockedWorkoutFacts,
): Record<string, unknown> {
  const result = { ...aiResult };
  if (lockedFacts.durationMinutes) {
    result.estimated_duration = lockedFacts.durationMinutes.value;
    result.duration_minutes = lockedFacts.durationMinutes.value;
  }
  if (lockedFacts.trainingType) {
    result.workout_type = lockedFacts.trainingType.value;
    result.training_type = canonicalWorkoutTypeToDatabase(lockedFacts.trainingType.value);
  }
  if (lockedFacts.difficulty) result.difficulty = DIFFICULTY_TO_DB[lockedFacts.difficulty.value];
  if (lockedFacts.equipmentRequired) result.equipment_required = lockedFacts.equipmentRequired.value;
  if (lockedFacts.equipment) result.equipment = [...lockedFacts.equipment.value];
  if (lockedFacts.bodyParts) {
    result.body_parts = [...lockedFacts.bodyParts.value];
    result.target_muscles = lockedFacts.bodyParts.value.map((part) => BODY_PART_TO_DB[part] || part);
  }
  if (lockedFacts.scenarios) result.scenarios = [...lockedFacts.scenarios.value];

  const category = canonicalCategory(
    lockedFacts.bodyParts?.value || [],
    lockedFacts.trainingType?.value,
  );
  if (category) result.category = category;
  return result;
}

export function groundWorkoutMetadata(
  aiResult: Record<string, unknown>,
  lockedFacts: LockedWorkoutFacts,
  allowContentInference: boolean,
): Record<string, unknown> {
  const result = { ...aiResult };
  if (!allowContentInference) {
    if (!lockedFacts.durationMinutes) {
      result.estimated_duration = null;
      result.duration_minutes = null;
    }
    if (!lockedFacts.trainingType) {
      result.training_type = null;
      result.workout_type = null;
    }
    if (!lockedFacts.difficulty) result.difficulty = null;
    if (!lockedFacts.equipment) result.equipment = [];
    if (!lockedFacts.equipmentRequired) result.equipment_required = null;
    if (!lockedFacts.bodyParts) {
      result.body_parts = [];
      result.target_muscles = [];
      result.category = null;
    }
    if (!lockedFacts.scenarios) result.scenarios = [];
  }
  return applyLockedWorkoutFacts(result, lockedFacts);
}

export function lockedFactsToMetadata(lockedFacts: LockedWorkoutFacts): Record<string, Fact<unknown>> {
  const metadata: Record<string, Fact<unknown>> = {};
  if (lockedFacts.durationMinutes) metadata.duration_minutes = lockedFacts.durationMinutes;
  if (lockedFacts.trainingType) metadata.training_type = lockedFacts.trainingType;
  if (lockedFacts.difficulty) metadata.difficulty = lockedFacts.difficulty;
  if (lockedFacts.equipmentRequired) metadata.equipment_required = lockedFacts.equipmentRequired;
  if (lockedFacts.equipment) metadata.equipment = lockedFacts.equipment;
  if (lockedFacts.bodyParts) metadata.body_parts = lockedFacts.bodyParts;
  if (lockedFacts.scenarios) metadata.scenarios = lockedFacts.scenarios;
  if (lockedFacts.creator) metadata.creator = lockedFacts.creator;
  return metadata;
}

export function formatLockedFactsForPrompt(lockedFacts: LockedWorkoutFacts): string {
  const metadata = lockedFactsToMetadata(lockedFacts);
  if (Object.keys(metadata).length === 0) return "LOCKED FACTS: none";
  return `LOCKED FACTS (must not be changed):\n${JSON.stringify(metadata, null, 2)}`;
}

export function hasAnyLockedWorkoutFacts(lockedFacts: LockedWorkoutFacts): boolean {
  return Object.keys(lockedFactsToMetadata(lockedFacts)).length > 0;
}
