import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

const LINK_BASE =
  "flex h-full items-center px-4 font-label-md text-label-md no-underline transition-colors";

// The shell shared by the pages that are not inside the sidebar Layout. `children` holds
// the page-specific controls on the right (settings, notifications, avatar…).
export default function TopNavBar({
  active,
  children,
}: {
  active: "dashboard" | "history";
  children?: ReactNode;
}) {
  const { t } = useI18n();

  function linkClass(target: "dashboard" | "history"): string {
    return `${LINK_BASE} ${
      target === active
        ? "border-b-2 border-primary font-bold text-primary"
        : "text-on-surface-variant hover:bg-surface-container-low"
    }`;
  }

  return (
    <header className="fixed top-0 z-50 flex h-[48px] w-full items-center justify-between border-b border-border-subtle bg-surface px-margin-desktop">
      <div className="flex items-center gap-6">
        <Link to="/refinement" className="flex items-center gap-2 no-underline">
          <img alt="PromptRefine Logo" className="h-6 w-6 rounded object-contain" src={LOGO_URL} />
          <span className="font-headline-md text-headline-md tracking-tight text-primary">
            PromptRefine
          </span>
        </Link>
        <nav className="hidden h-full md:flex">
          <Link to="/refinement" className={linkClass("dashboard")}>
            {t("nav.dashboard")}
          </Link>
          <Link to="/refinement/history" className={linkClass("history")}>
            {t("nav.history")}
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
