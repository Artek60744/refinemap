import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { exportUrl, getSession } from "../api/refinement";
import ArtifactView from "../components/ArtifactView";
import { useI18n } from "../i18n";
import type { SessionDetailResponse } from "../types/api";

export default function SessionResultPage() {
  const { sessionId = "" } = useParams();
  const { t } = useI18n();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    getSession(sessionId)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
        {loadError}
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("result.eyebrow")}</p>
          <h3 className="font-headline-lg text-headline-lg text-on-surface">Session {detail.session.id}</h3>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/refinement/sessions/${detail.session.id}`}
            className="rounded-lg border border-border-subtle px-4 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors no-underline"
          >
            {t("result.back")}
          </Link>
          <a
            href={exportUrl(detail.session.id)}
            className="rounded-lg bg-primary-container text-on-primary px-4 py-3 text-sm font-semibold hover:opacity-90 transition-colors no-underline"
          >
            {t("session.export_markdown")}
          </a>
        </div>
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
        {detail.finalArtifact ? (
          <ArtifactView artifact={detail.finalArtifact} />
        ) : (
          <div className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-4 text-sm text-on-surface-variant">
            {t("result.not_available")}
          </div>
        )}
      </section>
    </>
  );
}
