import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n";
import { SUPPORTED_LANGUAGES } from "../i18n/catalog";
import type { Lang } from "../i18n/catalog";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
    isActive ? "bg-primary-fixed/40 text-on-primary-fixed-variant" : "text-on-surface-variant hover:bg-surface-container-low"
  }`;
}

export default function Layout() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r border-border-subtle bg-surface-container-lowest p-6 lg:flex lg:flex-col">
        <div className="mb-10">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{t("app.name")}</h1>
          <p className="mt-2 font-body-md text-body-md text-outline">{t("app.tagline")}</p>
        </div>

        <nav className="space-y-1 flex-1">
          <NavLink to="/refinement" className={navLinkClass}>
            {t("nav.refinement")}
          </NavLink>
          <NavLink to="/refinement/history" className={navLinkClass}>
            {t("nav.history")}
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            {t("nav.settings")}
          </NavLink>
          <a href="/health" className="block rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors no-underline">
            {t("nav.health")}
          </a>
        </nav>

        <div className="flex items-center gap-1 mt-auto pt-6 border-t border-border-subtle">
          {(Object.entries(SUPPORTED_LANGUAGES) as [Lang, { flag: string; label: string }][]).map(
            ([code, language]) => (
              <button
                key={code}
                type="button"
                title={language.label}
                aria-label={language.label}
                aria-current={code === lang || undefined}
                onClick={() => setLang(code)}
                className={`rounded-full px-2 py-1 text-base leading-none transition-colors border-0 bg-transparent cursor-pointer ${
                  code === lang
                    ? "bg-primary-fixed/40 ring-1 ring-primary/30"
                    : "opacity-40 hover:opacity-80"
                }`}
              >
                {language.flag}
              </button>
            ),
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-canvas-bg">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
