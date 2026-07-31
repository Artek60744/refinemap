"""Minimal translation layer for the UI, the JS strings and the API messages.

The active language lives in a ContextVar set once per request by middleware, so
templates, services and exception messages can all call `t()` without threading a
`lang` argument through every signature.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar

from fastapi import Request

logger = logging.getLogger(__name__)

DEFAULT_LANGUAGE = "fr"
LANGUAGE_COOKIE = "lang"

SUPPORTED_LANGUAGES: dict[str, dict[str, str]] = {
    "fr": {"flag": "🇫🇷", "label": "Français"},
    "en": {"flag": "🇬🇧", "label": "English"},
}

# key: (english, french)
_MESSAGES: dict[str, tuple[str, str]] = {
    # --- shell -------------------------------------------------------------
    "app.name": ("Refinement Assistant", "Refinement Assistant"),
    "app.tagline": (
        "AI-assisted backlog refinement for Azure DevOps.",
        "Refinement de backlog assisté par IA pour Azure DevOps.",
    ),
    "nav.refinement": ("Refinement", "Refinement"),
    "nav.settings": ("Settings", "Paramètres"),
    "nav.health": ("Health", "Santé"),
    "header.eyebrow": ("Internal Tooling", "Outil interne"),
    "header.title": ("AI-assisted Refinement", "Refinement assisté par IA"),
    "lang.switch": ("Change language", "Changer de langue"),
    # --- shared ------------------------------------------------------------
    "common.test": ("Test", "Tester"),
    "common.save": ("Save", "Sauvegarder"),
    "common.load": ("Load", "Charger"),
    "common.na": ("N/A", "N/D"),
    # --- settings page -----------------------------------------------------
    "settings.eyebrow": ("Configuration", "Configuration"),
    "settings.title": ("Connections and runtime", "Connexions et runtime"),
    "settings.subtitle": (
        "Configure the LLM provider and the Azure DevOps connection from the app.",
        "Configure le provider LLM et la connexion Azure DevOps depuis l'application.",
    ),
    "settings.secrets_note": (
        "Secrets are encrypted at rest. Leaving a secret field empty keeps the current value.",
        "Les secrets sont chiffrés en base. Laisser un champ secret vide conserve la valeur existante.",
    ),
    "settings.tab.llm": ("LLM", "LLM"),
    "settings.tab.azure": ("Azure DevOps", "Azure DevOps"),
    "llm.title": ("AI provider", "Provider IA"),
    "llm.subtitle": (
        "Mock by default, then Azure or OpenAI depending on your needs.",
        "Mock par défaut, puis Azure ou OpenAI selon tes besoins.",
    ),
    "llm.provider": ("Provider", "Provider"),
    "llm.model": ("Model", "Modèle"),
    "llm.model_hint": (
        "The model's public name at the provider.",
        "Nom public du modèle chez le provider.",
    ),
    "llm.endpoint": ("Endpoint", "Endpoint"),
    "llm.endpoint_hint": ("URL of your Azure resource.", "URL de ta ressource Azure."),
    "llm.deployment": ("Deployment", "Deployment"),
    "llm.deployment_hint": (
        "Azure-specific: the name <em>you</em> gave the model deployment in Azure AI Foundry / "
        "Azure OpenAI (Deployments). That name, not the model's, goes into the call URL.",
        "Spécifique à Azure : le nom que <em>tu</em> as donné au déploiement du modèle dans Azure AI "
        "Foundry / Azure OpenAI (Deployments). C'est ce nom, pas celui du modèle, qui va dans l'URL d'appel.",
    ),
    "llm.api_key": ("API key", "Clé API"),
    "llm.api_key_placeholder": (
        "Leave empty to keep the current key",
        "Laisser vide pour conserver la clé existante",
    ),
    "azure.title": ("Azure DevOps connection", "Connexion Azure DevOps"),
    "azure.subtitle": (
        "Organization URL, project, PAT, and mock mode for the local fallback.",
        "URL d'organisation, projet, PAT, et mode mock pour le fallback local.",
    ),
    "azure.org_url": ("Organization URL", "URL d'organisation"),
    "azure.project": ("Project", "Projet"),
    "azure.project_placeholder": ("-- Load the projects --", "-- Charger les projets --"),
    "azure.project_hint": (
        "Fill in the organization URL and the PAT, then click Load to list the projects.",
        "Renseigne l'URL d'organisation et le PAT, puis clique sur Charger pour lister les projets.",
    ),
    "azure.pat": ("PAT", "PAT"),
    "azure.pat_placeholder": (
        "Leave empty to keep the current PAT",
        "Laisser vide pour conserver le PAT existant",
    ),
    "azure.mock_mode": ("Use the local mock mode", "Utiliser le mode mock local"),
    # --- refinement home ---------------------------------------------------
    "home.eyebrow": ("Selection", "Sélection"),
    "home.title": ("Pick a work item", "Choisir un work item"),
    "home.subtitle": (
        "Azure DevOps search, in mock mode by default. You can plug the real provider in later "
        "without touching the UI.",
        "Recherche Azure DevOps, en mode mock par défaut. Tu peux brancher le provider réel plus tard "
        "sans changer l'UI.",
    ),
    "home.search_label": ("Search a ticket", "Recherche ticket"),
    "home.search_placeholder": (
        "e.g. database Playwright API, or a work item id",
        "Ex : database Playwright API, ou un id de work item",
    ),
    "home.search_button": ("Search", "Chercher"),
    "home.extra_context": ("Extra context", "Contexte bonus"),
    "home.extra_context_placeholder": (
        "Add what the team already knows, informal notes, suspected impacts, or angles worth digging into.",
        "Ajoute ce que l'équipe sait déjà, des notes informelles, des impacts suspectés, ou des angles à creuser.",
    ),
    "home.max_rounds": ("Max rounds", "Rounds max"),
    "home.max_questions": ("Questions / round", "Questions / round"),
    "home.submit": ("Refine", "Refiner"),
    "home.workflow.eyebrow": ("Workflow", "Workflow"),
    "home.workflow.title": ("What the MVP does", "Ce que fait le MVP"),
    "home.workflow.step1": (
        "1. Load an existing Azure DevOps work item.",
        "1. Charge un work item Azure DevOps existant.",
    ),
    "home.workflow.step2": (
        "2. Generate a first batch of technical, data, CI/CD and validation questions.",
        "2. Génère une première salve de questions techniques, data, CI/CD et validation.",
    ),
    "home.workflow.step3": (
        "3. Take the answers in and loop while the context is insufficient.",
        "3. Reprend les réponses et boucle tant que le contexte est insuffisant.",
    ),
    "home.workflow.step4": (
        "4. Produce a final refinement with a proposed split, acceptance criteria and watch points.",
        "4. Produit un refinement final avec split proposé, critères d'acceptation et points d'attention.",
    ),
    "home.workflow.note": (
        "The AzDO provider and the LLM engine are pluggable. The current mode runs the flow end to end "
        "right away.",
        "Le provider AzDO et le moteur LLM sont branchables. Le mode actuel sert à faire tourner le flux "
        "bout en bout immédiatement.",
    ),
    # --- work item card ----------------------------------------------------
    "card.eyebrow": ("Source context", "Contexte source"),
    "card.description": ("Description", "Description"),
    "card.existing_ac": ("Existing AC", "AC existants"),
    "card.state": ("State", "État"),
    "card.area": ("Area", "Area"),
    "card.iteration": ("Iteration", "Iteration"),
    # --- session page ------------------------------------------------------
    "session.title": ("Refinement Session", "Session de refinement"),
    "session.round": ("Round", "Round"),
    "session.status": ("Status", "Statut"),
    "session.view_final": ("View the final refinement", "Voir le refinement final"),
    "session.questions": ("Questions", "Questions"),
    "session.current_round": ("Current round", "Round en cours"),
    "session.result_eyebrow": ("Result", "Résultat"),
    "session.result_title": ("Final refinement available", "Refinement final disponible"),
    "session.export_markdown": ("Export as markdown", "Exporter en markdown"),
    "session.answer_placeholder": (
        "Team answer, assumptions, trade-offs, links or constraints...",
        "Réponse équipe, hypothèses, arbitrages, liens ou contraintes...",
    ),
    "session.submit_answers": ("Submit the answers", "Soumettre les réponses"),
    "session.no_round": (
        "No question round open at the moment.",
        "Aucun round de question ouvert pour le moment.",
    ),
    # --- summary -----------------------------------------------------------
    "summary.eyebrow": ("Synthesis", "Synthèse"),
    "summary.title": ("Context state", "État du contexte"),
    "summary.reason": ("Reason", "Raison"),
    "summary.facts": ("Facts", "Faits"),
    "summary.assumptions": ("Assumptions", "Hypothèses"),
    "summary.unknowns": ("Unknowns", "Inconnues"),
    "summary.dependencies": ("Dependencies", "Dépendances"),
    "summary.risks": ("Risks", "Risques"),
    "summary.no_facts": ("No fact captured.", "Aucun fait capturé."),
    "summary.no_assumptions": ("No explicit assumption.", "Aucune hypothèse explicite."),
    "summary.no_unknowns": ("No grey area left.", "Aucune zone floue restante."),
    "summary.no_dependencies": ("No dependency identified.", "Aucune dépendance identifiée."),
    "summary.no_risks": ("No major risk identified.", "Aucun risque majeur identifié."),
    # --- final artifact ----------------------------------------------------
    "result.eyebrow": ("Final result", "Résultat final"),
    "result.title": ("Refinement Result", "Résultat du refinement"),
    "result.back": ("Back to session", "Retour session"),
    "result.not_available": (
        "The final refinement is not available for this session yet.",
        "Le refinement final n'est pas encore disponible pour cette session.",
    ),
    "artifact.summary": ("Summary", "Synthèse"),
    "artifact.in_scope": ("In scope", "Dans le scope"),
    "artifact.out_of_scope": ("Out of scope", "Hors scope"),
    "artifact.proposed_split": ("Proposed split", "Split proposé"),
    "artifact.story_count": ("{count} proposed sub-stories", "{count} sous-stories proposées"),
    "artifact.acceptance_criteria": ("Acceptance criteria", "Critères d'acceptation"),
    "artifact.technical_notes": ("Technical notes", "Notes techniques"),
    "artifact.no_technical_notes": (
        "No extra technical note.",
        "Aucune note technique supplémentaire.",
    ),
    "artifact.known_facts": ("Known facts", "Faits connus"),
    "artifact.no_known_facts": ("No explicit fact captured.", "Aucun fait explicite capturé."),
    "artifact.assumptions": ("Assumptions", "Hypothèses"),
    "artifact.no_assumptions": ("No assumption left.", "Aucune hypothèse restante."),
    "artifact.cross_cutting": ("Cross-cutting concerns", "Points transverses"),
    "artifact.concern.testing": ("Testing", "Tests"),
    "artifact.concern.cicd": ("CI/CD", "CI/CD"),
    "artifact.concern.infra": ("Infra", "Infra"),
    "artifact.concern.data": ("Data", "Data"),
    "artifact.concern.security": ("Security", "Sécurité"),
    "artifact.concern.observability": ("Observability", "Observabilité"),
    "artifact.no_item": ("No item.", "Aucun point."),
    "artifact.delivery_plan": ("Delivery plan", "Plan de livraison"),
    "artifact.recommended_order": ("Recommended order", "Ordre recommandé"),
    "artifact.milestones": ("Milestones", "Jalons"),
    "artifact.open_questions": ("Open questions", "Questions ouvertes"),
    "artifact.no_open_questions": ("No open question.", "Aucune question ouverte."),
    # --- enum labels rendered from stored values ---------------------------
    "status.draft": ("Draft", "Brouillon"),
    "status.questioning": ("Questioning", "Questions en cours"),
    "status.analyzing": ("Analyzing", "Analyse en cours"),
    "status.final_ready": ("Final ready", "Refinement prêt"),
    "status.open": ("Open", "Ouvert"),
    "status.answered": ("Answered", "Répondu"),
    "priority.high": ("High", "Haute"),
    "priority.medium": ("Medium", "Moyenne"),
    "priority.low": ("Low", "Basse"),
    "confidence.high": ("High confidence", "Confiance haute"),
    "confidence.medium": ("Medium confidence", "Confiance moyenne"),
    "confidence.low": ("Low confidence", "Confiance basse"),
    "theme.data": ("Data", "Data"),
    "theme.testing": ("Testing", "Tests"),
    "theme.cicd": ("CI/CD", "CI/CD"),
    "theme.infra": ("Infra", "Infra"),
    "theme.security": ("Security", "Sécurité"),
    "theme.observability": ("Observability", "Observabilité"),
    "theme.dependencies": ("Dependencies", "Dépendances"),
    "theme.functional": ("Functional", "Fonctionnel"),
    "theme.technical": ("Technical", "Technique"),
    # --- javascript --------------------------------------------------------
    "js.no_work_item": ("No work item found.", "Aucun work item trouvé."),
    "js.search_failed": ("Search failed.", "Recherche impossible."),
    "js.select_work_item": (
        "Select a work item before starting the refinement.",
        "Sélectionne un work item avant de lancer le refinement.",
    ),
    "js.loading_projects": ("Loading the projects...", "Chargement des projets..."),
    "js.projects_failed": ("Unable to list the projects.", "Impossible de lister les projets."),
    "js.settings_load_failed": ("Unable to load the settings.", "Impossible de charger les paramètres."),
    "js.settings_save_failed": ("Unable to save the settings.", "Impossible d'enregistrer les paramètres."),
    "js.llm_test_failed": ("LLM test failed.", "Le test LLM a échoué."),
    "js.ado_test_failed": ("Azure DevOps test failed.", "Le test Azure DevOps a échoué."),
    "js.key_configured": ("Key configured {hint}", "Clé configurée {hint}"),
    "js.no_key": ("No key configured", "Aucune clé configurée"),
    "js.pat_configured": ("PAT configured {hint}", "PAT configuré {hint}"),
    "js.no_pat": ("No PAT configured", "Aucun PAT configuré"),
    "js.na": ("N/A", "N/D"),
    "js.project_placeholder": ("-- Load the projects --", "-- Charger les projets --"),
    "js.session_create_failed": ("Unable to create the session.", "Création de session impossible."),
    "js.answers_submit_failed": (
        "Unable to submit the answers.",
        "Soumission des réponses impossible.",
    ),
    # --- api / services ----------------------------------------------------
    "api.settings_saved": ("Settings saved successfully.", "Paramètres enregistrés."),
    "api.mock_llm": (
        "Mock LLM mode is enabled. The local refinement engine is active.",
        "Mode LLM mock actif. Le moteur de refinement local est utilisé.",
    ),
    "api.llm_missing": ("Missing LLM configuration: {fields}.", "Configuration LLM incomplète : {fields}."),
    "api.llm_ready": (
        "Configuration appears complete. Live provider invocation is not wired in this MVP yet.",
        "La configuration semble complète. L'appel réel au provider n'est pas encore branché dans ce MVP.",
    ),
    "api.llm_unsupported": ("Unsupported LLM provider: {provider}", "Provider LLM non supporté : {provider}"),
    "api.field.api_key": ("api key", "clé api"),
    "api.field.endpoint": ("endpoint", "endpoint"),
    "api.field.deployment": ("deployment", "deployment"),
    "api.field.model": ("model", "modèle"),
    "api.mock_mode_on": (
        "Mock mode is enabled. Azure DevOps calls will use local seed data.",
        "Mode mock actif. Les appels Azure DevOps utiliseront les données locales.",
    ),
    "api.org_url_missing": ("Organization URL not configured.", "URL d'organisation non configurée."),
    "api.project_missing": ("Project not configured.", "Projet non configuré."),
    "api.pat_missing": ("PAT not configured.", "PAT non configuré."),
    "api.org_url_hint": (
        "Organization URL not configured — fill it in above, then click Load.",
        "URL d'organisation non configurée — renseigne-la ci-dessus, puis clique sur Charger.",
    ),
    "api.pat_hint": (
        "PAT not configured — fill it in above, then click Load.",
        "PAT non configuré — renseigne-le ci-dessus, puis clique sur Charger.",
    ),
    "api.ado_ok": (
        "Azure DevOps connection successful on project '{project}'.",
        "Connexion Azure DevOps réussie sur le projet '{project}'.",
    ),
    "api.ado_project_invisible": (
        "Connected, but project '{project}' is not visible with this PAT.",
        "Connexion établie, mais le projet '{project}' n'est pas visible avec ce PAT.",
    ),
    "api.ado_failed": ("Azure DevOps connection failed: {error}", "Échec de connexion Azure DevOps : {error}"),
    "api.projects_found": ("{count} project(s) found.", "{count} projet(s) trouvé(s)."),
    "api.projects_failed": ("Unable to list the projects: {error}", "Impossible de lister les projets : {error}"),
    "api.ado_unreachable": ("Azure DevOps is unreachable: {error}", "Azure DevOps est injoignable : {error}"),
    # --- azure devops provider errors --------------------------------------
    "ado.ctx.search": ("Work item search", "La recherche de work item"),
    "ado.ctx.load": ("Work item load", "Le chargement du work item"),
    "ado.ctx.projects": ("Listing projects", "Le listing des projets"),
    "ado.ctx.connection": ("Azure DevOps connection", "La connexion Azure DevOps"),
    "ado.err.signin": (
        "{context} failed: Azure DevOps returned a sign-in page. The PAT is invalid, expired, or lacks "
        "the required scope (Work Items: Read).",
        "{context} a échoué : Azure DevOps a renvoyé une page de connexion. Le PAT est invalide, expiré, "
        "ou n'a pas le scope requis (Work Items: Read).",
    ),
    "ado.err.http": (
        "{context} failed (HTTP {status}): {detail}",
        "{context} a échoué (HTTP {status}) : {detail}",
    ),
    "ado.err.no_details": ("no details returned", "aucun détail renvoyé"),
    "ado.err.unreadable": (
        "{context} failed: unreadable Azure DevOps response.",
        "{context} a échoué : réponse Azure DevOps illisible.",
    ),
    "ado.err.org_missing": (
        "Azure DevOps organization URL is not configured.",
        "L'URL d'organisation Azure DevOps n'est pas configurée.",
    ),
    "ado.err.project_missing": (
        "Azure DevOps project is not configured.",
        "Le projet Azure DevOps n'est pas configuré.",
    ),
    "ado.err.pat_missing": ("Azure DevOps PAT is not configured.", "Le PAT Azure DevOps n'est pas configuré."),
    "ado.err.not_found": (
        "Azure DevOps work item not found: {work_item_id}",
        "Work item Azure DevOps introuvable : {work_item_id}",
    ),
    # --- mock refinement engine --------------------------------------------
    "mock.q.data.scope": (
        "Which datasets or data domains are really in scope for the dedicated target database?",
        "Quels datasets ou domaines de données sont réellement dans le scope de la base cible dédiée ?",
    ),
    "mock.q.data.scope.why": (
        "This defines the migration perimeter and avoids copying unnecessary data.",
        "Cela définit le périmètre de migration et évite de copier des données inutiles.",
    ),
    "mock.q.data.sync": (
        "Is the data copy expected to be one-time or synchronized over time between shared and dedicated environments?",
        "La copie de données doit-elle être ponctuelle ou synchronisée dans le temps entre les environnements partagé et dédié ?",
    ),
    "mock.q.data.sync.why": (
        "This changes both implementation complexity and operating model.",
        "Cela change à la fois la complexité d'implémentation et le modèle d'exploitation.",
    ),
    "mock.q.testing.suites": (
        "Which automated suites, scenarios, or jobs still depend on the shared test data today?",
        "Quelles suites automatisées, scénarios ou jobs dépendent encore des données de test partagées aujourd'hui ?",
    ),
    "mock.q.testing.suites.why": (
        "This determines the non-regression scope for the refinement.",
        "Cela détermine le périmètre de non-régression du refinement.",
    ),
    "mock.q.cicd.pipelines": (
        "Which pipelines, runtime parameters, or datasetLabel values must change to consume the new target dataset?",
        "Quels pipelines, paramètres d'exécution ou valeurs de datasetLabel doivent changer pour consommer le nouveau dataset cible ?",
    ),
    "mock.q.cicd.pipelines.why": (
        "This identifies delivery impact and avoids hidden rollout failures.",
        "Cela identifie l'impact sur la livraison et évite les échecs de déploiement cachés.",
    ),
    "mock.q.dependencies.owner": (
        "Which team or owner is responsible for provisioning and validating the dedicated environment changes?",
        "Quelle équipe ou quel responsable prend en charge le provisioning et la validation des changements sur l'environnement dédié ?",
    ),
    "mock.q.dependencies.owner.why": (
        "Ownership gaps often block enablers more than the technical change itself.",
        "Les trous dans la répartition des responsabilités bloquent souvent les enablers plus que le changement technique lui-même.",
    ),
    "mock.q.infra.rollback": (
        "What rollback or fallback plan is expected if the new isolated setup breaks existing test execution?",
        "Quel plan de rollback ou de repli est attendu si le nouveau setup isolé casse l'exécution des tests existants ?",
    ),
    "mock.q.infra.rollback.why": (
        "This impacts release safety and acceptance criteria.",
        "Cela impacte la sûreté de la mise en production et les critères d'acceptation.",
    ),
    "mock.q.functional.out_of_scope": (
        "What is explicitly out of scope for this enabler so the split does not grow into a full test platform redesign?",
        "Qu'est-ce qui est explicitement hors scope pour cet enabler, pour que le split ne devienne pas une refonte complète de la plateforme de test ?",
    ),
    "mock.q.functional.out_of_scope.why": (
        "This keeps the refinement focused and the story split realistic.",
        "Cela garde le refinement cadré et le découpage en stories réaliste.",
    ),
    "mock.q.cicd.update": (
        "Who will update the affected pipelines and how will the configuration change be validated end to end?",
        "Qui va mettre à jour les pipelines impactés et comment le changement de configuration sera-t-il validé de bout en bout ?",
    ),
    "mock.q.cicd.update.why": (
        "Pipeline ownership and validation still look unclear.",
        "La responsabilité et la validation des pipelines restent floues.",
    ),
    "mock.q.infra.rollback_path": (
        "What concrete rollback path should the team keep if the isolated target dataset causes unstable executions?",
        "Quel chemin de rollback concret l'équipe doit-elle garder si le dataset cible isolé rend les exécutions instables ?",
    ),
    "mock.q.infra.rollback_path.why": (
        "Operational safety is still unresolved.",
        "La sûreté opérationnelle n'est toujours pas tranchée.",
    ),
    "mock.q.dependencies.signoff": (
        "Which team owns the migration, and who signs off once the new setup is validated?",
        "Quelle équipe porte la migration, et qui valide une fois le nouveau setup vérifié ?",
    ),
    "mock.q.dependencies.signoff.why": (
        "This closes the governance gap around the change.",
        "Cela comble le trou de gouvernance autour du changement.",
    ),
    "mock.q.technical.unknown": (
        "What concrete decision or constraint should be clarified about: {unknown}?",
        "Quelle décision ou contrainte concrète faut-il clarifier au sujet de : {unknown} ?",
    ),
    "mock.q.technical.unknown.why": (
        "This remaining ambiguity could still change the split or acceptance criteria.",
        "Cette ambiguïté restante peut encore changer le découpage ou les critères d'acceptation.",
    ),
    "mock.q.testing.prove": (
        "How will the team prove that the isolated setup does not regress existing web or API non-regression coverage?",
        "Comment l'équipe va-t-elle prouver que le setup isolé ne régresse pas la couverture de non-régression web ou API existante ?",
    ),
    "mock.q.testing.prove.why": (
        "Validation strategy still needs to be explicit.",
        "La stratégie de validation doit encore être explicitée.",
    ),
    "mock.reasoning_summary": (
        "Focus on scope boundaries, migration approach, pipeline impact, ownership, and validation.",
        "Focus sur les limites de scope, l'approche de migration, l'impact pipeline, les responsabilités et la validation.",
    ),
    "mock.assumption.unclear": (
        "Answer remains unclear for: {question}",
        "La réponse reste floue pour : {question}",
    ),
    "mock.unknown.data_perimeter": (
        "Exact data migration perimeter is still unclear.",
        "Le périmètre exact de migration des données reste flou.",
    ),
    "mock.unknown.pipeline_config": (
        "Affected pipeline configuration and ownership are still unclear.",
        "La configuration des pipelines impactés et leur responsabilité restent floues.",
    ),
    "mock.unknown.rollback": (
        "Rollback strategy is not explicit yet.",
        "La stratégie de rollback n'est pas encore explicite.",
    ),
    "mock.dependency.delivery_qa": (
        "Delivery or QA ownership is needed to validate pipeline changes.",
        "Un référent Delivery ou QA est nécessaire pour valider les changements de pipeline.",
    ),
    "mock.dependency.provisioning": (
        "Environment provisioning or DBA support may be required.",
        "Un provisioning d'environnement ou un appui DBA peut être nécessaire.",
    ),
    "mock.risk.shared_assumptions": (
        "Hidden shared data assumptions may keep some tests pointed at the old target.",
        "Des hypothèses implicites sur les données partagées peuvent laisser certains tests pointer vers l'ancienne cible.",
    ),
    "mock.risk.pipeline_drift": (
        "Pipeline configuration drift can break web or mobile execution unexpectedly.",
        "Une dérive de configuration des pipelines peut casser l'exécution web ou mobile de façon inattendue.",
    ),
    "mock.reason.enough": (
        "The context is sufficient to produce a practical refinement split.",
        "Le contexte est suffisant pour produire un découpage de refinement exploitable.",
    ),
    "mock.reason.not_enough": (
        "More information is needed on the remaining unknowns before finalizing the split.",
        "Il manque des informations sur les inconnues restantes avant de finaliser le découpage.",
    ),
    "mock.missing.data_scope": (
        "Exact data scope and migration approach",
        "Scope de données exact et approche de migration",
    ),
    "mock.missing.pipeline_impact": (
        "Pipeline and runtime configuration impact",
        "Impact sur les pipelines et la configuration d'exécution",
    ),
    "mock.missing.ownership": (
        "Ownership and validation sign-off",
        "Responsabilités et validation finale",
    ),
    "mock.missing.rollback": (
        "Rollback or fallback strategy",
        "Stratégie de rollback ou de repli",
    ),
    "mock.risk.data_drift": (
        "Data drift between shared and isolated targets may make tests inconsistent.",
        "Une dérive des données entre cibles partagée et isolée peut rendre les tests incohérents.",
    ),
    "mock.risk.implicit_target": (
        "Some automated scenarios may still consume the old shared target implicitly.",
        "Certains scénarios automatisés peuvent encore consommer implicitement l'ancienne cible partagée.",
    ),
    "mock.risk.param_drift": (
        "CI/CD parameter drift may break execution in one platform while another still passes.",
        "Une dérive des paramètres CI/CD peut casser l'exécution sur une plateforme pendant qu'une autre passe encore.",
    ),
    "mock.story.data.title": (
        "Isolate target data scope",
        "Isoler le scope de données cible",
    ),
    "mock.story.data.goal": (
        "Identify and provision the dedicated target datasets needed by the change.",
        "Identifier et provisionner les datasets cibles dédiés nécessaires au changement.",
    ),
    "mock.story.data.ac1": (
        "The in-scope datasets or data domains are explicitly listed.",
        "Les datasets ou domaines de données dans le scope sont explicitement listés.",
    ),
    "mock.story.data.ac2": (
        "A dedicated target database or dataset area is provisioned for the scoped tests.",
        "Une base ou une zone de datasets cible dédiée est provisionnée pour les tests concernés.",
    ),
    "mock.story.data.ac3": (
        "The migration or cloning approach is documented and reproducible.",
        "L'approche de migration ou de clonage est documentée et reproductible.",
    ),
    "mock.story.data.note1": (
        "Prefer explicit dataset ownership over implicit shared usage.",
        "Privilégier une propriété explicite des datasets plutôt qu'un usage partagé implicite.",
    ),
    "mock.story.data.note2": (
        "Document whether synchronization is one-time or recurring.",
        "Documenter si la synchronisation est ponctuelle ou récurrente.",
    ),
    "mock.order.data": (
        "Provision and validate the isolated target data scope",
        "Provisionner et valider le scope de données cible isolé",
    ),
    "mock.story.consumers.title": (
        "Update consumers and configuration",
        "Mettre à jour les consommateurs et la configuration",
    ),
    "mock.story.consumers.goal": (
        "Ensure every impacted consumer uses the intended isolated target configuration.",
        "S'assurer que chaque consommateur impacté utilise bien la configuration cible isolée prévue.",
    ),
    "mock.story.consumers.ac1": (
        "All impacted jobs, suites, or runtime parameters point to the intended target configuration.",
        "Tous les jobs, suites ou paramètres d'exécution impactés pointent vers la configuration cible prévue.",
    ),
    "mock.story.consumers.ac2": (
        "No remaining execution path silently depends on the old shared target.",
        "Aucun chemin d'exécution restant ne dépend silencieusement de l'ancienne cible partagée.",
    ),
    "mock.story.consumers.note1": (
        "Track datasetLabel, runtime variables, and platform-specific configuration separately.",
        "Suivre séparément datasetLabel, les variables d'exécution et la configuration spécifique à chaque plateforme.",
    ),
    "mock.order.consumers": (
        "Update test consumers and configuration",
        "Mettre à jour les consommateurs de test et la configuration",
    ),
    "mock.story.pipeline.title": (
        "Validate pipeline and non-regression impact",
        "Valider l'impact pipeline et non-régression",
    ),
    "mock.story.pipeline.goal": (
        "Adapt the delivery flow and prove the isolated setup does not regress automation reliability.",
        "Adapter le flux de livraison et prouver que le setup isolé ne dégrade pas la fiabilité de l'automatisation.",
    ),
    "mock.story.pipeline.ac1": (
        "Impacted pipelines are updated and documented.",
        "Les pipelines impactés sont mis à jour et documentés.",
    ),
    "mock.story.pipeline.ac2": (
        "Web and API non-regression expectations are explicitly validated after the change.",
        "Les attentes de non-régression web et API sont explicitement validées après le changement.",
    ),
    "mock.story.pipeline.ac3": (
        "A rollback or fallback path is documented if unstable behavior appears.",
        "Un chemin de rollback ou de repli est documenté en cas de comportement instable.",
    ),
    "mock.story.pipeline.note1": (
        "Treat CI/CD validation as a first-class acceptance concern, not an afterthought.",
        "Traiter la validation CI/CD comme un critère d'acceptation à part entière, pas comme un à-côté.",
    ),
    "mock.order.pipeline": (
        "Run end-to-end validation across impacted CI/CD flows",
        "Exécuter une validation de bout en bout sur les flux CI/CD impactés",
    ),
    "mock.rationale": (
        "The split separates data isolation, consumer configuration, and delivery validation so the team can control migration risk while keeping the implementation sequence testable.",
        "Le découpage sépare l'isolation des données, la configuration des consommateurs et la validation de livraison, pour que l'équipe maîtrise le risque de migration tout en gardant une séquence d'implémentation testable.",
    ),
    "mock.concern.testing1": (
        "Identify the exact suites that must move to the isolated target.",
        "Identifier les suites exactes qui doivent basculer vers la cible isolée.",
    ),
    "mock.concern.testing2": (
        "Add explicit non-regression validation for the new target usage.",
        "Ajouter une validation de non-régression explicite pour l'usage de la nouvelle cible.",
    ),
    "mock.concern.cicd1": (
        "Review datasetLabel or equivalent runtime parameters in all impacted jobs.",
        "Revoir datasetLabel ou les paramètres d'exécution équivalents dans tous les jobs impactés.",
    ),
    "mock.concern.cicd2": (
        "Document rollout and rollback expectations in the pipeline flow.",
        "Documenter les attentes de déploiement et de rollback dans le flux pipeline.",
    ),
    "mock.concern.infra1": (
        "Provision the isolated target with repeatable automation where possible.",
        "Provisionner la cible isolée avec une automatisation reproductible quand c'est possible.",
    ),
    "mock.concern.data1": (
        "Keep a clear ownership model for cloned or synchronized datasets.",
        "Garder un modèle de responsabilité clair pour les datasets clonés ou synchronisés.",
    ),
    "mock.concern.security1": (
        "Ensure isolated targets respect existing secret and credential handling rules.",
        "S'assurer que les cibles isolées respectent les règles existantes de gestion des secrets et des accès.",
    ),
    "mock.concern.observability1": (
        "Track failed runs by target environment so regressions are visible quickly.",
        "Suivre les exécutions en échec par environnement cible pour voir les régressions rapidement.",
    ),
    "mock.milestone.scope": (
        "Scope validated",
        "Scope validé",
    ),
    "mock.milestone.target": (
        "Target isolated and configured",
        "Cible isolée et configurée",
    ),
    "mock.milestone.consumers": (
        "Consumers migrated",
        "Consommateurs migrés",
    ),
    "mock.milestone.nonreg": (
        "Non-regression confirmed",
        "Non-régression confirmée",
    ),
    "mock.scope.refine_for": (
        "Refine and split work for: {title}",
        "Refiner et découper le travail pour : {title}",
    ),
    "mock.scope.capture_impacts": (
        "Capture impacts on data, test automation, and delivery configuration.",
        "Capturer les impacts sur les données, l'automatisation des tests et la configuration de livraison.",
    ),
    "mock.scope.out_redesign": (
        "A full redesign of the broader testing platform beyond the identified target scope.",
        "Une refonte complète de la plateforme de test au-delà du scope cible identifié.",
    ),
    "mock.summary": (
        "This refinement focuses on isolating the impacted target scope, updating its consumers, and validating the resulting delivery flow with explicit non-regression and rollback thinking.",
        "Ce refinement se concentre sur l'isolation du scope cible impacté, la mise à jour de ses consommateurs, et la validation du flux de livraison qui en résulte, avec une réflexion explicite sur la non-régression et le rollback.",
    ),
}

CATALOG: dict[str, dict[str, str]] = {
    "en": {key: value[0] for key, value in _MESSAGES.items()},
    "fr": {key: value[1] for key, value in _MESSAGES.items()},
}

_current_language: ContextVar[str] = ContextVar("current_language", default=DEFAULT_LANGUAGE)


def get_current_language() -> str:
    return _current_language.get()


def set_current_language(language: str) -> None:
    _current_language.set(normalize_language(language))


def normalize_language(language: str | None) -> str:
    if not language:
        return DEFAULT_LANGUAGE
    short = language.strip().lower()[:2]
    return short if short in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def resolve_language(request: Request) -> str:
    cookie = request.cookies.get(LANGUAGE_COOKIE)
    if cookie and normalize_language(cookie) == cookie.lower()[:2] and cookie.lower()[:2] in SUPPORTED_LANGUAGES:
        return cookie.lower()[:2]

    header = request.headers.get("accept-language", "")
    for part in header.split(","):
        candidate = part.split(";")[0].strip().lower()[:2]
        if candidate in SUPPORTED_LANGUAGES:
            return candidate

    return DEFAULT_LANGUAGE


def t(key: str, language: str | None = None, **kwargs: object) -> str:
    lang = normalize_language(language) if language else get_current_language()
    template = CATALOG.get(lang, {}).get(key)

    if template is None:
        logger.warning("Missing translation for key %r in %r", key, lang)
        template = CATALOG[DEFAULT_LANGUAGE].get(key, key)

    if not kwargs:
        return template

    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        logger.warning("Bad placeholders for translation key %r", key)
        return template


def label(prefix: str, value: str | None, language: str | None = None) -> str:
    """Translate a stored enum value (status, theme, priority) for display.

    Falls back to the raw value so an unexpected one from the model still shows
    something readable instead of a bare key.
    """
    if not value:
        return ""

    lang = normalize_language(language) if language else get_current_language()
    key = f"{prefix}.{str(value).strip().lower()}"
    return CATALOG.get(lang, {}).get(key) or str(value)


def js_catalog(language: str | None = None) -> dict[str, str]:
    """Only the `js.*` entries, injected into the page for the front-end helper."""
    lang = normalize_language(language) if language else get_current_language()
    return {key: value for key, value in CATALOG[lang].items() if key.startswith("js.")}
