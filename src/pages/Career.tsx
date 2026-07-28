import { useState } from "react";
import {
  Briefcase, CalendarClock, FileText, TrendingUp, Loader2, Plus, Trash2,
  Building2, MapPin, Clock, MessageSquare, Star, ChevronRight, CheckCircle2,
  Target, Lightbulb, Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useJobs, useCreateJob, useUpdateJob, useDeleteJob,
  useInterviews, useCreateInterview, useDeleteInterview,
  useCareerReflections, useCreateCareerReflection, useDeleteCareerReflection,
  type JobRow, type InterviewRow,
} from "@/lib/hooks/useCareer";

// ── Constants ──

const STATUS_OPTIONS = [
  { key: "saved", label: "已收藏", color: "bg-ink/5 text-ink-light" },
  { key: "applied", label: "已投递", color: "bg-accent-sky/10 text-accent-sky" },
  { key: "interviewing", label: "面试中", color: "bg-amber-50 text-amber-600" },
  { key: "offer", label: "已Offer", color: "bg-emerald-50 text-emerald-600" },
  { key: "rejected", label: "已拒绝", color: "bg-accent-rose/10 text-accent-rose" },
  { key: "accepted", label: "已接受", color: "bg-purple-50 text-purple-700" },
] as const;

const RESULT_OPTIONS = [
  { key: "passed", label: "通过", color: "text-emerald-600" },
  { key: "failed", label: "未通过", color: "text-accent-rose" },
  { key: "pending", label: "等待中", color: "text-amber-600" },
] as const;

type Tab = "jobs" | "interviews" | "reflection";

// ── Page ──

export default function Career() {
  const [tab, setTab] = useState<Tab>("jobs");

  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const { data: reflections } = useCareerReflections();
  const stats = {
    total: jobs?.length ?? 0,
    interviewing: jobs?.filter((j) => j.status === "interviewing").length ?? 0,
    totalInterviews: 0, // computed in Interviews tab
    reflections: reflections?.length ?? 0,
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">工作成长</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Career OS</h1>
      </header>

      {/* Stats */}
      {loadingJobs ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard icon={Briefcase} label="求职记录" value={`${stats.total} 个`} sub="公司岗位" color="text-accent-sky" bg="bg-accent-sky/5" />
          <StatCard icon={MessageSquare} label="面试中" value={`${stats.interviewing} 个`} sub="进行中" color="text-amber-600" bg="bg-amber-50" />
          <StatCard icon={Target} label="职业反思" value={`${stats.reflections} 条`} sub="成长记录" color="text-sage-deep" bg="bg-sage-light" />
          <StatCard icon={Star} label="技能成长" value="持续积累" sub="每次面试都是练习" color="text-accent-warm" bg="bg-accent-warm/5" />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex bg-ink/5 rounded-xl p-1">
        {([
          { key: "jobs" as Tab, label: "求职记录", icon: Briefcase },
          { key: "interviews" as Tab, label: "面试记录", icon: CalendarClock },
          { key: "reflection" as Tab, label: "职业反思", icon: TrendingUp },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === "jobs" && <JobsTab />}
      {tab === "interviews" && <InterviewsTab jobs={jobs || []} />}
      {tab === "reflection" && <ReflectionTab />}
    </div>
  );
}

// ── Stat Card ──

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className={cn("rounded-2xl p-3.5 flex flex-col gap-1.5", bg)}>
      <Icon size={16} className={color} />
      <div>
        <p className="text-lg font-bold text-ink">{value}</p>
        <p className="text-[11px] font-medium text-ink-light">{label}</p>
        <p className="text-[10px] text-ink-lighter mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Jobs Tab ──

function JobsTab() {
  const { data: jobs, isLoading } = useJobs();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ company_name: "", position: "", status: "saved", location: "", industry: "", notes: "" });

  const reset = () => { setForm({ company_name: "", position: "", status: "saved", location: "", industry: "", notes: "" }); setShowForm(false); setEditingId(null); };

  const handleAdd = () => {
    if (!form.company_name.trim() || !form.position.trim()) return;
    createJob.mutate({
      company_name: form.company_name.trim(),
      position: form.position.trim(),
      status: form.status,
      location: form.location || undefined,
      industry: form.industry || undefined,
      notes: form.notes || undefined,
    }, { onSuccess: reset });
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>;

  return (
    <div className="space-y-3">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-4 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Plus size={16} />添加求职记录
        </button>
      )}

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="公司名称" autoFocus
              className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="职位"
              className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="地点"
              className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="行业"
              className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="备注（JD要点、薪资范围...）"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-16 resize-none focus:border-sage-deep/50 transition-colors" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.company_name.trim() || !form.position.trim() || createJob.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors">
              {createJob.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}保存
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors">取消</button>
          </div>
        </div>
      )}

      {(jobs || []).length === 0 ? (
        <div className="text-center py-8">
          <Briefcase size={28} className="text-ink-lighter mx-auto mb-2 opacity-30" />
          <p className="text-sm text-ink-lighter">暂无求职记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(jobs || []).map((j: JobRow) => {
            const statusInfo = STATUS_OPTIONS.find((s) => s.key === j.status);
            return (
              <div key={j.id} className="bg-card rounded-2xl border border-border p-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-ink-light shrink-0" />
                      <p className="text-sm font-semibold text-ink truncate">{j.company_name}</p>
                    </div>
                    <p className="text-xs text-ink-light mt-0.5 ml-6">{j.position}</p>
                    <div className="flex gap-2 mt-1.5 ml-6 flex-wrap">
                      {j.location && <span className="text-[10px] text-ink-lighter flex items-center gap-0.5"><MapPin size={10} />{j.location}</span>}
                      {j.industry && <span className="text-[10px] text-ink-lighter">{j.industry}</span>}
                      {j.notes && <p className="text-[10px] text-ink-lighter w-full mt-0.5">{j.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={j.status}
                      onChange={(e) => updateJob.mutate({ id: j.id, status: e.target.value })}
                      className="text-[10px] font-medium rounded-full px-2 py-1 outline-none cursor-pointer border border-border bg-card"
                      style={{ color: statusInfo?.color?.split(" ")[0] || "" }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteJob.mutate(j.id)} className="p-1 text-ink-lighter hover:text-accent-rose transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Interviews Tab ──

function InterviewsTab({ jobs }: { jobs: JobRow[] }) {
  const { data: interviews, isLoading } = useInterviews();
  const createInterview = useCreateInterview();
  const deleteInterview = useDeleteInterview();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ job_id: "", round_number: "1", format: "技术面", interview_date: "", questions_asked: "", self_assessment: "", result: "pending", notes: "" });

  const reset = () => { setForm({ job_id: "", round_number: "1", format: "技术面", interview_date: "", questions_asked: "", self_assessment: "", result: "pending", notes: "" }); setShowForm(false); };

  const handleAdd = () => {
    if (!form.job_id) return;
    createInterview.mutate({
      job_id: form.job_id,
      round_number: parseInt(form.round_number) || 1,
      format: form.format || undefined,
      interview_date: form.interview_date || undefined,
      questions_asked: form.questions_asked ? form.questions_asked.split("\n").filter(Boolean) : undefined,
      self_assessment: form.self_assessment || undefined,
      result: form.result || undefined,
      notes: form.notes || undefined,
    }, { onSuccess: reset });
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-sage-deep" /></div>;

  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-3">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-4 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Plus size={16} />记录面试
        </button>
      )}

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <select value={form.job_id} onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))}
            className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors">
            <option value="">选择岗位</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.company_name} — {j.position}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={form.round_number} onChange={(e) => setForm((f) => ({ ...f, round_number: e.target.value }))}
              placeholder="第几轮" className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
              placeholder="面试形式" className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors" />
            <input type="date" value={form.interview_date} onChange={(e) => setForm((f) => ({ ...f, interview_date: e.target.value }))}
              className="bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50 transition-colors" />
          </div>
          <textarea value={form.questions_asked} onChange={(e) => setForm((f) => ({ ...f, questions_asked: e.target.value }))}
            placeholder="面试问题（每行一个）"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-20 resize-none focus:border-sage-deep/50 transition-colors" />
          <textarea value={form.self_assessment} onChange={(e) => setForm((f) => ({ ...f, self_assessment: e.target.value }))}
            placeholder="自我评估：哪些问题回答得好？哪些需要加强？"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-20 resize-none focus:border-sage-deep/50 transition-colors" />
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="备注"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-14 resize-none focus:border-sage-deep/50 transition-colors" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.job_id || createInterview.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors">
              {createInterview.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}保存
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors">取消</button>
          </div>
        </div>
      )}

      {(interviews || []).length === 0 ? (
        <div className="text-center py-8">
          <CalendarClock size={28} className="text-ink-lighter mx-auto mb-2 opacity-30" />
          <p className="text-sm text-ink-lighter">暂无面试记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(interviews || []).map((iv: InterviewRow) => {
            const job = jobMap.get(iv.job_id);
            const resultInfo = RESULT_OPTIONS.find((r) => r.key === iv.result);
            return (
              <div key={iv.id} className="bg-card rounded-2xl border border-border p-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-ink-light shrink-0" />
                      <p className="text-sm font-semibold text-ink">{job?.company_name || "未知公司"}</p>
                      <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                        第{iv.round_number}轮
                      </span>
                      {iv.result && (
                        <span className={cn("text-[10px] font-medium", resultInfo?.color)}>
                          {resultInfo?.label || iv.result}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-light mt-0.5 ml-6">{job?.position || ""}</p>
                    <div className="flex gap-2 mt-1 ml-6 text-[10px] text-ink-lighter flex-wrap">
                      {iv.format && <span>{iv.format}</span>}
                      {iv.interview_date && <span>{new Date(iv.interview_date).toLocaleDateString("zh-CN")}</span>}
                    </div>
                    {iv.questions_asked && iv.questions_asked.length > 0 && (
                      <div className="mt-1.5 ml-6">
                        <p className="text-[10px] text-ink-lighter mb-0.5">面试问题：</p>
                        {iv.questions_asked.map((q, i) => (
                          <p key={i} className="text-[11px] text-ink-light ml-2">· {q}</p>
                        ))}
                      </div>
                    )}
                    {iv.self_assessment && (
                      <div className="mt-1.5 ml-6 bg-sage-light/20 rounded-lg px-2.5 py-1.5">
                        <p className="text-[10px] text-sage-deep font-medium mb-0.5">自我复盘</p>
                        <p className="text-[11px] text-ink-light whitespace-pre-wrap">{iv.self_assessment}</p>
                      </div>
                    )}
                    {iv.notes && <p className="text-[10px] text-ink-lighter mt-1 ml-6">{iv.notes}</p>}
                  </div>
                  <button onClick={() => deleteInterview.mutate(iv.id)} className="p-1 text-ink-lighter hover:text-accent-rose shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reflection Tab ──

function ReflectionTab() {
  const { data: reflections } = useCareerReflections();
  const createReflection = useCreateCareerReflection();
  const deleteReflection = useDeleteCareerReflection();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ learned: "", skills: "", direction: "" });

  const reset = () => { setForm({ learned: "", skills: "", direction: "" }); setShowForm(false); };

  const handleSave = () => {
    const content = [
      form.learned && `## 学到了什么\n${form.learned}`,
      form.skills && `## 能力提升\n${form.skills}`,
      form.direction && `## 下一步方向\n${form.direction}`,
    ].filter(Boolean).join("\n\n");

    if (!content) return;
    createReflection.mutate({ title: `职业反思 · ${new Date().toLocaleDateString("zh-CN")}`, content }, { onSuccess: reset });
  };

  return (
    <div className="space-y-3">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-4 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
          <Lightbulb size={16} />记录职业反思
        </button>
      )}

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-ink-lighter mb-1 block">学到了什么</label>
            <textarea value={form.learned} onChange={(e) => setForm((f) => ({ ...f, learned: e.target.value }))}
              placeholder="最近学到了什么新知识、新技能？"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-20 resize-none focus:border-sage-deep/50 transition-colors" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-ink-lighter mb-1 block">能力提升</label>
            <textarea value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              placeholder="哪些能力得到了提升？有什么证据？"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-20 resize-none focus:border-sage-deep/50 transition-colors" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-ink-lighter mb-1 block">下一步方向</label>
            <textarea value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
              placeholder="下一步计划？重点提升什么？"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 h-16 resize-none focus:border-sage-deep/50 transition-colors" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.learned && !form.skills && !form.direction}
              className="flex-1 flex items-center justify-center gap-2 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors">
              <CheckCircle2 size={14} />保存
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors">取消</button>
          </div>
        </div>
      )}

      {(reflections || []).length === 0 ? (
        <div className="text-center py-8">
          <TrendingUp size={28} className="text-ink-lighter mx-auto mb-2 opacity-30" />
          <p className="text-sm text-ink-lighter">暂无职业反思</p>
          <p className="text-xs text-ink-lighter mt-0.5">记录你的职业成长</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(reflections || []).map((r: Record<string, unknown>) => (
            <div key={r.id as string} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{r.title as string}</p>
                  <p className="text-xs text-ink-lighter mt-0.5">{r.generated_at as string}</p>
                  <div className="mt-2 text-sm text-ink-light whitespace-pre-wrap leading-relaxed">
                    {String(r.content || "").split("\n").map((line, i) => {
                      if (line.startsWith("## ")) {
                        return <p key={i} className="text-xs font-semibold text-ink mt-3 mb-1">{line.replace("## ", "")}</p>;
                      }
                      return <p key={i} className="text-xs text-ink-light">{line}</p>;
                    })}
                  </div>
                </div>
                <button onClick={() => deleteReflection.mutate(r.id as string)} className="p-1 text-ink-lighter hover:text-accent-rose shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
