from __future__ import annotations

import hashlib
from functools import cached_property
from pathlib import Path


class PromptLoader:
    def __init__(self, prompts_dir: Path):
        self.prompts_dir = prompts_dir

    def load(self, prompt_name: str) -> str:
        prompt_path = self.prompts_dir / f"{prompt_name}.md"
        return prompt_path.read_text(encoding="utf-8")

    @cached_property
    def version(self) -> str:
        digest = hashlib.sha1()
        for prompt_file in sorted(self.prompts_dir.glob("*.md")):
            digest.update(prompt_file.name.encode("utf-8"))
            digest.update(prompt_file.read_bytes())
        return digest.hexdigest()[:12]
