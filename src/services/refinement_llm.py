from __future__ import annotations

import json
import re
import logging
from typing import Any, Protocol

import httpx

logger = logging.getLogger(__name__)

from src.api.schemas_refinement import (
    BriefSection,
    DecisionReport,
    DetectModeOutput,
    GenerateQuestionsOutput,
    PlanStep,
    ProductMemoryOp,
    ProductMemoryOpsOutput,
    QuestionItem,
    RefinementDeliverableOutput,
    SessionSummaryOutput,
)
from src.config.settings import settings
from src.services.product_memory_rules import classify_memory_category, is_durable_statement
from src.services.prompt_loader import PromptLoader
from src.services.question_grids import (
    detect_grid_by_keywords,
    grid_axes,
    resolve_grid,
)


class RefinementLLM(Protocol):
    model_name: str

    async def detect_mode(self, context: dict[str, Any]) -> DetectModeOutput:
        ...

    async def generate_questions(self, context: dict[str, Any]) -> GenerateQuestionsOutput:
        ...

    async def summarize_context(self, context: dict[str, Any]) -> SessionSummaryOutput:
        ...

    async def generate_final_refinement(self, context: dict[str, Any]) -> RefinementDeliverableOutput:
        ...

    async def extract_product_memory(self, context: dict[str, Any]) -> ProductMemoryOpsOutput:
        ...


# ---------------------------------------------------------------------------
# Offline mock engine (generalist, topic-agnostic)
# ---------------------------------------------------------------------------


class MockRefinementLLM:
    """Deterministic offline engine. Templates questions from the active grid and
    assembles a Brief/Plan from the answers — no external call, works for any subject."""

    def __init__(self, model_name: str = "mock-refiner-v1") -> None:
        self.model_name = model_name

    async def detect_mode(self, context: dict[str, Any]) -> DetectModeOutput:
        grid = detect_grid_by_keywords(self._subject_text(context))
        return DetectModeOutput(grid=grid, reason="Detected from keywords (offline mode).")

    async def generate_questions(self, context: dict[str, Any]) -> GenerateQuestionsOutput:
        grid = resolve_grid(context.get("grid", "po"))
        axes = grid_axes(grid)
        max_questions = int(context.get("max_questions_per_round", 6))
        round_number = int(context.get("round", 0)) + 1

        # Offline engine: it cannot infer plausible answers, so it only offers the two
        # utility chips (the first one is understood by `_looks_unknown` downstream).
        fallback_suggestions = ["Je ne sais pas encore", "Sans objet pour ce sujet"]

        questions: list[QuestionItem] = []
        if round_number == 1:
            for index, axis in enumerate(axes):
                if len(questions) >= max_questions:
                    break
                priority = "high" if index < 3 else "medium"
                questions.append(
                    QuestionItem(
                        id=f"q{index + 1}",
                        theme=axis["label"],
                        priority=priority,
                        question=f"À propos de « {axis['label']} » : quel est l'élément clé à clarifier pour ce sujet ?",
                        why=f"Clarifier « {axis['label']} » réduit l'ambiguïté avant de rédiger le livrable.",
                        suggestions=fallback_suggestions,
                    )
                )
        else:
            unknowns = context.get("unknowns", [])[:max_questions]
            for index, unknown in enumerate(unknowns):
                questions.append(
                    QuestionItem(
                        id=f"q{index + 1}",
                        theme="Zone d'incertitude",
                        priority="medium",
                        question=f"Peux-tu préciser : {unknown}",
                        why="Cette zone reste floue et peut changer le livrable.",
                        suggestions=fallback_suggestions,
                    )
                )
            if not questions:
                questions.append(
                    QuestionItem(
                        id="q1",
                        theme="Validation",
                        priority="medium",
                        question="Reste-t-il un point à trancher avant de figer le livrable ?",
                        why="Confirmer qu'il n'y a plus d'ambiguïté bloquante.",
                        suggestions=fallback_suggestions,
                    )
                )

        missing = [axis["label"] for axis in axes[:3]]
        return GenerateQuestionsOutput(
            questions=questions[:max_questions],
            reasoningSummary=f"Questions issues de la grille {grid.upper()}.",
            potentialRisks=[],
            missingAreas=missing,
            stopCriteria=False,
        )

    async def summarize_context(self, context: dict[str, Any]) -> SessionSummaryOutput:
        facts = self._dedupe(list(context.get("facts", [])))
        assumptions = self._dedupe(list(context.get("assumptions", [])))
        unknowns: list[str] = []

        asked = {item["id"]: item.get("question", "") for item in context.get("asked_questions", [])}
        for answer in context.get("answers", []):
            answer_text = (answer.get("answer") or "").strip()
            question_text = asked.get(answer.get("questionId"), "")
            if not answer_text or self._looks_unknown(answer_text):
                if question_text:
                    unknowns.append(question_text)
                continue
            facts.append(answer_text)

        facts = self._dedupe(facts)
        unknowns = self._dedupe(unknowns)
        dependencies = self._dedupe(list(context.get("dependencies", [])))
        risks = self._dedupe(list(context.get("risks", [])))

        round_number = int(context.get("round", 0))
        max_rounds = int(context.get("max_rounds", 3))
        if not unknowns:
            confidence = "high"
        elif round_number >= max_rounds:
            confidence = "medium"
        elif len(unknowns) <= 2 and len(facts) >= 3:
            confidence = "medium"
        else:
            confidence = "low"

        enough_context = confidence == "high" or round_number >= max_rounds
        reason = (
            "Le contexte est suffisant pour produire le livrable."
            if enough_context
            else "Des zones d'incertitude subsistent, un tour supplémentaire est utile."
        )

        return SessionSummaryOutput(
            facts=facts,
            assumptions=assumptions,
            unknowns=unknowns,
            dependencies=dependencies,
            risks=risks,
            confidence=confidence,
            enoughContext=enough_context,
            reason=reason,
        )

    async def generate_final_refinement(self, context: dict[str, Any]) -> RefinementDeliverableOutput:
        grid = resolve_grid(context.get("grid", "po"))
        subject = context.get("subject", {})
        title = subject.get("title", "Sujet")

        facts = self._dedupe(list(context.get("facts", [])))
        unknowns = self._dedupe(list(context.get("unknowns", [])))
        assumptions = self._dedupe(list(context.get("assumptions", [])))
        risks = self._dedupe(list(context.get("risks", [])))
        confidence = context.get("confidence", "low")

        # Group answered questions under their theme (grid axis) -> Brief sections.
        asked = {item["id"]: item for item in context.get("asked_questions", [])}
        by_theme: dict[str, list[str]] = {}
        for answer in context.get("answers", []):
            text = (answer.get("answer") or "").strip()
            if not text or self._looks_unknown(text):
                continue
            question = asked.get(answer.get("questionId"), {})
            theme = question.get("theme") or "Contexte"
            by_theme.setdefault(theme, []).append(text)

        brief: list[BriefSection] = [BriefSection(heading="Résumé", items=[title] + facts[:1])]
        for axis in grid_axes(grid):
            items = by_theme.get(axis["label"])
            if items:
                brief.append(BriefSection(heading=axis["label"], items=items))

        plan = [
            PlanStep(title="Cadrer le sujet", detail="Valider objectif, périmètre et parties prenantes."),
            PlanStep(title="Lever les incertitudes", detail="Traiter les questions ouvertes restantes."),
            PlanStep(title="Produire le livrable", detail="Formaliser le brief et le partager."),
        ]

        code_draft = None
        if grid in {"technique", "hybride"}:
            code_draft = f"// Brouillon de départ pour : {title}\n// TODO: implémenter selon le brief ci-contre.\n"

        return RefinementDeliverableOutput(
            summary=f"Refinement du sujet « {title} » via la grille {grid.upper()}.",
            brief=brief,
            plan=plan,
            codeDraft=code_draft,
            openQuestions=unknowns,
            decisionReport=self._build_decision_report(
                facts=facts,
                unknowns=unknowns,
                assumptions=assumptions,
                risks=risks,
                confidence=confidence,
                grid=grid,
            ),
        )

    async def extract_product_memory(self, context: dict[str, Any]) -> ProductMemoryOpsOutput:
        """Promote the session's durable facts into the product memory.

        Offline rules only: a fact enters the memory if it is a short statement with
        no temporal anchor and no equivalent already memorized. The mock never emits
        `update` or `remove` — rewriting a memorized fact needs a judgment it cannot
        make, and archiving on a heuristic would silently erase real knowledge.
        """
        known = {
            (item.get("statement") or "").strip().lower()
            for item in context.get("product_memory", [])
        }
        ops: list[ProductMemoryOp] = []
        for fact in self._dedupe(list(context.get("facts", []))):
            if self._looks_unknown(fact) or not is_durable_statement(fact):
                continue
            if fact.strip().lower() in known:
                continue
            known.add(fact.strip().lower())
            ops.append(
                ProductMemoryOp(
                    action="add",
                    category=classify_memory_category(fact),
                    statement=fact.strip(),
                )
            )

        return ProductMemoryOpsOutput(
            ops=ops,
            reason=f"{len(ops)} fait(s) durable(s) retenu(s) hors ligne.",
        )

    def _build_decision_report(
        self,
        *,
        facts: list[str],
        unknowns: list[str],
        assumptions: list[str],
        risks: list[str],
        confidence: str,
        grid: str,
    ) -> DecisionReport:
        # Deterministic arbitration rules, evaluated in order. The confidence is the
        # solidity of the verdict: a drop forced by an empty fact base is a firm call.
        if not facts and len(unknowns) >= 3:
            recommendation, decision_confidence = "drop", "high"
        elif not unknowns and confidence == "high" and len(risks) <= 1:
            recommendation, decision_confidence = "go", "high"
        elif len(risks) >= 3 or len(risks) > len(facts):
            recommendation, decision_confidence = "rework", "medium"
        else:
            recommendation = "explore"
            decision_confidence = "medium"

        # One list of blocking subjects feeds the root cause, the blockers and the next
        # action, so the three always point at the same thing. A `go` has none.
        if recommendation == "go":
            blocking_label, blocking_items = "", []
        elif recommendation == "rework" and risks:
            blocking_label, blocking_items = "Risque bloquant", risks[:2]
        elif unknowns:
            blocking_label, blocking_items = "Inconnue bloquante", unknowns[:2]
        elif risks:
            blocking_label, blocking_items = "Risque bloquant", risks[:2]
        else:
            blocking_label = "Cadrage bloquant"
            blocking_items = ["le sujet ne permet pas de trancher en l'état"]

        # One main blocker, one secondary at most: beyond that it is a shopping list.
        blockers = [f"{blocking_label} : {item}" for item in blocking_items]

        # reasons[0] is the root cause — the item that, once lifted, flips the verdict.
        # Counting facts against unknowns is a meeting report, not a judgment.
        if recommendation == "go":
            root_cause = (
                f"Aucun blocage résiduel : {facts[0]}"
                if facts
                else "Aucun risque ni inconnue résiduelle : le sujet est actionnable."
            )
        else:
            root_cause = f"Cause racine : {blocking_items[0]}"

        main_item = blocking_items[0] if blocking_items else None
        secondaries: list[str] = []
        for unknown in unknowns:
            if unknown != main_item:
                secondaries.append(f"Inconnue non levée : {unknown}")
                break
        for risk in risks:
            if risk != main_item:
                secondaries.append(f"Risque identifié : {risk}")
                break
        if assumptions:
            secondaries.append(f"Hypothèse non vérifiée : {assumptions[0]}")
        if not secondaries:
            secondaries.append("Aucun autre point ne pèse sur ce verdict.")

        strengths = facts[:3]
        if not strengths:
            strengths = [f"Le périmètre est cadré par la grille {grid.upper()}."]

        if recommendation == "go":
            next_action = "Lancer la mise en œuvre du plan proposé."
        elif recommendation == "rework":
            next_action = f"Reformuler le sujet en traitant : {main_item}"
        elif recommendation == "drop":
            next_action = f"Ne pas poursuivre ; ne rouvrir que si ce point tombe : {main_item}"
        else:
            next_action = f"Trancher en priorité : {main_item}"

        return DecisionReport(
            recommendation=recommendation,
            confidence=decision_confidence,
            reasons=[root_cause, *secondaries][:4],
            blockers=blockers[:2],
            strengths=strengths,
            nextAction=next_action,
        )

    # -- helpers --
    def _subject_text(self, context: dict[str, Any]) -> str:
        subject = context.get("subject", {})
        values = [subject.get("title", ""), subject.get("description", ""), context.get("extra_context", "")]
        return " ".join(value for value in values if value)

    def _looks_unknown(self, answer: str) -> bool:
        lowered = answer.lower()
        return any(
            token in lowered
            for token in ["je ne sais pas", "à confirmer", "a confirmer", "pas sûr", "pas sur", "unknown", "not sure", "to confirm"]
        )

    def _dedupe(self, values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = (value or "").strip()
            if not item or item.lower() in seen:
                continue
            seen.add(item.lower())
            result.append(item)
        return result


# ---------------------------------------------------------------------------
# Real engine: any OpenAI-compatible /chat/completions endpoint
# ---------------------------------------------------------------------------


def _repair_json_text(text: str) -> str:
    text = re.sub(r",\s*([}\]])", r"\1", text)
    text = re.sub(r"([{,])\s*'([^']*)'\s*:", r'\1 "\2":', text)
    text = re.sub(r":\s*'([^']*)'", r': "\1"', text)
    text = re.sub(r'"([^"\\]*(\\.[^"\\]*)*)"\s+(?=")', r'"\1", ', text)
    return text


def _extract_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("JSON parse failed (%s), attempting repair: %.300s...", exc, text)
        repaired = _repair_json_text(text)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            raise exc


class OpenAICompatibleLLM:
    def __init__(
        self,
        *,
        provider: str,
        endpoint: str,
        api_key: str,
        deployment: str,
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> None:
        self.provider = provider
        self.endpoint = endpoint.rstrip("/") if endpoint else ""
        self.api_key = api_key
        self.deployment = deployment
        self.model = model or deployment or "gpt-4o-mini"
        self.model_name = f"{provider}:{self.model}"
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.prompt_loader = PromptLoader(settings.prompts_dir)
        # Deterministic safety net: if a real call fails (network, truncated/invalid
        # JSON, schema mismatch), degrade to the offline engine instead of a 500.
        self._fallback = MockRefinementLLM(model_name=self.model_name)
        # True as soon as one call in this request degraded to the offline engine,
        # so the API can tell the UI instead of silently serving template questions.
        self.degraded = False

    @property
    def _is_azure(self) -> bool:
        return self.provider in {"azure-openai", "azure-foundry"}

    def _url(self) -> str:
        if self._is_azure:
            deployment = self.deployment or self.model
            return f"{self.endpoint}/openai/deployments/{deployment}/chat/completions?api-version=2024-06-01"
        defaults = {
            "deepseek": "https://api.deepseek.com",
            "openrouter": "https://openrouter.ai/api/v1",
        }
        base = self.endpoint or defaults.get(self.provider, "https://api.openai.com/v1")
        return f"{base}/chat/completions"

    def _headers(self) -> dict[str, str]:
        if self._is_azure:
            return {"api-key": self.api_key, "Content-Type": "application/json"}
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def _chat_json(
        self, system_prompt: str, task_prompt: str, context: dict[str, Any], max_tokens: int | None = None
    ) -> dict[str, Any]:
        user = (
            f"{task_prompt}\n\nCONTEXT (JSON):\n"
            f"{json.dumps(context, ensure_ascii=False)}\n\n"
            "Return a single strict JSON object only, no prose, no code fences. "
            'Inside string values, never use unescaped double quotes — write « » or \\" instead.'
        )
        body: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
            ],
            "temperature": self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
            "response_format": {"type": "json_object"},
        }
        if not self._is_azure:
            body["model"] = self.model
        # DeepSeek's thinking-capable models (deepseek-v4-*) reason by default, and the
        # reasoning tokens count against max_tokens — on large contexts they can exhaust
        # the budget and leave `content` empty, which degrades the whole round to the
        # offline fallback. Curb the effort so reasoning stays short and content is always
        # emitted. (temperature is silently ignored while thinking is enabled.)
        if self.provider == "deepseek":
            body["reasoning_effort"] = "low"

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(self._url(), headers=self._headers(), json=body)
            response.raise_for_status()
            payload = response.json()
        content = payload["choices"][0]["message"]["content"]

        try:
            return _extract_json(content)
        except json.JSONDecodeError as exc:
            # One corrective retry: the model already produced the right content, it
            # only broke the encoding — asking it to re-emit valid JSON usually saves
            # the round instead of dropping to the offline fallback.
            logger.warning("Invalid JSON from %s (%s); asking the model to re-emit it.", self.model_name, exc)
            body["messages"] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": (
                        f"Your previous response is not valid JSON ({exc}). Re-emit the exact same content "
                        'as ONE valid JSON object. Escape every double quote inside string values as \\" '
                        "(or replace it with « »). No prose, no code fences."
                    ),
                },
            ]
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(self._url(), headers=self._headers(), json=body)
                response.raise_for_status()
                payload = response.json()
            return _extract_json(payload["choices"][0]["message"]["content"])

    def _system(self) -> str:
        return self.prompt_loader.load("system-refinement")

    async def detect_mode(self, context: dict[str, Any]) -> DetectModeOutput:
        try:
            data = await self._chat_json(self._system(), self.prompt_loader.load("detect-mode"), context)
            return DetectModeOutput.model_validate(data)
        except Exception as exc:
            logger.warning("detect_mode via %s failed (%s); using offline fallback.", self.model_name, exc)
            self.degraded = True
            return await self._fallback.detect_mode(context)

    async def generate_questions(self, context: dict[str, Any]) -> GenerateQuestionsOutput:
        try:
            data = await self._chat_json(self._system(), self.prompt_loader.load("generate-questions"), context)
            return GenerateQuestionsOutput.model_validate(data)
        except Exception as exc:
            logger.warning("generate_questions via %s failed (%s); using offline fallback.", self.model_name, exc)
            self.degraded = True
            return await self._fallback.generate_questions(context)

    async def summarize_context(self, context: dict[str, Any]) -> SessionSummaryOutput:
        try:
            data = await self._chat_json(self._system(), self.prompt_loader.load("summarize-context"), context)
            return SessionSummaryOutput.model_validate(data)
        except Exception as exc:
            logger.warning("summarize_context via %s failed (%s); using offline fallback.", self.model_name, exc)
            self.degraded = True
            return await self._fallback.summarize_context(context)

    async def generate_final_refinement(self, context: dict[str, Any]) -> RefinementDeliverableOutput:
        # The deliverable is the largest output — give it a bigger token budget so the
        # JSON is not truncated, and fall back deterministically if it still fails.
        budget = max(self.max_tokens, 8000)
        try:
            data = await self._chat_json(
                self._system(), self.prompt_loader.load("generate-final-refinement"), context, max_tokens=budget
            )
            return RefinementDeliverableOutput.model_validate(data)
        except Exception as exc:
            logger.warning("generate_final_refinement via %s failed (%s); using offline fallback.", self.model_name, exc)
            self.degraded = True
            return await self._fallback.generate_final_refinement(context)

    async def extract_product_memory(self, context: dict[str, Any]) -> ProductMemoryOpsOutput:
        try:
            data = await self._chat_json(self._system(), self.prompt_loader.load("extract-product-memory"), context)
            return ProductMemoryOpsOutput.model_validate(data)
        except Exception as exc:
            logger.warning("extract_product_memory via %s failed (%s); using offline fallback.", self.model_name, exc)
            self.degraded = True
            return await self._fallback.extract_product_memory(context)


def build_refinement_llm(
    *,
    provider: str,
    endpoint: str = "",
    api_key: str = "",
    deployment: str = "",
    model: str = "",
) -> RefinementLLM:
    """Return a real OpenAI-compatible engine when configured, else the offline mock."""
    if provider and provider != "mock" and api_key:
        return OpenAICompatibleLLM(
            provider=provider,
            endpoint=endpoint,
            api_key=api_key,
            deployment=deployment,
            model=model,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
    return MockRefinementLLM()
