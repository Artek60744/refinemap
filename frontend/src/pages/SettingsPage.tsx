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

// Endpoint + deployment only exist for the Azure-hosted providers; the plain
// API providers are addressed by model name instead.
const LLM_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  mock: [],
  "azure-foundry": ["endpoint", "deployment"],
  "azure-openai": ["endpoint", "deployment"],
  openai: ["model"],
  openrouter: ["model"],
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none";

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
      <div className={result.success ? "text-emerald-300" : "text-rose-300"}>{result.message}</div>
      {entries.length > 0 && (
        <div className="mt-2 text-xs text-slate-400">
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
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="text-sm text-violet-300">{t("settings.eyebrow")}</p>
        <h3 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h3>
        <p className="mt-2 text-sm text-slate-400">{t("settings.subtitle")}</p>
      </div>

      {banner && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-800">
        {(["llm", "azure"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? "border-slate-700 bg-slate-900 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t(`settings.tab.${tab}`)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className={activeTab === "llm" ? "space-y-6" : "hidden"}>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-violet-300">LLM</p>
                <h4 className="text-xl font-semibold tracking-tight">{t("llm.title")}</h4>
                <p className="mt-2 text-sm text-slate-400">{t("llm.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleTestLlm()}
                className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/20"
              >
                {t("common.test")}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  {t("llm.provider")}
                </label>
                <select
                  value={form.llmProvider}
                  onChange={(event) => set("llmProvider", event.target.value)}
                  className={`${INPUT_CLASS} focus:border-violet-400`}
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
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    {t("llm.model")}
                  </label>
                  <input
                    type="text"
                    value={form.llmModel}
                    onChange={(event) => set("llmModel", event.target.value)}
                    placeholder="gpt-4.1-mini"
                    className={`${INPUT_CLASS} focus:border-violet-400`}
                  />
                  <p className="mt-2 text-xs text-slate-500">{t("llm.model_hint")}</p>
                </div>
              )}
              {visibleLlmFields.includes("endpoint") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    {t("llm.endpoint")}
                  </label>
                  <input
                    type="text"
                    value={form.llmEndpoint}
                    onChange={(event) => set("llmEndpoint", event.target.value)}
                    placeholder="https://mon-service.openai.azure.com"
                    className={`${INPUT_CLASS} focus:border-violet-400`}
                  />
                  <p className="mt-2 text-xs text-slate-500">{t("llm.endpoint_hint")}</p>
                </div>
              )}
              {visibleLlmFields.includes("deployment") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    {t("llm.deployment")}
                  </label>
                  <input
                    type="text"
                    value={form.llmDeployment}
                    onChange={(event) => set("llmDeployment", event.target.value)}
                    placeholder="mon-gpt4o-prod"
                    className={`${INPUT_CLASS} focus:border-violet-400`}
                  />
                  <p className="mt-2 text-xs text-slate-500">{t("llm.deployment_hint")}</p>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                {t("llm.api_key")}
              </label>
              <input
                type="password"
                value={form.llmApiKey}
                onChange={(event) => set("llmApiKey", event.target.value)}
                placeholder={t("llm.api_key_placeholder")}
                className={`${INPUT_CLASS} focus:border-violet-400`}
              />
              <p className="mt-2 text-xs text-slate-500">{keyHintText}</p>
            </div>

            <ConnectionResult result={llmTestResult} />
          </div>
        </section>

        <section className={activeTab === "azure" ? "space-y-6" : "hidden"}>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-violet-300">Azure DevOps</p>
                <h4 className="text-xl font-semibold tracking-tight">{t("azure.title")}</h4>
                <p className="mt-2 text-sm text-slate-400">{t("azure.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleTestAdo()}
                className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 hover:bg-blue-500/20"
              >
                {t("common.test")}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  {t("azure.org_url")}
                </label>
                <input
                  type="text"
                  value={form.adoOrgUrl}
                  onChange={(event) => set("adoOrgUrl", event.target.value)}
                  placeholder="https://dev.azure.com/myorg"
                  className={`${INPUT_CLASS} focus:border-blue-400`}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  {t("azure.project")}
                </label>
                <div className="flex gap-3">
                  <select
                    value={form.adoProject}
                    onChange={(event) => set("adoProject", event.target.value)}
                    className={`${INPUT_CLASS} focus:border-blue-400`}
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
                    className="whitespace-nowrap rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 hover:bg-blue-500/20 disabled:opacity-60"
                  >
                    {t("common.load")}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">{projectHint}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  {t("azure.pat")}
                </label>
                <input
                  type="password"
                  value={form.adoPat}
                  onChange={(event) => set("adoPat", event.target.value)}
                  placeholder={t("azure.pat_placeholder")}
                  className={`${INPUT_CLASS} focus:border-blue-400`}
                />
                <p className="mt-2 text-xs text-slate-500">{patHintText}</p>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.adoMockMode}
                  onChange={(event) => set("adoMockMode", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-400 focus:ring-blue-400"
                />
                {t("azure.mock_mode")}
              </label>
            </div>

            <ConnectionResult result={adoTestResult} />
          </div>
        </section>

        <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-400">{t("settings.secrets_note")}</p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
