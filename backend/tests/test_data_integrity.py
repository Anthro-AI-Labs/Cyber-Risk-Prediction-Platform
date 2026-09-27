import shutil
from pathlib import Path

import pytest

from app.data_loader import DATA_DIR, DataIntegrityError, DataLoader, verify_data_manifest

# Hashes of the provided originals (docs/REFERENCE_FACTS.md §3). Kept here as well as in
# data/MANIFEST.sha256 so that editing a data file *and* the manifest still fails a test.
REFERENCE_HASHES = {
    "mitre/MITRE_ATTACK_demo_subset.json": "2725bd45060e1f9bb6cad0fedf55102f76c65d0a8bcfbba1e678e32ca6128eb3",
    "ctid/ctid_m365_mappings_subset.json": "f0742a06e782d6e808e6abb08beba61c14a7dd635a98edcb04b19349777ff059",
    "mappings.json": "0b5414f94ba1969f6fff108b06368761e935d38fb498351b68a98ccac0c2f1b9",
    "risk_assumptions.json": "58a338ce7f6bbf2f2de19adbb1dedd6bfb5b2c8012688470e6546f9934532ff5",
}


def test_manifest_matches_reference_hashes():
    assert verify_data_manifest(DATA_DIR) == REFERENCE_HASHES


def _copy_data(tmp_path: Path) -> Path:
    dst = tmp_path / "data"
    shutil.copytree(DATA_DIR, dst, ignore=shutil.ignore_patterns(".cache"))
    return dst


def test_loader_fails_loudly_on_modified_file(tmp_path):
    data = _copy_data(tmp_path)
    DataLoader(data_dir=data)  # pristine copy loads
    p = data / "mappings.json"
    p.write_bytes(p.read_bytes() + b"\n")
    with pytest.raises(DataIntegrityError, match="mappings.json"):
        DataLoader(data_dir=data)


def test_loader_fails_on_missing_manifest(tmp_path):
    data = _copy_data(tmp_path)
    (data / "MANIFEST.sha256").unlink()
    with pytest.raises(DataIntegrityError, match="manifest missing"):
        DataLoader(data_dir=data)
