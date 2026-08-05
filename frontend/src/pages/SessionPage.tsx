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
      <div className="rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
        {loadError}
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>;
  }

  const { session, workItem, currentQuestionRound, sessionSummary, finalArtifact } = detail;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Session {session.id}</p>
          <h3 className="font-headline-lg text-headline-lg text-on-surface">{workItem.title}</h3>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t("session.round")} {session.round} / {session.maxRounds} · {t("session.status")}{" "}
            {label("status", session.status)}
          </p>
        </div>
        {finalArtifact && (
          <Link
            to={`/refinement/sessions/${session.id}/result`}
            className="rounded-lg border border-primary/20 bg-primary-fixed/30 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant hover:bg-primary-fixed/50 transition-colors no-underline"
          >
            {t("session.view_final")}
          </Link>
        )}
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
        <WorkItemCard workItem={workItem} />

        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("session.questions")}</p>
              <h4 className="font-headline-md text-headline-md text-on-surface">{t("session.current_round")}</h4>
            </div>
            <span className="rounded-full border border-border-subtle bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
              {label("status", session.status)}
            </span>
          </div>
          {submitError && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
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
        <section className="mt-6 rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("session.result_eyebrow")}</p>
              <h4 className="font-headline-md text-headline-md text-on-surface">{t("session.result_title")}</h4>
            </div>
            <a
              href={exportUrl(session.id)}
              className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors no-underline"
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
