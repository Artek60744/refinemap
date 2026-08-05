import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  getSettings,
  listAdoProjects,
  saveSettings,
  testAzureDevOps,
  testLlm,
} from "../api/settings";
import { useI18n } from "../i18n";
import type { ConnectionTestResponse, SettingsViewResponse } from "../types/api";

const LLM_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  mock: [],
  "azure-foundry": ["endpoint", "deployment"],
  "azure-openai": ["endpoint", "deployment"],
  openai: ["model"],
  openrouter: ["model"],
};

const INPUT_CLASS =
  "w-full rounded-lg border border-border-subtle bg-white px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors";
const LABEL_CLASS = "mb-2 block text-xs font-semibold text-on-surface-variant uppercase tracking-wider";

interface FormState {
  llmProvider: string;
  llmEndpoint: string;
  llmApiKey: string;
  llmDeployment: string;
  llmModel: string;
  adoOrgUrl: string;
  adoProject: string;
  adoPat: string;
  adoMockMode: boolean;
}

const EMPTY_FORM: FormState = {
  llmProvider: "mock",
  llmEndpoint: "",
  llmApiKey: "",
  llmDeployment: "",
  llmModel: "",
  adoOrgUrl: "",
  adoProject: "",
  adoPat: "",
  adoMockMode: true,
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

  const [activeTab, setActiveTab] = useState<"llm" | "azure">("llm");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyHintText, setKeyHintText] = useState("");
  const [patHintText, setPatHintText] = useState("");
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [projectHint, setProjectHint] = useState(t("azure.project_hint"));
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<ConnectionTestResponse | null>(null);
  const [adoTestResult, setAdoTestResult] = useState<ConnectionTestResponse | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applySettings(settings: SettingsViewResponse) {
    setForm((current) => ({
      ...current,
      llmProvider: settings.llm.provider || "mock",
      llmEndpoint: settings.llm.endpoint || "",
      llmDeployment: settings.llm.deployment || "",
      llmModel: settings.llm.model || "",
      llmApiKey: "",
      adoOrgUrl: settings.azureDevOps.orgUrl || "",
      adoProject: settings.azureDevOps.project || "",
      adoPat: "",
      adoMockMode: !!settings.azureDevOps.mockMode,
    }));
    setKeyHintText(
      settings.llm.keyConfigured
        ? t("llm.key_configured", { hint: settings.llm.keyHint ?? "" })
        : t("llm.no_key"),
    );
    setPatHintText(
      settings.azureDevOps.patConfigured
        ? t("azure.pat_configured", { hint: settings.azureDevOps.patHint ?? "" })
        : t("azure.no_pat"),
    );
    if (settings.azureDevOps.project) {
      setProjectOptions((current) =>
        current.includes(settings.azureDevOps.project)
          ? current
          : [settings.azureDevOps.project, ...current],
      );
    }
  }

  async function loadProjects(orgUrl: string, pat: string, { silent = false } = {}) {
    setLoadingProjects(true);
    setProjectHint(t("azure.loading_projects"));
    try {
      const response = await listAdoProjects({ orgUrl, pat });
      setProjectHint(response.message);
      if (!response.success) {
        if (!silent) {
          setAdoTestResult({ success: false, message: response.message, details: {} });
        }
        return;
      }
      const names = response.projects.map((project) => project.name);
      setForm((current) => {
        if (current.adoProject && !names.includes(current.adoProject)) {
          names.unshift(current.adoProject);
        }
        return { ...current, adoProject: current.adoProject || names[0] || "" };
      });
      setProjectOptions(names);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("azure.projects_failed");
      setProjectHint(message);
      if (!silent) {
        setAdoTestResult({ success: false, message, details: {} });
      }
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        applySettings(payload);
        if (payload.azureDevOps.orgUrl && payload.azureDevOps.patConfigured) {
          void loadProjects(payload.azureDevOps.orgUrl, "", { silent: true });
        }
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

  async function handleTestAdo() {
    try {
      setAdoTestResult(
        await testAzureDevOps({
          orgUrl: form.adoOrgUrl,
          project: form.adoProject,
          pat: form.adoPat,
          mockMode: form.adoMockMode,
        }),
      );
    } catch (error) {
      setAdoTestResult({
        success: false,
        message: error instanceof Error ? error.message : t("azure.test_failed"),
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

      <div className="mb-6 flex gap-1 border-b border-border-subtle">
        {(["llm", "azure"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer bg-transparent ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t(`settings.tab.${tab}`)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className={activeTab === "llm" ? "space-y-6" : "hidden"}>
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
                  <option value="azure-foundry">Azure Foundry</option>
                  <option value="azure-openai">Azure OpenAI</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
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
            </div>

            <div className="mt-4">
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

            <ConnectionResult result={llmTestResult} />
          </div>
        </section>

        <section className={activeTab === "azure" ? "space-y-6" : "hidden"}>
          <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{t("azure.title")}</h3>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t("azure.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleTestAdo()}
                className="rounded-lg border border-tertiary-container/30 bg-tertiary-fixed/30 px-4 py-2 text-sm font-semibold text-tertiary hover:bg-tertiary-fixed/50 transition-colors cursor-pointer shrink-0"
              >
                {t("common.test")}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>{t("azure.org_url")}</label>
                <input
                  type="text"
                  value={form.adoOrgUrl}
                  onChange={(event) => set("adoOrgUrl", event.target.value)}
                  placeholder="https://dev.azure.com/myorg"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>{t("azure.project")}</label>
                <div className="flex gap-3">
                  <select
                    value={form.adoProject}
                    onChange={(event) => set("adoProject", event.target.value)}
                    className={`${INPUT_CLASS} flex-1`}
                  >
                    {projectOptions.length === 0 && (
                      <option value="">{t("azure.project_placeholder")}</option>
                    )}
                    {projectOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={loadingProjects}
                    onClick={() => void loadProjects(form.adoOrgUrl, form.adoPat)}
                    className="whitespace-nowrap rounded-lg border border-tertiary-container/30 bg-tertiary-fixed/30 px-4 py-3 text-sm font-semibold text-tertiary hover:bg-tertiary-fixed/50 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {t("common.load")}
                  </button>
                </div>
                <p className="mt-2 text-xs text-outline">{projectHint}</p>
              </div>

              <div>
                <label className={LABEL_CLASS}>{t("azure.pat")}</label>
                <input
                  type="password"
                  value={form.adoPat}
                  onChange={(event) => set("adoPat", event.target.value)}
                  placeholder={t("azure.pat_placeholder")}
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-xs text-outline">{patHintText}</p>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.adoMockMode}
                  onChange={(event) => set("adoMockMode", event.target.checked)}
                  className="h-4 w-4 rounded border-border-subtle bg-white text-primary focus:ring-primary"
                />
                {t("azure.mock_mode")}
              </label>
            </div>

            <ConnectionResult result={adoTestResult} />
          </div>
        </section>

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
