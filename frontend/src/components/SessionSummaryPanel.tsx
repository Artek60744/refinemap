import { useI18n } from "../i18n";
import type { SessionSummaryModel } from "../types/api";

const NEUTRAL_ITEM = "rounded-lg border border-slate-800 bg-slate-950/60 p-3";
const AMBER_ITEM = "rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100";
const ROSE_ITEM = "rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-rose-100";

function SummaryList({
  title,
  items,
  emptyText,
  itemClass = NEUTRAL_ITEM,
}: {
  title: string;
  items: string[];
  emptyText: string;
  itemClass?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <ul className="space-y-2 text-slate-300">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li key={index} className={itemClass}>
              {item}
            </li>
          ))
        ) : (
          <li className="text-slate-500">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}

export default function SessionSummaryPanel({ summary }: { summary: SessionSummaryModel }) {
  const { t, label } = useI18n();

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-violet-300">{t("summary.eyebrow")}</p>
          <h4 className="text-xl font-semibold tracking-tight">{t("summary.title")}</h4>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
          {label("confidence", summary.confidence)}
        </span>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("summary.reason")}
          </p>
          <p className="text-slate-300">{summary.reason}</p>
        </div>

        <SummaryList title={t("summary.facts")} items={summary.facts} emptyText={t("summary.no_facts")} />
        <SummaryList
          title={t("summary.assumptions")}
          items={summary.assumptions}
          emptyText={t("summary.no_assumptions")}
        />
        <SummaryList
          title={t("summary.unknowns")}
          items={summary.unknowns}
          emptyText={t("summary.no_unknowns")}
          itemClass={AMBER_ITEM}
        />
        <SummaryList
          title={t("summary.dependencies")}
          items={summary.dependencies}
          emptyText={t("summary.no_dependencies")}
        />
        <SummaryList
          title={t("summary.risks")}
          items={summary.risks}
          emptyText={t("summary.no_risks")}
          itemClass={ROSE_ITEM}
        />
      </div>
    </aside>
  );
}
