import { Check, Loader2, Plus, RefreshCw } from "lucide-react";
import type { ExpressionConnection } from "@/lib/english/expressionConnections";

const REGISTER_LABELS: Record<ExpressionConnection["register"], string> = {
  spoken: "口语",
  neutral: "中性",
  formal: "正式",
  written: "书面",
};

const INTERCHANGEABILITY_LABELS: Record<ExpressionConnection["interchangeability"], string> = {
  usually: "通常可替换",
  sometimes: "部分场景可替换",
  rarely: "很少直接替换",
};

interface Props {
  title: string;
  connections: ExpressionConnection[];
  isLoading?: boolean;
  error?: unknown;
  compact?: boolean;
  onRetry?: () => void;
  onOpen?: (expressionId: string) => void;
  onAdd?: (connection: ExpressionConnection) => void;
  addingExpression?: string | null;
}

export default function ExpressionConnectionsPanel({
  title,
  connections,
  isLoading = false,
  error,
  compact = false,
  onRetry,
  onOpen,
  onAdd,
  addingExpression,
}: Props) {
  if (!isLoading && !error && connections.length === 0) return null;

  return (
    <section className="min-w-0 border-y border-border py-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-ink">{title}</h3>
        {isLoading && <Loader2 size={13} className="shrink-0 animate-spin text-ink-lighter" aria-label="正在加载相关表达" />}
      </div>

      {Boolean(error) && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-lighter">
          <span>相关表达暂时无法加载</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 text-sage-deep hover:text-ink">
              <RefreshCw size={12} className="mr-1 inline" />重试
            </button>
          )}
        </div>
      )}

      {connections.length > 0 && (
        <div className="mt-2 divide-y divide-border/70">
          {connections.map((connection) => (
            <div key={`${connection.expression_id || "external"}-${connection.expression}`} className={compact ? "py-2.5" : "py-3"}>
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  disabled={!connection.expression_id || !onOpen}
                  onClick={() => connection.expression_id && onOpen?.(connection.expression_id)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="block break-words text-sm font-medium text-ink">{connection.expression}</span>
                  <span className={connection.learned ? "mt-0.5 block text-[10px] text-sage-deep" : "mt-0.5 block text-[10px] text-ink-lighter"}>
                    {connection.learned ? <><Check size={10} className="mr-1 inline" />已学过</> : connection.expression_id ? "已在表达库" : "未学习"}
                  </span>
                </button>
                {!connection.expression_id && onAdd && (
                  <button
                    type="button"
                    onClick={() => onAdd(connection)}
                    disabled={addingExpression === connection.expression}
                    className="shrink-0 text-[11px] text-ink-light hover:text-sage-deep disabled:opacity-50"
                  >
                    {addingExpression === connection.expression
                      ? <Loader2 size={12} className="animate-spin" aria-label="正在加入表达库" />
                      : <><Plus size={12} className="mr-0.5 inline" />加入表达库</>}
                  </button>
                )}
              </div>
              {connection.chinese_meaning && <p className="mt-1 break-words text-xs text-ink-light">{connection.chinese_meaning}</p>}
              <p className="mt-1 break-words text-xs leading-5 text-ink-light">{connection.difference}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-lighter">{REGISTER_LABELS[connection.register]}</span>
                <span className="bg-sage-light/40 px-1.5 py-0.5 text-[10px] text-sage-deep">{INTERCHANGEABILITY_LABELS[connection.interchangeability]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
