import { useState } from "react";
import {
  Dumbbell, Plus, ChevronLeft, ChevronRight, Clock, MapPin,
  Zap, Smile, Loader2, Trash2, Edit3, Calendar, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import WorkoutSessionForm from "@/components/health/WorkoutSessionForm";
import type {
  WorkoutSession, ExerciseLibraryItem,
  WorkoutSessionInput,
} from "@/lib/hooks/useHealth";

type ExerciseFormEntry = {
  key: string;
  exercise_id?: string;
  exercise_name: string;
  category?: string;
  equipment?: string;
  sets: { reps: number; weight: number; completed: boolean }[];
  duration_seconds?: number;
  rest_seconds?: number;
  notes?: string;
  is_bodyweight: boolean;
};

type PrefillVideo = {
  id: string;
  title: string | null;
  training_type: string | null;
  category: string | null;
};

type WorkoutJournalTabProps = {
  sessions: WorkoutSession[];
  isLoading: boolean;
  exerciseLibrary: ExerciseLibraryItem[];
  onCreateSession: (input: WorkoutSessionInput) => Promise<unknown>;
  onUpdateSession: (input: { id: string } & Partial<WorkoutSessionInput>) => Promise<unknown>;
  onDeleteSession: (id: string) => void;
  expandedSession: WorkoutSession | null | undefined;
  onExpandSession: (id: string | null) => void;
  prefillVideo: PrefillVideo | null;
  onConsumedPrefill: () => void;
  workoutsThisWeek?: number;
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

const FEELING_EMOJI: Record<string, string> = {
  "超棒": "🤩", "不错": "😊", "一般": "😐", "疲惫": "😫", "酸痛": "💪",
};

const LOCATION_ICONS: Record<string, string> = {
  "居家": "🏠", "健身房": "🏋️", "户外": "🌳",
};

export default function WorkoutJournalTab({
  sessions,
  isLoading,
  exerciseLibrary,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  expandedSession,
  onExpandSession,
  prefillVideo,
  onConsumedPrefill,
  workoutsThisWeek,
}: WorkoutJournalTabProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!prefillVideo);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consumedPrefillId, setConsumedPrefillId] = useState<string | null>(null);

  // When prefillVideo changes, open form and track it
  if (prefillVideo && prefillVideo.id !== consumedPrefillId) {
    setConsumedPrefillId(prefillVideo.id);
    setShowForm(true);
  }

  const expandedId = expandedSession?.id || null;

  // Group sessions by date
  const sessionsByDate = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    const list = sessionsByDate.get(s.date) || [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }

  const dates = [...sessionsByDate.keys()].sort().reverse();
  const displaySessions = selectedDate
    ? sessionsByDate.get(selectedDate) || []
    : sessions;

  // Navigate dates
  const currentDateIdx = selectedDate ? dates.indexOf(selectedDate) : -1;
  const prevDate = currentDateIdx > 0 ? dates[currentDateIdx - 1] : null;
  const nextDate = currentDateIdx >= 0 && currentDateIdx < dates.length - 1 ? dates[currentDateIdx + 1] : null;

  const handleCreate = async (formData: {
    date: string; title: string; mode: "video_follow" | "free_training";
    training_type: string; location: string; duration_minutes: number | null;
    feeling: string; perceived_effort: number | null; notes: string;
    source_video_id?: string;
  }, exercises: ExerciseFormEntry[]) => {
    setIsSubmitting(true);
    try {
      const input: WorkoutSessionInput = {
        date: formData.date,
        title: formData.title,
        mode: formData.mode,
        training_type: formData.training_type || undefined,
        location: formData.location as WorkoutSessionInput["location"] || undefined,
        duration_minutes: formData.duration_minutes ?? undefined,
        feeling: formData.feeling || undefined,
        perceived_effort: formData.perceived_effort ?? undefined,
        notes: formData.notes || undefined,
        source_video_id: formData.source_video_id,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          category: ex.category,
          equipment: ex.equipment,
          sets_completed: ex.sets.filter((s) => s.completed).length,
          reps: ex.sets.map((s, si) => ({
            set: si + 1,
            reps: s.reps,
            weight: s.weight,
            completed: s.completed,
          })),
          weight_kg: ex.is_bodyweight ? null : (ex.sets[0]?.weight || null),
          duration_seconds: ex.duration_seconds,
          rest_seconds: ex.rest_seconds,
          sort_order: i,
          notes: ex.notes,
          is_bodyweight: ex.is_bodyweight,
        })),
      };
      await onCreateSession(input);
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (formData: {
    date: string; title: string; mode: "video_follow" | "free_training";
    training_type: string; location: string; duration_minutes: number | null;
    feeling: string; perceived_effort: number | null; notes: string;
    source_video_id?: string;
  }, _exercises: ExerciseFormEntry[]) => {
    if (!editingSession) return;
    setIsSubmitting(true);
    try {
      await onUpdateSession({
        id: editingSession.id,
        date: formData.date,
        title: formData.title,
        mode: formData.mode,
        training_type: formData.training_type || undefined,
        location: formData.location as WorkoutSessionInput["location"] || undefined,
        duration_minutes: formData.duration_minutes ?? undefined,
        feeling: formData.feeling || undefined,
        perceived_effort: formData.perceived_effort ?? undefined,
        notes: formData.notes || undefined,
      });
      setEditingSession(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form view (create)
  if (showForm) {
    return (
      <WorkoutSessionForm
        exerciseLibrary={exerciseLibrary}
        sourceVideo={prefillVideo}
        onSubmit={async (formData, exercises) => {
          await handleCreate(formData, exercises);
          onConsumedPrefill();
        }}
        onCancel={() => { setShowForm(false); onConsumedPrefill(); }}
        isSubmitting={isSubmitting}
      />
    );
  }

  if (editingSession) {
    return (
      <WorkoutSessionForm
        exerciseLibrary={exerciseLibrary}
        initialData={editingSession}
        onSubmit={handleUpdate}
        onCancel={() => setEditingSession(null)}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick stats + add button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <Activity size={14} className="text-sage-deep mx-auto mb-1" />
            <p className="text-lg font-bold text-ink">{sessions.length}</p>
            <p className="text-[10px] text-ink-lighter">总训练次数</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <Calendar size={14} className="text-accent-sky mx-auto mb-1" />
            <p className="text-lg font-bold text-ink">{workoutsThisWeek ?? 0}</p>
            <p className="text-[10px] text-ink-lighter">本周训练/天</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 h-full min-h-[80px] w-20 bg-sage-light text-sage-deep rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-sage-light/80 transition-colors"
        >
          <Plus size={18} />
          <span className="text-[10px] font-semibold">开始训练</span>
        </button>
      </div>

      {/* Date filter chips */}
      {dates.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDate(null)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors",
              !selectedDate ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            全部
          </button>
          {prevDate && (
            <button
              onClick={() => setSelectedDate(prevDate)}
              className="shrink-0 h-7 w-7 rounded-full bg-ink/5 flex items-center justify-center text-ink-light hover:bg-ink/10"
            >
              <ChevronLeft size={12} />
            </button>
          )}
          {dates.slice(0, 10).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors",
                selectedDate === d ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
              )}
            >
              {formatDate(d)} {formatWeekday(d)}
            </button>
          ))}
          {nextDate && dates.length > 10 && (
            <button
              onClick={() => setSelectedDate(nextDate)}
              className="shrink-0 h-7 w-7 rounded-full bg-ink/5 flex items-center justify-center text-ink-light hover:bg-ink/10"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Session list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-sage-deep" />
        </div>
      ) : displaySessions.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell size={36} className="text-ink-lighter mx-auto mb-3 opacity-20" />
          <p className="text-sm text-ink-lighter">
            {selectedDate ? `${formatDate(selectedDate)} 没有训练记录` : "还没有训练记录"}
          </p>
          <p className="text-xs text-ink-lighter mt-1">点击"开始训练"记录你的每一次努力</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold hover:bg-sage-light/80 transition-colors"
          >
            <Plus size={13} />开始训练
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {displaySessions.map((session) => {
            const isExpanded = expandedId === session.id;
            return (
              <div
                key={session.id}
                className="bg-card rounded-2xl border border-border hover:border-sage-light/30 transition-colors overflow-hidden"
              >
                <button
                  onClick={() => onExpandSession(isExpanded ? null : session.id)}
                  className="w-full p-3.5 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sage-light/30 flex items-center justify-center shrink-0">
                      <Dumbbell size={16} className="text-sage-deep" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink">{session.title || "训练"}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-ink-lighter">{formatDate(session.date)} {formatWeekday(session.date)}</span>
                            {session.training_type && (
                              <span className="text-[10px] text-accent-sky bg-accent-sky/5 rounded-full px-1.5 py-0.5">{session.training_type}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSession(session); }}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Quick stats row */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-ink-lighter">
                        {session.duration_minutes && (
                          <span className="flex items-center gap-0.5"><Clock size={10} />{session.duration_minutes}分钟</span>
                        )}
                        {session.location && (
                          <span className="flex items-center gap-0.5"><MapPin size={10} />{LOCATION_ICONS[session.location] || ""}{session.location}</span>
                        )}
                        {session.feeling && (
                          <span className="flex items-center gap-0.5"><Smile size={10} />{FEELING_EMOJI[session.feeling] || ""}{session.feeling}</span>
                        )}
                        {session.perceived_effort && (
                          <span className="flex items-center gap-0.5"><Zap size={10} />RPE {session.perceived_effort}/10</span>
                        )}
                        <span className="text-sage-deep font-medium">
                          {session.mode === "video_follow" ? "跟练" : "自由训练"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded: exercise details */}
                {isExpanded && expandedSession?.exercises && expandedSession.exercises.length > 0 && (
                  <div className="border-t border-border/50 px-3.5 py-3 space-y-2">
                    {expandedSession.exercises.map((ex) => (
                      <div key={ex.id} className="bg-ink/5 rounded-xl p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-ink">{ex.exercise_name}</span>
                            {ex.category && (
                              <span className="text-[10px] text-ink-lighter bg-white/50 rounded-full px-1.5 py-0.5">{ex.category}</span>
                            )}
                            {ex.is_bodyweight && (
                              <span className="text-[10px] text-accent-warm bg-accent-warm/10 rounded-full px-1.5 py-0.5">自重</span>
                            )}
                          </div>
                          {ex.sets_completed != null && (
                            <span className="text-[10px] text-ink-lighter">{ex.sets_completed}组完成</span>
                          )}
                        </div>
                        {ex.reps && ex.reps.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {ex.reps.map((r, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full",
                                  r.completed
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-ink/5 text-ink-lighter",
                                )}
                              >
                                {r.reps}次{r.weight > 0 ? ` ${r.weight}kg` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: notes */}
                {isExpanded && expandedSession?.notes && (
                  <div className="border-t border-border/50 px-3.5 py-2.5">
                    <p className="text-[11px] text-ink-light leading-relaxed">{session.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
