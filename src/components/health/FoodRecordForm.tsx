import { useState } from "react";
import { Apple, Search, X, Image as ImageIcon, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import RecipeSelector from "@/components/health/RecipeSelector";
import type { Recipe } from "@/lib/hooks/useHealth";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍪" };

type FoodFormData = {
  meal_type: string;
  food_name: string;
  portion: string;
  notes: string;
  feeling: string;
  record_time: string;
  recipe_id: string;
  recipe_image_url: string;
};

type FoodRecordFormProps = {
  recipes: Recipe[];
  initialData?: Partial<FoodFormData>;
  onSubmit: (data: FoodFormData, imageFiles: File[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
};

export default function FoodRecordForm({
  recipes,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: FoodRecordFormProps) {
  const [form, setForm] = useState<FoodFormData>({
    meal_type: initialData?.meal_type || "breakfast",
    food_name: initialData?.food_name || "",
    portion: initialData?.portion || "",
    notes: initialData?.notes || "",
    feeling: initialData?.feeling || "",
    record_time: initialData?.record_time || "",
    recipe_id: initialData?.recipe_id || "",
    recipe_image_url: initialData?.recipe_image_url || "",
  });
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const handleSelectRecipe = (recipe: Recipe) => {
    setForm((f) => ({
      ...f,
      food_name: recipe.name || f.food_name,
      recipe_id: recipe.id,
      recipe_image_url: recipe.image_url || "",
    }));
    setShowRecipeSelector(false);
  };

  const handleAddImages = (files: File[]) => {
    const remaining = 3 - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    setImageFiles((prev) => [...prev, ...toAdd].slice(0, 3));
    for (const f of toAdd) {
      setImagePreviews((prev) => [...prev, URL.createObjectURL(f)].slice(0, 3));
    }
  };

  const handleSubmit = () => {
    if (!form.food_name.trim()) return;
    onSubmit(form, imageFiles);
  };

  return (
    <div className="space-y-3">
      {/* Recipe link button */}
      {!form.recipe_id && (
        <button
          onClick={() => setShowRecipeSelector(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium text-sage-deep bg-sage-light/30 hover:bg-sage-light/50 transition-colors"
        >
          <ChefHat size={12} />从我的食谱库选择
        </button>
      )}
      {form.recipe_id && (
        <div className="flex items-center justify-between bg-sage-light/20 rounded-xl px-3 py-2">
          <span className="text-[11px] text-sage-deep flex items-center gap-1">
            <ChefHat size={11} />已关联食谱
          </span>
          <button
            onClick={() => setForm((f) => ({ ...f, recipe_id: "", recipe_image_url: "" }))}
            className="text-[10px] text-ink-lighter hover:text-accent-rose"
          >
            取消关联
          </button>
        </div>
      )}

      {/* Meal type selector */}
      <div className="flex gap-1">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt}
            onClick={() => setForm((f) => ({ ...f, meal_type: mt }))}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
              form.meal_type === mt ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light",
            )}
          >
            {MEAL_ICONS[mt]} {MEAL_LABELS[mt]}
          </button>
        ))}
      </div>

      {/* Food name */}
      <input
        type="text"
        value={form.food_name}
        onChange={(e) => setForm((f) => ({ ...f, food_name: e.target.value }))}
        placeholder="吃了什么？"
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50"
        autoFocus
      />

      {/* Portion + time */}
      <div className="flex gap-2">
        <input
          type="text"
          value={form.portion}
          onChange={(e) => setForm((f) => ({ ...f, portion: e.target.value }))}
          placeholder="份量 (如：1碗)"
          className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50"
        />
        <input
          type="time"
          value={form.record_time}
          onChange={(e) => setForm((f) => ({ ...f, record_time: e.target.value }))}
          className="w-28 bg-transparent text-xs text-ink outline-none border border-border rounded-xl px-2 py-2 focus:border-sage-deep/50"
        />
      </div>

      {/* Notes */}
      <input
        type="text"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        placeholder="备注 (选填)"
        className="w-full bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2 focus:border-sage-deep/50"
      />

      {/* Image picker */}
      <div className="space-y-1.5">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          id="food-form-image-input"
          onChange={(e) => {
            handleAddImages(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => document.getElementById("food-form-image-input")?.click()}
          disabled={imageFiles.length >= 3}
          className="flex items-center gap-1 text-[10px] font-medium text-ink-lighter bg-ink/5 rounded-lg px-2 py-1.5 hover:bg-ink/10 disabled:opacity-40 transition-colors"
        >
          <ImageIcon size={12} />
          {imageFiles.length > 0 ? `已选 ${imageFiles.length}/3` : "添加图片"}
        </button>
        {imagePreviews.length > 0 && (
          <div className="flex gap-1.5">
            {imagePreviews.map((url, i) => (
              <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-ink/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
                    setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  className="absolute top-0 right-0 w-4 h-4 bg-black/40 rounded-bl-lg flex items-center justify-center"
                >
                  <X size={9} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!form.food_name.trim() || isSubmitting}
          className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
        >
          {isSubmitting ? "保存中..." : "保存"}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 text-xs text-ink-light hover:bg-ink/5 rounded-xl">
          取消
        </button>
      </div>

      {/* Recipe selector modal */}
      {showRecipeSelector && (
        <RecipeSelector
          recipes={recipes}
          onSelect={handleSelectRecipe}
          onClose={() => setShowRecipeSelector(false)}
        />
      )}
    </div>
  );
}
