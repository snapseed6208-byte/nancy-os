import type { AlternativeExpression } from "@/lib/english/alternativeExpressions";

export default function AlternativeExpressionsList({
  alternatives,
  legacySynonyms,
  compact = false,
}: {
  alternatives: AlternativeExpression[];
  legacySynonyms?: string | null;
  compact?: boolean;
}) {
  if (alternatives.length === 0 && !legacySynonyms?.trim()) return null;

  return (
    <section className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-ink-light">你还可以这样说</p>
      {alternatives.length > 0 ? (
        <div className="min-w-0 space-y-2">
          {alternatives.slice(0, 2).map((item) => (
            <div key={item.expression} className="min-w-0 border-l-2 border-sage-light pl-3">
              <p className="break-words text-sm font-medium text-ink">{item.expression}</p>
              {!compact && <p className="mt-0.5 break-words text-xs leading-5 text-ink-lighter">{item.difference}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="break-words text-xs leading-5 text-ink-lighter">近义词：{legacySynonyms}</p>
      )}
    </section>
  );
}
