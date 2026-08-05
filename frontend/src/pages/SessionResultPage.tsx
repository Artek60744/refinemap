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
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        {loadError}
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-slate-400">{t("common.loading")}</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-violet-300">{t("result.eyebrow")}</p>
          <h3 className="text-2xl font-semibold tracking-tight">Session {detail.session.id}</h3>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/refinement/sessions/${detail.session.id}`}
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800"
          >
            {t("result.back")}
          </Link>
          <a
            href={exportUrl(detail.session.id)}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            {t("session.export_markdown")}
          </a>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        {detail.finalArtifact ? (
          <ArtifactView artifact={detail.finalArtifact} />
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            {t("result.not_available")}
          </div>
        )}
      </section>
    </>
  );
}
