"""Fusion 360 entry point for the weather-station enclosure generator.

This initial version is deliberately a smoke test. Running it from Fusion proves
that the repository-owned script is linked correctly. The enclosure generator
will replace the message box while keeping this same entry point.
"""

import traceback

import adsk.core


def run(_context):
    """Confirm that Fusion can execute the script from this repository."""
    app = adsk.core.Application.get()
    ui = app.userInterface

    try:
        ui.messageBox(
            "Connection established. Fusion is running the weather-station "
            "CAD script directly from the Git repository.",
            "Weather Station CAD",
        )
    except Exception:
        if ui:
            ui.messageBox(f"Script failed:\n{traceback.format_exc()}")
