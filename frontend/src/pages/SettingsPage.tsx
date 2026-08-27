import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getSettings, saveSettings, testLlm } from "../api/settings";
import { useI18n } from "../i18n";
import type { ConnectionTestResponse, SettingsViewResponse } from "../types/api";

const LLM_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  mock: [],
  deepseek: ["model"],
  "azure-foundry": ["endpoint", "deployment"],
  "azure-openai": ["endpoint", "deployment"],
  openai: ["model"],
  openrouter: ["model"],
  // Endpoint stays editable: Ollama may run on another machine on the LAN.
  ollama: ["model", "endpoint"],
};

// Local runtimes need no credentials — showing an API key field for them only
// invites people to paste a real key into a local endpoint.
// Mirrors KEYLESS_PROVIDERS in src/services/refinement_llm.py.
const KEYLESS_PROVIDERS = ["ollama"];

const INPUT_CLASS =
  "w-full rounded-lg border border-border-subtle bg-white px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors";
const LABEL_CLASS = "mb-2 block text-xs font-semibold text-on-surface-variant uppercase tracking-wider";

interface FormState {
  llmProvider: string;
  llmEndpoint: string;
  llmApiKey: string;
  llmDeployment: string;
  llmModel: string;
}

const EMPTY_FORM: FormState = {
  llmProvider: "mock",
  llmEndpoint: "",
  llmApiKey: "",
  llmDeployment: "",
  llmModel: "",
};

interface Banner {
  kind: "success" | "error";
  message: string;
}

function ConnectionResult({ result }: { result: ConnectionTestResponse | null }) {
  if (!result) {
    return null;
  }
  const entries = Object.entries(result.details ?? {});
  return (
    <div className="mt-4 text-sm">
      <div className={result.success ? "text-green-600" : "text-error"}>{result.message}</div>
      {entries.length > 0 && (
        <div className="mt-2 text-xs text-outline">
          {entries.map(([key, value]) => `${key}: ${value}`).join(" • ")}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyHintText, setKeyHintText] = useState("");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<ConnectionTestResponse | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applySettings(settings: SettingsViewResponse) {
    setForm({
      llmProvider: settings.llm.provider || "mock",
      llmEndpoint: settings.llm.endpoint || "",
      llmDeployment: settings.llm.deployment || "",
      llmModel: settings.llm.model || "",
      llmApiKey: "",
    });
    setKeyHintText(
      settings.llm.keyConfigured
        ? t("llm.key_configured", { hint: settings.llm.keyHint ?? "" })
        : t("llm.no_key"),
    );
  }

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((payload) => {
        if (!cancelled) applySettings(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBanner({
            kind: "error",
            message: error instanceof Error ? error.message : t("settings.load_failed"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await saveSettings({ ...form });
      applySettings(response.settings);
      setBanner({ kind: "success", message: response.message });
    } catch (error) {
      setBanner({
        kind: "error",
        message: error instanceof Error ? error.message : t("settings.save_failed"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestLlm() {
    try {
      setLlmTestResult(
        await testLlm({
          provider: form.llmProvider,
          endpoint: form.llmEndpoint,
          deployment: form.llmDeployment,
          model: form.llmModel,
          apiKey: form.llmApiKey,
        }),
      );
    } catch (error) {
      setLlmTestResult({
        success: false,
        message: error instanceof Error ? error.message : t("llm.test_failed"),
        details: {},
      });
    }
  }

  const visibleLlmFields = LLM_FIELDS_BY_PROVIDER[form.llmProvider] ?? ["model"];

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{t("settings.title")}</h2>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{t("settings.subtitle")}</p>
      </div>

      {banner && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-error/30 bg-error-container/50 text-error"
          }`}
        >
          {banner.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">{t("llm.title")}</h3>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t("llm.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleTestLlm()}
              className="rounded-lg border border-primary/30 bg-primary-fixed/30 px-4 py-2 text-sm font-semibold text-on-primary-fixed-variant hover:bg-primary-fixed/50 transition-colors cursor-pointer shrink-0"
            >
              {t("common.test")}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>{t("llm.provider")}</label>
              <select
                value={form.llmProvider}
                onChange={(event) => set("llmProvider", event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="mock">Mock</option>
                <option value="deepseek">DeepSeek</option>
                <option value="azure-foundry">Azure Foundry</option>
                <option value="azure-openai">Azure OpenAI</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama (local)</option>
              </select>
            </div>

            {visibleLlmFields.includes("model") && (
              <div>
                <label className={LABEL_CLASS}>{t("llm.model")}</label>
                <input
                  type="text"
                  value={form.llmModel}
                  onChange={(event) => set("llmModel", event.target.value)}
                  placeholder="gpt-4.1-mini"
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-xs text-outline">{t("llm.model_hint")}</p>
              </div>
            )}

            {visibleLlmFields.includes("endpoint") && (
              <div>
                <label className={LABEL_CLASS}>{t("llm.endpoint")}</label>
                <input
                  type="text"
                  value={form.llmEndpoint}
                  onChange={(event) => set("llmEndpoint", event.target.value)}
                  placeholder="https://mon-service.openai.azure.com"
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-xs text-outline">{t("llm.endpoint_hint")}</p>
              </div>
            )}

            {visibleLlmFields.includes("deployment") && (
              <div>
                <label className={LABEL_CLASS}>{t("llm.deployment")}</label>
                <input
                  type="text"
                  value={form.llmDeployment}
                  onChange={(event) => set("llmDeployment", event.target.value)}
                  placeholder="mon-gpt4o-prod"
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-xs text-outline">{t("llm.deployment_hint")}</p>
              </div>
            )}

            {!KEYLESS_PROVIDERS.includes(form.llmProvider) && (
              <div>
                <label className={LABEL_CLASS}>{t("llm.api_key")}</label>
                <input
                  type="password"
                  value={form.llmApiKey}
                  onChange={(event) => set("llmApiKey", event.target.value)}
                  placeholder={t("llm.api_key_placeholder")}
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-xs text-outline">{keyHintText}</p>
              </div>
            )}
          </div>

          <ConnectionResult result={llmTestResult} />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-6">
          <p className="text-xs text-outline">{t("settings.secrets_note")}</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-container text-on-primary px-5 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 active:scale-95 transition-all cursor-pointer border-0"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
