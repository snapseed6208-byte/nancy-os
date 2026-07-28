import { useState } from "react";
import {
  GraduationCap,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Target,
  Calendar,
  BarChart3,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  useExams,
  useCreateExam,
  useUpdateExam,
  useDeleteExam,
  useStudySessions,
  useRecentStudySessions,
  useCreateStudySession,
  useDeleteStudySession,
  useExamStats,
  type ExamRow,
} from "@/lib/hooks/useExam";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { key: "ielts", label: "IELTS" },
  { key: "course", label: "课程" },
  { key: "certificate", label: "证书" },
  { key: "self_study", label: "自学" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  ielts: "IELTS",
  course: "课程",
  certificate: "证书",
  self_study: "自学",
};

const TABS = [
  { key: "exams", label: "考试/课程" },
  { key: "log", label: "学习记录" },
  { key: "stats", label: "本周统计" },
] as const;

export default function Exam() {
  const [tab, setTab] = useState("exams");
  const [showAddExam, setShowAddExam] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("self_study");
  const [addTarget, setAddTarget] = useState("");
  const [addExamDate, setAddExamDate] = useState("");
  const [addNotes, setAddNotes] = useState("");

  const { data: exams, isLoading: examsLoading } = useExams();
  const { data: allSessions, isLoading: sessionsLoading } = useStudySessions();
  const { data: recentSessions } = useRecentStudySessions();
  const { data: stats } = useExamStats();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const createSession = useCreateStudySession();
  const deleteSession = useDeleteStudySession();

  const [quickExamId, setQuickExamId] = useState("");
  const [quickMinutes, setQuickMinutes] = useState(30);
  const [quickTopic, setQuickTopic] = useState("");
  const [quickScore, setQuickScore] = useState("");

  const handleCreateExam = async () => {
    if (!addName.trim()) return;
    await createExam.mutateAsync({
      name: addName.trim(),
      category: addCategory,
      target_score: addTarget || undefined,
      exam_date: addExamDate || undefined,
      notes: addNotes || undefined,
    });
    setAddName("");
    setAddCategory("self_study");
    setAddTarget("");
    setAddExamDate("");
    setAddNotes("");
    setShowAddExam(false);
  };

  const handleLogSession = async () => {
    if (quickMinutes < 1) return;
    await createSession.mutateAsync({
      exam_id: quickExamId || undefined,
      duration_minutes: quickMinutes,
      topic: quickTopic || undefined,
      score: quickScore ? parseFloat(quickScore) : undefined,
    });
    setQuickTopic("");
    setQuickScore("");
  };

  const toggleExamStatus = async (exam: ExamRow) => {
    const nextStatus =
      exam.status === "active" ? "paused" : exam.status === "paused" ? "completed" : "active";
    await updateExam.mutateAsync({ id: exam.id, status: nextStatus });
  };

  const sessions = allSessions || [];
  const activeExams = (exams || []).filter((e) => e.status === "active");
  const displaySessions = tab === "log" ? sessions : recentSessions || [];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">考试学习</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Exam OS</h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 bg-ink/5 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Exams ── */}
      {tab === "exams" && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-sage-deep">{stats.totalMinutes}</p>
                <p className="text-[11px] text-ink-lighter mt-1">本周学习 (分钟)</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-accent-sky">{stats.daysStudied}</p>
                <p className="text-[11px] text-ink-lighter mt-1">学习天数</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-accent-warm">{activeExams.length}</p>
                <p className="text-[11px] text-ink-lighter mt-1">进行中</p>
              </div>
            </div>
          )}

          {showAddExam ? (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <input
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5"
                placeholder="考试/课程名称"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setAddCategory(cat.key)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      addCategory === cat.key
                        ? "border-sage-light bg-sage-light/30 text-sage-deep"
                        : "border-border text-ink-light hover:border-sage-light/50",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5"
                  placeholder="目标分数 (可选)"
                  value={addTarget}
                  onChange={(e) => setAddTarget(e.target.value)}
                />
                <input
                  type="date"
                  className="bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5"
                  value={addExamDate}
                  onChange={(e) => setAddExamDate(e.target.value)}
                />
              </div>
              <textarea
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 resize-none"
                rows={2}
                placeholder="备注 (可选)"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowAddExam(false)}
                  className="rounded-xl px-4 py-2 text-sm text-ink-light hover:bg-ink/5"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateExam}
                  disabled={!addName.trim() || createExam.isPending}
                  className="bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createExam.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  添加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddExam(true)}
              className="w-full bg-card rounded-2xl border border-dashed border-border p-4 text-sm text-ink-light hover:border-sage-light/50 hover:text-sage-deep transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              添加考试/课程
            </button>
          )}

          {examsLoading ? (
            <div className="text-center py-8">
              <Loader2 size={24} className="animate-spin text-ink-lighter mx-auto" />
            </div>
          ) : !exams?.length ? (
            <div className="bg-card rounded-2xl border border-border p-10 text-center">
              <GraduationCap size={32} className="text-ink-lighter mx-auto mb-3" />
              <p className="text-sm text-ink-light">还没有添加任何考试或课程</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(exams as ExamRow[]).map((exam) => (
                <div
                  key={exam.id}
                  className={cn(
                    "bg-card rounded-2xl border border-border p-4 transition-colors",
                    exam.status === "completed" && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-ink/5 flex items-center justify-center shrink-0">
                      <GraduationCap size={18} className="text-ink-light" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink truncate">{exam.name}</h3>
                        <span
                          className={cn(
                            "text-[10px] rounded-full px-2 py-0.5 shrink-0",
                            exam.status === "active"
                              ? "bg-sage-light/30 text-sage-deep"
                              : exam.status === "paused"
                                ? "bg-accent-warm/10 text-accent-warm"
                                : "bg-ink/5 text-ink-lighter",
                          )}
                        >
                          {exam.status === "active" ? "进行中" : exam.status === "paused" ? "已暂停" : "已完成"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                          {CATEGORY_LABELS[exam.category] || exam.category}
                        </span>
                        {exam.target_score && (
                          <span className="text-[11px] text-ink-lighter flex items-center gap-1">
                            <Target size={11} />
                            {exam.target_score}
                          </span>
                        )}
                        {exam.exam_date && (
                          <span className="text-[11px] text-ink-lighter flex items-center gap-1">
                            <Calendar size={11} />
                            {exam.exam_date}
                          </span>
                        )}
                      </div>
                      {exam.notes && (
                        <p className="text-xs text-ink-light mt-2 line-clamp-2">{exam.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleExamStatus(exam)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                        title={exam.status === "active" ? "暂停" : exam.status === "paused" ? "完成" : "重新激活"}
                      >
                        {exam.status === "active" ? (
                          <PauseCircle size={14} />
                        ) : exam.status === "paused" ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <PlayCircle size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteExam.mutateAsync(exam.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-accent-rose/10 hover:text-accent-rose"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Study Log ── */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-medium text-ink-light">快速记录学习</p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 min-w-[140px]"
                value={quickExamId}
                onChange={(e) => setQuickExamId(e.target.value)}
              >
                <option value="">不关联考试</option>
                {activeExams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 bg-ink/5 rounded-xl px-3 py-2">
                <Clock size={14} className="text-ink-lighter" />
                <input
                  type="number"
                  className="w-14 bg-transparent text-sm text-ink outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={quickMinutes}
                  onChange={(e) => setQuickMinutes(parseInt(e.target.value) || 0)}
                  min={1}
                  max={480}
                />
                <span className="text-xs text-ink-lighter">分钟</span>
              </div>
              <input
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 min-w-[140px]"
                placeholder="学习内容 (可选)"
                value={quickTopic}
                onChange={(e) => setQuickTopic(e.target.value)}
              />
              <input
                type="number"
                className="w-20 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="分数"
                value={quickScore}
                onChange={(e) => setQuickScore(e.target.value)}
                step="0.5"
              />
              <button
                onClick={handleLogSession}
                disabled={quickMinutes < 1 || createSession.isPending}
                className="bg-sage-light text-sage-deep rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {createSession.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                记录
              </button>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="text-center py-8">
              <Loader2 size={24} className="animate-spin text-ink-lighter mx-auto" />
            </div>
          ) : !displaySessions.length ? (
            <div className="bg-card rounded-2xl border border-border p-10 text-center">
              <BookOpen size={32} className="text-ink-lighter mx-auto mb-3" />
              <p className="text-sm text-ink-light">还没有学习记录</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {displaySessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-sage-light/30 flex items-center justify-center shrink-0">
                    <Clock size={15} className="text-sage-deep" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {s.exams?.name && (
                        <span className="text-xs font-medium text-ink truncate">{s.exams.name}</span>
                      )}
                      {s.topic && (
                        <span className="text-xs text-ink-light truncate">
                          {s.exams?.name ? `· ${s.topic}` : s.topic}
                        </span>
                      )}
                      {!s.exams?.name && !s.topic && (
                        <span className="text-xs text-ink-lighter">未分类学习</span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-lighter mt-0.5 flex items-center gap-2">
                      <span>{s.date}</span>
                      <span>{s.duration_minutes} 分钟</span>
                      {s.score != null && <span>得分: {s.score}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSession.mutateAsync(s.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-accent-rose/10 hover:text-accent-rose shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Stats ── */}
      {tab === "stats" && (
        <div className="space-y-4">
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-2xl border border-border p-5 text-center">
                  <Clock size={20} className="text-sage-deep mx-auto mb-2" />
                  <p className="text-3xl font-bold text-ink">{stats.totalMinutes}</p>
                  <p className="text-xs text-ink-lighter mt-1">本周总学习 (分钟)</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 text-center">
                  <TrendingUp size={20} className="text-accent-sky mx-auto mb-2" />
                  <p className="text-3xl font-bold text-ink">{stats.avgPerDay}</p>
                  <p className="text-xs text-ink-lighter mt-1">日均学习 (分钟)</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 text-center">
                  <BookOpen size={20} className="text-accent-warm mx-auto mb-2" />
                  <p className="text-3xl font-bold text-ink">{stats.totalSessions}</p>
                  <p className="text-xs text-ink-lighter mt-1">学习次数</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 text-center">
                  <Calendar size={20} className="text-sage-deep mx-auto mb-2" />
                  <p className="text-3xl font-bold text-ink">{stats.daysStudied}</p>
                  <p className="text-xs text-ink-lighter mt-1">学习天数</p>
                </div>
              </div>

              {activeExams.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-medium text-ink-light mb-3 flex items-center gap-2">
                    <BarChart3 size={13} />
                    进行中的考试
                  </p>
                  <div className="space-y-2">
                    {activeExams.map((exam) => {
                      const examMinutes = sessions
                        .filter((s) => s.exam_id === exam.id)
                        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
                      return (
                        <div key={exam.id} className="flex items-center gap-3">
                          <span className="text-sm text-ink flex-1 truncate">{exam.name}</span>
                          <span className="text-xs text-ink-lighter">{examMinutes} 分钟</span>
                          {exam.target_score && (
                            <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
                              {exam.target_score}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-10 text-center">
              <BarChart3 size={32} className="text-ink-lighter mx-auto mb-3" />
              <p className="text-sm text-ink-light">记录学习时间后自动生成统计</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
