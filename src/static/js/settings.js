async function settingsFetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || `HTTP ${response.status}`);
    }

    return payload;
}

function setBanner(message, kind = "info") {
    const banner = document.getElementById("settings-status-banner");
    if (!banner) {
        return;
    }

    banner.classList.remove("hidden", "border-emerald-500/30", "bg-emerald-500/10", "text-emerald-200", "border-rose-500/30", "bg-rose-500/10", "text-rose-200", "border-slate-700", "bg-slate-900", "text-slate-200");
    if (kind === "success") {
        banner.classList.add("border-emerald-500/30", "bg-emerald-500/10", "text-emerald-200");
    } else if (kind === "error") {
        banner.classList.add("border-rose-500/30", "bg-rose-500/10", "text-rose-200");
    } else {
        banner.classList.add("border-slate-700", "bg-slate-900", "text-slate-200");
    }
    banner.textContent = message;
}

function renderConnectionResult(targetId, payload) {
    const target = document.getElementById(targetId);
    if (!target) {
        return;
    }

    const color = payload.success ? "text-emerald-300" : "text-rose-300";
    const details = payload.details && Object.keys(payload.details).length
        ? `<div class="mt-2 text-xs text-slate-400">${Object.entries(payload.details).map(([key, value]) => `${key}: ${value}`).join(" • ")}</div>`
        : "";

    target.innerHTML = `<div class="${color}">${payload.message}</div>${details}`;
}

function switchSettingsTab(target) {
    document.querySelectorAll(".settings-tab").forEach((button) => {
        const active = button.dataset.target === target;
        button.classList.toggle("border-slate-700", active);
        button.classList.toggle("bg-slate-900", active);
        button.classList.toggle("text-slate-100", active);
        button.classList.toggle("border-transparent", !active);
        button.classList.toggle("text-slate-400", !active);
    });

    document.querySelectorAll(".settings-panel").forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== `tab-${target}`);
    });
}

// Endpoint + deployment only exist for the Azure-hosted providers; the plain
// API providers are addressed by model name instead.
const LLM_FIELDS_BY_PROVIDER = {
    mock: [],
    "azure-foundry": ["endpoint", "deployment"],
    "azure-openai": ["endpoint", "deployment"],
    openai: ["model"],
    openrouter: ["model"],
};

function applyLlmProviderVisibility() {
    const provider = document.getElementById("llm-provider")?.value || "mock";
    const visible = LLM_FIELDS_BY_PROVIDER[provider] || ["model"];
    document.querySelectorAll("[data-llm-field]").forEach((element) => {
        element.classList.toggle("hidden", !visible.includes(element.dataset.llmField));
    });
}

function setProjectOptions(projects, selected) {
    const select = document.getElementById("ado-project");
    if (!select) {
        return;
    }

    const names = projects.map((project) => project.name);
    if (selected && !names.includes(selected)) {
        names.unshift(selected);
    }

    select.innerHTML = names.length
        ? names.map((name) => `<option value="${name}">${name}</option>`).join("")
        : `<option value="">${window.t("js.project_placeholder")}</option>`;
    select.value = selected || names[0] || "";
}

async function loadAdoProjects({ silent = false } = {}) {
    const hint = document.getElementById("ado-project-hint");
    const button = document.getElementById("load-ado-projects-btn");
    const selected = document.getElementById("ado-project")?.value || "";

    if (hint) {
        hint.textContent = window.t("js.loading_projects");
    }
    if (button) {
        button.disabled = true;
    }

    try {
        const response = await settingsFetchJson("/api/settings/azure-devops/projects", {
            method: "POST",
            body: JSON.stringify({
                orgUrl: document.getElementById("ado-org-url").value,
                pat: document.getElementById("ado-pat").value,
            }),
        });

        if (hint) {
            hint.textContent = response.message;
        }

        if (!response.success) {
            // The failure reason matters here, so it goes where the test result
            // is shown rather than staying in the small hint line.
            if (!silent) {
                renderConnectionResult("ado-test-result", response);
            }
            return;
        }

        setProjectOptions(response.projects || [], selected);
    } catch (error) {
        const message = error.message || window.t("js.projects_failed");
        if (hint) {
            hint.textContent = message;
        }
        if (!silent) {
            renderConnectionResult("ado-test-result", { success: false, message, details: {} });
        }
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

function fillSettingsForm(settings) {
    document.getElementById("llm-provider").value = settings.llm.provider || "mock";
    document.getElementById("llm-endpoint").value = settings.llm.endpoint || "";
    document.getElementById("llm-deployment").value = settings.llm.deployment || "";
    document.getElementById("llm-model").value = settings.llm.model || "";
    document.getElementById("llm-key-hint").textContent = settings.llm.keyConfigured ? window.t("js.key_configured", { hint: settings.llm.keyHint || '' }) : window.t("js.no_key");
    applyLlmProviderVisibility();

    document.getElementById("ado-org-url").value = settings.azureDevOps.orgUrl || "";
    document.getElementById("ado-mock-mode").checked = !!settings.azureDevOps.mockMode;
    document.getElementById("ado-pat-hint").textContent = settings.azureDevOps.patConfigured ? window.t("js.pat_configured", { hint: settings.azureDevOps.patHint || '' }) : window.t("js.no_pat");
    setProjectOptions([], settings.azureDevOps.project || "");
}

async function loadSettingsPage() {
    const form = document.getElementById("settings-form");
    if (!form) {
        return;
    }

    const payload = await settingsFetchJson("/api/settings");
    fillSettingsForm(payload);

    // Populate the project list right away when the stored credentials allow it.
    if (payload.azureDevOps.orgUrl && payload.azureDevOps.patConfigured) {
        await loadAdoProjects({ silent: true });
    }
}

function collectSettingsPayload() {
    return {
        llmProvider: document.getElementById("llm-provider").value,
        llmEndpoint: document.getElementById("llm-endpoint").value,
        llmApiKey: document.getElementById("llm-api-key").value,
        llmDeployment: document.getElementById("llm-deployment").value,
        llmModel: document.getElementById("llm-model").value,
        adoOrgUrl: document.getElementById("ado-org-url").value,
        adoProject: document.getElementById("ado-project").value,
        adoPat: document.getElementById("ado-pat").value,
        adoMockMode: document.getElementById("ado-mock-mode").checked,
    };
}

async function saveSettings(event) {
    event.preventDefault();
    const payload = collectSettingsPayload();
    const response = await settingsFetchJson("/api/settings", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    fillSettingsForm(response.settings);
    document.getElementById("llm-api-key").value = "";
    document.getElementById("ado-pat").value = "";
    setBanner(response.message, "success");
}

async function testLlmConnection() {
    const payload = {
        provider: document.getElementById("llm-provider").value,
        endpoint: document.getElementById("llm-endpoint").value,
        deployment: document.getElementById("llm-deployment").value,
        model: document.getElementById("llm-model").value,
        apiKey: document.getElementById("llm-api-key").value,
    };
    const response = await settingsFetchJson("/api/settings/test/llm", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    renderConnectionResult("llm-test-result", response);
}

async function testAdoConnection() {
    const payload = {
        orgUrl: document.getElementById("ado-org-url").value,
        project: document.getElementById("ado-project").value,
        pat: document.getElementById("ado-pat").value,
        mockMode: document.getElementById("ado-mock-mode").checked,
    };
    const response = await settingsFetchJson("/api/settings/test/azure-devops", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    renderConnectionResult("ado-test-result", response);
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".settings-tab").forEach((button) => {
        button.addEventListener("click", () => switchSettingsTab(button.dataset.target));
    });

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        loadSettingsPage().catch((error) => setBanner(error.message || window.t("js.settings_load_failed"), "error"));
        settingsForm.addEventListener("submit", async (event) => {
            try {
                await saveSettings(event);
            } catch (error) {
                setBanner(error.message || window.t("js.settings_save_failed"), "error");
            }
        });

        document.getElementById("test-llm-btn")?.addEventListener("click", async () => {
            try {
                await testLlmConnection();
            } catch (error) {
                renderConnectionResult("llm-test-result", { success: false, message: error.message || window.t("js.llm_test_failed"), details: {} });
            }
        });

        document.getElementById("test-ado-btn")?.addEventListener("click", async () => {
            try {
                await testAdoConnection();
            } catch (error) {
                renderConnectionResult("ado-test-result", { success: false, message: error.message || window.t("js.ado_test_failed"), details: {} });
            }
        });

        document.getElementById("load-ado-projects-btn")?.addEventListener("click", () => loadAdoProjects());
        document.getElementById("llm-provider")?.addEventListener("change", applyLlmProviderVisibility);
    }
});
