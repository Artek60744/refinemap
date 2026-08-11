import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { exportUrl, getSession, setSessionMode, submitAnswers } from "../api/refinement";
import DecisionReportView from "../components/DecisionReportView";
import { GRID_LABELS } from "../constants/grids";
import { useI18n } from "../i18n";
import type { QuestionItem, QuestionRoundModel, SessionDetailResponse } from "../types/api";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

// Full literal class names so Tailwind's scanner keeps them.
const THEME_STYLES = [
  { text: "text-node-blue", bg: "bg-node-blue", border: "border-node-blue", icon: "subject" },
  { text: "text-node-purple", bg: "bg-node-purple", border: "border-node-purple", icon: "key" },
  { text: "text-node-pink", bg: "bg-node-pink", border: "border-node-pink", icon: "build" },
  { text: "text-node-orange", bg: "bg-node-orange", border: "border-node-orange", icon: "account_tree" },
  { text: "text-node-yellow", bg: "bg-node-yellow", border: "border-node-yellow", icon: "verified" },
] as const;

// One question of one round, with everything the sidebar and the chat need.
interface QuestionEntry {
  key: string;
  round: number;
  inOpenRound: boolean;
  question: QuestionItem;
  answer: string | null;
}

interface ThemeGroup {
  theme: string;
  style: (typeof THEME_STYLES)[number];
  entries: QuestionEntry[];
}

// The grid axis a question belongs to. `theme` is a free string on the wire, so the
// sidebar, the filter and the chat must all derive the axis the exact same way.
function themeKey(question: QuestionItem): string {
  return question.theme?.trim() || "Refinement";
}

function groupByTheme(entries: QuestionEntry[]): ThemeGroup[] {
  const groups: ThemeGroup[] = [];
  const index = new Map<string, ThemeGroup>();
  for (const entry of entries) {
    const theme = themeKey(entry.question);
    let group = index.get(theme);
    if (!group) {
      group = { theme, style: THEME_STYLES[groups.length % THEME_STYLES.length], entries: [] };
      index.set(theme, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

// Chat order for the open round: the exchanges already validated, oldest answer first,
// then the question currently in the composer. The server order would put a freshly
// picked question above answers given before it.
// `includePending` keeps the axis questions still untouched at the end — the filtered
// view shows a whole axis, where the chronological view only reveals the active one.
function openRoundOrder(
  questions: QuestionItem[],
  sent: Record<string, string>,
  activeId: string | null,
  includePending = false,
): QuestionItem[] {
  const pending = new Map(questions.map((q) => [q.id, q]));
  const ordered: QuestionItem[] = [];
  for (const id of Object.keys(sent)) {
    const question = pending.get(id);
    if (question) {
      ordered.push(question);
      pending.delete(id);
    }
  }
  // A whole axis keeps the server order for what is still open, so activating a question
  // highlights it in place instead of pulling it to the top of the thread.
  if (includePending) {
    ordered.push(...pending.values());
    return ordered;
  }
  const active = activeId ? pending.get(activeId) : undefined;
  if (active) ordered.push(active);
  return ordered;
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

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-3 rounded-xl rounded-tl-none border border-border-subtle bg-surface-container px-4 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
        <span className="text-sm text-on-surface-variant">{label}</span>
      </div>
    </div>
  );
}

function RoundDivider({ round }: { round: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="rounded-full border border-border-subtle bg-surface px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        Tour {round}
      </span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

type Tab = "brief" | "plan" | "code";

export default function WarRoom() {
  const { sessionId = "" } = useParams();
  const { t, label } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Answers validated locally for the open round, before the round is submitted.
  const [sent, setSent] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  // User-picked question of the open round; falls back to the first unanswered one.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Grid axis the chat is narrowed to; null = the whole chronological thread.
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<boolean>(
    Boolean((location.state as { degraded?: boolean } | null)?.degraded),
  );
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [tab, setTab] = useState<Tab>("brief");
  const chatRef = useRef<HTMLDivElement | null>(null);

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

  const openRoundId = detail?.currentQuestionRound?.id ?? null;
  const rounds: QuestionRoundModel[] = useMemo(() => {
    if (!detail) return [];
    if (detail.questionRounds.length > 0) return detail.questionRounds;
    return detail.currentQuestionRound ? [detail.currentQuestionRound] : [];
  }, [detail]);

  const serverAnswers = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of detail?.answers ?? []) {
      map.set(`${item.round}:${item.questionId}`, item.answer);
    }
    return map;
  }, [detail?.answers]);

  // New round arriving from the server: the local buffer belongs to the old round.
  useEffect(() => {
    setSent({});
    setDraft("");
    setActiveId(null);
    setThemeFilter(null);
  }, [openRoundId]);

  const entries: QuestionEntry[] = useMemo(() => {
    const list: QuestionEntry[] = [];
    for (const round of rounds) {
      const inOpenRound = round.id === openRoundId;
      for (const question of round.questions) {
        const local = inOpenRound ? sent[question.id] : undefined;
        const server = serverAnswers.get(`${round.round}:${question.id}`);
        const answer = local ?? server ?? null;
        list.push({
          key: `${round.round}-${question.id}`,
          round: round.round,
          inOpenRound,
          question,
          answer: answer !== undefined && answer !== null && answer.trim() ? answer : null,
        });
      }
    }
    return list;
  }, [rounds, openRoundId, sent, serverAnswers]);

  const openQuestions = useMemo(
    () => (detail?.currentQuestionRound?.questions ?? []) as QuestionItem[],
    [detail?.currentQuestionRound],
  );
  // Under a filter the composer must stay on the visible axis: once that axis is done for
  // the round there is no fallback, and the composer gives way to an explanatory note.
  const filteredOpenQuestions = useMemo(
    () => (themeFilter ? openQuestions.filter((q) => themeKey(q) === themeFilter) : openQuestions),
    [openQuestions, themeFilter],
  );
  const firstUnanswered = filteredOpenQuestions.find((q) => sent[q.id] === undefined) ?? null;
  const activeQuestion =
    (activeId ? openQuestions.find((q) => q.id === activeId) : undefined) ?? firstUnanswered;

  // Scrolls the chat feed only — scrollIntoView would drag the outer columns along.
  function scrollChatTo(key: string) {
    const node = chatRef.current;
    const bubble = document.getElementById(`chat-${key}`);
    if (!node || !bubble) return false;
    const top = bubble.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
    node.scrollTo({ top: Math.max(top - 24, 0), behavior: "smooth" });
    return true;
  }

  // Auto-scroll: keep the latest bubble in view as the conversation grows. Two cases put
  // the active question elsewhere than at the end — an answered exchange reopened for
  // editing, and a filtered axis where open questions keep their order — and there we
  // scroll to that question instead of jumping to the bottom.
  const sentCount = Object.keys(sent).length;
  const openRound = detail?.currentQuestionRound?.round ?? null;
  const focusKey =
    activeQuestion && openRound !== null && !submitting
      ? `${openRound}-${activeQuestion.id}`
      : null;
  useEffect(() => {
    if (focusKey && scrollChatTo(focusKey)) return;
    const node = chatRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [entries.length, sentCount, submitting, detail?.deliverable, activeQuestion?.id, focusKey]);

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
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas-bg text-sm text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-[28px] text-primary">progress_activity</span>
        {t("common.loading")}
      </div>
    );
  }

  const { session, subject, sessionSummary, deliverable } = detail;
  const groups = groupByTheme(entries);
  const themeStyles = new Map(groups.map((group) => [group.theme, group.style]));
  const answeredCount = openQuestions.filter((q) => (sent[q.id] ?? "").trim().length > 0).length;
  const openCount = Math.max(openQuestions.length - answeredCount, 0);
  const tensionCount = sessionSummary.risks.length;
  const clarity = clarityFromConfidence(sessionSummary.confidence, Boolean(deliverable));
  const suggestions = activeQuestion?.suggestions ?? [];
  const busy = submitting || switching;

  const suggestion =
    session.detectedGrid && session.detectedGrid !== session.grid && !suggestionDismissed
      ? session.detectedGrid
      : null;

  // A chip fills an empty draft, and appends to an existing one so several can be combined.
  function applySuggestion(text: string) {
    setDraft((current) => {
      const trimmed = current.trim();
      if (!trimmed) return text;
      if (trimmed.includes(text)) return current;
      return `${trimmed}, ${text}`;
    });
  }

  async function refreshDetail() {
    const fresh = await getSession(sessionId);
    setDetail(fresh);
  }

  async function handleSetMode(mode: string) {
    if (busy) return;
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

  async function submitRound(answersMap: Record<string, string>) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitAnswers(sessionId, {
        answers: openQuestions.map((q) => ({ questionId: q.id, answer: answersMap[q.id] ?? "" })),
      });
      setDegraded(response.degraded);
      // Refetch so the chat history (all rounds + stored answers) stays server-truth.
      await refreshDetail();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("session.answers_submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSend() {
    if (!activeQuestion || !draft.trim() || busy) return;
    const updated = { ...sent, [activeQuestion.id]: draft.trim() };
    setSent(updated);
    setDraft("");
    setActiveId(null);
    const remaining = openQuestions.filter((q) => updated[q.id] === undefined);
    if (remaining.length === 0) void submitRound(updated);
  }

  function focusQuestion(question: QuestionItem) {
    setActiveId(question.id);
    // An already answered question gets its text back in the composer so it can be
    // edited before the round is sent.
    setDraft(sent[question.id] ?? "");
  }

  // Narrowing the chat to one axis: the composer follows, so it never answers a question
  // the filtered thread does not show. Clicking the selected axis again clears the filter.
  function selectTheme(theme: string | null) {
    const next = theme === themeFilter ? null : theme;
    setThemeFilter(next);
    if (!next || submitting) return;
    const target = openQuestions.find((q) => themeKey(q) === next && sent[q.id] === undefined);
    if (target) focusQuestion(target);
  }

  function handleSidebarClick(entry: QuestionEntry) {
    // Only touch the filter when it would hide the question that was just clicked.
    if (themeFilter && themeKey(entry.question) !== themeFilter) {
      setThemeFilter(themeKey(entry.question));
    }
    if (entry.inOpenRound && !submitting) {
      // Jump to any question of the open round.
      focusQuestion(entry.question);
      return;
    }
    scrollChatTo(entry.key);
  }

  const typingLabel =
    session.round >= session.maxRounds
      ? "Analyse des réponses et rédaction du livrable…"
      : "Analyse des réponses… le prochain tour arrive";

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
              {t("nav.dashboard")}
            </Link>
            <Link
              to="/refinement/history"
              className="flex h-full items-center px-4 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low no-underline"
            >
              {t("nav.history")}
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
              {groups.map((group) => {
                const answered = group.entries.filter((entry) => entry.answer !== null).length;
                const selected = group.theme === themeFilter;
                return (
                <div key={group.theme} className="mt-2 first:mt-0">
                  <button
                    type="button"
                    onClick={() => selectTheme(group.theme)}
                    title={selected ? "Revenir au fil complet" : `Filtrer le fil sur « ${group.theme} »`}
                    className={`relative z-10 flex w-full items-center gap-2 rounded border-0 px-1 py-1 text-left transition-colors ${
                      selected ? "bg-surface-container-highest" : "bg-transparent hover:bg-surface-container-low"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${group.style.text}`}>
                      {selected ? "filter_alt" : "arrow_drop_down"}
                    </span>
                    <span className={`material-symbols-outlined text-[18px] ${group.style.text}`}>
                      {group.style.icon}
                    </span>
                    <span className={`flex-1 truncate font-label-md ${selected ? "font-bold" : ""} text-on-surface`}>
                      {group.theme}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">
                      {answered}/{group.entries.length}
                    </span>
                  </button>
                  <div className="my-1 ml-6 flex flex-col gap-2 border-l-2 border-border-subtle pl-2">
                    {group.entries.map((entry) => {
                      const isActive = entry.inOpenRound && entry.question.id === activeQuestion?.id;
                      const isAnswered = entry.answer !== null;
                      return (
                        <button
                          type="button"
                          key={entry.key}
                          onClick={() => handleSidebarClick(entry)}
                          className={`tree-node-line relative flex items-center gap-2 rounded border-0 px-2 py-1 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-surface-container-highest font-bold text-on-surface"
                              : "cursor-pointer bg-transparent text-on-surface-variant hover:bg-surface-container-low"
                          }`}
                        >
                          <div
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isAnswered ? group.style.bg : `border ${group.style.border}`
                            }`}
                          ></div>
                          <span className="truncate">{entry.question.question}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ZONE 2: Decision War Room */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-canvas-bg">
          <div className="mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col gap-6 p-6">
            {/* Grid suggestion */}
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
                    disabled={busy}
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

            {/* Title + compact metrics */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="flex items-center gap-3 font-headline-lg text-headline-lg text-on-surface">
                <span className="material-symbols-outlined text-[32px] text-primary">analytics</span>
                Decision War Room
              </h1>
              <div className="flex items-center divide-x divide-border-subtle rounded-full border border-border-subtle bg-surface px-1">
                <div className="flex items-baseline gap-1.5 px-3 py-1">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Clarity</span>
                  <span className={`font-display text-[15px] leading-none ${scoreColor(clarity)}`}>{clarity}</span>
                  <span className="text-[11px] text-on-surface-variant">/100</span>
                </div>
                <div className="flex items-baseline gap-1.5 px-3 py-1">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Open</span>
                  <span
                    className={`font-display text-[15px] leading-none ${
                      openCount > 0 ? "text-score-alert" : "text-score-good"
                    }`}
                  >
                    {openCount}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 px-3 py-1">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Tensions</span>
                  <span
                    className={`font-display text-[15px] leading-none ${
                      tensionCount > 0 ? "text-score-warn" : "text-score-good"
                    }`}
                  >
                    {tensionCount}
                  </span>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
                {submitError}
              </div>
            )}

            {degraded && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-score-warn/40 bg-score-warn/10 px-4 py-3">
                <div className="flex items-start gap-2 text-sm text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-score-warn">warning</span>
                  <span>
                    Le moteur IA n'a pas répondu correctement : ces questions sont des questions
                    génériques de secours. Vérifie la configuration LLM dans les Réglages, ou
                    revalide le tour pour retenter.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDegraded(false)}
                  className="shrink-0 rounded border-0 bg-transparent p-1 text-on-surface-variant hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            {/* Conversation card */}
            <div className="relative flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-xl border border-primary-fixed bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-primary-fixed bg-primary-container/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-node-pink"></div>
                  <span className="font-label-md uppercase tracking-wide text-primary">
                    {activeQuestion ? `Active Refinement: ${activeQuestion.theme}` : "Refinement"}
                  </span>
                  {themeFilter && (
                    <button
                      type="button"
                      onClick={() => selectTheme(null)}
                      title="Revenir au fil complet"
                      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary bg-surface px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                      <span className="max-w-[160px] truncate">{themeFilter}</span>
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
                <span className="rounded-full border border-border-subtle bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
                  {t("session.round")} {session.round}/{session.maxRounds} · {label("status", session.status)}
                </span>
              </div>

              {/* Mode-switch overlay */}
              {switching && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/80 backdrop-blur-sm">
                  <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
                    progress_activity
                  </span>
                  <p className="text-sm text-on-surface-variant">Nouvelles questions en préparation…</p>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
                {/* Chat feed */}
                <div
                  ref={chatRef}
                  className="flex min-h-[280px] flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-border-subtle bg-surface-container-lowest p-6"
                >
                  {rounds.map((round) => {
                    const inOpenRound = round.id === openRoundId;
                    const roundQuestions = themeFilter
                      ? round.questions.filter((q) => themeKey(q) === themeFilter)
                      : round.questions;
                    const chatQuestions = inOpenRound
                      ? openRoundOrder(
                          roundQuestions,
                          sent,
                          activeQuestion?.id ?? null,
                          Boolean(themeFilter),
                        )
                      : roundQuestions;
                    const bubbles: JSX.Element[] = [];
                    for (const question of chatQuestions) {
                      const key = `${round.round}-${question.id}`;
                      const answer = inOpenRound
                        ? sent[question.id] ?? null
                        : serverAnswers.get(`${round.round}:${question.id}`) ?? null;
                      const isActive = inOpenRound && question.id === activeQuestion?.id;
                      const isPending = inOpenRound && answer === null && !isActive;

                      // The chronological view keeps the open round conversational: only the
                      // questions already answered locally plus the active one are visible.
                      // A filtered axis shows its whole thread, upcoming questions included.
                      if (isPending && !themeFilter) continue;

                      bubbles.push(
                        <div key={`q-${key}`} id={`chat-${key}`} className="flex justify-start">
                          <div
                            className={`max-w-[75%] rounded-xl rounded-tl-none border p-4 ${
                              isActive
                                ? "border-primary bg-primary-container/10 text-on-surface"
                                : isPending
                                  ? "border-dashed border-border-subtle bg-transparent text-on-surface-variant"
                                  : "border-border-subtle bg-surface-container text-on-surface"
                            }`}
                          >
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                              {question.theme}
                            </p>
                            <p className="font-body-md text-body-lg">{question.question}</p>
                            {isActive && question.why && (
                              <p className="mt-2 text-xs italic text-on-surface-variant">{question.why}</p>
                            )}
                            {isPending && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => focusQuestion(question)}
                                className="mt-2 rounded border-0 bg-transparent p-0 text-xs font-bold text-primary hover:underline disabled:opacity-40"
                              >
                                Répondre à cette question
                              </button>
                            )}
                          </div>
                        </div>,
                      );

                      if (answer !== null && answer.trim()) {
                        bubbles.push(
                          <div key={`a-${key}`} className="flex flex-col items-end gap-1">
                            <div className="max-w-[75%] rounded-xl rounded-tr-none bg-primary-container p-4 text-on-primary shadow-sm">
                              <p className="font-body-md text-body-lg">{answer}</p>
                            </div>
                            {inOpenRound && !busy && (
                              <button
                                type="button"
                                onClick={() => focusQuestion(question)}
                                title="Corriger cette réponse"
                                className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                Modifier
                              </button>
                            )}
                          </div>,
                        );
                      } else if (!inOpenRound) {
                        bubbles.push(
                          <div key={`a-${key}`} className="flex justify-end">
                            <p className="text-xs italic text-outline">Sans réponse</p>
                          </div>,
                        );
                      }
                    }
                    // A filtered axis is absent from most rounds: no bubble, no divider.
                    if (bubbles.length === 0) return null;
                    return (
                      <div key={round.id} className="flex flex-col gap-4">
                        <RoundDivider round={round.round} />
                        {bubbles}
                      </div>
                    );
                  })}

                  {submitting && <TypingIndicator label={typingLabel} />}

                  {deliverable && !submitting && (
                    <div className="mt-2 rounded-xl border border-score-good/40 bg-surface p-5 text-center">
                      <span className="material-symbols-outlined text-[28px] text-score-good">task_alt</span>
                      <p className="mt-1 font-headline-md text-on-surface">Refinement terminé</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Le livrable à droite est prêt à être exporté.
                      </p>
                    </div>
                  )}

                  {!deliverable && !submitting && !activeQuestion && openQuestions.length === 0 && (
                    <p className="text-center text-sm italic text-on-surface-variant">{sessionSummary.reason}</p>
                  )}
                </div>

                {/* Axis done for this round: the composer has nothing to target here. */}
                {!activeQuestion && themeFilter && !deliverable && !submitting && (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-subtle p-4 text-center">
                    <p className="text-sm text-on-surface-variant">
                      Aucune question ouverte sur « {themeFilter} » pour ce tour.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectTheme(null)}
                        className="rounded border border-border-subtle bg-surface px-4 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
                      >
                        Revenir au fil complet
                      </button>
                      {openCount > 0 && answeredCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void submitRound(sent)}
                          disabled={busy}
                          className="flex items-center gap-2 rounded border-0 bg-primary-container px-4 py-1.5 font-label-md text-label-md text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[16px]">skip_next</span>
                          Terminer le tour sans le reste
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Composer */}
                {activeQuestion && (
                  <div className="flex flex-col gap-3">
                    {suggestions.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-3">
                        {suggestions.map((item) => {
                          const picked = draft.includes(item);
                          return (
                            <button
                              type="button"
                              key={item}
                              disabled={busy}
                              onClick={() => applySuggestion(item)}
                              className={`cursor-pointer rounded-full border-2 border-primary px-5 py-2.5 font-label-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50 ${
                                picked
                                  ? "bg-primary text-on-primary"
                                  : "bg-surface text-primary hover:bg-primary/5"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="relative flex items-end gap-2">
                      <textarea
                        value={draft}
                        disabled={busy}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={
                          activeQuestion && sent[activeQuestion.id] !== undefined
                            ? "Modifie ta réponse puis renvoie…"
                            : "Réponds à cette question…"
                        }
                        className="min-h-[80px] w-full resize-none rounded-lg border border-border-subtle bg-surface-container-lowest p-3 font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
                      />
                      <div className="absolute bottom-3 right-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={busy || !draft.trim()}
                          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-primary text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-outline">
                        {answeredCount}/{openQuestions.length} resolved · Entrée pour envoyer
                      </span>
                      {openCount > 0 && answeredCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void submitRound(sent)}
                          disabled={busy}
                          className="flex items-center gap-2 rounded border-0 bg-primary-container px-4 py-1.5 font-label-md text-label-md text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[16px]">skip_next</span>
                          Terminer le tour sans le reste
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
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

            {deliverable?.decisionReport && (
              <DecisionReportView report={deliverable.decisionReport} variant="banner" />
            )}

            {tab === "brief" &&
              (deliverable ? (
                <>
                  {deliverable.summary && (
                    <p className="mb-4 leading-relaxed text-on-surface-variant">{deliverable.summary}</p>
                  )}
                  {deliverable.brief.map((section, index) => (
                    <Section
                      key={index}
                      heading={section.heading}
                      items={section.items}
                      style={themeStyles.get(section.heading) ?? THEME_STYLES[0]}
                    />
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

function Section({
  heading,
  items,
  style = THEME_STYLES[0],
}: {
  heading: string;
  items: string[];
  style?: (typeof THEME_STYLES)[number];
}) {
  return (
    <div className="mb-4">
      <h3 className={`mb-2 mt-6 flex items-center gap-2 text-lg font-bold ${style.text}`}>
        <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
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
