"""The JSON fixtures that vitest compares the TypeScript engine against are generated from the
Python engine by scripts/validate.py. These tests fail if a fixture no longer matches the engine."""
import json
from pathlib import Path

from app.validation import all_tool_configs, python_engine_results, python_monte_carlo_reference

FIXTURES = Path(__file__).parent / "fixtures"


def test_parity_fixture_matches_python_engine():
    fixture = json.loads((FIXTURES / "parity.json").read_text(encoding="utf-8"))
    assert fixture == python_engine_results(all_tool_configs())


def test_monte_carlo_fixture_matches_python_engine():
    fixture = json.loads((FIXTURES / "monte_carlo_reference.json").read_text(encoding="utf-8"))
    assert fixture == python_monte_carlo_reference()
    assert fixture["iterations"] == 10000
