import { useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "../i18n";
import type { QuestionRoundModel } from "../types/api";

interface Props {
  questionRound: QuestionRoundModel | null;
  submitting: boolean;
  onSubmit: (answers: Record<string, string>) => void;
}

export default function QuestionRoundPanel({ questionRound, submitting, onSubmit }: Props) {
  const { t, label } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!questionRound || questionRound.questions.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-container-low p-4 text-sm text-on-surface-variant">
        {t("session.no_round")}
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(answers);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {questionRound.questions.map((question) => (
        <div key={question.id} className="rounded-lg border border-border-subtle bg-surface-container-low p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="rounded-full border border-primary/20 bg-primary-fixed/30 px-3 py-1 text-xs font-medium text-on-primary-fixed-variant">
              {label("theme", question.theme)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-outline">
              {label("priority", question.priority)}
            </span>
          </div>
          <p className="text-sm font-semibold text-on-surface">{question.question}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{question.why}</p>
          <textarea
            rows={4}
            value={answers[question.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
            }
            disabled={submitting}
            placeholder={t("session.answer_placeholder")}
            className="mt-4 w-full rounded-lg border border-border-subtle bg-white px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 resize-none transition-colors"
          />
        </div>
      ))}

      {submitting && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary-fixed/20 p-4 text-sm text-on-primary-fixed-variant">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t("session.analyzing_wait")}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary-container text-on-primary px-5 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 active:scale-95 transition-all border-0 cursor-pointer"
      >
        {t("session.submit_answers")}
      </button>
    </form>
  );
}
