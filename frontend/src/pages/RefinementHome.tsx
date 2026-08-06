import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBfikYYcBcADrKCg8nLbkcK32aq9GCb6KJz4jkTN8UzcM5g6GfQ1a99g4azrl9I6DBZ87MzXJMkV16rZoJ2la1uqkl0oZVpxSEEFMkO6IS3SEUjobrG_OUMEaVDCtwFpOcwGHHdRseM4VUsy1DWHGiW_b1CHAcgTtSuTOvh4RCqh_2aFhrUiLIeH7qdt-17yCDwdWGa-Ul0afnHZjtQ2TGqL0e5W9JItS091fqt7XP8Gp34rHXB-ykL";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

export default function RefinementHome() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");

  function handleStart() {
    const objective = query.trim();
    if (!objective) return;
    navigate("/refinement/choose", { state: { objective } });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full h-[48px] z-50 flex justify-between items-center px-margin-desktop bg-surface border-b border-border-subtle">
        <a href="/" className="flex items-center gap-3 no-underline">
          <img alt="PromptRefine Logo" className="h-6 w-6 object-contain rounded" src={LOGO_URL} />
          <span className="font-headline-md text-headline-md text-primary tracking-tight">
            PromptRefine
          </span>
        </a>

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
          <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center ml-2 border border-border-subtle overflow-hidden">
            <img className="w-full h-full object-cover" src={AVATAR_URL} alt="User avatar" />
          </div>
        </div>
      </header>

      {/* Main Content Area (Canvas Stage) */}
      <main className="flex-1 mt-[48px] relative canvas-grid flex flex-col items-center justify-center px-4 md:px-0">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="font-display text-display text-on-surface mb-2">{t("home.heading")}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{t("home.subheading")}</p>
          </div>

          <div className="w-full bg-surface-container-lowest rounded-xl border border-border-subtle shadow-sm textarea-focus-ring transition-all duration-200 overflow-hidden flex flex-col">
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
                  void handleStart();
                }
              }}
              placeholder={t("home.search_placeholder")}
            />

            <div className="flex justify-between items-center px-4 py-3 border-t border-border-subtle bg-surface-container-lowest">
              <span className="font-label-sm text-label-sm text-outline">
                {query.length} / 2000 chars
              </span>
              <button
                onClick={handleStart}
                disabled={!query.trim()}
                className="flex items-center justify-center gap-2 bg-primary-container text-on-primary px-6 py-2 rounded font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all border-0 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                {t("home.search_button")}
              </button>
            </div>
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
