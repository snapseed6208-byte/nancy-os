const str = (v: unknown): v is string => typeof v === "string" && v.length <= 3000;
const LEVELS = ["R1","R2","P1","P2"];
export function validateEnrichment(value: unknown, type?:string): Record<string,unknown> & {schema_version:number} {
  const e = value as Record<string,unknown>;
  const fields = ["core_meaning","tem8_meaning","english_definition","pronunciation","known_meaning","trigger","trap","register"];
  // The model may name the target either way; anything outside the enum falls back to R1, the
  // depth most TEM8 words need, so a bad guess can never inflate a word to output training.
  const level = LEVELS.includes(String(e.recommended_target)) ? String(e.recommended_target)
    : LEVELS.includes(String(e.recommended_level)) ? String(e.recommended_level) : "R1";
  if (!e || fields.some(k => !str(e[k])) || !e.core_meaning || !e.tem8_meaning || !e.english_definition ||
    !["high","medium","low"].includes(String(e.value)) ||
    !Array.isArray(e.collocations) || e.collocations.length > 5 || !e.collocations.every(str) ||
    !Array.isArray(e.examples) || e.examples.length < 1 || e.examples.length > 2 || !e.examples.every(str)) {
    throw new Error("AI 加工结果不完整，未覆盖已保存内容");
  }
  const optionalFields=["contrast_example","writing_use","translation_use"];
  if(optionalFields.some(k=>e[k]!==undefined && !str(e[k])) || (e.synonyms!==undefined && (!Array.isArray(e.synonyms) || e.synonyms.length>5 || !e.synonyms.every(str)))) throw new Error("扩展词卡格式无效");
  if(type==="familiar" && ["known_meaning","trigger","trap","contrast_example"].some(k=>typeof e[k]!=="string" || !e[k].trim())) throw new Error("熟词生义卡缺少对比或识别线索");
  if(["P1","P2"].includes(level) && (e.examples.length!==2 || !e.writing_use || !e.translation_use)) throw new Error("输出词卡缺少双例句或写作翻译用法");
  return {...Object.fromEntries(fields.map(k => [k,e[k]])),
    recommended_level:level,value:e.value,collocations:e.collocations,examples:e.examples,
    target_reason:typeof e.target_reason==="string" ? e.target_reason.trim().slice(0,200) : "",
    ...Object.fromEntries(optionalFields.map(k=>[k,e[k]||""])),synonyms:e.synonyms||[],schema_version:2};
}
