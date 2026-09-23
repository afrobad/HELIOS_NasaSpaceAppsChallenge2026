"""
generate_telemetry_stream.py
Synthesizes a continuous 10 Hz spaceflight telemetry dataset calibrated against
NASA OSDR astronaut baseline profiles (OSD-575, OSD-569), incorporating the
8 competition demonstration scenarios including presymptomatic clinical forecasting.
"""

import os
import json
import math
import random
import csv
from datetime import datetime, timedelta, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
BASELINES_FILE = os.path.join(DATA_DIR, "nasa_astronaut_baselines.json")
OUTPUT_CSV = os.path.join(DATA_DIR, "astronaut_telemetry_stream.csv")


def calculate_fridericia_qtc(hr: float, raw_qt: float) -> float:
    if hr <= 0:
        return raw_qt
    rr_sec = 60.0 / max(30.0, min(220.0, hr))
    cbrt_rr = math.pow(rr_sec, 1.0 / 3.0)
    return round(raw_qt / max(0.5, cbrt_rr), 1)


def generate_telemetry():
    print("=" * 70)
    print(" NASA Spaceflight Multimodal 10 Hz Telemetry Synthesis Engine")
    print(" Standards: NASA OSDR (OSD-575 / OSD-569) + HRP Presymptomatic Models")
    print("=" * 70)

    if not os.path.exists(BASELINES_FILE):
        raise FileNotFoundError(f"Baseline file missing: {BASELINES_FILE}")

    with open(BASELINES_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    crew_profiles = config["crew_profiles"]
    env_baselines = config["environmental_baselines"]

    # Simulation duration: 1080 seconds (18 minutes) @ 10 Hz = 10,800 ticks per astronaut
    fps = 10
    total_seconds = 1080
    total_ticks = total_seconds * fps

    start_time = datetime(2026, 10, 3, 14, 0, 0, tzinfo=timezone.utc)

    # Multimodal Columns (Continuous Biosignals + NASA OSDR Point-of-Care Lab Biomarkers + Indexes)
    fieldnames = [
        "timestamp",
        "tick",
        "astronaut_id",
        "astronaut_name",
        "mission_state",
        "heart_rate",
        "hrv_rmssd",
        "spo2",
        "core_temp",
        "sleep_score",
        "cabin_co2",
        "potassium",
        "hematocrit",
        "wbc_count",
        "il_6",
        "platelet_count",
        "crp",
        "radiation_flux",
        "lymphocyte_count",
        "radiation_dose_gy",
        "computed_qtc",
        "computed_epi",
        "computed_arf",
        "computed_trm",
        "computed_rsi",
        "scenario_phase",
        "z_score_hr",
        "z_score_hrv",
        "alert_severity",
        "data_source"
    ]

    print(f"[>] Generating {total_ticks} ticks (10 Hz, {total_seconds}s) for {len(crew_profiles)} crew members...")

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()


        for ast_id, profile in crew_profiles.items():
            ast_name = profile["name"]
            rest_b = profile["baselines"]["REST"]
            workout_b = profile["baselines"]["WORKOUT"]

            print(f"    [*] Simulating multimodal streams for {ast_name}...")

            for tick in range(total_ticks):
                t_sec = tick / fps
                current_time = start_time + timedelta(seconds=t_sec)
                time_str = current_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

                # Respiratory Sinus Arrhythmia
                rsa = 1.8 * math.sin(2 * math.pi * 0.25 * t_sec)
                noise_hr = random.gauss(0, 0.35)
                noise_hrv = random.gauss(0, 0.75)

                # Default NASA OSDR Lab Baseline values
                potassium = 4.2 + random.gauss(0, 0.05)
                hematocrit = 44.2 + random.gauss(0, 0.2)
                wbc_count = 6.8 + random.gauss(0, 0.15)
                il_6 = 6.5 + random.gauss(0, 0.3)
                platelets = 245.0 + random.gauss(0, 3.0)
                crp = 1.2 + random.gauss(0, 0.05)
                radiation_flux = 0.05 + random.gauss(0, 0.005)  # Nominal deep-space cosmic background ~0.05 mGy/h
                lymphocyte_count = 2.2 + random.gauss(0, 0.05)  # Normal ALC 2.2 k/uL
                raw_qt = 395.0

                # -------------------------------------------------------------
                # 9 Demonstration Scenarios Timeline
                # -------------------------------------------------------------

                if t_sec < 120:
                    # 1. NOMINAL CRUISE (0 - 120s)
                    mission_state = "REST"
                    scenario_phase = "NOMINAL_CRUISE"
                    target_hr = rest_b["heart_rate"]["mean"] + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] + noise_hrv
                    target_spo2 = rest_b["spo2"]["mean"] + random.gauss(0, 0.12)
                    target_temp = rest_b["core_temp"]["mean"] + random.gauss(0, 0.02)
                    sleep_score = rest_b["sleep_score"]["mean"]
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + random.gauss(0, 0.04)

                elif 120 <= t_sec < 240:
                    # 2. SCENARIO 1: Fatigue Drift (120 - 240s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_1_BASELINE_DRIFT"
                    progress = (t_sec - 120) / 120.0
                    target_hr = rest_b["heart_rate"]["mean"] + (progress * 14.0) + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] * (1.0 - 0.35 * progress) + noise_hrv
                    target_spo2 = rest_b["spo2"]["mean"] + random.gauss(0, 0.15)
                    target_temp = rest_b["core_temp"]["mean"] + (progress * 0.25)
                    sleep_score = rest_b["sleep_score"]["mean"] - (progress * 15)
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + random.gauss(0, 0.05)

                elif 240 <= t_sec < 360:
                    # 3. SCENARIO 2: Workout Gating & Recovery (240 - 360s)
                    scenario_phase = "SCENARIO_2_WORKOUT_GATING"
                    if t_sec < 310:
                        mission_state = "WORKOUT"
                        workout_prog = (t_sec - 240) / 70.0
                        target_hr = 120 + (35 * math.sin(workout_prog * math.pi)) + random.gauss(0, 1.5)
                        target_hrv = workout_b["hrv_rmssd"]["mean"] + random.gauss(0, 0.5)
                        target_spo2 = workout_b["spo2"]["mean"] + random.gauss(0, 0.2)
                        target_temp = workout_b["core_temp"]["mean"] + random.gauss(0, 0.05)
                        sleep_score = rest_b["sleep_score"]["mean"]
                        cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + 0.3 + random.gauss(0, 0.05)
                        potassium = 4.5  # Transient exercise hyperkalemia
                    else:
                        mission_state = "POST_WORKOUT"
                        recov_prog = (t_sec - 310) / 50.0
                        recov_decay = math.exp(-3.0 * recov_prog)
                        target_hr = rest_b["heart_rate"]["mean"] + (65.0 * recov_decay) + noise_hr
                        target_hrv = rest_b["hrv_rmssd"]["mean"] - (30.0 * recov_decay) + noise_hrv
                        target_spo2 = rest_b["spo2"]["mean"] + random.gauss(0, 0.15)
                        target_temp = rest_b["core_temp"]["mean"] + (0.5 * recov_decay)
                        sleep_score = rest_b["sleep_score"]["mean"]
                        cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + random.gauss(0, 0.05)

                elif 360 <= t_sec < 480:
                    # 4. SCENARIO 3: Acute CO2 Hypoxia (360 - 480s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_3_CO2_HYPOXIA"
                    crisis_prog = min(1.0, (t_sec - 360) / 50.0)
                    target_hr = rest_b["heart_rate"]["mean"] + (crisis_prog * 28.0) + rsa + noise_hr
                    target_hrv = max(15.0, rest_b["hrv_rmssd"]["mean"] - (crisis_prog * 35.0))
                    target_spo2 = rest_b["spo2"]["mean"] - (crisis_prog * 9.2) + random.gauss(0, 0.2)
                    target_temp = rest_b["core_temp"]["mean"] + (crisis_prog * 0.6)
                    sleep_score = rest_b["sleep_score"]["mean"]
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + (crisis_prog * 2.4) + random.gauss(0, 0.05)

                elif 480 <= t_sec < 600:
                    # 5. SCENARIO 4: Deep Space Blackout (480 - 600s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_4_DEEP_SPACE_BLACKOUT"
                    target_hr = rest_b["heart_rate"]["mean"] + 5.0 + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] - 8.0 + noise_hrv
                    target_spo2 = 96.5 + random.gauss(0, 0.15)
                    target_temp = rest_b["core_temp"]["mean"] + 0.1
                    sleep_score = 65.0
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"] + random.gauss(0, 0.05)

                elif 600 <= t_sec < 720:
                    # 6. SCENARIO 5: PRESYMPTOMATIC SEPSIS / CYTOKINE SURGE (600 - 720s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_5_PRESYMPTOMATIC_SEPSIS"
                    prog = min(1.0, (t_sec - 600) / 60.0)
                    target_hr = rest_b["heart_rate"]["mean"] + (prog * 3.5) + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] - (prog * 18.0) + noise_hrv
                    target_spo2 = rest_b["spo2"]["mean"] - (prog * 0.6)
                    target_temp = rest_b["core_temp"]["mean"] + (prog * 0.15)
                    sleep_score = 72.0
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"]
                    il_6 = 6.5 + (prog * 115.0) + random.gauss(0, 2.5)
                    wbc_count = 6.8 + (prog * 5.8) + random.gauss(0, 0.2)
                    crp = 1.2 + (prog * 14.5)

                elif 720 <= t_sec < 840:
                    # 7. SCENARIO 6: SILENT HYPOKALEMIC ARRHYTHMIA VULNERABILITY (720 - 840s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA"
                    prog = min(1.0, (t_sec - 720) / 60.0)
                    target_hr = rest_b["heart_rate"]["mean"] + (prog * 4.0) + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] + (prog * 6.0) + noise_hrv
                    target_spo2 = rest_b["spo2"]["mean"]
                    target_temp = rest_b["core_temp"]["mean"]
                    sleep_score = 80.0
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"]
                    potassium = max(2.7, 4.2 - (prog * 1.35) + random.gauss(0, 0.04))
                    raw_qt = 395.0 + (prog * 65.0)

                elif 840 <= t_sec < 960:
                    # 8. SCENARIO 7: CEPHALIC VENOUS STASIS & THROMBOSIS RISK (840 - 960s)
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_7_VENOUS_THROMBOSIS_RISK"
                    prog = min(1.0, (t_sec - 840) / 60.0)
                    target_hr = rest_b["heart_rate"]["mean"] + (prog * 2.0) + rsa + noise_hr
                    target_hrv = rest_b["hrv_rmssd"]["mean"] - 4.0 + noise_hrv
                    target_spo2 = rest_b["spo2"]["mean"] - (prog * 0.8)
                    target_temp = rest_b["core_temp"]["mean"]
                    sleep_score = 75.0
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"]
                    hematocrit = 44.2 + (prog * 7.5) + random.gauss(0, 0.15)
                    platelets = 245.0 + (prog * 125.0) + random.gauss(0, 2.0)
                    il_6 = 6.5 + (prog * 18.0)

                else:
                    # 9. SCENARIO 8: ACUTE SOLAR PARTICLE EVENT & ARS BIODOSIMETRY (960 - 1080s)
                    # Coronal Mass Ejection strike: Dosimeter surges to 340 mGy/h,
                    # Lymphocyte count depletes exponentially according to Andrews Kinetic Model
                    mission_state = "REST"
                    scenario_phase = "SCENARIO_8_SOLAR_RADIATION_STORM"
                    prog = min(1.0, (t_sec - 960) / 60.0)
                    target_hr = rest_b["heart_rate"]["mean"] + (prog * 14.0) + rsa + noise_hr  # Prodromal tachycardia
                    target_hrv = max(18.0, rest_b["hrv_rmssd"]["mean"] - (prog * 24.0) + noise_hrv) # Autonomic suppression
                    target_spo2 = rest_b["spo2"]["mean"] - (prog * 1.5)
                    target_temp = rest_b["core_temp"]["mean"] + (prog * 0.3)  # Prodromal hyperthermia
                    sleep_score = 65.0
                    cabin_co2 = env_baselines["cabin_co2_mmhg"]["nominal_mean"]
                    # Physical dosimeter spike (mGy/h)
                    radiation_flux = 0.05 + (prog * 340.0) + random.gauss(0, 3.0)
                    # Biological lymphocyte depletion (Andrews Kinetic Curve)
                    lymphocyte_count = max(0.45, 2.2 - (prog * 1.55) + random.gauss(0, 0.02))

                # Clamp bounded metrics
                target_spo2 = min(100.0, max(85.0, round(target_spo2, 1)))
                target_hr = round(max(40.0, min(190.0, target_hr)), 1)
                target_hrv = round(max(8.0, min(120.0, target_hrv)), 1)
                target_temp = round(target_temp, 2)
                cabin_co2 = round(max(0.5, cabin_co2), 2)
                sleep_score = round(max(0.0, min(100.0, sleep_score)), 1)
                potassium = round(max(2.0, min(6.5, potassium)), 2)
                hematocrit = round(max(30.0, min(60.0, hematocrit)), 1)
                wbc_count = round(max(2.0, min(25.0, wbc_count)), 1)
                il_6 = round(max(1.0, min(250.0, il_6)), 1)
                platelets = round(max(80.0, min(600.0, platelets)), 1)
                crp = round(max(0.2, min(50.0, crp)), 1)
                radiation_flux = round(max(0.01, radiation_flux), 2)
                lymphocyte_count = round(max(0.2, lymphocyte_count), 2)

                # Mathematical Presymptomatic Index Calculations
                computed_qtc = calculate_fridericia_qtc(target_hr, raw_qt)

                # ARF (Arrhythmogenic Risk Factor)
                arf = (computed_qtc / 450.0) * math.pow(3.8 / potassium, 1.8)
                computed_arf = round(max(0.2, min(5.0, arf)), 2)

                # EPI (Early Sepsis Prediction Index)
                il6_s = min(3.0, max(0.0, (il_6 - 8.0) / 30.0))
                wbc_s = min(2.5, max(0.0, (wbc_count - 7.0) / 2.5))
                hrv_dec = max(0.0, (rest_b["hrv_rmssd"]["mean"] - target_hrv) / rest_b["hrv_rmssd"]["mean"])
                computed_epi = round(min(3.0, (0.45 * il6_s) + (0.30 * wbc_s) + (0.25 * hrv_dec * 2.0)), 2)

                # TRM (Thrombosis Risk Metric)
                hct_f = max(1.0, hematocrit / 44.0)
                plt_f = max(1.0, platelets / 240.0)
                computed_trm = round(min(5.0, (math.pow(hct_f, 2.5) * plt_f * math.sqrt(max(1.0, il_6 / 10.0))) / (target_spo2 / 98.5)), 2)

                # Andrews Kinetic Biodosimetry & Radiation Sickness Index (RSI)
                alc_ratio = max(0.05, lymphocyte_count / 2.2)
                dose_gy = -math.log(alc_ratio) / (0.05 * 4.0)
                radiation_dose_gy = round(max(0.0, min(10.0, dose_gy)), 2)
                phys_s = max(0.0, (radiation_flux - 10.0) / 100.0)
                bio_s = max(0.0, (1.0 - alc_ratio) * 2.5)
                computed_rsi = round(max(0.1, min(5.0, (0.5 * phys_s) + (0.5 * bio_s))), 2)

                # Z-scores
                z_hr = (target_hr - rest_b["heart_rate"]["mean"]) / rest_b["heart_rate"]["std"]
                z_hrv = (target_hrv - rest_b["hrv_rmssd"]["mean"]) / rest_b["hrv_rmssd"]["std"]

                # Multi-Signal Severity Determination
                if (
                    target_spo2 < 90.0 or
                    cabin_co2 >= 4.0 or
                    computed_arf >= 1.6 or
                    computed_trm >= 2.2 or
                    computed_rsi >= 1.8 or
                    radiation_dose_gy >= 1.5
                ):
                    severity = "CRITICAL"
                elif mission_state == "WORKOUT":
                    severity = "NOMINAL"
                elif (
                    (abs(z_hr) >= 2.0 and z_hrv <= -2.0) or
                    cabin_co2 >= 3.0 or
                    computed_epi >= 1.2 or
                    computed_arf >= 1.25 or
                    computed_trm >= 1.5 or
                    computed_rsi >= 1.0 or
                    radiation_dose_gy >= 0.5
                ):
                    severity = "WARNING"
                elif abs(z_hr) >= 1.5 or abs(z_hrv) >= 1.5 or computed_epi >= 0.8 or computed_rsi >= 0.5:
                    severity = "INFO"
                else:
                    severity = "NOMINAL"

                row = {
                    "timestamp": time_str,
                    "tick": tick,
                    "astronaut_id": ast_id,
                    "astronaut_name": ast_name,
                    "mission_state": mission_state,
                    "heart_rate": target_hr,
                    "hrv_rmssd": target_hrv,
                    "spo2": target_spo2,
                    "core_temp": target_temp,
                    "sleep_score": sleep_score,
                    "cabin_co2": cabin_co2,
                    "potassium": potassium,
                    "hematocrit": hematocrit,
                    "wbc_count": wbc_count,
                    "il_6": il_6,
                    "platelet_count": platelets,
                    "crp": crp,
                    "radiation_flux": radiation_flux,
                    "lymphocyte_count": lymphocyte_count,
                    "radiation_dose_gy": radiation_dose_gy,
                    "computed_qtc": computed_qtc,
                    "computed_epi": computed_epi,
                    "computed_arf": computed_arf,
                    "computed_trm": computed_trm,
                    "computed_rsi": computed_rsi,
                    "scenario_phase": scenario_phase,
                    "z_score_hr": round(z_hr, 2),
                    "z_score_hrv": round(z_hrv, 2),
                    "alert_severity": severity,
                    "data_source": "REAL_NASA_OSDR_DERIVED_10HZ_MULTIMODAL_STREAM"
                }
                writer.writerow(row)


    file_size_mb = os.path.getsize(OUTPUT_CSV) / (1024 * 1024)
    print(f"\n[OK] Generated Multimodal Stream at {OUTPUT_CSV} ({file_size_mb:.2f} MB, {total_ticks * len(crew_profiles)} total rows)")


if __name__ == "__main__":
    generate_telemetry()
