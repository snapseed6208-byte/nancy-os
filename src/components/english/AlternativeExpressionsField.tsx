import { Plus, Trash2 } from "lucide-react";
import {
  MAX_ALTERNATIVE_EXPRESSIONS,
  type AlternativeExpression,
} from "@/lib/english/alternativeExpressions";

interface AlternativeExpressionsFieldProps {
  value: AlternativeExpression[];
  onChange: (value: AlternativeExpression[]) => void;
}

export default function AlternativeExpressionsField({ value, onChange }: AlternativeExpressionsFieldProps) {
  const update = (index: number, field: keyof AlternativeExpression, nextValue: string) => {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: nextValue } : item));
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-ink-light">近义替换</label>
        {value.length < MAX_ALTERNATIVE_EXPRESSIONS && (
          <button
            type="button"
            onClick={() => onChange([...value, { expression: "", difference: "" }])}
            className="inline-flex items-center gap-1 text-xs text-sage-deep"
          >
            <Plus size={13} /> 添加替换
          </button>
        )}
      </div>
      {value.map((item, index) => (
        <div key={index} className="min-w-0 border-t border-border pt-2 space-y-2 first:border-t-0 first:pt-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-4 shrink-0 text-xs text-ink-lighter">{index + 1}.</span>
            <input
              aria-label={`替换表达 ${index + 1}`}
              value={item.expression}
              onChange={(event) => update(index, "expression", event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
            />
            <button
              type="button"
              aria-label={`删除替换 ${index + 1}`}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              className="h-8 w-8 shrink-0 flex items-center justify-center text-ink-lighter hover:text-accent-rose"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            aria-label={`使用区别 ${index + 1}`}
            value={item.difference}
            onChange={(event) => update(index, "difference", event.target.value)}
            rows={2}
            placeholder="简短说明使用区别"
            className="w-full min-w-0 resize-none bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50 [overflow-wrap:anywhere]"
          />
        </div>
      ))}
    </div>
  );
}
