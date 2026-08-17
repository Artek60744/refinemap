# Files

- [Deployment, Docker and the Azure VM](deployment.md) - How RefineMap is deployed on its Azure VM — the deploy.sh workflow (dev sync vs prod deploy), the three Docker containers, cost control, what is never overwritten, transport channels, and the documented security limits.
- [LLM Provider Configuration and Secret Handling](llm-configuration.md) - How RefineMap resolves and stores the LLM provider at runtime — the app_settings key/value store, env fallbacks per provider, Fernet encryption of the API key, masked hints, and the non-live connection test.
