import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n";
import { SUPPORTED_LANGUAGES } from "../i18n/catalog";
import type { Lang } from "../i18n/catalog";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-lg px-3 py-2 ${
    isActive ? "bg-violet-500/15 text-violet-200" : "text-slate-300 hover:bg-slate-800"
  }`;
}

export default function Layout() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-900/80 p-6 lg:block">
        <div className="mb-10">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
            AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("app.tagline")}</p>
        </div>

        <nav className="space-y-2 text-sm">
          <NavLink to="/refinement" className={navLinkClass}>
            {t("nav.refinement")}
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            {t("nav.settings")}
          </NavLink>
          <a href="/health" className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800">
            {t("nav.health")}
          </a>
        </nav>
      </aside>

      <main className="flex-1">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
                {t("header.eyebrow")}
              </p>
              <h2 className="text-lg font-medium text-slate-100">{t("header.title")}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 p-1"
                role="group"
                aria-label={t("lang.switch")}
              >
                {(Object.entries(SUPPORTED_LANGUAGES) as [Lang, { flag: string; label: string }][]).map(
                  ([code, language]) => (
                    <button
                      key={code}
                      type="button"
                      title={language.label}
                      aria-label={language.label}
                      aria-current={code === lang || undefined}
                      onClick={() => setLang(code)}
                      className={`rounded-full px-2 py-1 text-base leading-none transition ${
                        code === lang
                          ? "bg-violet-500/20 ring-1 ring-violet-400/40"
                          : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      {language.flag}
                    </button>
                  ),
                )}
              </div>
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                MVP
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
