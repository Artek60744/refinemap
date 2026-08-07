import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteSession, exportUrl, listSessions, renameSession } from "../api/refinement";
import TopNavBar from "../components/TopNavBar";
import { GRID_LABELS } from "../constants/grids";
import { useI18n } from "../i18n";
import type { SessionListItem, SessionStatus } from "../types/api";

const PAGE_SIZE = 20;

const STATUSES: SessionStatus[] = ["DRAFT", "QUESTIONING", "ANALYZING", "FINAL_READY"];

function statusChipClass(status: SessionStatus): string {
  switch (status) {
    case "FINAL_READY":
      return "border-score-good/40 bg-score-good/10 text-score-good";
    case "ANALYZING":
      return "border-score-warn/40 bg-score-warn/10 text-score-warn";
    case "DRAFT":
      return "border-border-subtle bg-surface-container text-on-surface-variant";
    default:
      return "border-primary/30 bg-primary-container/10 text-primary";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const { t, label } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState<SessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  // Row-level UI state: which row is being renamed, and which one asks to confirm deletion.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A filter change restarts from the first page; "load more" appends instead.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listSessions({ q: debouncedSearch, status: status || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items);
        setTotal(payload.total);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const hasMore = items.length < total;
  const filtering = useMemo(() => Boolean(debouncedSearch || status), [debouncedSearch, status]);

  async function loadMore() {
    setLoading(true);
    try {
      const payload = await listSessions({
        q: debouncedSearch,
        status: status || undefined,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((current) => [...current, ...payload.items]);
      setTotal(payload.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  function openSession(item: SessionListItem) {
    navigate(
      item.status === "FINAL_READY"
        ? `/refinement/sessions/${item.id}/result`
        : `/refinement/sessions/${item.id}`,
    );
  }

  function startRename(item: SessionListItem) {
    setConfirmingId(null);
    setRenamingId(item.id);
    setRenameDraft(item.title);
  }

  async function commitRename(item: SessionListItem) {
    const title = renameDraft.trim();
    if (!title || title === item.title) {
      setRenamingId(null);
      return;
    }
    setBusyId(item.id);
    try {
      const updated = await renameSession(item.id, { title });
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
      setRenamingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(item: SessionListItem) {
    setBusyId(item.id);
    try {
      await deleteSession(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setTotal((current) => Math.max(current - 1, 0));
      setConfirmingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
      <TopNavBar active="history">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-transform hover:bg-surface-container-low active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>
      </TopNavBar>

      <main className="mt-[48px] flex-1 overflow-y-auto bg-canvas-bg">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <h1 className="flex items-center gap-3 font-headline-lg text-headline-lg text-on-surface">
            <span className="material-symbols-outlined text-[32px] text-primary">history</span>
            {t("history.title")}
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t("history.subtitle")}
          </p>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("history.search_placeholder")}
                className="w-full rounded-lg border border-border-subtle bg-surface py-2 pl-10 pr-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface p-1">
              <button
                type="button"
                onClick={() => setStatus("")}
                className={`rounded px-3 py-1 text-sm font-label-md transition-colors ${
                  status === ""
                    ? "bg-primary-container/15 font-bold text-primary"
                    : "border-0 bg-transparent text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {t("history.filter_all")}
              </button>
              {STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`rounded px-3 py-1 text-sm font-label-md transition-colors ${
                    status === value
                      ? "bg-primary-container/15 font-bold text-primary"
                      : "border-0 bg-transparent text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {label("status", value)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
              {error}
            </div>
          )}

          {/* List */}
          <div className="mt-6 flex flex-col gap-2">
            {items.map((item) => {
              const isRenaming = renamingId === item.id;
              const isConfirming = confirmingId === item.id;
              const busy = busyId === item.id;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        value={renameDraft}
                        disabled={busy}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename(item);
                          }
                          if (event.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => setRenamingId(null)}
                        className="w-full rounded border border-primary bg-surface-container-lowest px-2 py-1 font-label-md text-body-md text-on-surface focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSession(item)}
                        className="block w-full truncate border-0 bg-transparent p-0 text-left font-label-md text-body-lg text-on-surface hover:text-primary hover:underline"
                      >
                        {item.title || t("history.untitled")}
                      </button>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium ${statusChipClass(item.status)}`}
                      >
                        {label("status", item.status)}
                      </span>
                      <span className="rounded-full bg-primary-container/15 px-2 py-0.5 font-bold text-primary">
                        {GRID_LABELS[item.grid] ?? item.grid}
                      </span>
                      <span>
                        {t("session.round")} {item.round}/{item.maxRounds}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(item.updatedAt ?? item.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void confirmDelete(item)}
                          className="rounded border-0 bg-error px-3 py-1.5 text-sm font-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {t("history.delete_confirm")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingId(null)}
                          className="rounded border border-border-subtle bg-surface px-3 py-1.5 text-sm font-label-md text-on-surface-variant hover:bg-surface-container-low"
                        >
                          {t("common.cancel")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openSession(item)}
                          title={t("history.resume")}
                          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {item.status === "FINAL_READY" ? "description" : "play_arrow"}
                          </span>
                        </button>
                        {item.status === "FINAL_READY" && (
                          <a
                            href={exportUrl(item.id)}
                            title={t("session.export_markdown")}
                            className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant no-underline transition-colors hover:bg-surface-container-low hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => startRename(item)}
                          title={t("history.rename")}
                          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(null);
                            setConfirmingId(item.id);
                          }}
                          title={t("history.delete")}
                          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-colors hover:bg-error-container/50 hover:text-error"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <p className="mt-6 text-center text-sm italic text-on-surface-variant">
              {t("common.loading")}
            </p>
          )}

          {!loading && items.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-10 text-center">
              <span className="material-symbols-outlined text-[32px] text-outline">inbox</span>
              <p className="mt-2 text-sm text-on-surface-variant">
                {filtering ? t("history.empty_filtered") : t("history.empty")}
              </p>
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                className="rounded border border-border-subtle bg-surface px-4 py-2 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                {t("history.load_more", { count: String(total - items.length) })}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
