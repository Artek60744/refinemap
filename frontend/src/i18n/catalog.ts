// UI translation catalog, ported from src/i18n.py (the api.*, ado.* and mock.*
// namespaces stay on the backend). Format: key -> [english, french].

export type Lang = "fr" | "en";

export const DEFAULT_LANGUAGE: Lang = "fr";
export const LANGUAGE_COOKIE = "lang";

export const SUPPORTED_LANGUAGES: Record<Lang, { flag: string; label: string }> = {
  fr: { flag: "🇫🇷", label: "Français" },
  en: { flag: "🇬🇧", label: "English" },
};

export const MESSAGES: Record<string, [en: string, fr: string]> = {
  // --- shell ---------------------------------------------------------------
  "app.name": ["Refinement Assistant", "Refinement Assistant"],
  "app.tagline": [
    "AI-assisted backlog refinement for Azure DevOps.",
    "Refinement de backlog assisté par IA pour Azure DevOps.",
  ],
  "nav.refinement": ["Refinement", "Refinement"],
  "nav.settings": ["Settings", "Paramètres"],
  "nav.health": ["Health", "Santé"],
  "header.eyebrow": ["Internal Tooling", "Outil interne"],
  "header.title": ["AI-assisted Refinement", "Refinement assisté par IA"],
  "lang.switch": ["Change language", "Changer de langue"],
  // --- shared --------------------------------------------------------------
  "common.test": ["Test", "Tester"],
  "common.save": ["Save", "Sauvegarder"],
  "common.load": ["Load", "Charger"],
  "common.na": ["N/A", "N/D"],
  "common.loading": ["Loading...", "Chargement..."],
  // --- settings page -------------------------------------------------------
  "settings.eyebrow": ["Configuration", "Configuration"],
  "settings.title": ["Connections and runtime", "Connexions et runtime"],
  "settings.subtitle": [
    "Configure the LLM provider and the Azure DevOps connection from the app.",
    "Configure le provider LLM et la connexion Azure DevOps depuis l'application.",
  ],
  "settings.secrets_note": [
    "Secrets are encrypted at rest. Leaving a secret field empty keeps the current value.",
    "Les secrets sont chiffrés en base. Laisser un champ secret vide conserve la valeur existante.",
  ],
  "settings.tab.llm": ["LLM", "LLM"],
  "settings.tab.azure": ["Azure DevOps", "Azure DevOps"],
  "settings.load_failed": ["Unable to load the settings.", "Impossible de charger les paramètres."],
  "settings.save_failed": ["Unable to save the settings.", "Impossible d'enregistrer les paramètres."],
  "llm.title": ["AI provider", "Provider IA"],
  "llm.subtitle": [
    "Mock by default, then Azure or OpenAI depending on your needs.",
    "Mock par défaut, puis Azure ou OpenAI selon tes besoins.",
  ],
  "llm.provider": ["Provider", "Provider"],
  "llm.model": ["Model", "Modèle"],
  "llm.model_hint": [
    "The model's public name at the provider.",
    "Nom public du modèle chez le provider.",
  ],
  "llm.endpoint": ["Endpoint", "Endpoint"],
  "llm.endpoint_hint": ["URL of your Azure resource.", "URL de ta ressource Azure."],
  "llm.deployment": ["Deployment", "Deployment"],
  "llm.deployment_hint": [
    "Azure-specific: the name you gave the model deployment in Azure AI Foundry / " +
      "Azure OpenAI (Deployments). That name, not the model's, goes into the call URL.",
    "Spécifique à Azure : le nom que tu as donné au déploiement du modèle dans Azure AI " +
      "Foundry / Azure OpenAI (Deployments). C'est ce nom, pas celui du modèle, qui va dans l'URL d'appel.",
  ],
  "llm.api_key": ["API key", "Clé API"],
  "llm.api_key_placeholder": [
    "Leave empty to keep the current key",
    "Laisser vide pour conserver la clé existante",
  ],
  "llm.key_configured": ["Key configured {hint}", "Clé configurée {hint}"],
  "llm.no_key": ["No key configured", "Aucune clé configurée"],
  "llm.test_failed": ["LLM test failed.", "Le test LLM a échoué."],
  "azure.title": ["Azure DevOps connection", "Connexion Azure DevOps"],
  "azure.subtitle": [
    "Organization URL, project, PAT, and mock mode for the local fallback.",
    "URL d'organisation, projet, PAT, et mode mock pour le fallback local.",
  ],
  "azure.org_url": ["Organization URL", "URL d'organisation"],
  "azure.project": ["Project", "Projet"],
  "azure.project_placeholder": ["-- Load the projects --", "-- Charger les projets --"],
  "azure.project_hint": [
    "Fill in the organization URL and the PAT, then click Load to list the projects.",
    "Renseigne l'URL d'organisation et le PAT, puis clique sur Charger pour lister les projets.",
  ],
  "azure.pat": ["PAT", "PAT"],
  "azure.pat_placeholder": [
    "Leave empty to keep the current PAT",
    "Laisser vide pour conserver le PAT existant",
  ],
  "azure.mock_mode": ["Use the local mock mode", "Utiliser le mode mock local"],
  "azure.pat_configured": ["PAT configured {hint}", "PAT configuré {hint}"],
  "azure.no_pat": ["No PAT configured", "Aucun PAT configuré"],
  "azure.loading_projects": ["Loading the projects...", "Chargement des projets..."],
  "azure.projects_failed": ["Unable to list the projects.", "Impossible de lister les projets."],
  "azure.test_failed": ["Azure DevOps test failed.", "Le test Azure DevOps a échoué."],
  // --- refinement home -----------------------------------------------------
  "home.heading": ["Refine Your Intent", "Affine ton idée"],
  "home.subheading": [
    "From a vague idea to an actionable subject in 15 minutes",
    "Passe d'une idée floue à un sujet exploitable en 15 minutes",
  ],
  "home.search_section": ["Find work item", "Recherche work item"],
  "home.context_section": ["Extra context", "Contexte bonus"],
  "home.eyebrow": ["Selection", "Sélection"],
  "home.title": ["Pick a work item", "Choisir un work item"],
  "home.subtitle": [
    "Azure DevOps search, in mock mode by default. You can plug the real provider in later " +
      "without touching the UI.",
    "Recherche Azure DevOps, en mode mock par défaut. Tu peux brancher le provider réel plus tard " +
      "sans changer l'UI.",
  ],
  "home.search_label": ["Search a ticket", "Recherche ticket"],
  "home.search_placeholder": [
    "e.g., 'Set up user secrets management (KV)'",
    "Ex : 'Mettre en place du gardien des secrets (KV) utilisateurs'",
  ],
  "home.search_button": ["Search", "Chercher"],
  "home.refine_context": ["Refinement context", "Contexte de refinement"],
  "home.extra_context": ["Extra context", "Contexte bonus"],
  "home.extra_context_placeholder": [
    "Add what the team already knows, informal notes, suspected impacts, or angles worth digging into.",
    "Ajoute ce que l'équipe sait déjà, des notes informelles, des impacts suspectés, ou des angles à creuser.",
  ],
  "home.max_rounds": ["Max rounds", "Rounds max"],
  "home.max_questions": ["Questions / round", "Questions / round"],
  "home.submit": ["Refine", "Refiner"],
  "home.no_results": ["No work item found.", "Aucun work item trouvé."],
  "home.search_failed": ["Search failed.", "Recherche impossible."],
  "home.select_work_item": [
    "Select a work item before starting the refinement.",
    "Sélectionne un work item avant de lancer le refinement.",
  ],
  "home.session_create_failed": ["Unable to create the session.", "Création de session impossible."],
  "home.workflow.eyebrow": ["Workflow", "Workflow"],
  "home.workflow.title": ["What the MVP does", "Ce que fait le MVP"],
  "home.workflow.step1": [
    "1. Load an existing Azure DevOps work item.",
    "1. Charge un work item Azure DevOps existant.",
  ],
  "home.workflow.step2": [
    "2. Generate a first batch of technical, data, CI/CD and validation questions.",
    "2. Génère une première salve de questions techniques, data, CI/CD et validation.",
  ],
  "home.workflow.step3": [
    "3. Take the answers in and loop while the context is insufficient.",
    "3. Reprend les réponses et boucle tant que le contexte est insuffisant.",
  ],
  "home.workflow.step4": [
    "4. Produce a final refinement with a proposed split, acceptance criteria and watch points.",
    "4. Produit un refinement final avec split proposé, critères d'acceptation et points d'attention.",
  ],
  "home.workflow.note": [
    "The AzDO provider and the LLM engine are pluggable. The current mode runs the flow end to end " +
      "right away.",
    "Le provider AzDO et le moteur LLM sont branchables. Le mode actuel sert à faire tourner le flux " +
      "bout en bout immédiatement.",
  ],
  // --- work item card ------------------------------------------------------
  "card.eyebrow": ["Source context", "Contexte source"],
  "card.description": ["Description", "Description"],
  "card.existing_ac": ["Existing AC", "AC existants"],
  "card.state": ["State", "État"],
  "card.area": ["Area", "Area"],
  "card.iteration": ["Iteration", "Iteration"],
  // --- session page --------------------------------------------------------
  "session.title": ["Refinement Session", "Session de refinement"],
  "session.round": ["Round", "Round"],
  "session.status": ["Status", "Statut"],
  "session.view_final": ["View the final refinement", "Voir le refinement final"],
  "session.questions": ["Questions", "Questions"],
  "session.current_round": ["Current round", "Round en cours"],
  "session.result_eyebrow": ["Result", "Résultat"],
  "session.result_title": ["Final refinement available", "Refinement final disponible"],
  "session.export_markdown": ["Export as markdown", "Exporter en markdown"],
  "session.answer_placeholder": [
    "Team answer, assumptions, trade-offs, links or constraints...",
    "Réponse équipe, hypothèses, arbitrages, liens ou contraintes...",
  ],
  "session.submit_answers": ["Submit the answers", "Soumettre les réponses"],
  "session.no_round": [
    "No question round open at the moment.",
    "Aucun round de question ouvert pour le moment.",
  ],
  "session.analyzing_wait": [
    "The assistant is analyzing the answers, this can take a moment...",
    "L'assistant analyse les réponses, cela peut prendre un moment...",
  ],
  "session.answers_submit_failed": [
    "Unable to submit the answers.",
    "Soumission des réponses impossible.",
  ],
  // --- summary -------------------------------------------------------------
  "summary.eyebrow": ["Synthesis", "Synthèse"],
  "summary.title": ["Context state", "État du contexte"],
  "summary.reason": ["Reason", "Raison"],
  "summary.facts": ["Facts", "Faits"],
  "summary.assumptions": ["Assumptions", "Hypothèses"],
  "summary.unknowns": ["Unknowns", "Inconnues"],
  "summary.dependencies": ["Dependencies", "Dépendances"],
  "summary.risks": ["Risks", "Risques"],
  "summary.no_facts": ["No fact captured.", "Aucun fait capturé."],
  "summary.no_assumptions": ["No explicit assumption.", "Aucune hypothèse explicite."],
  "summary.no_unknowns": ["No grey area left.", "Aucune zone floue restante."],
  "summary.no_dependencies": ["No dependency identified.", "Aucune dépendance identifiée."],
  "summary.no_risks": ["No major risk identified.", "Aucun risque majeur identifié."],
  // --- final artifact ------------------------------------------------------
  "result.eyebrow": ["Final result", "Résultat final"],
  "result.title": ["Refinement Result", "Résultat du refinement"],
  "result.back": ["Back to session", "Retour session"],
  "result.not_available": [
    "The final refinement is not available for this session yet.",
    "Le refinement final n'est pas encore disponible pour cette session.",
  ],
  "artifact.summary": ["Summary", "Synthèse"],
  "artifact.in_scope": ["In scope", "Dans le scope"],
  "artifact.out_of_scope": ["Out of scope", "Hors scope"],
  "artifact.proposed_split": ["Proposed split", "Split proposé"],
  "artifact.story_count": ["{count} proposed sub-stories", "{count} sous-stories proposées"],
  "artifact.acceptance_criteria": ["Acceptance criteria", "Critères d'acceptation"],
  "artifact.technical_notes": ["Technical notes", "Notes techniques"],
  "artifact.no_technical_notes": [
    "No extra technical note.",
    "Aucune note technique supplémentaire.",
  ],
  "artifact.dependencies": ["Dependencies", "Dépendances"],
  "artifact.no_dependencies": ["No dependency identified.", "Aucune dépendance identifiée."],
  "artifact.risks": ["Risks", "Risques"],
  "artifact.no_risks": ["No risk identified.", "Aucun risque identifié."],
  "artifact.known_facts": ["Known facts", "Faits connus"],
  "artifact.no_known_facts": ["No explicit fact captured.", "Aucun fait explicite capturé."],
  "artifact.assumptions": ["Assumptions", "Hypothèses"],
  "artifact.no_assumptions": ["No assumption left.", "Aucune hypothèse restante."],
  "artifact.cross_cutting": ["Cross-cutting concerns", "Points transverses"],
  "artifact.concern.testing": ["Testing", "Tests"],
  "artifact.concern.cicd": ["CI/CD", "CI/CD"],
  "artifact.concern.infra": ["Infra", "Infra"],
  "artifact.concern.data": ["Data", "Data"],
  "artifact.concern.security": ["Security", "Sécurité"],
  "artifact.concern.observability": ["Observability", "Observabilité"],
  "artifact.no_item": ["No item.", "Aucun point."],
  "artifact.delivery_plan": ["Delivery plan", "Plan de livraison"],
  "artifact.recommended_order": ["Recommended order", "Ordre recommandé"],
  "artifact.milestones": ["Milestones", "Jalons"],
  "artifact.open_questions": ["Open questions", "Questions ouvertes"],
  "artifact.no_open_questions": ["No open question.", "Aucune question ouverte."],
  // --- enum labels rendered from stored values -----------------------------
  "status.draft": ["Draft", "Brouillon"],
  "status.questioning": ["Questioning", "Questions en cours"],
  "status.analyzing": ["Analyzing", "Analyse en cours"],
  "status.final_ready": ["Final ready", "Refinement prêt"],
  "status.open": ["Open", "Ouvert"],
  "status.answered": ["Answered", "Répondu"],
  "priority.high": ["High", "Haute"],
  "priority.medium": ["Medium", "Moyenne"],
  "priority.low": ["Low", "Basse"],
  "confidence.high": ["High confidence", "Confiance haute"],
  "confidence.medium": ["Medium confidence", "Confiance moyenne"],
  "confidence.low": ["Low confidence", "Confiance basse"],
  "theme.data": ["Data", "Data"],
  "theme.testing": ["Testing", "Tests"],
  "theme.cicd": ["CI/CD", "CI/CD"],
  "theme.infra": ["Infra", "Infra"],
  "theme.security": ["Security", "Sécurité"],
  "theme.observability": ["Observability", "Observabilité"],
  "theme.dependencies": ["Dependencies", "Dépendances"],
  "theme.functional": ["Functional", "Fonctionnel"],
  "theme.technical": ["Technical", "Technique"],
};
