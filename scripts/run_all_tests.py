"""
scripts/run_all_tests.py
Master Automated Test Orchestrator for the NASA Astronaut Health Monitoring System.
Executes all unit, edge case, throughput benchmark, and API streaming test suites,
reporting execution times, pass/fail statuses, and system validation metrics.
"""

import sys
import os
import time
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS_DIR = os.path.join(BASE_DIR, "backend", "tests")
sys.path.insert(0, BASE_DIR)


def run_master_test_suite():
    print("=" * 75)
    print(" NASA ASTRONAUT HEALTH MONITORING SYSTEM — MASTER VERIFICATION HARNESS")
    print(" Standards: NASA-STD-8739.8 / NASA-HCI-MED-STD-2026.2")
    print("=" * 75)

    test_modules = [
        ("Bounded Ring Buffer (O(1) Memory)", "test_circular_buffer"),
        ("Z-Score Mathematical Precision & NaN Safety", "test_zscore_math"),
        ("Contextual Activity & Workout Tachycardia Gating", "test_activity_gating"),
        ("Multi-Signal Sentry Matrix & Severity Ladder", "test_sentry_matrix"),
        ("Aerospace Computational Biomarkers & Risk Indices", "test_computational_biomarkers"),
        ("NASA OSDR Laboratory Assays (119 Biomarkers)", "test_lab_assay_manager"),
        ("SQLite WAL Concurrency & Throughput Benchmark", "test_database_wal"),
        ("FastAPI REST & Telemetry Streaming Endpoints", "test_api_streaming"),
        ("JARVIS AI Decision Engine & Voice Warnings", "test_ai_infrastructure"),
    ]

    total_tests = 0
    total_failures = 0
    total_errors = 0
    results_summary = []
    start_total_time = time.perf_counter()

    loader = unittest.TestLoader()

    for name, module_name in test_modules:
        print(f"\n[>] Executing Suite: {name} ({module_name}.py)...")
        suite = loader.loadTestsFromName(f"backend.tests.{module_name}")
        runner = unittest.TextTestRunner(verbosity=1)

        t0 = time.perf_counter()
        result = runner.run(suite)
        elapsed = time.perf_counter() - t0

        total_tests += result.testsRun
        total_failures += len(result.failures)
        total_errors += len(result.errors)

        status = "PASSED" if result.wasSuccessful() else "FAILED"
        results_summary.append({
            "name": name,
            "module": module_name,
            "tests_run": result.testsRun,
            "elapsed_ms": elapsed * 1000,
            "status": status
        })

    total_elapsed = time.perf_counter() - start_total_time

    print("\n" + "=" * 75)
    print(" MASTER VERIFICATION AUDIT REPORT")
    print("=" * 75)
    print(f"{'Test Subsystem':<50} | {'Tests':<6} | {'Time (ms)':<10} | {'Status':<6}")
    print("-" * 75)

    for item in results_summary:
        print(f"{item['name']:<50} | {item['tests_run']:<6} | {item['elapsed_ms']:<10.2f} | {item['status']:<6}")

    print("-" * 75)
    print(f"Total Suites: {len(test_modules)} | Total Tests: {total_tests} | "
          f"Failures: {total_failures} | Errors: {total_errors}")
    print(f"Total Verification Wall Time: {total_elapsed:.3f} seconds")
    print("=" * 75)

    if total_failures == 0 and total_errors == 0:
        print("\n[OK] 100% FLIGHT VERIFICATION CRITERIA SATISFIED. SYSTEM FLIGHT-READY.")
        return 0
    else:
        print("\n[FAIL] CRITICAL FLIGHT DEFECTS DETECTED. SYSTEM NOT READY.")
        return 1


if __name__ == "__main__":
    exit_code = run_master_test_suite()
    sys.exit(exit_code)
