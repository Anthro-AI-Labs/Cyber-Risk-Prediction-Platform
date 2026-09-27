import copy
import json

import pytest

from app.validation import CACHE_DIR, MITRE_SUBSET_PATH, check_mitre_fidelity

STIX_PATH = CACHE_DIR / "enterprise-attack-19.2.json"
pytestmark = pytest.mark.skipif(not STIX_PATH.exists(), reason="official MITRE STIX cache not present")


@pytest.fixture(scope="module")
def stix_objects():
    return json.loads(STIX_PATH.read_text(encoding="utf-8"))["objects"]


@pytest.fixture()
def subset():
    return json.loads(MITRE_SUBSET_PATH.read_text(encoding="utf-8"))


def test_provided_subset_matches_official_stix(subset, stix_objects):
    res = check_mitre_fidelity(subset, stix_objects)
    assert res["failures"] == []
    assert (res["passed"], res["total"]) == (118, 118)
    assert (res["field_checks_total"], res["step_checks_total"]) == (84, 34)


def _mutated(subset, mutate):
    bad = copy.deepcopy(subset)
    mutate(bad)
    return bad


def test_catches_wrong_mitigation_url(subset, stix_objects, tmp_path):
    # Reproduces the edit found in the audit: T1114.003 / M1041 pointing at the M1042 page.
    def mutate(s):
        tech = next(t for t in s["techniques"] if t["id"] == "T1114.003")
        mit = next(m for m in tech["mitigations"] if m["id"] == "M1041")
        mit["url"] = "https://attack.mitre.org/mitigations/M1042"

    # Round-trip through a temporary file, as a mutated copy of the data file would be read.
    path = tmp_path / "MITRE_ATTACK_demo_subset.json"
    path.write_text(json.dumps(_mutated(subset, mutate)), encoding="utf-8")
    res = check_mitre_fidelity(json.loads(path.read_text(encoding="utf-8")), stix_objects)
    assert res["passed"] == 117
    assert any("T1114.003" in f and "M1041" in f and "url" in f for f in res["failures"])


@pytest.mark.parametrize(
    "mutate, needle",
    [
        (lambda s: s["techniques"][0].update(url="https://attack.mitre.org/techniques/T9999"), "technique url"),
        (lambda s: s["techniques"][0].update(name="Renamed"), "name"),
        (lambda s: s["techniques"][0]["mitigations"].pop(), "mitigation set differs"),
        (lambda s: s["techniques"][0]["mitigations"][0].update(name="Wrong"), "name"),
        (lambda s: s["scenarios"][0]["steps"][0].update(technique_id="T0000"), "does not match STIX"),
    ],
)
def test_catches_other_edits(subset, stix_objects, mutate, needle):
    res = check_mitre_fidelity(_mutated(subset, mutate), stix_objects)
    assert res["passed"] < res["total"]
    assert any(needle in f for f in res["failures"])
