import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { exportUrl, getSession, submitAnswers } from "../api/refinement";
import ArtifactView from "../components/ArtifactView";
import QuestionRoundPanel from "../components/QuestionRoundPanel";
import SessionSummaryPanel from "../components/SessionSummaryPanel";
import WorkItemCard from "../components/WorkItemCard";
import { useI18n } from "../i18n";
import type { SessionDetailResponse } from "../types/api";

export default function SessionPage() {
  const { sessionId = "" } = useParams();
  const { t, label } = useI18n();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  async function handleSubmitAnswers(answers: Record<string, string>) {
    if (!detail?.currentQuestionRound) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitAnswers(sessionId, {
        answers: detail.currentQuestionRound.questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? "",
        })),
      });
      setDetail((current) =>
        current
          ? {
              ...current,
              session: response.session,
              currentQuestionRound: response.questionRound,
              sessionSummary: response.sessionSummary,
              finalArtifact: response.finalArtifact,
            }
          : current,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t("session.answers_submit_failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

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

  const { session, workItem, currentQuestionRound, sessionSummary, finalArtifact } = detail;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-violet-300">Session {session.id}</p>
          <h3 className="text-2xl font-semibold tracking-tight">{workItem.title}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {t("session.round")} {session.round} / {session.maxRounds} • {t("session.status")}{" "}
            {label("status", session.status)}
          </p>
        </div>
        {finalArtifact && (
          <Link
            to={`/refinement/sessions/${session.id}/result`}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            {t("session.view_final")}
          </Link>
        )}
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
        <WorkItemCard workItem={workItem} />

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-300">{t("session.questions")}</p>
              <h4 className="text-xl font-semibold tracking-tight">{t("session.current_round")}</h4>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
              {label("status", session.status)}
            </span>
          </div>
          {submitError && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {submitError}
            </div>
          )}
          <QuestionRoundPanel
            key={currentQuestionRound?.id ?? "no-round"}
            questionRound={currentQuestionRound}
            submitting={submitting}
            onSubmit={(answers) => void handleSubmitAnswers(answers)}
          />
        </div>

        <SessionSummaryPanel summary={sessionSummary} />
      </section>

      {finalArtifact && (
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-300">{t("session.result_eyebrow")}</p>
              <h4 className="text-xl font-semibold tracking-tight">{t("session.result_title")}</h4>
            </div>
            <a
              href={exportUrl(session.id)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {t("session.export_markdown")}
            </a>
          </div>
          <ArtifactView artifact={finalArtifact} />
        </section>
      )}
    </>
  );
}
