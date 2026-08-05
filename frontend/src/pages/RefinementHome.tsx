import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createSession, searchWorkItems } from "../api/refinement";
import { useI18n } from "../i18n";
import type { WorkItemSearchItem } from "../types/api";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBfikYYcBcADrKCg8nLbkcK32aq9GCb6KJz4jkTN8UzcM5g6GfQ1a99g4azrl9I6DBZ87MzXJMkV16rZoJ2la1uqkl0oZVpxSEEFMkO6IS3SEUjobrG_OUMEaVDCtwFpOcwGHHdRseM4VUsy1DWHGiW_b1CHAcgTtSuTOvh4RCqh_2aFhrUiLIeH7qdt-17yCDwdWGa-Ul0afnHZjtQ2TGqL0e5W9JItS091fqt7XP8Gp34rHXB-ykL";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

export default function RefinementHome() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkItemSearchItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraContext, setExtraContext] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [showResults, setShowResults] = useState(false);
  const [showContext, setShowContext] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const payload = await searchWorkItems(query);
      setResults(payload.items ?? []);
      setShowResults(true);
    } catch (error) {
      setResults(null);
      setSearchError(error instanceof Error ? error.message : t("home.search_failed"));
      setShowResults(true);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectItem(item: WorkItemSearchItem) {
    setSelectedId(item.id);
    setExtraContext("");
    setShowContext(true);
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
        maxRounds: 3,
        maxQuestionsPerRound: 6,
      });
      navigate(`/refinement/sessions/${response.session.id}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : t("home.session_create_failed"));
      setStarting(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full h-[48px] z-50 flex justify-between items-center px-margin-desktop bg-surface border-b border-border-subtle">
        {/* Brand / Logo */}
        <a href="/" className="flex items-center gap-3 no-underline">
          <img
            alt="PromptRefine Logo"
            className="h-6 w-6 object-contain rounded"
            src={LOGO_URL}
          />
          <span className="font-headline-md text-headline-md text-primary tracking-tight">
            PromptRefine
          </span>
        </a>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 h-full">
          <a
            className="h-full flex items-center text-primary font-bold border-b-2 border-primary hover:bg-surface-container-low transition-colors cursor-pointer active:scale-95 px-2 font-label-md text-label-md no-underline"
            href="#"
          >
            Dashboard
          </a>
          <a
            className="h-full flex items-center text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer active:scale-95 px-2 font-label-md text-label-md no-underline"
            href="#"
          >
            History
          </a>
          <a
            className="h-full flex items-center text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer active:scale-95 px-2 font-label-md text-label-md no-underline"
            href="#"
          >
            Templates
          </a>
        </nav>

        {/* Trailing Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer active:scale-95 border-0 bg-transparent" type="button">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button
            className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer active:scale-95 border-0 bg-transparent"
            type="button"
            onClick={() => navigate("/settings")}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
          {/* User Profile Avatar Placeholder */}
          <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center ml-2 border border-border-subtle overflow-hidden">
            <img
              className="w-full h-full object-cover"
              src={AVATAR_URL}
              alt="User avatar"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area (Canvas Stage) */}
      <main className="flex-1 mt-[48px] relative canvas-grid flex flex-col items-center justify-center px-4 md:px-0">
        {/* Overlay for results / context panels */}
        {showResults && results && results.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
            <div className="w-full max-w-3xl rounded-xl border border-border-subtle bg-surface-container-lowest shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  {results.length} work item{results.length > 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setShowResults(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors border-0 bg-transparent cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      handleSelectItem(item);
                      setShowResults(false);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-surface-container-low transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <span className="text-xs font-mono text-primary bg-primary-fixed/30 px-2 py-0.5 rounded shrink-0">
                      {item.type} #{item.id}
                    </span>
                    <span className="text-sm text-on-surface truncate flex-1">{item.title}</span>
                    {item.state && (
                      <span className="text-xs text-outline shrink-0">{item.state}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showContext && selectedId && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
            <div className="w-full max-w-3xl rounded-xl border border-border-subtle bg-surface-container-lowest shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  {t("home.refine_context")} — #{selectedId}
                </span>
                <button
                  type="button"
                  onClick={() => setShowContext(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors border-0 bg-transparent cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder={t("home.extra_context_placeholder")}
                rows={5}
                className="w-full bg-transparent border-none px-6 py-4 text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none resize-none font-body-md text-body-md"
                autoFocus
              />
              <div className="flex justify-between items-center px-4 py-3 border-t border-border-subtle bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-outline">
                  {extraContext.length} / 2000 chars
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={starting}
                  className="flex items-center justify-center gap-2 bg-primary-container text-on-primary px-6 py-2 rounded font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all border-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  {starting ? t("common.loading") : t("home.submit")}
                </button>
              </div>
              {startError && (
                <div className="mx-4 mb-3 rounded-xl border border-error/20 bg-error-container/50 px-4 py-2 text-sm text-error">
                  {startError}
                </div>
              )}
            </div>
          </div>
        )}

        {searchError && (
          <div className="absolute top-20 z-10 rounded-xl border border-error/20 bg-error-container/50 px-4 py-2 text-sm text-error">
            {searchError}
          </div>
        )}

        {/* Refinement Interface Container */}
        <div className="w-full max-w-3xl flex flex-col items-center">
          {/* Context/Prompt Heading */}
          <div className="mb-8 text-center">
            <h1 className="font-display text-display text-on-surface mb-2">{t("home.heading")}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{t("home.subheading")}</p>
          </div>

          {/* Input Area */}
          <div className="w-full bg-surface-container-lowest rounded-xl border border-border-subtle shadow-sm textarea-focus-ring transition-all duration-200 overflow-hidden flex flex-col">
            {/* Toolbar for Input */}
            <div className="flex items-center px-4 py-2 border-b border-border-subtle bg-surface-container-low gap-2">
              <button className="p-1 text-on-surface-variant hover:text-primary rounded transition-colors border-0 bg-transparent cursor-pointer" type="button" title="Formatting">
                <span className="material-symbols-outlined text-[18px]">format_bold</span>
              </button>
              <button className="p-1 text-on-surface-variant hover:text-primary rounded transition-colors border-0 bg-transparent cursor-pointer" type="button" title="Insert Variable">
                <span className="material-symbols-outlined text-[18px]">data_object</span>
              </button>
              <div className="h-4 w-px bg-border-subtle mx-1"></div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Drafting</span>
            </div>

            <textarea
              aria-label="Prompt Input Area"
              className="w-full h-48 md:h-64 p-6 bg-transparent border-none resize-none focus:ring-0 font-body-lg text-body-lg text-on-surface placeholder:text-outline-variant outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder={t("home.search_placeholder")}
            />

            {/* Input Footer / Character Count */}
            <div className="flex justify-between items-center px-4 py-3 border-t border-border-subtle bg-surface-container-lowest">
              <span className="font-label-sm text-label-sm text-outline">
                {query.length} / 2000 chars
              </span>
              <button
                onClick={() => void handleSearch()}
                disabled={searching || !query.trim()}
                className="flex items-center justify-center gap-2 bg-primary-container text-on-primary px-6 py-2 rounded font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all border-0 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                {searching ? t("common.loading") : t("home.search_button")}
              </button>
            </div>
          </div>

          {/* Suggestion Chips (Minimalist) */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
          </div>
        </div>
      </main>

      {/* Bottom Navigation Shell (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 w-full h-[56px] z-50 bg-surface border-t border-border-subtle flex justify-around items-center px-2">
        <a className="flex flex-col items-center justify-center w-full h-full text-primary no-underline" href="#">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="font-label-sm text-label-sm">Dashboard</span>
        </a>
        <a className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors no-underline" href="#">
          <span className="material-symbols-outlined mb-1">history</span>
          <span className="font-label-sm text-label-sm">History</span>
        </a>
        <a className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors no-underline" href="#">
          <span className="material-symbols-outlined mb-1">description</span>
          <span className="font-label-sm text-label-sm">Templates</span>
        </a>
      </nav>
    </div>
  );
}
