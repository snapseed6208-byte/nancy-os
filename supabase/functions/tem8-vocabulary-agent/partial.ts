// Recover only fully closed entry objects. Never invent missing JSON fields.
export function extractResponse(value: unknown): { data: unknown; partial: boolean } {
  if (typeof value !== "string") return {data:value,partial:false};
  const raw=value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return {data:JSON.parse(raw),partial:false}; } catch { /* incomplete response */ }
  const start=/"entries"\s*:\s*\[/.exec(raw);
  if (!start) throw new Error("AI 返回结构无效，已保存批次不受影响，请重试");
  const entries:unknown[]=[];
  let depth=0, quoted=false, escaped=false, entryStart=-1;
  for(let i=start.index+start[0].length;i<raw.length;i++) {
    const c=raw[i];
    if(quoted) { if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; continue; }
    if(c==='"') { quoted=true; continue; }
    if(c==='{') { if(depth===0) entryStart=i; depth++; }
    if(c==='}' && depth>0 && --depth===0) {
      try { entries.push(JSON.parse(raw.slice(entryStart,i+1))); } catch { /* reject malformed entry */ }
    }
    if(c===']' && depth===0) break;
  }
  if(!entries.length) throw new Error("本批次尚无完整可保存条目，请继续提取；已有词汇已保留");
  return {data:{entries},partial:true};
}
