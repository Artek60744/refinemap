// UI translation catalog. Format: key -> [english, french].

export type Lang = "fr" | "en";

export const DEFAULT_LANGUAGE: Lang = "fr";
export const LANGUAGE_COOKIE = "lang";

export const SUPPORTED_LANGUAGES: Record<Lang, { flag: string; label: string }> = {
  fr: { flag: "🇫🇷", label: "Français" },
  en: { flag: "🇬🇧", label: "English" },
};

export const MESSAGES: Record<string, [en: string, fr: string]> = {
  // --- shell ---------------------------------------------------------------
  "app.name": ["PromptRefine", "PromptRefine"],
  "app.tagline": [
    "Turn a fuzzy subject into a clear brief.",
    "Transforme un sujet flou en brief clair.",
  ],
  "nav.refinement": ["Refinement", "Refinement"],
  "nav.dashboard": ["Dashboard", "Dashboard"],
  "nav.history": ["History", "Historique"],
  "nav.memory": ["Product memory", "Mémoire produit"],
  "nav.settings": ["Settings", "Paramètres"],
  "nav.health": ["Health", "Santé"],
  // --- shared --------------------------------------------------------------
  "common.test": ["Test", "Tester"],
  "common.save": ["Save", "Sauvegarder"],
  "common.cancel": ["Cancel", "Annuler"],
  "common.loading": ["Loading...", "Chargement..."],
  // --- settings page -------------------------------------------------------
  "settings.title": ["Connections and runtime", "Connexions et runtime"],
  "settings.subtitle": [
    "Configure the LLM provider used to refine subjects.",
    "Configure le provider LLM utilisé pour raffiner les sujets.",
  ],
  "settings.secrets_note": [
    "Secrets are encrypted at rest. Leaving a secret field empty keeps the current value.",
    "Les secrets sont chiffrés en base. Laisser un champ secret vide conserve la valeur existante.",
  ],
  "settings.load_failed": ["Unable to load the settings.", "Impossible de charger les paramètres."],
  "settings.save_failed": ["Unable to save the settings.", "Impossible d'enregistrer les paramètres."],
  "llm.title": ["AI provider", "Provider IA"],
  "llm.subtitle": [
    "Mock by default, then a real provider depending on your needs.",
    "Mock par défaut, puis un vrai provider selon tes besoins.",
  ],
  "llm.provider": ["Provider", "Provider"],
  "llm.model": ["Model", "Modèle"],
  "llm.model_hint": ["The model's public name at the provider.", "Nom public du modèle chez le provider."],
  "llm.endpoint": ["Endpoint", "Endpoint"],
  "llm.endpoint_hint": ["URL of your provider resource.", "URL de ta ressource provider."],
  "llm.deployment": ["Deployment", "Deployment"],
  "llm.deployment_hint": [
    "Azure-specific: the deployment name goes into the call URL, not the model name.",
    "Spécifique à Azure : c'est le nom du déploiement qui va dans l'URL d'appel, pas celui du modèle.",
  ],
  "llm.api_key": ["API key", "Clé API"],
  "llm.api_key_placeholder": [
    "Leave empty to keep the current key",
    "Laisser vide pour conserver la clé existante",
  ],
  "llm.key_configured": ["Key configured {hint}", "Clé configurée {hint}"],
  "llm.no_key": ["No key configured", "Aucune clé configurée"],
  "llm.test_failed": ["LLM test failed.", "Le test LLM a échoué."],
  // --- refinement home -----------------------------------------------------
  "home.heading": ["Refine Your Subject", "Affine ton sujet"],
  "home.subheading": [
    "From a vague idea to an actionable brief in minutes",
    "Passe d'une idée floue à un brief exploitable en quelques minutes",
  ],
  "home.search_placeholder": [
    "e.g., 'Improve onboarding for new mobile users'",
    "Ex : 'Améliorer l'onboarding des nouveaux utilisateurs mobiles'",
  ],
  "home.search_button": ["Refine", "Lancer le refinement"],
  "home.session_create_failed": ["Unable to create the session.", "Création de session impossible."],
  // --- session / war room --------------------------------------------------
  "session.round": ["Round", "Round"],
  "session.status": ["Status", "Statut"],
  "session.view_final": ["View the final deliverable", "Voir le livrable final"],
  "session.export_markdown": ["Export as markdown", "Exporter en markdown"],
  "session.answers_submit_failed": ["Unable to submit the answers.", "Soumission des réponses impossible."],
  // --- result page ---------------------------------------------------------
  "result.eyebrow": ["Final result", "Résultat final"],
  "result.back": ["Back to session", "Retour session"],
  "result.not_available": [
    "The deliverable is not available for this session yet.",
    "Le livrable n'est pas encore disponible pour cette session.",
  ],
  // --- history page --------------------------------------------------------
  "history.title": ["History", "Historique"],
  "history.subtitle": [
    "Every refinement session, most recently updated first.",
    "Toutes les sessions de refinement, la plus récemment modifiée en premier.",
  ],
  "history.search_placeholder": ["Search by title...", "Rechercher par titre..."],
  "history.filter_all": ["All", "Toutes"],
  "history.untitled": ["Untitled session", "Session sans titre"],
  "history.empty": [
    "No session yet. Start one from the dashboard.",
    "Aucune session pour l'instant. Lances-en une depuis le dashboard.",
  ],
  "history.empty_filtered": [
    "No session matches these filters.",
    "Aucune session ne correspond à ces filtres.",
  ],
  "history.resume": ["Open", "Ouvrir"],
  "history.rename": ["Rename", "Renommer"],
  "history.delete": ["Delete", "Supprimer"],
  "history.delete_confirm": ["Confirm deletion", "Confirmer la suppression"],
  "history.load_more": ["Load more ({count})", "Voir plus ({count})"],
  "decision.title": ["Decision", "Décision"],
  "decision.recommendation": ["Recommendation", "Recommandation"],
  "decision.confidence": ["Confidence", "Confiance"],
  "decision.reasons": ["Why", "Pourquoi"],
  "decision.root_cause": ["Root cause", "Cause racine"],
  "decision.secondary_reasons": ["Secondary reasons", "Raisons secondaires"],
  "decision.blockers": ["Real blockers", "Blocage réel"],
  "decision.main_blocker": ["main", "principal"],
  "decision.conditional_go_one": [
    "Conditional go once the main blocker is lifted.",
    "Go conditionnel une fois le blocage principal levé.",
  ],
  "decision.conditional_go_many": [
    "Conditional go once the {count} blockers are lifted.",
    "Go conditionnel une fois les {count} blocages levés.",
  ],
  "decision.strengths": ["What is already solid", "Ce qui est assez solide"],
  "decision.next_action": ["Next action", "Prochaine action"],
  // --- enum labels rendered from stored values -----------------------------
  "decision.go": ["Go", "Go"],
  "decision.explore": ["Explore", "Explorer"],
  "decision.rework": ["Rework", "Retravailler"],
  "decision.drop": ["Drop", "Abandonner"],
  "confidence.low": ["Low", "Faible"],
  "confidence.medium": ["Medium", "Moyenne"],
  "confidence.high": ["High", "Élevée"],
  "status.draft": ["Draft", "Brouillon"],
  "status.questioning": ["Questioning", "Questions en cours"],
  "status.analyzing": ["Analyzing", "Analyse en cours"],
  "status.final_ready": ["Ready", "Livrable prêt"],
  "status.open": ["Open", "Ouvert"],
  "status.answered": ["Answered", "Répondu"],
  // --- product memory ------------------------------------------------------
  "memory.title": ["Product memory", "Mémoire produit"],
  "memory.subtitle": [
    "What the tool already knows about your products, so it stops asking twice.",
    "Ce que l'outil sait déjà de tes produits, pour qu'il arrête de redemander.",
  ],
  "memory.product": ["Product", "Produit"],
  "memory.product_placeholder": ["No product (no memory)", "Aucun produit (sans mémoire)"],
  "memory.new_product": ["New product", "Nouveau produit"],
  "memory.new_product_placeholder": ["Product name...", "Nom du produit..."],
  "memory.no_product": [
    "No product yet. Attach a session to a product to start building its memory.",
    "Aucun produit. Rattache une session à un produit pour commencer à construire sa mémoire.",
  ],
  "memory.empty": [
    "This product has no memorized fact yet. Facts appear once a session reaches its verdict.",
    "Ce produit n'a encore aucun fait mémorisé. Les faits apparaissent quand une session atteint son verdict.",
  ],
  "memory.fact_count": ["{count} facts", "{count} faits"],
  "memory.add_fact": ["Add a fact", "Ajouter un fait"],
  "memory.add_placeholder": [
    "A durable fact about this product...",
    "Un fait durable sur ce produit...",
  ],
  "memory.confirmed": ["Confirmed", "Confirmé"],
  "memory.unconfirmed": ["Not verified", "Non vérifié"],
  "memory.delete_confirm": ["Confirm removal", "Confirmer le retrait"],
  "memory.cap_notice": [
    "Only the {count} most recent facts are injected into a session.",
    "Seuls les {count} faits les plus récents sont injectés dans une session.",
  ],
  // banner shown in the war room at round 0
  "memory.known_title": ["What I already know", "Ce que je sais déjà"],
  "memory.known_hint": [
    "Inherited from past sessions on this product. Correct anything wrong — it updates the memory.",
    "Hérité des sessions passées sur ce produit. Corrige ce qui est faux — la mémoire est mise à jour.",
  ],
  "memory.correct": ["Correct", "Corriger"],
  "memory.remove": ["Remove", "Retirer"],
  // --- memory categories ---------------------------------------------------
  "category.produit": ["Product", "Produit"],
  "category.stack": ["Stack", "Stack"],
  "category.equipe": ["Team", "Équipe"],
  "category.contrainte": ["Constraint", "Contrainte"],
  "category.utilisateur": ["Users", "Utilisateurs"],
  "category.decision": ["Settled decision", "Décision actée"],
};
