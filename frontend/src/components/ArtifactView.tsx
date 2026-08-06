import type { RefinementDeliverable } from "../types/api";

function ItemList({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <p className="text-sm italic text-outline">—</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function ArtifactView({ deliverable }: { deliverable: RefinementDeliverable }) {
  return (
    <div className="space-y-6">
      {deliverable.summary && (
        <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">Résumé</p>
          <p className="text-sm leading-6 text-on-surface">{deliverable.summary}</p>
        </section>
      )}

      <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-outline">Brief</p>
        <div className="space-y-4">
          {deliverable.brief.map((section, index) => (
            <div key={index}>
              <p className="mb-2 text-base font-semibold text-on-surface">{section.heading}</p>
              <ItemList items={section.items} />
            </div>
          ))}
        </div>
      </section>

      {deliverable.plan.length > 0 && (
        <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-outline">Plan</p>
          <ol className="space-y-2">
            {deliverable.plan.map((step, index) => (
              <li key={index} className="rounded-lg border border-border-subtle bg-surface-container-lowest p-3">
                <p className="text-sm font-semibold text-on-surface">
                  {index + 1}. {step.title}
                </p>
                {step.detail && <p className="mt-1 text-sm text-on-surface-variant">{step.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {deliverable.codeDraft && (
        <section className="rounded-lg border border-border-subtle bg-surface-container-low p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-outline">Code Draft</p>
          <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-container p-4 text-xs text-on-surface">
            <code>{deliverable.codeDraft}</code>
          </pre>
        </section>
      )}

      {deliverable.openQuestions.length > 0 && (
        <section className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">Questions ouvertes</p>
          <ItemList items={deliverable.openQuestions} />
        </section>
      )}
    </div>
  );
}
