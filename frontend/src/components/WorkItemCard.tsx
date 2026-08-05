import { useI18n } from "../i18n";
import type { WorkItemDetail } from "../types/api";

export default function WorkItemCard({ workItem }: { workItem: WorkItemDetail }) {
  const { t } = useI18n();

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-violet-300">{t("card.eyebrow")}</p>
      <h4 className="mt-1 text-xl font-semibold tracking-tight">
        {workItem.type} #{workItem.id}
      </h4>
      <p className="mt-3 text-sm text-slate-300">{workItem.title}</p>

      {workItem.description && (
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("card.description")}
          </p>
          <p className="text-sm leading-6 text-slate-300">{workItem.description}</p>
        </div>
      )}

      {workItem.acceptanceCriteria && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("card.existing_ac")}
          </p>
          <p className="text-sm leading-6 text-slate-300">{workItem.acceptanceCriteria}</p>
        </div>
      )}

      <dl className="mt-5 grid gap-3 text-sm text-slate-300">
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("card.state")}</dt>
          <dd>{workItem.state || t("common.na")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("card.area")}</dt>
          <dd>{workItem.areaPath || t("common.na")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("card.iteration")}</dt>
          <dd>{workItem.iterationPath || t("common.na")}</dd>
        </div>
      </dl>

      {workItem.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {workItem.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
