"""Terminal output helpers.

Deliberately dependency-free: the CLI is meant to be installed with pipx into a
lot of environments, so every avoided dependency is one less reason for the
install to fail.
"""

from __future__ import annotations

import os
import shutil
import sys
import textwrap

_ANSI = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "red": "\033[0;31m",
    "green": "\033[0;32m",
    "yellow": "\033[0;33m",
    "blue": "\033[0;34m",
    "cyan": "\033[0;36m",
}


def _use_color() -> bool:
    # NO_COLOR is the cross-tool convention; a pipe or a redirect gets plain text.
    if os.getenv("NO_COLOR"):
        return False
    return sys.stdout.isatty()


def paint(text: str, *styles: str) -> str:
    if not _use_color():
        return text
    prefix = "".join(_ANSI.get(style, "") for style in styles)
    return f"{prefix}{text}{_ANSI['reset']}" if prefix else text


def width() -> int:
    # Cap at 88: full-width paragraphs on a maximised terminal are unreadable.
    return min(shutil.get_terminal_size((80, 24)).columns, 88)


def wrap(text: str, indent: str = "") -> str:
    return textwrap.fill(
        text,
        width=width(),
        initial_indent=indent,
        subsequent_indent=indent,
        replace_whitespace=True,
    )


def hang(text: str, first: str, rest: str) -> str:
    """Wrap with a hanging indent, so continuation lines stay under the first."""
    return textwrap.fill(text, width=width(), initial_indent=first, subsequent_indent=rest)


def out(text: str = "") -> None:
    print(text)


def heading(text: str) -> None:
    print()
    print(paint(text, "bold"))
    print(paint("─" * min(len(text), width()), "dim"))


def bullet(text: str, marker: str = "•") -> None:
    body = textwrap.fill(
        text,
        width=width(),
        initial_indent=f"  {marker} ",
        subsequent_indent="    ",
    )
    print(body)


def info(text: str) -> None:
    print(wrap(text))


def success(text: str) -> None:
    print(paint(f"✓ {text}", "green"))


def warn(text: str) -> None:
    print(paint(f"! {text}", "yellow"))


def error(text: str) -> None:
    print(paint(f"✗ {text}", "red"), file=sys.stderr)


def ask(prompt: str) -> str:
    """Read one answer. Ctrl-C / Ctrl-D abort the session cleanly."""
    try:
        return input(paint(prompt, "cyan")).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        raise AbortedByUser() from None


class AbortedByUser(Exception):
    """The operator interrupted an interactive prompt."""
