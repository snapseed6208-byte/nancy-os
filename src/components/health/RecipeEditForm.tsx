import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { RecipeIngredient, RecipeIngredientsGrouped, RecipeStep } from "@/lib/hooks/useHealth";

type EditData = {
  name: string;
  image_url: string;
  ingredients_json: RecipeIngredient[] | RecipeIngredientsGrouped;
  steps_json: RecipeStep[];
};

type RecipeEditFormProps = {
  initialData: EditData;
  onSave: (data: EditData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
};

const GROUP_DEFS = [
  { key: "main" as const, label: "主食材" },
  { key: "marinade" as const, label: "腌料" },
  { key: "sauce" as const, label: "料汁" },
  { key: "garnish" as const, label: "出锅装饰" },
];

function isGrouped(ing: RecipeIngredient[] | RecipeIngredientsGrouped): ing is RecipeIngredientsGrouped {
  return ing && typeof ing === "object" && !Array.isArray(ing);
}

export default function RecipeEditForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
}: RecipeEditFormProps) {
  const [name, setName] = useState(initialData.name);
  const [imageUrl, setImageUrl] = useState(initialData.image_url);

  const initialGrouped = isGrouped(initialData.ingredients_json);

  // For grouped mode, maintain state per group
  const [groupedIngredients, setGroupedIngredients] = useState<RecipeIngredientsGrouped>(
    initialGrouped
      ? initialData.ingredients_json as RecipeIngredientsGrouped
      : { main: [], marinade: [], sauce: [], garnish: [] },
  );

  // For flat mode, maintain flat array
  const [flatIngredients, setFlatIngredients] = useState<RecipeIngredient[]>(
    !initialGrouped && Array.isArray(initialData.ingredients_json) && initialData.ingredients_json.length > 0
      ? initialData.ingredients_json as RecipeIngredient[]
      : [{ name: "", amount: "", category: "" }],
  );

  const [steps, setSteps] = useState<RecipeStep[]>(
    initialData.steps_json.length > 0 ? initialData.steps_json : [{ order: 1, text: "" }],
  );

  // ── Flat ingredient helpers ──
  const addFlatIngredient = () => {
    setFlatIngredients((prev) => [...prev, { name: "", amount: "", category: "" }]);
  };

  const removeFlatIngredient = (idx: number) => {
    if (flatIngredients.length <= 1) return;
    setFlatIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFlatIngredient = (idx: number, field: "name" | "amount", value: string) => {
    setFlatIngredients((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  // ── Grouped ingredient helpers ──
  const addGroupedIngredient = (groupKey: keyof RecipeIngredientsGrouped) => {
    setGroupedIngredients((prev) => ({
      ...prev,
      [groupKey]: [...prev[groupKey], { name: "", amount: "", category: "" }],
    }));
  };

  const removeGroupedIngredient = (groupKey: keyof RecipeIngredientsGrouped, idx: number) => {
    setGroupedIngredients((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].filter((_, i) => i !== idx),
    }));
  };

  const updateGroupedIngredient = (
    groupKey: keyof RecipeIngredientsGrouped,
    idx: number,
    field: "name" | "amount",
    value: string,
  ) => {
    setGroupedIngredients((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  // ── Step helpers ──
  const addStep = () => {
    setSteps((prev) => [...prev, { order: prev.length + 1, text: "" }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const updateStep = (idx: number, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, text: value } : s)));
  };

  const handleSubmit = async () => {
    const cleanSteps = steps.filter((s) => s.text.trim()).map((s, i) => ({ ...s, order: i + 1 }));

    let finalIngredients: RecipeIngredient[] | RecipeIngredientsGrouped;

    if (initialGrouped) {
      const cleaned: RecipeIngredientsGrouped = { main: [], marinade: [], sauce: [], garnish: [] };
      for (const g of GROUP_DEFS) {
        cleaned[g.key] = groupedIngredients[g.key].filter(
          (item) => item.name.trim() || item.amount.trim(),
        );
      }
      finalIngredients = cleaned;
    } else {
      const cleaned = flatIngredients.filter((item) => item.name.trim() || item.amount.trim());
      finalIngredients = cleaned.length > 0 ? cleaned : initialData.ingredients_json;
    }

    await onSave({
      name: name.trim(),
      image_url: imageUrl.trim(),
      ingredients_json: finalIngredients,
      steps_json: cleanSteps.length > 0 ? cleanSteps : initialData.steps_json,
    });
  };

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">基本信息</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="食谱名称"
          className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-lg px-3 py-2 focus:border-sage-deep/50"
        />
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="图片链接（可选）"
          className="w-full bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-3 py-2 focus:border-sage-deep/50"
        />
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">食材</label>

        {initialGrouped ? (
          <div className="space-y-3">
            {GROUP_DEFS.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-semibold text-ink-lighter">{group.label}</h4>
                  <button
                    onClick={() => addGroupedIngredient(group.key)}
                    className="flex items-center gap-1 text-[10px] text-sage-deep font-medium hover:underline"
                  >
                    <Plus size={10} />添加
                  </button>
                </div>
                {groupedIngredients[group.key].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <GripVertical size={12} className="text-ink-lighter shrink-0" />
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateGroupedIngredient(group.key, idx, "name", e.target.value)}
                      placeholder="名称"
                      className="flex-1 bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
                    />
                    <input
                      type="text"
                      value={item.amount}
                      onChange={(e) => updateGroupedIngredient(group.key, idx, "amount", e.target.value)}
                      placeholder="用量"
                      className="w-20 bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
                    />
                    <button
                      onClick={() => removeGroupedIngredient(group.key, idx)}
                      className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {flatIngredients.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <GripVertical size={12} className="text-ink-lighter shrink-0" />
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateFlatIngredient(idx, "name", e.target.value)}
                  placeholder="名称"
                  className="flex-1 bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
                />
                <input
                  type="text"
                  value={item.amount}
                  onChange={(e) => updateFlatIngredient(idx, "amount", e.target.value)}
                  placeholder="用量"
                  className="w-20 bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 focus:border-sage-deep/50"
                />
                <button
                  onClick={() => removeFlatIngredient(idx)}
                  className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-red-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={addFlatIngredient}
              className="flex items-center gap-1 text-[10px] text-sage-deep font-medium hover:underline mt-1"
            >
              <Plus size={10} />添加食材
            </button>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">步骤</label>
          <button
            onClick={addStep}
            className="flex items-center gap-1 text-[10px] text-sage-deep font-medium hover:underline"
          >
            <Plus size={10} />添加步骤
          </button>
        </div>
        <div className="space-y-1.5">
          {steps.map((s, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sage-light/50 text-sage-deep text-[10px] font-bold flex items-center justify-center mt-1">
                {idx + 1}
              </span>
              <textarea
                value={s.text}
                onChange={(e) => updateStep(idx, e.target.value)}
                placeholder={`步骤 ${idx + 1} 的内容`}
                className="flex-1 bg-transparent text-xs text-ink outline-none border border-border rounded-lg px-2.5 py-1.5 h-12 resize-none focus:border-sage-deep/50"
              />
              <button
                onClick={() => removeStep(idx)}
                className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:text-red-500 mt-0.5"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={isSaving || !name.trim()}
          className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-xs text-ink-light hover:bg-ink/5 rounded-xl"
        >
          取消
        </button>
      </div>
    </div>
  );
}
