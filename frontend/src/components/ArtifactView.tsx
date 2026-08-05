import { useI18n } from "../i18n";
import type { FinalRefinementModel } from "../types/api";

const NEUTRAL_ITEM = "rounded-lg border border-border-subtle bg-surface-container-low p-3";
const NESTED_ITEM = "rounded-lg border border-border-subtle bg-white p-3";
const AMBER_ITEM = "rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-3 text-on-surface-variant";

function ItemList({
  items,
  emptyText,
  itemClass = NEUTRAL_ITEM,
}: {
  items: string[];
  emptyText?: string;
  itemClass?: string;
}) {
  return (
    <ul className="space-y-2 text-sm text-on-surface-variant">
      {items.length > 0
        ? items.map((item, index) => (
            <li key={index} className={itemClass}>
              {item}
            </li>
          ))
        : emptyText && <li className="text-outline text-sm">{emptyText}</li>}
    </ul>
  );
}

const CONCERN_KEYS = ["testing", "cicd", "infra", "data", "security", "observability"] as const;

export default function ArtifactView({ artifact }: { artifact: FinalRefinementModel }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
          {t("artifact.summary")}
        </p>
        <p className="text-sm leading-6 text-on-surface">{artifact.summary}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.in_scope")}
          </p>
          <ItemList items={artifact.scope.inScope ?? []} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.out_of_scope")}
          </p>
          <ItemList items={artifact.scope.outOfScope ?? []} />
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.proposed_split")}
          </p>
          <h5 className="text-lg font-semibold text-on-surface">
            {t("artifact.story_count", { count: artifact.proposedSplit.storyCount })}
          </h5>
        </div>
        <p className="mb-4 text-sm text-on-surface-variant">{artifact.proposedSplit.rationale}</p>
        <div className="space-y-4">
          {artifact.proposedSplit.stories.map((story, index) => (
            <article key={index} className="rounded-lg border border-border-subtle bg-surface-container-lowest p-5">
              <h6 className="text-base font-semibold text-on-surface">
                {index + 1}. {story.title}
              </h6>
              <p className="mt-2 text-sm text-on-surface-variant">{story.goal}</p>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                    {t("artifact.acceptance_criteria")}
                  </p>
                  <ItemList items={story.acceptanceCriteria} itemClass={NESTED_ITEM} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                    {t("artifact.technical_notes")}
                  </p>
                  <ItemList
                    items={story.technicalNotes}
                    emptyText={t("artifact.no_technical_notes")}
                    itemClass={NESTED_ITEM}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                    {t("artifact.dependencies")}
                  </p>
                  <ItemList
                    items={story.dependencies}
                    emptyText={t("artifact.no_dependencies")}
                    itemClass={NESTED_ITEM}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                    {t("artifact.risks")}
                  </p>
                  <ItemList
                    items={story.risks}
                    emptyText={t("artifact.no_risks")}
                    itemClass={NESTED_ITEM}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.known_facts")}
          </p>
          <ItemList items={artifact.knownFacts} emptyText={t("artifact.no_known_facts")} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.assumptions")}
          </p>
          <ItemList items={artifact.assumptions} emptyText={t("artifact.no_assumptions")} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.cross_cutting")}
          </p>
          <div className="space-y-4">
            {CONCERN_KEYS.map((concern) => (
              <div key={concern}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                  {t(`artifact.concern.${concern}`)}
                </p>
                <ItemList
                  items={artifact.crossCuttingConcerns[concern]}
                  emptyText={t("artifact.no_item")}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
            {t("artifact.delivery_plan")}
          </p>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                {t("artifact.recommended_order")}
              </p>
              <ItemList items={artifact.deliveryPlan.recommendedOrder} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                {t("artifact.milestones")}
              </p>
              <ItemList items={artifact.deliveryPlan.milestones} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">
                {t("artifact.open_questions")}
              </p>
              <ItemList
                items={artifact.openQuestions}
                emptyText={t("artifact.no_open_questions")}
                itemClass={AMBER_ITEM}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
