import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { createSession } from "../api/refinement";
import { useI18n } from "../i18n";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW8Ydnt1pjaSuuOkoaNpK1bp7aL7xVEgZAfXu4_neIosXkFUY8fo12xP_7XfMCd5zqMPdCevOiuoIYykQoU54l85QQLB-BZJSCDd_g3XlCDrD7CpUKO31N87WHuGyh0IDgl8VMQpqPoASztCeXDwjnvcgt6Z0dE5ejZxtDqgqdkEkxTfwH5Ptb1QeXYEj6veWO7sCIaJSw3dhJCH8ErNWSug3IN5wx5RNL-za3Oo-Oc_JJ8__8SL3-";

interface Card {
  mode: string;
  title: string;
  description: string;
  icon: string;
}

const CARDS: Card[] = [
  {
    mode: "po",
    title: "Je veux cadrer business.",
    description: "Valeur métier, problème, périmètre, arbitrages. Pour cadrer une demande sans l'implémenter.",
    icon: "insights",
  },
  {
    mode: "technique",
    title: "Je veux cadrer technique.",
    description: "Faisabilité, contraintes, existant, risques techniques. Pour préparer une spec ou un ticket.",
    icon: "build",
  },
  {
    mode: "hybride",
    title: "Je veux cadrer les deux.",
    description: "Aligne produit et technique. Idéal si le sujet est encore flou.",
    icon: "hub",
  },
];

export default function ChooseGrid() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const objective = (location.state as { objective?: string } | null)?.objective ?? "";

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!objective) {
    return <Navigate to="/refinement" replace />;
  }

  async function choose(mode: string) {
    if (pending) return;
    setPending(mode);
    setError(null);
    try {
      const response = await createSession({ objective, mode });
      navigate(`/refinement/sessions/${response.session.id}`, {
        state: { degraded: response.degraded },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.session_create_failed"));
      setPending(null);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full h-[48px] z-50 flex justify-between items-center px-margin-desktop bg-surface border-b border-border-subtle">
        <a href="/" className="flex items-center gap-3 no-underline">
          <img alt="PromptRefine Logo" className="h-6 w-6 object-contain rounded" src={LOGO_URL} />
          <span className="font-headline-md text-headline-md text-primary tracking-tight">PromptRefine</span>
        </a>
        <button
          className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer active:scale-95 border-0 bg-transparent"
          type="button"
          onClick={() => navigate("/settings")}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 mt-[48px] relative canvas-grid flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-4xl flex flex-col items-center">
          {/* Subject reminder */}
          <div className="mb-8 text-center">
            <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-2">Sujet</p>
            <h1 className="font-headline-lg text-headline-lg text-on-surface max-w-2xl">{objective}</h1>
            <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
              Choisis un cadrage : les premières questions s'adapteront à ce que tu veux clarifier.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-error/20 bg-error-container/50 px-4 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {/* 3 cards */}
          <div className="grid w-full gap-4 md:grid-cols-3">
            {CARDS.map((card) => {
              const isPending = pending === card.mode;
              const dimmed = pending !== null && !isPending;
              return (
                <button
                  key={card.mode}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void choose(card.mode)}
                  className={`group flex flex-col items-start gap-3 rounded-xl border bg-surface-container-lowest p-6 text-left shadow-sm transition-all cursor-pointer disabled:cursor-default ${
                    isPending
                      ? "border-primary ring-1 ring-primary"
                      : "border-border-subtle hover:border-primary hover:shadow-md active:scale-[0.99]"
                  } ${dimmed ? "opacity-50" : ""}`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                      isPending ? "bg-primary text-on-primary" : "bg-primary-container/15 text-primary"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[24px] ${isPending ? "animate-spin" : ""}`}>
                      {isPending ? "progress_activity" : card.icon}
                    </span>
                  </span>
                  <h2 className="font-headline-md text-lg leading-tight text-on-surface">{card.title}</h2>
                  <p className="font-body-md text-sm text-on-surface-variant">{card.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 font-label-md text-label-md text-primary">
                    {isPending ? "Génération des premières questions…" : "Lancer le refinement"}
                    {!isPending && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate("/refinement")}
            disabled={pending !== null}
            className="mt-8 inline-flex items-center gap-1 border-0 bg-transparent font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Modifier le sujet
          </button>
        </div>
      </main>
    </div>
  );
}
