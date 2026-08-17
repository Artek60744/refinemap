# Fichiers

- [Déploiement, Docker et la VM Azure](deployment.md) - Comment RefineMap est déployé sur sa VM Azure — le flux deploy.sh (sync en dev vs deploy en prod), les trois conteneurs Docker, le contrôle des coûts, ce qui n'est jamais écrasé, les canaux de transport et les limites de sécurité documentées.
- [Configuration du fournisseur LLM et gestion des secrets](llm-configuration.md) - Comment RefineMap résout et stocke le fournisseur LLM à l’exécution — le magasin clé/valeur app_settings, les replis d’environnement par fournisseur, le chiffrement Fernet de la clé API, les indices masqués et le test de connexion non live.
