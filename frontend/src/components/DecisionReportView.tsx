import type { DecisionRecommendation, DecisionReport } from "../types/api";
import { useI18n } from "../i18n";

const RECOMMENDATION_STYLES: Record<
  DecisionRecommendation,
  { icon: string; badge: string; border: string; background: string }
> = {
  go: {
    icon: "check_circle",
    badge: "bg-score-good text-white",
    border: "border-score-good/40",
    background: "bg-score-good/10",
  },
  explore: {
    icon: "travel_explore",
    badge: "bg-node-blue text-white",
    border: "border-node-blue/40",
    background: "bg-node-blue/10",
  },
  rework: {
    icon: "build_circle",
    badge: "bg-score-warn text-white",
    border: "border-score-warn/40",
    background: "bg-score-warn/10",
  },
  drop: {
    icon: "cancel",
    badge: "bg-score-alert text-white",
    border: "border-score-alert/40",
    background: "bg-score-alert/10",
  },
};

// `firstMarker` flags the leading item as the decisive one — the list is ordered by
// decisional impact, so the first blocker is the one that gates the verdict.
function DecisionList({
  title,
  items,
  firstMarker,
}: {
  title: string;
  items: string[];
  firstMarker?: string;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
        {items.map((item, index) => (
          <li key={index}>
            {index === 0 && firstMarker && (
              <span className="mr-1.5 rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface">
                {firstMarker}
              </span>
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DecisionReportView({
  report,
  variant,
}: {
  report: DecisionReport;
  variant: "banner" | "full";
}) {
  const { t, label } = useI18n();
  const styles = RECOMMENDATION_STYLES[report.recommendation] ?? RECOMMENDATION_STYLES.explore;

  // reasons[0] is the root cause: the one item that, once lifted, flips the verdict.
  const [rootCause, ...secondaryReasons] = report.reasons;
  // A verdict short of a go carries its own flip condition, derived from the blockers.
  const conditionalGo =
    (report.recommendation === "explore" || report.recommendation === "rework") &&
    report.blockers.length > 0
      ? report.blockers.length === 1
        ? t("decision.conditional_go_one")
        : t("decision.conditional_go_many", { count: report.blockers.length })
      : null;

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${styles.badge}`}
      >
        <span className="material-symbols-outlined text-[16px]">{styles.icon}</span>
        {label("decision", report.recommendation)}
      </span>
      <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-xs text-on-surface-variant">
        {t("decision.confidence")} : {label("confidence", report.confidence)}
      </span>
    </div>
  );

  const nextAction = report.nextAction && (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-border-subtle bg-surface p-3">
      <span className="material-symbols-outlined mt-0.5 text-[18px] text-on-surface-variant">
        arrow_forward
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-outline">
          {t("decision.next_action")}
        </p>
        <p className="mt-0.5 text-sm font-medium text-on-surface">{report.nextAction}</p>
      </div>
    </div>
  );

  if (variant === "banner") {
    return (
      <div className={`mb-5 rounded-lg border ${styles.border} ${styles.background} p-4`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
          {t("decision.title")}
        </p>
        {header}
        {conditionalGo && (
          <p className="mt-2 text-sm font-medium text-on-surface">{conditionalGo}</p>
        )}
        {rootCause && (
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant line-clamp-3">
            <span className="font-semibold text-on-surface">{t("decision.root_cause")} : </span>
            {rootCause}
          </p>
        )}
        {nextAction}
      </div>
    );
  }

  return (
    <section className={`rounded-lg border ${styles.border} ${styles.background} p-5`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-outline">
        {t("decision.title")}
      </p>
      {header}
      {conditionalGo && (
        <p className="mt-3 text-sm font-medium text-on-surface">{conditionalGo}</p>
      )}
      <div className="mt-4 space-y-4">
        {rootCause && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
              {t("decision.root_cause")}
            </p>
            <p className="text-sm font-medium leading-relaxed text-on-surface">{rootCause}</p>
          </div>
        )}
        <DecisionList title={t("decision.secondary_reasons")} items={secondaryReasons} />
        <DecisionList
          title={t("decision.blockers")}
          items={report.blockers}
          firstMarker={report.blockers.length > 1 ? t("decision.main_blocker") : undefined}
        />
        <DecisionList title={t("decision.strengths")} items={report.strengths} />
      </div>
      {nextAction}
    </section>
  );
}
