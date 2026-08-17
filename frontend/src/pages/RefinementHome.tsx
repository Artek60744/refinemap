import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopNavBar from "../components/TopNavBar";
import { listProducts } from "../api/memory";
import { useI18n } from "../i18n";
import type { ProductModel } from "../types/api";

// Sentinel value of the product <select>, distinct from "" (= no product at all).
const NEW_PRODUCT = "__new__";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBfikYYcBcADrKCg8nLbkcK32aq9GCb6KJz4jkTN8UzcM5g6GfQ1a99g4azrl9I6DBZ87MzXJMkV16rZoJ2la1uqkl0oZVpxSEEFMkO6IS3SEUjobrG_OUMEaVDCtwFpOcwGHHdRseM4VUsy1DWHGiW_b1CHAcgTtSuTOvh4RCqh_2aFhrUiLIeH7qdt-17yCDwdWGa-Ul0afnHZjtQ2TGqL0e5W9JItS091fqt7XP8Gp34rHXB-ykL";

export default function RefinementHome() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductModel[]>([]);
  const [productId, setProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");

  useEffect(() => {
    // A failure here must not block starting a session: no product simply means
    // a session without memory.
    listProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  function handleStart() {
    const objective = query.trim();
    if (!objective) return;
    navigate("/refinement/choose", {
      state: {
        objective,
        productId: productId === NEW_PRODUCT ? null : productId || null,
        productName: productId === NEW_PRODUCT ? newProductName.trim() : "",
      },
    });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Navigation Shell */}
      <TopNavBar active="dashboard">
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
      </TopNavBar>

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

              {/* Product scope: decides which memory feeds this session. */}
              <div className="ml-auto flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-outline">database</span>
                <select
                  aria-label={t("memory.product")}
                  className="rounded border border-border-subtle bg-surface-container-lowest px-2 py-1 font-label-sm text-label-sm text-on-surface-variant outline-none cursor-pointer"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">{t("memory.product_placeholder")}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.factCount})
                    </option>
                  ))}
                  <option value={NEW_PRODUCT}>{t("memory.new_product")}</option>
                </select>
                {productId === NEW_PRODUCT && (
                  <input
                    autoFocus
                    aria-label={t("memory.new_product")}
                    className="w-40 rounded border border-border-subtle bg-surface-container-lowest px-2 py-1 font-label-sm text-label-sm text-on-surface outline-none"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder={t("memory.new_product_placeholder")}
                  />
                )}
              </div>
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
        <Link className="flex flex-col items-center justify-center w-full h-full text-primary no-underline" to="/refinement">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="font-label-sm text-label-sm">{t("nav.dashboard")}</span>
        </Link>
        <Link className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors no-underline" to="/refinement/history">
          <span className="material-symbols-outlined mb-1">history</span>
          <span className="font-label-sm text-label-sm">{t("nav.history")}</span>
        </Link>
        <a className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors no-underline" href="#">
          <span className="material-symbols-outlined mb-1">description</span>
          <span className="font-label-sm text-label-sm">Templates</span>
        </a>
      </nav>
    </div>
  );
}
