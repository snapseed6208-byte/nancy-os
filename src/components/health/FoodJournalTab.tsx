import { useState } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Apple, Trash2,
  ChefHat, Sparkles, Loader2, AlertTriangle, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import FoodRecordForm from "@/components/health/FoodRecordForm";
import {
  useRecipes, useFoodRecords, useCreateFoodRecord, useDeleteFoodRecord,
  useGenerateDailyDietSummary, useDailyDietSummary,
  type FoodRecord,
} from "@/lib/hooks/useHealth";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍪" };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FoodJournalTab() {
  const [date, setDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: recipes } = useRecipes();
  const { data: foodRecords, isLoading } = useFoodRecords(date);
  const createFood = useCreateFoodRecord();
  const deleteFood = useDeleteFoodRecord();
  const generateSummary = useGenerateDailyDietSummary();
  const { data: dailySummary } = useDailyDietSummary(date);

  const isToday = date === today();
  const prevDate = shiftDate(date, -1);
  const nextDate = !isToday ? shiftDate(date, 1) : null;

  // Group records by meal type
  const foodsByMeal = (foodRecords || []).reduce<Record<string, FoodRecord[]>>((acc, r) => {
    const mt = r.meal_type || "other";
    if (!acc[mt]) acc[mt] = [];
    acc[mt].push(r);
    return acc;
  }, {});

  const handleCreate = async (
    formData: {
      meal_type: string; food_name: string; portion: string;
      notes: string; feeling: string; record_time: string;
      recipe_id: string;
    },
    imageFiles: File[],
  ) => {
    setIsSubmitting(true);
    try {
      await createFood.mutateAsync({
        date,
        meal_type: formData.meal_type,
        food_name: formData.food_name.trim(),
        portion: formData.portion || undefined,
        feeling: formData.feeling || undefined,
        record_time: formData.record_time || undefined,
        notes: formData.notes || undefined,
        recipe_id: formData.recipe_id || undefined,
        image_files: imageFiles.length > 0 ? imageFiles : undefined,
      });
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Date navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-2">
        <button
          onClick={() => setDate(prevDate)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5 text-ink-light"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            {formatDate(date)} {formatWeekday(date)}
          </p>
          {!isToday && (
            <button
              onClick={() => setDate(today())}
              className="text-[10px] text-sage-deep font-medium hover:underline mt-0.5"
            >
              回到今天
            </button>
          )}
        </div>
        <button
          onClick={() => nextDate && setDate(nextDate)}
          disabled={!nextDate}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5 text-ink-light disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-3.5 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors"
        >
          <Plus size={15} />添加饮食
        </button>
      )}

      {/* Food record form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-3">
          <FoodRecordForm
            recipes={recipes || []}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-sage-deep" />
        </div>
      )}

      {/* Food records by meal type */}
      {!isLoading && Object.keys(foodsByMeal).length === 0 && !isLoading && (
        <div className="text-center py-10">
          <Apple size={28} className="text-ink-lighter mx-auto mb-2 opacity-25" />
          <p className="text-xs text-ink-lighter">还没有饮食记录</p>
          <p className="text-[10px] text-ink-lighter mt-1">点击"添加饮食"记录今天吃了什么</p>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-2">
          {MEAL_TYPES.map((mt) => {
            const meals = foodsByMeal[mt];
            if (!meals || meals.length === 0) return null;
            return (
              <div key={mt} className="bg-card rounded-2xl border border-border p-3.5 space-y-2">
                <p className="text-xs font-semibold text-ink-light">
                  {MEAL_ICONS[mt]} {MEAL_LABELS[mt]}
                </p>
                {meals.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Apple size={11} className="text-accent-rose shrink-0 mt-0.5" />
                        <span className="text-xs text-ink truncate">{f.food_name}</span>
                        {f.portion && (
                          <span className="text-[10px] text-ink-lighter shrink-0">({f.portion})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => deleteFood.mutate(f.id)}
                          className="h-6 w-6 rounded-lg flex items-center justify-center text-ink-lighter hover:text-accent-rose"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Recipe link + notes + time */}
                    <div className="flex items-center gap-2 text-[10px] text-ink-lighter ml-5 flex-wrap">
                      {f.recipe_id && (
                        <span className="flex items-center gap-0.5 text-sage-deep bg-sage-light/20 rounded-full px-1.5 py-0.5">
                          <ChefHat size={9} />我的食谱库
                        </span>
                      )}
                      {f.record_time && (
                        <span>{f.record_time}</span>
                      )}
                      {f.notes && (
                        <span className="text-ink-lighter">{f.notes}</span>
                      )}
                    </div>

                    {/* Image thumbnails */}
                    {f.image_urls && f.image_urls.length > 0 && (
                      <div className="flex gap-1 ml-5">
                        {f.image_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-ink/5 hover:opacity-80 transition-opacity">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Daily Summary */}
      {!isLoading && foodRecords && foodRecords.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-light flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-warm" />AI今日总结
            </p>
            <button
              onClick={() => generateSummary.mutate({ date })}
              disabled={generateSummary.isPending}
              className="flex items-center gap-1 text-[10px] font-medium text-sage-deep bg-sage-light/50 rounded-full px-2 py-0.5 hover:bg-sage-light transition-colors disabled:opacity-50"
            >
              {generateSummary.isPending ? (
                <><Loader2 size={10} className="animate-spin" />生成中</>
              ) : (
                <><Sparkles size={10} />{dailySummary ? "重新生成" : "生成总结"}</>
              )}
            </button>
          </div>
          {generateSummary.error && (
            <div className="flex items-center gap-1.5 text-[10px] text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1.5">
              <AlertTriangle size={10} className="shrink-0" />
              {(generateSummary.error as Error).message}
            </div>
          )}
          {dailySummary?.content && (
            <p className="text-xs text-ink-light leading-relaxed">{dailySummary.content}</p>
          )}
          {!dailySummary?.content && !generateSummary.isPending && (
            <p className="text-[10px] text-ink-lighter">点击"生成总结"获取今日饮食AI反馈</p>
          )}
        </div>
      )}
    </div>
  );
}
