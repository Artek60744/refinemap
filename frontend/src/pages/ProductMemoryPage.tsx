import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMemoryFact,
  archiveMemoryFact,
  getProductMemory,
  listProducts,
  updateMemoryFact,
} from "../api/memory";
import TopNavBar from "../components/TopNavBar";
import { useI18n } from "../i18n";
import type { ProductMemoryItem, ProductModel } from "../types/api";

// Mirrors MEMORY_CATEGORIES in src/models/product_memory.py, in display order.
const CATEGORIES = ["produit", "stack", "equipe", "contrainte", "utilisateur", "decision"];

// Mirrors MEMORY_FACT_LIMIT in src/models/product_memory.py.
const FACT_LIMIT = 40;

export default function ProductMemoryPage() {
  const { t, label } = useI18n();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductModel[]>([]);
  const [productId, setProductId] = useState("");
  const [facts, setFacts] = useState<ProductMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newStatement, setNewStatement] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [adding, setAdding] = useState(false);

  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    listProducts()
      .then((rows) => {
        setProducts(rows);
        setProductId((current) => current || rows[0]?.id || "");
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!productId) {
      setFacts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProductMemory(productId)
      .then((payload) => {
        if (!cancelled) setFacts(payload.facts);
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
  }, [productId]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  // Grouped for reading; the injection order itself lives in the backend.
  const grouped = useMemo(() => {
    const buckets = new Map<string, ProductMemoryItem[]>();
    for (const fact of facts) {
      const bucket = buckets.get(fact.category) ?? [];
      bucket.push(fact);
      buckets.set(fact.category, bucket);
    }
    return CATEGORIES.filter((category) => buckets.has(category)).map((category) => ({
      category,
      items: buckets.get(category) ?? [],
    }));
  }, [facts]);

  function startEdit(fact: ProductMemoryItem) {
    setConfirmingId(null);
    setEditingId(fact.id);
    setEditDraft(fact.statement);
  }

  async function commitEdit(fact: ProductMemoryItem) {
    const statement = editDraft.trim();
    if (!statement || statement === fact.statement) {
      setEditingId(null);
      return;
    }
    setBusyId(fact.id);
    try {
      const updated = await updateMemoryFact(fact.id, { statement });
      setFacts((current) => current.map((row) => (row.id === fact.id ? updated : row)));
      setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmFact(fact: ProductMemoryItem) {
    setBusyId(fact.id);
    try {
      const updated = await updateMemoryFact(fact.id, { confirmed: true });
      setFacts((current) => current.map((row) => (row.id === fact.id ? updated : row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function removeFact(fact: ProductMemoryItem) {
    setBusyId(fact.id);
    try {
      await archiveMemoryFact(fact.id);
      setFacts((current) => current.filter((row) => row.id !== fact.id));
      setConfirmingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function addFact() {
    const statement = newStatement.trim();
    if (!statement || !productId) return;
    setAdding(true);
    try {
      const created = await addMemoryFact(productId, { category: newCategory, statement });
      setFacts((current) => [...current, created]);
      setNewStatement("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-low">
      <TopNavBar active="memory">
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
            <span className="material-symbols-outlined text-[32px] text-primary">database</span>
            {t("memory.title")}
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t("memory.subtitle")}
          </p>

          {products.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="font-label-md text-label-md text-on-surface-variant">
                {t("memory.product")}
              </label>
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="rounded-lg border border-border-subtle bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <span className="font-label-sm text-label-sm text-outline">
                {t("memory.fact_count", { count: String(facts.length) })}
              </span>
              {facts.length >= FACT_LIMIT && (
                <span className="rounded-full border border-score-warn/40 bg-score-warn/10 px-2 py-0.5 font-label-sm text-label-sm text-score-warn">
                  {t("memory.cap_notice", { count: String(FACT_LIMIT) })}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-error/30 bg-error-container/50 p-4 text-sm text-error">
              {error}
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-10 text-center">
              <span className="material-symbols-outlined text-[32px] text-outline">database_off</span>
              <p className="mt-2 text-sm text-on-surface-variant">{t("memory.no_product")}</p>
            </div>
          )}

          {!loading && products.length > 0 && facts.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-10 text-center">
              <span className="material-symbols-outlined text-[32px] text-outline">inbox</span>
              <p className="mt-2 text-sm text-on-surface-variant">{t("memory.empty")}</p>
            </div>
          )}

          {grouped.map((group) => (
            <section key={group.category} className="mt-6">
              <h2 className="font-label-md text-label-md uppercase tracking-wider text-outline">
                {label("category", group.category)}
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {group.items.map((fact) => {
                  const isEditing = editingId === fact.id;
                  const isConfirming = confirmingId === fact.id;
                  const busy = busyId === fact.id;
                  return (
                    <div
                      key={fact.id}
                      className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            value={editDraft}
                            disabled={busy}
                            onChange={(event) => setEditDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void commitEdit(fact);
                              }
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => setEditingId(null)}
                            className="w-full rounded border border-primary bg-surface-container-lowest px-2 py-1 font-body-md text-body-md text-on-surface focus:ring-1 focus:ring-primary"
                          />
                        ) : (
                          <p className="font-body-md text-body-md text-on-surface">{fact.statement}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-medium ${
                              fact.confirmed
                                ? "border-score-good/40 bg-score-good/10 text-score-good"
                                : "border-border-subtle bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {fact.confirmed ? t("memory.confirmed") : t("memory.unconfirmed")}
                          </span>
                          {fact.sourceSessionId && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/refinement/sessions/${fact.sourceSessionId}/result`)
                              }
                              className="border-0 bg-transparent p-0 text-xs text-on-surface-variant underline hover:text-primary"
                            >
                              {t("history.resume")}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeFact(fact)}
                              className="rounded border-0 bg-error px-3 py-1.5 text-sm font-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                              {t("memory.delete_confirm")}
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
                            {!fact.confirmed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void confirmFact(fact)}
                                title={t("memory.confirmed")}
                                className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-score-good"
                              >
                                <span className="material-symbols-outlined text-[18px]">check</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(fact)}
                              title={t("memory.correct")}
                              className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setConfirmingId(fact.id);
                              }}
                              title={t("memory.remove")}
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
            </section>
          ))}

          {loading && (
            <p className="mt-6 text-center text-sm italic text-on-surface-variant">
              {t("common.loading")}
            </p>
          )}

          {productId && (
            <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-subtle p-4">
              <select
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                className="rounded border border-border-subtle bg-surface px-2 py-2 font-label-md text-label-md text-on-surface-variant outline-none"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {label("category", category)}
                  </option>
                ))}
              </select>
              <input
                value={newStatement}
                onChange={(event) => setNewStatement(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addFact();
                  }
                }}
                placeholder={t("memory.add_placeholder")}
                className="min-w-[220px] flex-1 rounded border border-border-subtle bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={adding || !newStatement.trim()}
                onClick={() => void addFact()}
                className="rounded border-0 bg-primary-container px-4 py-2 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("memory.add_fact")}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
