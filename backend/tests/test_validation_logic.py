import copy

from app.validation import (
    _check,
    _combine,
    all_tool_configs,
    compare_engines,
    python_engine_results,
    run_d4_correctness_reproducibility,
)


def test_check_status_is_computed():
    assert _check(3, 3)["status"] == "PASS"
    assert _check(2, 3)["status"] == "FAIL"
    assert _check(0, 0)["status"] == "FAIL"  # nothing checked is not a pass


def test_combine_fails_on_any_failure_and_ignores_info():
    assert _combine({"status": "PASS"}, {"status": "INFO"}) == "PASS"
    assert _combine({"status": "PASS"}, {"status": "FAIL"}) == "FAIL"
    assert _combine({"status": "PASS"}, {"status": "NOT_RUN"}) == "NOT_RUN"


def test_all_tool_configs_covers_every_combination():
    configs = all_tool_configs()
    assert len(configs) == 256
    assert len({tuple(sorted(c)) for c in configs}) == 256


def test_compare_engines_detects_a_single_difference():
    py = python_engine_results(all_tool_configs()[:8])
    assert compare_engines(py, copy.deepcopy(py))["passed"] == 8
    ts = copy.deepcopy(py)
    ts[3]["scenarios"]["S2"]["ale_point_rounded"] += 1
    res = compare_engines(py, ts)
    assert res["passed"] == 7 and "S2.ale_point_rounded" in res["failures"][0]


def test_missing_inputs_are_not_run_and_failing_tests_fail():
    d4 = run_d4_correctness_reproducibility()
    assert d4["acceptance_tests"]["status"] == "NOT_RUN"
    assert d4["python_ts_parity"]["status"] == "NOT_RUN"
    failing = {"pytest": {"passed": 9, "failed": 1, "errors": 0, "skipped": 0, "total": 10}}
    assert run_d4_correctness_reproducibility(test_results=failing)["acceptance_tests"]["status"] == "FAIL"
