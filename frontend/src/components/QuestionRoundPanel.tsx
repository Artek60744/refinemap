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
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
        {t("session.no_round")}
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(answers);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {questionRound.questions.map((question) => (
        <div key={question.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              {label("theme", question.theme)}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {label("priority", question.priority)}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-100">{question.question}</p>
          <p className="mt-2 text-sm text-slate-400">{question.why}</p>
          <textarea
            rows={4}
            value={answers[question.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
            }
            disabled={submitting}
            placeholder={t("session.answer_placeholder")}
            className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none disabled:opacity-60"
          />
        </div>
      ))}

      {submitting && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-100">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
          {t("session.analyzing_wait")}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-violet-500 px-5 py-3 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
      >
        {t("session.submit_answers")}
      </button>
    </form>
  );
}
