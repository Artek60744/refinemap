async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const payload = await response.json();
            message = payload.detail || payload.error?.message || message;
        } catch (_error) {
            // Ignore JSON parse failure for error payloads.
        }
        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function renderSearchResults(items) {
    const container = document.getElementById("search-results");
    if (!container) {
        return;
    }

    if (!items.length) {
        container.innerHTML = `
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                ${window.t("js.no_work_item")}
            </div>
        `;
        return;
    }

    container.innerHTML = items
        .map(
            (item) => `
                <button type="button"
                        class="search-result-item block w-full rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left hover:border-violet-400/40 hover:bg-slate-900"
                        data-id="${item.id}">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-sm text-violet-300">${item.type} #${item.id}</p>
                            <h4 class="mt-1 text-base font-medium text-slate-100">${item.title}</h4>
                        </div>
                        <span class="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">${item.state || window.t("js.na")}</span>
                    </div>
                    <p class="mt-3 text-sm text-slate-400">${(item.tags || []).join(" • ")}</p>
                </button>
            `,
        )
        .join("");

    document.querySelectorAll(".search-result-item").forEach((element) => {
        element.addEventListener("click", () => selectWorkItem(element.dataset.id));
    });
}

async function selectWorkItem(workItemId) {
    const hiddenInput = document.getElementById("selected-work-item-id");
    hiddenInput.value = workItemId;

    const results = document.querySelectorAll(".search-result-item");
    results.forEach((item) => {
        item.classList.remove("border-emerald-400/50", "bg-emerald-500/10");
    });

    const active = Array.from(results).find((item) => item.dataset.id === workItemId);
    if (active) {
        active.classList.add("border-emerald-400/50", "bg-emerald-500/10");
    }
}

async function searchWorkItems() {
    const query = document.getElementById("work-item-search")?.value || "";
    const payload = await fetchJson(`/api/refinement/work-items/search?q=${encodeURIComponent(query)}&limit=10`);
    renderSearchResults(payload.items || []);
}

async function startSession(event) {
    event.preventDefault();

    const workItemId = document.getElementById("selected-work-item-id")?.value;
    if (!workItemId) {
        alert(window.t("js.select_work_item"));
        return;
    }

    const payload = {
        workItemId,
        extraContext: document.getElementById("extra-context")?.value || "",
        maxRounds: Number(document.getElementById("max-rounds")?.value || 3),
        maxQuestionsPerRound: Number(document.getElementById("max-questions")?.value || 6),
    };

    const response = await fetchJson("/api/refinement/sessions", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    window.location.href = `/refinement/sessions/${response.session.id}`;
}

async function submitAnswers(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const sessionId = form.dataset.sessionId;
    const textareas = form.querySelectorAll("textarea[name]");
    const answers = Array.from(textareas).map((textarea) => ({
        questionId: textarea.name,
        answer: textarea.value,
    }));

    const response = await fetchJson(`/api/refinement/sessions/${sessionId}/answers`, {
        method: "POST",
        body: JSON.stringify({ answers }),
    });

    if (response.finalArtifact) {
        window.location.reload();
        return;
    }

    window.location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
    const searchButton = document.getElementById("search-work-items");
    if (searchButton) {
        searchButton.addEventListener("click", async () => {
            try {
                await searchWorkItems();
            } catch (error) {
                const container = document.getElementById("search-results");
                const message = error.message || window.t("js.search_failed");
                if (container) {
                    container.innerHTML = `
                        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                            ${message}
                        </div>
                    `;
                } else {
                    alert(message);
                }
            }
        });
    }

    const startForm = document.getElementById("start-session-form");
    if (startForm) {
        startForm.addEventListener("submit", async (event) => {
            try {
                await startSession(event);
            } catch (error) {
                alert(error.message || window.t("js.session_create_failed"));
            }
        });
    }

    const answersForm = document.getElementById("answers-form");
    if (answersForm) {
        answersForm.addEventListener("submit", async (event) => {
            try {
                await submitAnswers(event);
            } catch (error) {
                alert(error.message || window.t("js.answers_submit_failed"));
            }
        });
    }
});
