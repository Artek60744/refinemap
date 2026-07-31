from __future__ import annotations

import base64
import html
import re
from typing import Any, Protocol

import httpx

from src.config.settings import Settings
from src.i18n import t


class AzureDevOpsError(RuntimeError):
    """Azure DevOps rejected the call, with a message worth showing to the user."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class WorkItemProvider(Protocol):
    async def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        ...

    async def get_by_id(self, work_item_id: str) -> dict[str, Any]:
        ...


def normalize_org_url(org_url: str) -> str:
    """Reduce a pasted Azure DevOps URL to its organization root.

    Copying the address bar gives `https://dev.azure.com/org/project`, which makes
    every `/_apis/...` call 404. Only the hosted form is trimmed: on-premise
    collection URLs legitimately carry extra path segments.
    """
    cleaned = org_url.strip().rstrip("/")
    match = re.match(r"^(https?://(?:dev\.azure\.com|vssps\.dev\.azure\.com)/[^/]+)(?:/.*)?$", cleaned, re.IGNORECASE)
    return match.group(1) if match else cleaned


def build_auth_headers(pat: str) -> dict[str, str]:
    token = base64.b64encode(f":{pat}".encode("utf-8")).decode("utf-8")
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def read_json_response(response: httpx.Response, context: str) -> dict[str, Any]:
    """Return the JSON body, or raise AzureDevOpsError with a readable reason.

    Azure DevOps answers an invalid or expired PAT with 203 and an HTML sign-in
    page instead of a 401, so the status code alone is not enough to tell a
    successful call from a failed one.
    """
    content_type = response.headers.get("content-type", "")
    is_json = "application/json" in content_type

    if response.status_code == 203 or (response.is_success and not is_json):
        raise AzureDevOpsError(t("ado.err.signin", context=context), response.status_code)

    if not response.is_success:
        detail = ""
        if is_json:
            try:
                detail = response.json().get("message", "")
            except ValueError:
                detail = ""
        if not detail:
            detail = response.text[:300].strip()
        raise AzureDevOpsError(
            t("ado.err.http", context=context, status=response.status_code, detail=detail or t("ado.err.no_details")),
            response.status_code,
        )

    try:
        return response.json()
    except ValueError as exc:
        raise AzureDevOpsError(t("ado.err.unreadable", context=context)) from exc


async def fetch_projects(org_url: str, pat: str, limit: int = 200) -> list[dict[str, str]]:
    url = f"{normalize_org_url(org_url)}/_apis/projects?api-version=7.0&$top={limit}&stateFilter=wellFormed"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, headers=build_auth_headers(pat))
    payload = read_json_response(response, t("ado.ctx.projects"))
    return [
        {"id": str(project.get("id", "")), "name": project.get("name", "")}
        for project in payload.get("value", [])
        if project.get("name")
    ]


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(without_tags)).strip()


class MockAzureDevOpsProvider:
    def __init__(self) -> None:
        self._items = {
            "1001": {
                "id": "1001",
                "type": "Enabler",
                "title": "Separate test databases for Playwright and API",
                "url": "https://dev.azure.com/mock/project/_workitems/edit/1001",
                "description": (
                    "Current web E2E Playwright tests use the same database as API tests. "
                    "The goal is to isolate datasets, create a dedicated web E2E database, "
                    "update datasetLabel usage, and cover CI/CD impact across web and mobile."
                ),
                "acceptanceCriteria": (
                    "Playwright tests consume the dedicated database. Shared datasets are no longer required."
                ),
                "tags": ["E2E", "Playwright", "CI/CD", "Data"],
                "areaPath": "Platform\\Quality",
                "iterationPath": "Backlog",
                "priority": 2,
                "state": "New",
                "relations": [
                    {
                        "type": "System.LinkTypes.Hierarchy-Forward",
                        "targetId": "1004",
                    }
                ],
                "raw": {"mock": True, "source": "local-seed"},
            },
            "1002": {
                "id": "1002",
                "type": "User Story",
                "title": "Harden pipeline variable management for release branches",
                "url": "https://dev.azure.com/mock/project/_workitems/edit/1002",
                "description": "Release branches still override shared variables manually. We need stronger variable scoping.",
                "acceptanceCriteria": "Release pipelines use dedicated scoped variables without manual overrides.",
                "tags": ["Pipeline", "Configuration"],
                "areaPath": "Platform\\Delivery",
                "iterationPath": "Backlog",
                "priority": 3,
                "state": "Approved",
                "relations": [],
                "raw": {"mock": True, "source": "local-seed"},
            },
            "1003": {
                "id": "1003",
                "type": "Enabler",
                "title": "Improve mobile non-regression validation after test data refresh",
                "url": "https://dev.azure.com/mock/project/_workitems/edit/1003",
                "description": "Mobile regression checks are inconsistent after refreshing shared test data.",
                "acceptanceCriteria": "Mobile smoke and regression validation are explicit after each data refresh.",
                "tags": ["Mobile", "Testing"],
                "areaPath": "Platform\\Mobile",
                "iterationPath": "Backlog",
                "priority": 2,
                "state": "New",
                "relations": [],
                "raw": {"mock": True, "source": "local-seed"},
            },
        }

    async def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        if not query.strip():
            return list(self._items.values())[:limit]

        needle = query.lower().strip()
        if needle in self._items:
            return [self._items[needle]]

        matched = []
        for item in self._items.values():
            haystack = " ".join(
                [
                    item["title"],
                    item.get("description", ""),
                    " ".join(item.get("tags", [])),
                ]
            ).lower()
            if needle in haystack:
                matched.append(item)
        return matched[:limit]

    async def get_by_id(self, work_item_id: str) -> dict[str, Any]:
        if work_item_id not in self._items:
            raise KeyError(f"Unknown mock work item: {work_item_id}")
        return self._items[work_item_id]


WORK_ITEM_FIELDS = [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "System.Tags",
    "System.AreaPath",
    "System.IterationPath",
    "Microsoft.VSTS.Common.Priority",
    "System.Description",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
]


class AzureDevOpsRestProvider:
    def __init__(self, org_url: str, project: str, pat: str) -> None:
        self.org_url = normalize_org_url(org_url)
        self.project = project
        self.headers = build_auth_headers(pat)

    async def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        needle = query.strip()

        # A bare number is almost always a work item id pasted from Azure DevOps.
        if needle.isdigit():
            try:
                return [await self.get_by_id(needle)]
            except KeyError:
                return []

        clauses = [f"[System.TeamProject] = '{self.project}'"]
        if needle:
            escaped = needle.replace("'", "''")
            clauses.append(f"[System.Title] Contains '{escaped}'")

        wiql = {
            "query": (
                "Select [System.Id] From WorkItems "
                f"Where {' And '.join(clauses)} "
                "Order By [System.ChangedDate] Desc"
            )
        }
        url = f"{self.org_url}/{self.project}/_apis/wit/wiql?api-version=7.0&$top={limit}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, headers=self.headers, json=wiql)
        payload = read_json_response(response, t("ado.ctx.search"))

        ids = [str(item["id"]) for item in payload.get("workItems", [])[:limit]]
        if not ids:
            return []

        details = await self._fetch_many(ids)
        return [self._to_work_item(item) for item in details]

    async def get_by_id(self, work_item_id: str) -> dict[str, Any]:
        details = await self._fetch_many([str(work_item_id)], with_relations=True)
        if not details:
            raise KeyError(t("ado.err.not_found", work_item_id=work_item_id))
        return self._to_work_item(details[0])

    async def _fetch_many(self, ids: list[str], with_relations: bool = False) -> list[dict[str, Any]]:
        url = f"{self.org_url}/_apis/wit/workitemsbatch?api-version=7.0"
        body: dict[str, Any] = {"ids": [int(item_id) for item_id in ids]}

        # workitemsbatch rejects `fields` and `$expand` together, so relations are
        # only requested where they are actually needed (single work item load).
        if with_relations:
            body["$expand"] = "Relations"
        else:
            body["fields"] = WORK_ITEM_FIELDS

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, headers=self.headers, json=body)
        payload = read_json_response(response, t("ado.ctx.load"))
        return payload.get("value", [])

    def _to_work_item(self, item: dict[str, Any]) -> dict[str, Any]:
        fields = item.get("fields", {})
        tags = fields.get("System.Tags", "")
        return {
            "id": str(fields.get("System.Id", item.get("id"))),
            "type": fields.get("System.WorkItemType", "Work Item"),
            "title": fields.get("System.Title", "Untitled"),
            "url": item.get("url"),
            "description": _strip_html(fields.get("System.Description")),
            "acceptanceCriteria": _strip_html(fields.get("Microsoft.VSTS.Common.AcceptanceCriteria")),
            "tags": [tag.strip() for tag in tags.split(";") if tag.strip()],
            "areaPath": fields.get("System.AreaPath"),
            "iterationPath": fields.get("System.IterationPath"),
            "priority": fields.get("Microsoft.VSTS.Common.Priority"),
            "state": fields.get("System.State"),
            "relations": [
                {
                    "type": relation.get("rel", "unknown"),
                    "url": relation.get("url"),
                    "targetId": relation.get("attributes", {}).get("id"),
                }
                for relation in item.get("relations", [])
            ],
            "raw": item,
        }


def build_work_item_provider_from_values(
    *,
    org_url: str,
    project: str,
    pat: str,
    mock_mode: bool,
) -> WorkItemProvider:
    if mock_mode:
        return MockAzureDevOpsProvider()

    if not org_url:
        raise ValueError(t("ado.err.org_missing"))
    if not project:
        raise ValueError(t("ado.err.project_missing"))
    if not pat:
        raise ValueError(t("ado.err.pat_missing"))

    return AzureDevOpsRestProvider(org_url=org_url, project=project, pat=pat)


def build_work_item_provider(settings: Settings) -> WorkItemProvider:
    return build_work_item_provider_from_values(
        org_url=settings.azure_devops_org,
        project=settings.azure_devops_project,
        pat=settings.azure_devops_pat,
        mock_mode=settings.azure_devops_mock_mode,
    )
