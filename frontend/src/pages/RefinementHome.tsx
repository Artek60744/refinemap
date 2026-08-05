import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createSession, searchWorkItems } from "../api/refinement";
import { useI18n } from "../i18n";
import type { WorkItemSearchItem } from "../types/api";

export default function RefinementHome() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkItemSearchItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraContext, setExtraContext] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [maxQuestions, setMaxQuestions] = useState(6);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    try {
      const payload = await searchWorkItems(query);
      setResults(payload.items ?? []);
    } catch (error) {
      setResults(null);
      setSearchError(error instanceof Error ? error.message : t("home.search_failed"));
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) {
      setStartError(t("home.select_work_item"));
      return;
    }

    setStarting(true);
    setStartError(null);
    try {
      const response = await createSession({
        workItemId: selectedId,
        extraContext,
        maxRounds,
        maxQuestionsPerRound: maxQuestions,
      });
      navigate(`/refinement/sessions/${response.session.id}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : t("home.session_create_failed"));
      setStarting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50">
        <div className="mb-6">
          <p className="text-sm text-violet-300">{t("home.eyebrow")}</p>
          <h3 className="text-2xl font-semibold tracking-tight">{t("home.title")}</h3>
          <p className="mt-2 text-sm text-slate-400">{t("home.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="work-item-search" className="mb-2 block text-sm font-medium text-slate-200">
              {t("home.search_label")}
            </label>
            <div className="flex gap-3">
              <input
                id="work-item-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder={t("home.search_placeholder")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching}
                className="rounded-xl bg-violet-500 px-4 py-3 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
              >
                {searching ? t("common.loading") : t("home.search_button")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {searchError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {searchError}
              </div>
            )}
            {results !== null && results.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                {t("home.no_results")}
              </div>
            )}
            {results?.map((item) => {
              const selected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full rounded-xl border p-4 text-left hover:border-violet-400/40 hover:bg-slate-900 ${
                    selected
                      ? "border-emerald-400/50 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-violet-300">
                        {item.type} #{item.id}
                      </p>
                      <h4 className="mt-1 text-base font-medium text-slate-100">{item.title}</h4>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                      {item.state || t("common.na")}
                    </span>
                  </div>
                  {item.tags.length > 0 && (
                    <p className="mt-3 text-sm text-slate-400">{item.tags.join(" • ")}</p>
                  )}
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="extra-context" className="mb-2 block text-sm font-medium text-slate-200">
              {t("home.extra_context")}
            </label>
            <textarea
              id="extra-context"
              rows={6}
              value={extraContext}
              onChange={(event) => setExtraContext(event.target.value)}
              placeholder={t("home.extra_context_placeholder")}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="max-rounds" className="mb-2 block text-sm font-medium text-slate-200">
                {t("home.max_rounds")}
              </label>
              <input
                id="max-rounds"
                type="number"
                min={1}
                max={5}
                value={maxRounds}
                onChange={(event) => setMaxRounds(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="max-questions" className="mb-2 block text-sm font-medium text-slate-200">
                {t("home.max_questions")}
              </label>
              <input
                id="max-questions"
                type="number"
                min={1}
                max={8}
                value={maxQuestions}
                onChange={(event) => setMaxQuestions(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>

          {startError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {startError}
            </div>
          )}

          <button
            type="submit"
            disabled={starting || !selectedId}
            className="inline-flex items-center rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {starting ? t("common.loading") : t("home.submit")}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="text-sm text-violet-300">{t("home.workflow.eyebrow")}</p>
        <h3 className="text-2xl font-semibold tracking-tight">{t("home.workflow.title")}</h3>
        <ol className="mt-5 space-y-4 text-sm text-slate-300">
          {["step1", "step2", "step3", "step4"].map((step) => (
            <li key={step} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              {t(`home.workflow.${step}`)}
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-100">
          {t("home.workflow.note")}
        </div>
      </div>
    </section>
  );
}
