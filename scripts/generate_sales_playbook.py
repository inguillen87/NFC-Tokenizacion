"""Compatibility entrypoint for the canonical Sales Playbook generator.

Keep all commercial copy in generate-sales-playbook-pdf.py so the dashboard,
web and docs mirrors cannot drift between two independent generators.
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).with_name("generate-sales-playbook-pdf.py")),
        run_name="__main__",
    )
