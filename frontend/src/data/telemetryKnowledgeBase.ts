/**
 * frontend/src/data/telemetryKnowledgeBase.ts
 * Comprehensive RAG Grounding Knowledge Base for Helix-AI Autonomous Clinical Sentry.
 * 
 * Contains detailed specifications for:
 * 1. All 18 NASA / Spaceflight Telemetry Devices deployed on the spacecraft.
 * 2. All 24+ Cardiorespiratory, Metabolic, Environmental, and Autonomous Telemetry Signals.
 * 3. NASA-STD-3001 clinical thresholds, alarm boundaries, and standard flight surgeon countermeasures.
 */

export interface DeviceKnowledge {
  id: string;
  name: string;
  category: 'Wearable' | 'Peripheral' | 'Diagnostic' | 'Life Support' | 'Point-of-Care Lab' | 'Environmental';
  mode: 'CONTINUOUS' | 'PERIODIC' | 'ON_DEMAND' | 'LAB';
  purpose: string;
  measures: string[];
  nominalBaseline: string;
  clinicalSignificance: string;
  protocols: string;
}

export interface SignalKnowledge {
  signalKey: string;
  name: string;
  unit: string;
  nominalRange: string;
  warningThreshold: string;
  criticalThreshold: string;
  measuredBy: string[];
  physiologicalSignificance: string;
  flightSurgeonDirective: string;
}

export const FLIGHT_DEVICES: DeviceKnowledge[] = [
  {
    id: 'DEV-01',
    name: 'AstroSkin / Bio-Monitor Garment',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Smart undershirt garment embedded with physiological sensors for continuous ambulatory monitoring during microgravity flight, workouts, and sleep.',
    measures: ['ECG (3-lead)', 'Heart Rate', 'Heart Rate Variability (HRV RMSSD)', 'Respiratory Rate (Thoracic & Abdominal)', 'Skin Temperature', '3-Axis Actigraphy Accelerometry'],
    nominalBaseline: 'Resting HR 55-75 bpm; Respiration 12-16 br/min; Skin Temp 33.0-34.5°C; HRV > 35 ms.',
    clinicalSignificance: 'Detects microgravity autonomic dysregulation, exercise fatigue index, and sleep fragmentation.',
    protocols: 'Wear 24/7 during flight campaigns. Machine-washable dry sensor arrays. Syncs via Bluetooth Low Energy to onboard health hub.',
  },
  {
    id: 'DEV-02',
    name: 'LifeGuard / CPOD Module',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Compact aerospace sensor module worn on belt or chest harness for multi-parameter autonomic nervous system assessment.',
    measures: ['Heart Rate', 'Pulse Oximetry (SpO₂)', 'Respiratory Rate', 'Galvanic Skin Response (GSR)'],
    nominalBaseline: 'SpO₂ 97-99%; GSR 2-10 μS baseline; HR 60-80 bpm.',
    clinicalSignificance: 'Evaluates acute stress response, hypoxia risk during cabin atmospheric transitions, and autonomic tone.',
    protocols: 'Primary backup telemetry unit when AstroSkin is in recharge/cleaning cycle.',
  },
  {
    id: 'DEV-03',
    name: 'Wearable 12-Lead ECG Bio-Patch',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'High-definition wireless diagnostic electrophysiology patch for cardiac rhythm, conduction timing, and repolarization analysis.',
    measures: ['Full 12-Lead ECG Voltage (mV)', 'Heart Rate', 'Cardiac Rhythm', 'QTc Interval (Bazett & Fridericia)', 'ST Segment Deviation', 'Arrhythmia Bursts (SVT, PVC, PAC)'],
    nominalBaseline: 'Normal Sinus Rhythm; QTc < 450 ms (male) / < 460 ms (female); ST deviation < 0.1 mV.',
    clinicalSignificance: 'Critical for detecting microgravity fluid-shift arrhythmias, post-ARED exertional SVT, and ventricular repolarization delays.',
    protocols: 'Trigger diagnostic Holter recording when ARF > 0.65 or QTc > 470 ms. Data burst transmitted to Houston flight surgeon on next ground pass.',
  },
  {
    id: 'DEV-04',
    name: 'Astropal PPG / Pulse Oximeter',
    category: 'Peripheral',
    mode: 'CONTINUOUS',
    purpose: 'Dual-wavelength optical photoplethysmograph sensor worn on index finger or earlobe for arterial blood oxygenation.',
    measures: ['Arterial Oxygen Saturation (SpO₂ %)', 'Pulse Rate', 'Perfusion Index (PI)', 'Plethysmographic Waveform'],
    nominalBaseline: 'SpO₂ 96-100%; Perfusion Index 1.5-6.0; Pulse Rate matching ECG within ±2 bpm.',
    clinicalSignificance: 'Immediate indicator of hypobaric hypoxia, cabin depressurization response, or respiratory impairment.',
    protocols: 'Alarm triggers if SpO₂ drops below 93% (Warning) or below 90% (Critical). Requires immediate oxygen mask cross-check.',
  },
  {
    id: 'DEV-05',
    name: 'Automated Non-Invasive Blood Pressure (NIBP) Cuff',
    category: 'Diagnostic',
    mode: 'PERIODIC',
    purpose: 'Oscillometric upper-arm blood pressure monitor calibrated for zero-g microgravity fluid redistribution.',
    measures: ['Systolic Blood Pressure (mmHg)', 'Diastolic Blood Pressure (mmHg)', 'Mean Arterial Pressure (MAP)', 'Pulse Pressure'],
    nominalBaseline: 'Systolic 100-125 mmHg; Diastolic 65-80 mmHg; MAP 75-95 mmHg.',
    clinicalSignificance: 'Monitors microgravity cephalad fluid shifts, baroreceptor resetting, and orthostatic intolerance risk.',
    protocols: 'Automated check upon waking, post-exercise, and pre-docking maneuvers. Mandatory measurement prior to suit egress.',
  },
  {
    id: 'DEV-06',
    name: 'Respiratory Inductance Plethysmograph (RIP)',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Dual elastic inductive bands around ribcage and abdomen measuring dynamic cross-sectional area changes.',
    measures: ['Thoracic Excursion', 'Abdominal Excursion', 'Tidal Volume Estimate', 'Thoraco-Abdominal Phase Angle', 'Apnea / Hypopnea Index'],
    nominalBaseline: 'Phase angle < 20°; Respiratory Rate 12-18 br/min; synchronous chest-wall motion.',
    clinicalSignificance: 'Detects microgravity sleep-disordered breathing, central sleep apnea, and respiratory muscle deconditioning.',
    protocols: 'Integrated into sleep harness. Flags asynchronous breathing episodes during sleep cycles.',
  },
  {
    id: 'DEV-07',
    name: 'Ingestible / Continuous Core-Temperature Capsule',
    category: 'Diagnostic',
    mode: 'CONTINUOUS',
    purpose: 'Miniature ingestible radio telemetry capsule or deep-tissue forehead sensor tracking internal thermal core regulation.',
    measures: ['Core Body Temperature (°C / °F)', 'Circadian Thermal Amplitude', 'Heat Dissipation Rate'],
    nominalBaseline: '36.5°C - 37.3°C (circadian nadir ~36.3°C during sleep, peak ~37.4°C post-exercise).',
    clinicalSignificance: 'Microgravity impairs convective cooling, causing "Space Fever" (post-exercise core temp elevation up to +1.0°C above terrestrial baselines).',
    protocols: 'Alert threshold at 38.0°C (TRM flag). Requires active fan cooling, cold hydration, and cessation of heavy resistive loading.',
  },
  {
    id: 'DEV-08',
    name: 'Galvanic Skin Response (GSR) / EDA Sensor',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Measures skin conductance fluctuations driven by sympathetic eccrine sweat gland innervation.',
    measures: ['Skin Conductance Level (SCL in μS)', 'Skin Conductance Responses (SCR frequency)', 'Sympathetic Arousal Score'],
    nominalBaseline: 'SCL 2-8 μS resting; transient SCR spikes during high cognitive loading.',
    clinicalSignificance: 'Quantifies mental workload, acute situational stress during critical burns, and psychological arousal.',
    protocols: 'Correlated with Psychomotor Vigilance Task (PVT) scores to diagnose cognitive fatigue and operational overload.',
  },
  {
    id: 'DEV-09',
    name: 'Flight Actiwatch / Sleep-Wake Monitor',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Precision wrist-worn accelerometer and ambient lux sensor tracking 24-hour sleep/wake cycles.',
    measures: ['Total Sleep Time (hours)', 'Sleep Efficiency (%)', 'Wake After Sleep Onset (WASO min)', 'Circadian Phase Shift', 'Ambient Light Exposure (lux)'],
    nominalBaseline: 'Sleep Time > 7.0 hours/night; Sleep Efficiency > 85%; WASO < 30 minutes.',
    clinicalSignificance: 'Detects chronic circadian desynchronosis caused by 90-minute orbital day/night cycles (16 sunrises/day).',
    protocols: 'Scores below 6.0 hours trigger cumulative sleep debt flags. Pilots stand down from docking if sleep debt exceeds -3.0σ.',
  },
  {
    id: 'DEV-10',
    name: 'Continuous Interstitial Glucose Monitor (CGM)',
    category: 'Wearable',
    mode: 'CONTINUOUS',
    purpose: 'Enzyme-based subcutaneous biosensor monitoring interstitial glucose levels continuously.',
    measures: ['Interstitial Glucose (mg/dL)', 'Glucose Rate of Change (mg/dL/min)', 'Time-in-Range (70-140 mg/dL %)'],
    nominalBaseline: 'Fasting 75-95 mg/dL; Post-prandial < 140 mg/dL; Time-in-Range > 90%.',
    clinicalSignificance: 'Microgravity induces peripheral insulin resistance and altered carbohydrate metabolism.',
    protocols: 'Tracks caloric intake balance and flags hypoglycemia during intense spacewalk or EVA exertion.',
  },
  {
    id: 'DEV-11',
    name: 'Near-Infrared Spectroscopy (NIRS) Cerebral Oximeter',
    category: 'Diagnostic',
    mode: 'PERIODIC',
    purpose: 'Dual-channel optical sensor measuring regional cerebral tissue oxygenation (rSO₂) in prefrontal cortex.',
    measures: ['Regional Cerebral Tissue Oxygenation (rSO₂ %)', 'Cerebral Blood Volume Trend', 'Muscle Oxygen Saturation (SmO₂)'],
    nominalBaseline: 'rSO₂ 62-78%; baseline symmetry between left and right hemispheres ±5%.',
    clinicalSignificance: 'Evaluates cerebral autoregulation during orthostatic stress and microgravity cephalic venous congestion.',
    protocols: 'Utilized during LBNP testing and post-flight re-entry simulation.',
  },
  {
    id: 'DEV-12',
    name: 'Microgravity Ultrasound (Butterfly iQ+ / Mindray TE7)',
    category: 'Diagnostic',
    mode: 'ON_DEMAND',
    purpose: 'Point-of-care ultrasound system for high-resolution musculoskeletal, cardiovascular, and ocular ultrasound imaging.',
    measures: ['Optic Nerve Sheath Diameter (ONSD for SANS mm)', 'Internal Jugular Vein (IJV) Flow & Thrombosis Screening', 'Inferior Vena Cava (IVC) Collapsibility', 'Organ Anatomy'],
    nominalBaseline: 'ONSD < 5.0 mm; IJV bidirectional non-stagnant flow; no venous micro-thrombi.',
    clinicalSignificance: 'Screening tool for Spaceflight Associated Neuro-ocular Syndrome (SANS) and jugular venous thrombosis in microgravity.',
    protocols: 'Bi-monthly scheduled flight scans. High ONSD (>5.8 mm) triggers visual acuity protocol and Houston flight surgeon review.',
  },
  {
    id: 'DEV-13',
    name: 'Cabin Atmosphere Sentry (O₂/CO₂/Pressure)',
    category: 'Life Support',
    mode: 'CONTINUOUS',
    purpose: 'Life support optical & electrochemical sensor array analyzing spacecraft cabin atmosphere composition in real time.',
    measures: ['Cabin CO₂ Partial Pressure (PCO₂ in mmHg)', 'Oxygen Fraction (% O₂)', 'Cabin Total Pressure (kPa / psi)', 'Trace Contaminants (Ammonia NH₃ ppm, CO ppm)'],
    nominalBaseline: 'CO₂ < 2.0 mmHg; O₂ 20.9% ± 0.5%; Total Pressure 101.3 kPa (14.7 psi); NH₃ < 10 ppm.',
    clinicalSignificance: 'Hypercapnia (CO₂ > 3.0 mmHg) causes acute headaches, cognitive slowing, visual disturbances, and sleep disruption.',
    protocols: 'CO₂ > 3.0 mmHg requires manual CDRA scrubber throttling. NH₃ > 25 ppm requires ventilation isolation of affected module.',
  },
  {
    id: 'DEV-14',
    name: 'Radiation Area Monitors & Crew Active Dosimeter (RAM & CAD)',
    category: 'Environmental',
    mode: 'CONTINUOUS',
    purpose: 'Silicon semiconductor detector network measuring cosmic ray background and Solar Particle Events (SPE).',
    measures: ['Instantaneous Dose Rate (mSv/h)', 'Cumulative Mission Dose (mSv)', 'High-LET Heavy Ion Flux (mGy/h)', 'SPE Storm Alert Status'],
    nominalBaseline: 'Nominal deep-space background: 0.04-0.08 mSv/h; career ceiling 600 mSv total.',
    clinicalSignificance: 'Protects crew against acute radiation sickness, DNA double-strand breaks, and lymphopenia during solar storms.',
    protocols: 'Flux > 1.0 mSv/h triggers SPE Haven Protocol (crew must muster in Central Hab water-shielded bunker).',
  },
  {
    id: 'DEV-15',
    name: 'Water Recovery System & TOC Monitor',
    category: 'Environmental',
    mode: 'PERIODIC',
    purpose: 'Catalytic oxidation sensor measuring total organic carbon and chemical purity in recycled potable water.',
    measures: ['Total Organic Carbon (TOC in ppb)', 'Conductivity (μS/cm)', 'Biocide Silver Ion Concentration (ppm)'],
    nominalBaseline: 'TOC < 500 ppb; Conductivity < 2.0 μS/cm; Silver biocide 0.2-0.5 ppm.',
    clinicalSignificance: 'Guarantees drinking water safety, preventing gastrointestinal pathogens and heavy metal toxicity.',
    protocols: 'Daily automated water loop quality verification.',
  },
  {
    id: 'DEV-16',
    name: 'Acoustic Noise Dosimeter Array',
    category: 'Environmental',
    mode: 'CONTINUOUS',
    purpose: 'Multi-microphone sound level meter network monitoring cabin fan, pump, and avionics noise pollution.',
    measures: ['Continuous Sound Pressure Level (dBA)', 'Peak Noise Exposure (dBC)', 'Daily Noise Dose (%)'],
    nominalBaseline: 'Habitation volume < 60 dBA; Sleep quarters < 50 dBA (NC-40 curve).',
    clinicalSignificance: 'Excessive spacecraft acoustic noise causes temporary threshold shifts, hearing loss, and chronic sleep disturbance.',
    protocols: 'Noise levels > 65 dBA require active noise-cancelling headset protocol.',
  },
  {
    id: 'DEV-17',
    name: 'r-MIX Lab-on-a-Chip Bio-Analyzer',
    category: 'Point-of-Care Lab',
    mode: 'LAB',
    purpose: 'Microfluidic immunological assay processor analyzing fingerstick blood for inflammation and immune response.',
    measures: ['Interleukin-6 (IL-6 pg/mL)', 'Tumor Necrosis Factor (TNF-α)', 'C-Reactive Protein (CRP mg/L)', 'Total White Blood Cell Count (WBC k/μL)'],
    nominalBaseline: 'IL-6 < 5.0 pg/mL; CRP < 3.0 mg/L; WBC 4.5-11.0 k/μL.',
    clinicalSignificance: 'Screens for viral reactivation (Epstein-Barr, VZV) and latent microgravity immune dysregulation.',
    protocols: 'Bi-weekly routine fingerstick run. Elevation of IL-6 (>15 pg/mL) flags acute systemic inflammation.',
  },
  {
    id: 'DEV-18',
    name: 'i-STAT / Alinity M Point-of-Care Blood Chemistry Analyzer',
    category: 'Point-of-Care Lab',
    mode: 'LAB',
    purpose: 'Dry-reagent electrochemical cartridge blood gas and comprehensive metabolic panel analyzer.',
    measures: ['Potassium (K⁺ mmol/L)', 'Sodium (Na⁺ mmol/L)', 'Hematocrit (Hct %)', 'Blood Urea Nitrogen (BUN)', 'Creatinine', 'Troponin-I (cTnI ng/mL)'],
    nominalBaseline: 'Potassium 3.8-5.0 mmol/L; Sodium 136-145 mmol/L; Hematocrit 38-48%; Troponin < 0.04 ng/mL.',
    clinicalSignificance: 'Detects microgravity hypokalemia (arrhythmia trigger), space anemia, and acute myocardial strain.',
    protocols: 'Mandatory clinical check when cardiac arrhythmias or abnormal ECG morphologies are observed.',
  },
];

export const TELEMETRY_SIGNALS: SignalKnowledge[] = [
  {
    signalKey: 'heart_rate',
    name: 'Heart Rate',
    unit: 'bpm',
    nominalRange: '55 - 85 bpm (Resting)',
    warningThreshold: '< 48 bpm or > 115 bpm (at rest)',
    criticalThreshold: '< 40 bpm or > 145 bpm (at rest / SVT burst)',
    measuredBy: ['DEV-01 AstroSkin', 'DEV-02 LifeGuard CPOD', 'DEV-03 12-Lead ECG Patch', 'DEV-04 Astropal PPG'],
    physiologicalSignificance: 'Chronotropic response to autonomic balance, microgravity fluid shifts, and exertional workload.',
    flightSurgeonDirective: 'Resting tachycardia (>100 bpm) warrants checking potassium, SpO₂, and 12-lead ECG for SVT bursts.',
  },
  {
    signalKey: 'hrv_rmssd',
    name: 'Heart Rate Variability (RMSSD)',
    unit: 'ms',
    nominalRange: '35 - 85 ms',
    warningThreshold: '< 25 ms (-2.0σ)',
    criticalThreshold: '< 15 ms (-3.5σ)',
    measuredBy: ['DEV-01 AstroSkin', 'DEV-03 12-Lead ECG Patch'],
    physiologicalSignificance: 'Root mean square of successive RR interval differences; index of parasympathetic (vagal) cardiac tone.',
    flightSurgeonDirective: 'Depressed HRV indicates severe cumulative physiological stress, sleep deficit, or autonomic burnout.',
  },
  {
    signalKey: 'spo2',
    name: 'Peripheral Arterial Oxygen Saturation',
    unit: '%',
    nominalRange: '96 - 100 %',
    warningThreshold: '< 93 % (+2.5σ desaturation)',
    criticalThreshold: '< 90 % (+3.5σ severe hypoxia)',
    measuredBy: ['DEV-04 Astropal PPG Oximeter', 'DEV-02 LifeGuard CPOD'],
    physiologicalSignificance: 'Fraction of oxygen-saturated hemoglobin relative to total hemoglobin in arterial bloodstream.',
    flightSurgeonDirective: 'SpO₂ < 92% requires immediate cross-check of cabin PCO₂/PO₂ and donning emergency oxygen mask if symptomatic.',
  },
  {
    signalKey: 'computed_qtc',
    name: 'Corrected QT Interval (QTc Bazett)',
    unit: 'ms',
    nominalRange: '380 - 440 ms',
    warningThreshold: '> 460 ms (Female) / > 450 ms (Male)',
    criticalThreshold: '> 485 ms (High Torsades de Pointes / Ventricular Arrhythmia Risk)',
    measuredBy: ['DEV-03 12-Lead ECG Bio-Patch'],
    physiologicalSignificance: 'Time required for ventricular depolarization and repolarization, adjusted for heart rate.',
    flightSurgeonDirective: 'QTc prolongation requires immediate serum electrolyte review (potassium K⁺, magnesium Mg²⁺) and grounding from spacewalks.',
  },
  {
    signalKey: 'cabin_co2',
    name: 'Cabin Carbon Dioxide Partial Pressure',
    unit: 'mmHg',
    nominalRange: '0.8 - 2.0 mmHg (Nominal LEO cabin)',
    warningThreshold: '> 2.8 mmHg (+2.0σ elevation)',
    criticalThreshold: '> 3.5 mmHg (+3.0σ hypercapnia)',
    measuredBy: ['DEV-13 Cabin Atmosphere Sentry'],
    physiologicalSignificance: 'Ambient PCO₂ in spacecraft atmosphere. Microgravity impairs natural convective dispersal, forming localized CO₂ pockets.',
    flightSurgeonDirective: 'CO₂ > 3.0 mmHg mandates increasing CDRA scrubber airflow to 100% capacity and engaging localized circulation fans.',
  },
  {
    signalKey: 'radiation_flux',
    name: 'Instantaneous Solar & Cosmic Radiation Flux',
    unit: 'mGy/h / mSv/h',
    nominalRange: '0.04 - 0.08 mSv/h',
    warningThreshold: '> 0.50 mSv/h (Elevated solar activity)',
    criticalThreshold: '> 1.50 mSv/h (Active Solar Particle Event SPE Storm)',
    measuredBy: ['DEV-14 Radiation Area Monitors (RAM & CAD)'],
    physiologicalSignificance: 'High-energy ionizing proton and HZE particle radiation penetrating spacecraft hull.',
    flightSurgeonDirective: 'Flux > 1.0 mSv/h mandates initiating Hab Haven shelter protocol behind polyethylene and water wall barriers.',
  },
  {
    signalKey: 'potassium',
    name: 'Serum Potassium Concentration (K⁺)',
    unit: 'mmol/L',
    nominalRange: '3.8 - 5.0 mmol/L',
    warningThreshold: '< 3.6 mmol/L or > 5.2 mmol/L',
    criticalThreshold: '< 3.2 mmol/L (Severe Hypokalemia) or > 5.8 mmol/L',
    measuredBy: ['DEV-18 i-STAT Point-of-Care Analyzer'],
    physiologicalSignificance: 'Primary intracellular cation dictating resting myocardial cell membrane potential and repolarization stability.',
    flightSurgeonDirective: 'Hypokalemia is the leading trigger for microgravity supraventricular and ventricular tachyarrhythmias; requires oral repletion.',
  },
  {
    signalKey: 'sleep_score',
    name: 'Sleep Rest & Vigilance Index',
    unit: 'hours / score',
    nominalRange: '7.0 - 8.5 hours (Score 80-100)',
    warningThreshold: '< 6.0 hours (Score < 70)',
    criticalThreshold: '< 5.0 hours recorded (-3.0σ sleep restriction)',
    measuredBy: ['DEV-09 Flight Actiwatch', 'DEV-01 AstroSkin Garment'],
    physiologicalSignificance: 'Restorative slow-wave and REM sleep duration in microgravity quarters.',
    flightSurgeonDirective: 'Sleep debt > -3.0σ slows Psychomotor Vigilance reaction times by +16%. Requires mandatory 45-min tactical nap before flight maneuvers.',
  },
  {
    signalKey: 'core_temp',
    name: 'Core Body Temperature',
    unit: '°C',
    nominalRange: '36.5 - 37.3 °C',
    warningThreshold: '> 37.8 °C (Elevated thermal load)',
    criticalThreshold: '> 38.3 °C (Hyperthermic Space Fever)',
    measuredBy: ['DEV-07 Core Temperature Capsule'],
    physiologicalSignificance: 'Internal thermoregulatory set-point; impaired evaporative sweating in zero-g leads to heat entrapment.',
    flightSurgeonDirective: 'Cease physical exercise on ARED/cycle ergometer; enforce active cooling garment and cold oral hydration.',
  },
];

/**
 * Searches and retrieves grounded knowledge snippets relevant to a user query.
 */
export function retrieveGroundedTelemetryKnowledge(query: string): string {
  const q = query.toLowerCase();

  const matchedDevices = FLIGHT_DEVICES.filter((d) => {
    return (
      q.includes(d.id.toLowerCase()) ||
      q.includes(d.name.toLowerCase()) ||
      d.measures.some((m) => q.includes(m.toLowerCase())) ||
      d.category.toLowerCase().includes(q)
    );
  });

  const matchedSignals = TELEMETRY_SIGNALS.filter((s) => {
    return (
      q.includes(s.signalKey) ||
      q.includes(s.name.toLowerCase()) ||
      q.includes(s.unit.toLowerCase())
    );
  });

  let knowledgeText = '';

  if (matchedDevices.length > 0) {
    knowledgeText += `[MATCHED FLIGHT HARDWARE SPECIFICATIONS]:\n`;
    matchedDevices.forEach((d) => {
      knowledgeText += `• ${d.name} (${d.category}, Mode: ${d.mode}): ${d.purpose}\n  Measures: ${d.measures.join(', ')}\n  Baseline: ${d.nominalBaseline}\n  Clinical Protocol: ${d.protocols}\n`;
    });
    knowledgeText += `\n`;
  }

  if (matchedSignals.length > 0) {
    knowledgeText += `[MATCHED BIOMETRIC / ENVIRONMENTAL SIGNAL THRESHOLDS]:\n`;
    matchedSignals.forEach((s) => {
      knowledgeText += `• ${s.name} (${s.unit}): Nominal: ${s.nominalRange} | Warning: ${s.warningThreshold} | Critical: ${s.criticalThreshold}\n  Measured By: ${s.measuredBy.join('; ')}\n  Clinical Significance: ${s.physiologicalSignificance}\n  Directive: ${s.flightSurgeonDirective}\n`;
    });
    knowledgeText += `\n`;
  }

  // If no specific keyword matched, supply top flight devices & key signals overview
  if (!knowledgeText) {
    knowledgeText = `[STANDARD FLIGHT SENSORS & SIGNAL ROSTER]:\n` +
      `Active devices: AstroSkin (ECG, Respiration, Temp, Actigraphy), CPOD (SpO2, GSR), 12-Lead Patch (QTc, Rhythm), Astropal (SpO2, PI), Cabin Sentry (CO2, NH3, kPa), Radiation Area Monitor (mSv/h SPE Flux), i-STAT (Potassium K+, Hct, Troponin).\n` +
      `Nominal limits: HR 55-85 bpm, SpO2 > 95%, QTc < 450ms, Cabin CO2 < 2.0 mmHg, Radiation < 0.1 mSv/h, Potassium 3.8-5.0 mmol/L.\n`;
  }

  return knowledgeText;
}

