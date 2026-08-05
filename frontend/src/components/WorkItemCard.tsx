import { useI18n } from "../i18n";
import type { WorkItemDetail } from "../types/api";

export default function WorkItemCard({ workItem }: { workItem: WorkItemDetail }) {
  const { t } = useI18n();

  return (
    <aside className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("card.eyebrow")}</p>
      <h4 className="mt-1 font-headline-md text-headline-md text-on-surface">
        {workItem.type} #{workItem.id}
      </h4>
      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">{workItem.title}</p>

      {workItem.description && (
        <div className="mt-5 rounded-lg border border-border-subtle bg-surface-container-low p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("card.description")}
          </p>
          <p className="text-sm leading-6 text-on-surface-variant">{workItem.description}</p>
        </div>
      )}

      {workItem.acceptanceCriteria && (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface-container-low p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("card.existing_ac")}
          </p>
          <p className="text-sm leading-6 text-on-surface-variant">{workItem.acceptanceCriteria}</p>
        </div>
      )}

      <dl className="mt-5 grid gap-3 text-sm text-on-surface-variant">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-outline">{t("card.state")}</dt>
          <dd>{workItem.state || t("common.na")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-outline">{t("card.area")}</dt>
          <dd>{workItem.areaPath || t("common.na")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-outline">{t("card.iteration")}</dt>
          <dd>{workItem.iterationPath || t("common.na")}</dd>
        </div>
      </dl>

      {workItem.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {workItem.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-primary/20 bg-primary-fixed/30 px-3 py-1 text-xs font-medium text-on-primary-fixed-variant"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
