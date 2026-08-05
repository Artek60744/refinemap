import { useI18n } from "../i18n";
import type { SessionSummaryModel } from "../types/api";

const NEUTRAL_ITEM = "rounded-lg border border-border-subtle bg-surface-container-low p-3";
const AMBER_ITEM = "rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-3 text-on-surface-variant";
const ROSE_ITEM = "rounded-lg border border-error/20 bg-error-container/50 p-3 text-error";

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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">{title}</p>
      <ul className="space-y-2 text-sm">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li key={index} className={itemClass}>
              {item}
            </li>
          ))
        ) : (
          <li className="text-outline">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}

export default function SessionSummaryPanel({ summary }: { summary: SessionSummaryModel }) {
  const { t, label } = useI18n();

  return (
    <aside className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("summary.eyebrow")}</p>
          <h4 className="font-headline-md text-headline-md text-on-surface">{t("summary.title")}</h4>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
          {label("confidence", summary.confidence)}
        </span>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("summary.reason")}
          </p>
          <p className="text-on-surface-variant">{summary.reason}</p>
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
