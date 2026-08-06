import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { exportUrl, getSession, setSessionMode, submitAnswers } from "../api/refinement";
import { useI18n } from "../i18n";
import type { QuestionItem, SessionDetailResponse } from "../types/api";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

const GRID_LABELS: Record<string, string> = { po: "PO", technique: "Technique", hybride: "Hybride" };
const MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "po", label: "PO" },
  { value: "technique", label: "Technique" },
  { value: "hybride", label: "Hybride" },
];

// Full literal class names so Tailwind's scanner keeps them.
const THEME_STYLES = [
  { text: "text-node-blue", bg: "bg-node-blue", border: "border-node-blue", icon: "subject" },
  { text: "text-node-purple", bg: "bg-node-purple", border: "border-node-purple", icon: "key" },
  { text: "text-node-pink", bg: "bg-node-pink", border: "border-node-pink", icon: "build" },
  { text: "text-node-orange", bg: "bg-node-orange", border: "border-node-orange", icon: "account_tree" },
  { text: "text-node-yellow", bg: "bg-node-yellow", border: "border-node-yellow", icon: "verified" },
] as const;

interface ThemeGroup {
  theme: string;
  style: (typeof THEME_STYLES)[number];
  questions: QuestionItem[];
}

function groupByTheme(questions: QuestionItem[]): ThemeGroup[] {
  const groups: ThemeGroup[] = [];
  const index = new Map<string, ThemeGroup>();
  for (const question of questions) {
    const theme = question.theme?.trim() || "Refinement";
    let group = index.get(theme);
    if (!group) {
      group = { theme, style: THEME_STYLES[groups.length % THEME_STYLES.length], questions: [] };
      index.set(theme, group);
      groups.push(group);
    }
    group.questions.push(question);
  }
  return groups;
}

function clarityFromConfidence(confidence: string, hasFinal: boolean): number {
  if (hasFinal) return 100;
  switch (confidence?.toLowerCase()) {
    case "high":
      return 85;
    case "medium":
      return 68;
    case "low":
      return 40;
    default:
      return 55;
  }
}

function scoreColor(value: number): string {
  if (value >= 75) return "text-score-good";
  if (value >= 50) return "text-score-warn";
  return "text-score-alert";
}

type Tab = "brief" | "plan" | "code";

export default function WarRoom() {
  const { sessionId = "" } = useParams();
  const { t, label } = useI18n();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [tab, setTab] = useState<Tab>("brief");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    getSession(sessionId)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const roundId = detail?.currentQuestionRound?.id ?? null;
  const questions = useMemo(
    () => detail?.currentQuestionRound?.questions ?? [],
    [detail?.currentQuestionRound],
  );

  useEffect(() => {
    setAnswers({});
    setActiveId(questions[0]?.id ?? null);
  }, [roundId, questions]);

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg p-6">
        <div className="max-w-md rounded-xl border border-error/30 bg-error-container/50 p-6 text-sm text-error">
          {loadError}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg text-sm text-on-surface-variant">
        {t("common.loading")}
      </div>
    );
  }

  const { session, subject, sessionSummary, deliverable } = detail;
  const groups = groupByTheme(questions);
  const activeQuestion = questions.find((q) => q.id === activeId) ?? questions[0] ?? null;
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const openCount = Math.max(questions.length - answeredCount, 0);
  const tensionCount = sessionSummary.risks.length;
  const clarity = clarityFromConfidence(sessionSummary.confidence, Boolean(deliverable));
  const queue = questions.filter((q) => q.id !== activeQuestion?.id);
  const activeDraft = activeQuestion ? answers[activeQuestion.id] ?? "" : "";

  const suggestion =
    session.detectedGrid && session.detectedGrid !== session.grid && !suggestionDismissed
      ? session.detectedGrid
      : null;

  function setDraft(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSetMode(mode: string) {
    if (switching) return;
    setSwitching(true);
    setSubmitError(null);
    try {
      const updated = await setSessionMode(sessionId, { mode });
      setDetail(updated);
      setSuggestionDismissed(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSwitching(false);
    }
  }

  async function submitRound() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitAnswers(sessionId, {
        answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })),
      });
      setDetail((current) =>
        current
          ? {
              ...current,
              session: response.session,
              currentQuestionRound: response.questionRound,
              sessionSummary: response.sessionSummary,
              deliverable: response.deliverable,
            }
          : current,
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("session.answers_submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSend() {
    if (!activeQuestion || !activeDraft.trim()) return;
    const nextUnanswered = questions.find(
      (q) => q.id !== activeQuestion.id && !(answers[q.id] ?? "").trim(),
    );
    if (nextUnanswered) {
      setActiveId(nextUnanswered.id);
    } else {
      void submitRound();
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-container-low font-body-md text-on-surface">
      {/* TopNavBar */}
      <header className="fixed top-0 z-50 flex h-[48px] w-full items-center justify-between border-b border-border-subtle bg-surface px-margin-desktop">
        <div className="flex items-center gap-6">
          <Link to="/refinement" className="flex items-center gap-2 no-underline">
            <img alt="Refinement Logo" className="h-8 w-8 object-contain" src={LOGO_URL} />
            <span className="font-display text-[24px] leading-tight text-primary">PromptRefine</span>
          </Link>
          <nav className="hidden h-full md:flex">
            <Link
              to="/refinement"
              className="flex h-full items-center px-4 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low no-underline"
            >
              Dashboard
            </Link>
            <span className="flex h-full items-center border-b-2 border-primary px-4 font-bold text-primary">
              War Room
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-transform hover:bg-surface-container-low active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </header>

      <div className="relative mt-[48px] flex flex-1 overflow-hidden">
        {/* ZONE 1: Intent Structure */}
        <aside className="z-20 flex w-[280px] flex-shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-surface">
          <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
                Intent Structure
              </h2>
              <span className="rounded-full bg-primary-container/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                {GRID_LABELS[session.grid] ?? session.grid}
              </span>
            </div>
            <p className="font-headline-md text-sm leading-tight text-on-surface">{subject.title}</p>
          </div>
          <div className="p-4">
            <div className="tree-line relative flex flex-col gap-1">
              {groups.length === 0 && (
                <p className="text-sm italic text-on-surface-variant">{t("common.loading")}</p>
              )}
              {groups.map((group) => (
                <div key={group.theme} className="mt-2 first:mt-0">
                  <div className="relative z-10 flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[16px] ${group.style.text}`}>
                      arrow_drop_down
                    </span>
                    <span className={`material-symbols-outlined text-[18px] ${group.style.text}`}>
                      {group.style.icon}
                    </span>
                    <span className="font-label-md text-on-surface">{group.theme}</span>
                  </div>
                  <div className="my-1 ml-6 flex flex-col gap-2 border-l-2 border-border-subtle pl-2">
                    {group.questions.map((question) => {
                      const isActive = question.id === activeQuestion?.id;
                      const isAnswered = (answers[question.id] ?? "").trim().length > 0;
                      return (
                        <button
                          type="button"
                          key={question.id}
                          onClick={() => setActiveId(question.id)}
                          className={`tree-node-line relative flex items-center gap-2 rounded border-0 px-2 py-1 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-surface-container-highest font-bold text-on-surface"
                              : "cursor-pointer bg-transparent text-on-surface-variant hover:bg-surface-container-low"
                          }`}
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              isAnswered ? group.style.bg : `border ${group.style.border}`
                            }`}
                          ></div>
                          <span className="truncate">{question.question}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ZONE 2: Decision War Room */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-canvas-bg">
          <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 p-6">
            {/* Mode override + suggestion */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Grille
                </span>
                {MODE_OPTIONS.map((option) => {
                  const active = option.value === "auto" ? session.mode === "auto" : session.grid === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={switching}
                      onClick={() => void handleSetMode(option.value)}
                      className={`rounded-full border px-3 py-1 font-label-md text-label-md transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary-container text-on-primary"
                          : "border-border-subtle bg-surface text-on-surface-variant hover:bg-surface-container-low"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                {switching && <span className="text-xs text-on-surface-variant">{t("common.loading")}</span>}
              </div>

              {suggestion && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary-fixed bg-primary-container/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-on-surface">
                    <span className="material-symbols-outlined text-[18px] text-primary">lightbulb</span>
                    Je pense que ce sujet est plutôt « {GRID_LABELS[suggestion] ?? suggestion} ». Passer en grille{" "}
                    {GRID_LABELS[suggestion] ?? suggestion} ?
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={switching}
                      onClick={() => void handleSetMode(suggestion)}
                      className="rounded bg-primary px-3 py-1.5 text-sm font-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionDismissed(true)}
                      className="rounded border border-border-subtle px-3 py-1.5 text-sm font-label-md text-on-surface-variant hover:bg-surface-container-low"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="flex items-center justify-between">
              <h1 className="flex items-center gap-3 font-headline-lg text-headline-lg text-on-surface">
                <span className="material-symbols-outlined text-[32px] text-primary">analytics</span>
                Decision War Room
              </h1>
              <div className="flex gap-4">
                <div className="flex min-w-[120px] flex-col rounded-lg border border-border-subtle bg-surface p-3">
                  <span className="mb-1 font-label-sm uppercase text-on-surface-variant">Clarity Score</span>
                  <div className="flex items-end gap-2">
                    <span className={`font-display text-[28px] leading-none ${scoreColor(clarity)}`}>{clarity}</span>
                    <span className="pb-1 text-sm text-on-surface-variant">/100</span>
                  </div>
                </div>
                <div className="flex min-w-[120px] flex-col rounded-lg border border-border-subtle bg-surface p-3">
                  <span className="mb-1 font-label-sm uppercase text-on-surface-variant">Open Questions</span>
                  <div className="flex items-end gap-2">
                    <span
                      className={`font-display text-[28px] leading-none ${
                        openCount > 0 ? "text-score-alert" : "text-score-good"
                      }`}
                    >
                      {openCount}
                    </span>
                    <span className="pb-1 text-sm text-on-surface-variant">critical</span>
                  </div>
                </div>
                <div className="flex min-w-[120px] flex-col rounded-lg border border-border-subtle bg-surface p-3">
                  <span className="mb-1 font-label-sm uppercase text-on-surface-variant">Tension Areas</span>
                  <div className="flex items-end gap-2">
                    <span
                      className={`font-display text-[28px] leading-none ${
                        tensionCount > 0 ? "text-score-warn" : "text-score-good"
                      }`}
                    >
                      {tensionCount}
                    </span>
                    <span className="pb-1 text-sm text-on-surface-variant">conflicts</span>
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
                {submitError}
              </div>
            )}

            {/* Active Focus Card */}
            {activeQuestion ? (
              <div className="flex flex-col overflow-hidden rounded-xl border border-primary-fixed bg-surface shadow-sm">
                <div className="flex items-center justify-between border-b border-primary-fixed bg-primary-container/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-node-pink"></div>
                    <span className="font-label-md uppercase tracking-wide text-primary">
                      Active Refinement: {activeQuestion.theme}
                    </span>
                  </div>
                  <span className="rounded-full border border-border-subtle bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
                    {t("session.round")} {session.round}/{session.maxRounds} · {label("status", session.status)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="mb-2 font-headline-md text-on-surface">{activeQuestion.theme}</h2>
                      <p className="font-body-md text-on-surface-variant">{activeQuestion.question}</p>
                    </div>
                    {tensionCount > 0 && (
                      <div className="mt-auto rounded-lg border border-error-container bg-error-container/30 p-4">
                        <div className="mb-2 flex items-center gap-2 font-label-md text-error">
                          <span className="material-symbols-outlined text-[18px]">warning</span>
                          Critical Tension Detected
                        </div>
                        <p className="text-sm text-on-surface-variant">{sessionSummary.risks[0]}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex min-h-[160px] flex-col gap-3 overflow-y-auto rounded-lg border border-border-subtle bg-surface-container-lowest p-4">
                      {activeQuestion.why && (
                        <div className="flex justify-start">
                          <div className="max-w-[90%] rounded-lg rounded-tl-none border border-border-subtle bg-surface-container p-3 text-on-surface">
                            <p className="font-body-md text-sm text-body-md">{activeQuestion.why}</p>
                          </div>
                        </div>
                      )}
                      {activeDraft.trim() && (
                        <div className="flex justify-end">
                          <div className="max-w-[90%] rounded-lg rounded-tr-none bg-primary-container p-3 text-on-primary shadow-sm">
                            <p className="font-body-md text-body-md">{activeDraft}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative flex items-end gap-2">
                      <textarea
                        value={activeDraft}
                        onChange={(e) => setDraft(activeQuestion.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Réponds à cette question..."
                        className="min-h-[80px] w-full resize-none rounded-lg border border-border-subtle bg-surface-container-lowest p-3 font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <div className="absolute bottom-3 right-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={submitting || !activeDraft.trim()}
                          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-primary text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-outline">
                        {answeredCount}/{questions.length} resolved
                      </span>
                      <button
                        type="button"
                        onClick={() => void submitRound()}
                        disabled={submitting || answeredCount === 0}
                        className="flex items-center gap-2 rounded border-0 bg-primary-container px-4 py-1.5 font-label-md text-label-md text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        {submitting ? t("common.loading") : "Valider le tour"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border-subtle bg-surface p-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-score-good">task_alt</span>
                <p className="mt-2 font-headline-md text-on-surface">
                  {deliverable ? "Refinement terminé" : "Aucune question ouverte"}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {deliverable ? "Le livrable à droite est prêt à être exporté." : sessionSummary.reason}
                </p>
              </div>
            )}

            {/* Next in Queue */}
            {queue.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <h3 className="mb-2 font-label-md uppercase tracking-wider text-on-surface-variant">
                  Next in Queue
                </h3>
                {queue.map((question) => {
                  const isAnswered = (answers[question.id] ?? "").trim().length > 0;
                  return (
                    <button
                      type="button"
                      key={question.id}
                      onClick={() => setActiveId(question.id)}
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface p-4 text-left opacity-70 transition-shadow hover:opacity-100 hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-2 w-2 rounded-full ${isAnswered ? "bg-score-good" : "bg-node-yellow"}`}
                        ></div>
                        <div>
                          <h4 className="font-label-md text-base text-on-surface">{question.theme}</h4>
                          <p className="font-body-md text-sm text-on-surface-variant">{question.question}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ZONE 3: Deliverable */}
        <aside className="z-30 flex w-[380px] flex-col border-l border-border-subtle bg-surface shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
          <div className="flex h-[48px] border-b border-border-subtle">
            {([
              { id: "brief", icon: "description", label: "Brief", enabled: true },
              { id: "plan", icon: "view_timeline", label: "Plan", enabled: true },
              { id: "code", icon: "code", label: "Code Draft", enabled: Boolean(deliverable?.codeDraft) },
            ] as { id: Tab; icon: string; label: string; enabled: boolean }[]).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.enabled}
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 font-label-md transition-colors disabled:opacity-40 ${
                  tab === item.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-on-surface-variant hover:bg-surface-container-lowest"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface-container-lowest p-2">
            <span className="px-2 font-label-sm uppercase tracking-wider text-outline">
              {deliverable ? "Prêt" : "Brouillon live"}
            </span>
            {deliverable ? (
              <a
                href={exportUrl(session.id)}
                className="flex items-center gap-2 rounded bg-primary px-3 py-1.5 text-sm font-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container no-underline"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                {t("session.export_markdown")}
              </a>
            ) : (
              <span className="px-2 text-xs italic text-on-surface-variant">en cours…</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-6 font-body-md text-on-surface">
            <h1 className="mb-4 border-b border-border-subtle pb-2 font-headline-md text-2xl text-on-surface">
              {subject.title}
            </h1>

            {tab === "brief" &&
              (deliverable ? (
                <>
                  {deliverable.summary && (
                    <p className="mb-4 leading-relaxed text-on-surface-variant">{deliverable.summary}</p>
                  )}
                  {deliverable.brief.map((section, index) => (
                    <Section key={index} heading={section.heading} items={section.items} />
                  ))}
                  <div className="mt-6">
                    <Link
                      to={`/refinement/sessions/${session.id}/result`}
                      className="text-sm font-semibold text-primary no-underline hover:underline"
                    >
                      {t("session.view_final")} →
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Section heading="Faits" items={sessionSummary.facts} />
                  <Section heading="Risques" items={sessionSummary.risks} />
                  <Section heading="Zones d'incertitude" items={sessionSummary.unknowns} />
                  <div className="mt-8 rounded border border-dashed border-border-subtle bg-surface-container p-4 text-center">
                    <p className="text-sm italic text-on-surface-variant">
                      Le document se met à jour au fil des décisions.
                    </p>
                  </div>
                </>
              ))}

            {tab === "plan" &&
              (deliverable && deliverable.plan.length > 0 ? (
                <ol className="space-y-3">
                  {deliverable.plan.map((step, index) => (
                    <li key={index} className="rounded-lg border border-border-subtle bg-surface p-3">
                      <p className="font-label-md text-on-surface">
                        {index + 1}. {step.title}
                      </p>
                      {step.detail && <p className="mt-1 text-sm text-on-surface-variant">{step.detail}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm italic text-on-surface-variant">Le plan apparaîtra une fois le refinement finalisé.</p>
              ))}

            {tab === "code" &&
              (deliverable?.codeDraft ? (
                <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-container p-4 text-xs text-on-surface">
                  <code>{deliverable.codeDraft}</code>
                </pre>
              ) : (
                <p className="text-sm italic text-on-surface-variant">Pas de brouillon de code pour ce sujet.</p>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 mt-6 flex items-center gap-2 text-lg font-bold text-node-blue">
        <span className="material-symbols-outlined text-[18px]">subject</span>
        {heading}
      </h3>
      {items && items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="pl-5 text-sm italic text-outline">—</p>
      )}
    </div>
  );
}
