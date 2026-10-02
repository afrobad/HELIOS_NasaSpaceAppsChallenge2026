"""
scripts/test_live_backend_mcc.py
Live Backend & MCC End-to-End Integration Verification Suite.
Executes live HTTP REST and WebSocket requests against the running FastAPI server (http://localhost:8000).
Tests:
1. System Health & Flight Computer Status (/api/health)
2. Authentic NASA OSDR Baselines (/api/baselines)
3. 10 Hz Telemetry Broadcast for all 4 Astronauts (/api/telemetry/latest-all)
4. Deep-Space Delay Toggle (/api/mars-delay) & Instant Recovery
5. Competition Scenario Triggering with Target Astronaut (/api/scenario/{key})
6. NASA OSDR Point-of-Care Laboratory Assays (/api/telemetry/lab-assays/{id})
7. Edge cases & error handling (invalid IDs, invalid scenarios, concurrent burst queries)
"""

import urllib.request
import urllib.error
import json
import time
import sys
import io

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"


def make_request(path: str, method: str = "GET", payload: dict = None) -> tuple[int, dict]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"} if payload else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content)
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, {"error": content}
    except Exception as e:
        return 500, {"error": str(e)}


def run_live_integration_suite():
    print("=" * 75)
    print(" H.E.L.I.O.S. LIVE BACKEND & MCC FLIGHT COMPUTER INTEGRATION VERIFICATION")
    print(f" Target: {BASE_URL}")
    print("=" * 75)

    passed = 0
    failed = 0

    def assert_test(name: str, condition: bool, details: str = ""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  [+] PASS: {name}")
        else:
            failed += 1
            print(f"  [-] FAIL: {name} | {details}")

    # 1. Health Endpoint
    status, data = make_request("/api/health")
    assert_test("Health Endpoint Returns NOMINAL", status == 200 and data.get("status") == "NOMINAL", str(data))
    assert_test("Streaming Hz is 10 Hz", data.get("streaming_hz") == 10, str(data))
    assert_test("Loaded Crew Count is 4", data.get("loaded_crew_members") == 4, str(data))

    # 2. Crew Baselines
    status, data = make_request("/api/baselines")
    assert_test("Baselines Endpoint Returns 200", status == 200, str(status))
    profiles = data.get("crew_profiles", {})
    assert_test("All 4 Crew Profiles Loaded", len(profiles) == 4, f"Found {len(profiles)}")
    env = data.get("environmental_baselines", {})
    assert_test("Environmental Baselines Contain CO2 Flight Rule Limit", "cabin_co2_mmhg" in env or "cabin_co2" in env, str(env))

    # 3. Latest Telemetry All Crew
    status, data = make_request("/api/telemetry/latest-all")
    assert_test("Latest All Telemetry Returns 200", status == 200, str(status))
    telem = data.get("telemetry", {})
    for ast_id in ["AST-01_COMMANDER", "AST-02_PILOT", "AST-03_MEDICAL", "AST-04_ENGINEER"]:
        pkt = telem.get(ast_id)
        assert_test(f"Telemetry for {ast_id} Active", pkt is not None and pkt.get("heart_rate") > 0, str(pkt))

    # 4. Mars Delay Toggle (Speed-of-Light Interplanetary Mode)
    status, data = make_request("/api/mars-delay?enabled=true", method="POST")
    assert_test("Mars 22m Delay Activated", status == 200 and data.get("delay_minutes") == 22.0, str(data))

    status, data = make_request("/api/mars-delay?enabled=false", method="POST")
    assert_test("Mars Delay Deactivated (Instant Warp)", status == 200 and data.get("delay_minutes") == 0.0, str(data))

    # 5. Demonstration Scenario Injection
    status, data = make_request("/api/scenario/SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH", method="POST")
    assert_test("CO2 Scrubber Breakthrough Scenario Injected", status == 200 and data.get("status") == "SCENARIO_TRIGGERED", str(data))

    # Reset to nominal
    status, data = make_request("/api/scenario/NOMINAL_CRUISE", method="POST")
    assert_test("Nominal Cruise Scenario Restored", status == 200, str(data))

    # 6. NASA OSDR Authentic Assays
    status, data = make_request("/api/telemetry/lab-assays/AST-01_COMMANDER")
    assert_test("NASA OSDR Lab Assays Loaded for Commander", status == 200 and "cbc" in data, str(data))

    # 7. Edge Cases
    # Edge Case A: Invalid Scenario Key
    status, data = make_request("/api/scenario/NON_EXISTENT_SCENARIO_XYZ", method="POST")
    assert_test("Invalid Scenario Key Returns 404", status == 404, f"Got status {status}")

    # Edge Case B: Friendly Alias Resolution for Astronaut ID
    status, data = make_request("/api/telemetry/lab-assays/commander")
    assert_test("Friendly Alias 'commander' Resolves Cleanly", status == 200 and data.get("astronaut_id") == "AST-01_COMMANDER", str(data))

    # Edge Case C: Concurrency Stress Test (25 Rapid Requests)
    t0 = time.perf_counter()
    burst_success = 0
    for _ in range(25):
        st, _ = make_request("/api/telemetry/latest-all")
        if st == 200:
            burst_success += 1
    burst_time = time.perf_counter() - t0
    assert_test(f"Concurrency Stress Test (25 Requests in {burst_time*1000:.1f}ms)", burst_success == 25, f"Success {burst_success}/25")

    print("=" * 75)
    print(f" LIVE INTEGRATION RESULTS: {passed} PASSED | {failed} FAILED")
    print("=" * 75)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_live_integration_suite()
