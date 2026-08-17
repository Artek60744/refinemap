# Files

- [RefineMap — System Architecture Overview](overview.md) - High-level architecture of RefineMap, the decision board for product and tech teams — React SPA, FastAPI backend, LangGraph refinement engine, SQLAlchemy/PostgreSQL persistence, pluggable LLM providers, and the request flow through a session.
- [The Refinement Engine — LangGraph Workflow and LLM Layer](refinement-engine.md) - The differentiating core of RefineMap — the LangGraph state machine (generate questions, summarize context, final refinement, extract memory), its routing rules, the RefinementState shape, and the two LLM engines with JSON repair, retry and offline fallback.
