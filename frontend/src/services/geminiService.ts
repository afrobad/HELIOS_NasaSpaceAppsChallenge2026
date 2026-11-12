/**
 * frontend/src/services/geminiService.ts
 * Google Gemini AI Client with Telemetry RAG Grounding for Helix-AI Autonomous Clinical Sentry.
 * 
 * Capabilities:
 * 1. Multi-Model Racing (gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-flash-lite-latest)
 * 2. Automated RAG context assembly from live multi-crew telemetryMap, 18 flight devices & signal specifications
 * 3. Dual-channel formatting:
 *    - spokenText: Clean, punchy sentences without markdown for Web Speech / Web Audio synthesis
 *    - displayText: Formatted clinical briefing with bullet points and telemetry callouts
 * 4. High-Reliability Local RAG Fallback ensuring 100% operational uptime
 */

import { retrieveGroundedTelemetryKnowledge, FLIGHT_DEVICES, TELEMETRY_SIGNALS } from '../data/telemetryKnowledgeBase';
import type { TelemetryPacket } from '../types/telemetry';

export interface ChatMessageContext {
  sender: 'helix' | 'user';
  text: string;
}

export interface HelixQueryOptions {
  telemetryMap?: Record<string, TelemetryPacket>;
  activeAlerts?: Array<{ id: string; crewId?: string; title: string; severity?: string; status?: string }>;
  selectedCrewId?: string;
  conversationHistory?: ChatMessageContext[];
}

export interface HelixAIResponse {
  spokenText: string;
  displayText: string;
  category: 'MISSION_DUTY' | 'TRIAGE' | 'RIDGE' | 'SBAR' | 'DEVICE' | 'SAFETY' | 'GENERAL';
  source: 'GEMINI_AI' | 'LOCAL_RAG';
  durationMs: number;
}

const HELIX_SYSTEM_INSTRUCTION = `You are HELIX-AI, an autonomous aerospace flight surgeon and clinical telemetry sentry aboard the HELIOS-01 deep-space spacecraft, engineered to NASA-STD-3001 aerospace medicine standards.
Your persona is calm, highly intelligent, fact-based, reassuring, and decisive.

CRITICAL OPERATIONAL RULES:
1. GROUNDING & ACCURACY: Never hallucinate biometric values. Strictly reference the live telemetry values, NASA-STD-3001 thresholds, and hardware device specs provided in the context.
2. AI IDENTITY: You are HELIX-AI. Never refer to yourself as EVA or any other name.
3. SPOKEN VOICE PACING:
   - Provide responses that can be spoken naturally.
   - Deliver findings in 3 to 4 crisp, distinct sentences with clear periods so the speech engine breathes naturally.
   - Avoid long run-on sentences.
   - Do NOT include markdown asterisks (**) or bullet characters (•) in the spoken output.
4. MEDICAL SAFETY GUARDRAIL: Do not write off-protocol pharmacological prescriptions or declare unverified diagnoses. Focus on flight physiology countermeasures (e.g. resting recovery, LBNP garment, CDRA scrubber cycles, sleep hygiene, and radiation haven protocols).
5. KNOWLEDGE DOMAIN: You possess complete deep technical understanding of all 18 flight telemetry devices (AstroSkin, CPOD, 12-Lead Patch, Astropal, NIBP, RIP, Core Temp capsule, Actiwatch, CGM, Ultrasound, Cabin Atmosphere Sentry, RAM/CAD dosimeters, i-STAT, r-MIX) and all physiological signals.`;

class GeminiService {
  private apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly models = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
  ];

  constructor() {
    // Read from Vite environment or localStorage or fallback to project key
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('helios_gemini_api_key') || '' : '';
    this.apiKey = storedKey || envKey || 'AQ.Ab8RN6I8FqysmCknJzI0vCv3BI8bYfXsd8sJjcrtHxDLK_M_Hg';
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('helios_gemini_api_key', this.apiKey);
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public isKeyConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 15);
  }

  /**
   * Main entry point: queries Gemini AI with automatic RAG grounding and local fallback.
   */
  public async query(prompt: string, options: HelixQueryOptions = {}): Promise<HelixAIResponse> {
    const startTime = performance.now();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      return {
        spokenText: 'Awaiting your clinical inquiry.',
        displayText: 'Awaiting your clinical inquiry.',
        category: 'GENERAL',
        source: 'LOCAL_RAG',
        durationMs: 0,
      };
    }

    // 1. Assemble RAG Context
    const ragContext = this.buildRagContext(cleanPrompt, options);

    // 2. Determine clinical category
    const category = this.categorizeQuery(cleanPrompt);

    // 3. If API key is available, query Gemini API
    if (this.isKeyConfigured()) {
      try {
        const geminiResult = await this.queryGeminiWithRacing(cleanPrompt, ragContext, options.conversationHistory);
        if (geminiResult) {
          const durationMs = Math.round(performance.now() - startTime);
          return {
            spokenText: geminiResult.spoken,
            displayText: geminiResult.display,
            category,
            source: 'GEMINI_AI',
            durationMs,
          };
        }
      } catch (err) {
        console.warn('[Helix-AI] Gemini API request failed, falling back to local RAG engine:', err);
      }
    }

    // 4. Resilient Local RAG Engine Fallback
    const localResult = this.generateLocalRagResponse(cleanPrompt, options);
    const durationMs = Math.round(performance.now() - startTime);
    return {
      spokenText: localResult.spoken,
      displayText: localResult.display,
      category,
      source: 'LOCAL_RAG',
      durationMs,
    };
  }

  /**
   * Builds the comprehensive RAG grounding context string.
   */
  private buildRagContext(query: string, options: HelixQueryOptions): string {
    let context = `--- RAG GROUNDING CONTEXT (NASA-STD-3001) ---\n\n`;

    // A. Knowledge Base device & signal lookup
    const kbInfo = retrieveGroundedTelemetryKnowledge(query);
    context += kbInfo + `\n`;

    // B. Live Multi-Crew Telemetry Snapshot
    context += `[CURRENT ASTRONAUT TELEMETRY SNAPSHOT]:\n`;
    if (options.telemetryMap && Object.keys(options.telemetryMap).length > 0) {
      Object.entries(options.telemetryMap).forEach(([id, packet]) => {
        const hr = packet.heart_rate ?? 'Nominal';
        const hrv = packet.hrv_rmssd ?? 'Nominal';
        const spo2 = packet.spo2 ?? 'Nominal';
        const temp = packet.core_temp ?? 36.8;
        const sleep = packet.sleep_score ?? 'Nominal';
        const qtc = packet.computed_qtc ?? 'Nominal';
        const co2 = packet.cabin_co2 ?? 1.8;
        const flux = packet.radiation_flux ?? 0.06;

        context += `• ${packet.astronaut_name || id}: HR=${hr} bpm, HRV=${hrv} ms, SpO2=${spo2}%, CoreTemp=${temp}°C, Sleep=${sleep}h, QTc=${qtc} ms, CabinCO2=${co2} mmHg, RadiationFlux=${flux} mSv/h\n`;
      });
    } else {
      context += `• Commander Haley (CDR): HR=148 bpm peak (SVT Bursts), QTc=485 ms (+2.8σ), SpO2=98%, Status: RESTRICTED FROM MISSION DUTIES.\n`;
      context += `• Pilot Chris (PLT): SpO2=91% (+3.2σ arterial desaturation), Sleep=4.6h (-3.4σ), PVT Latency=+16%, Status: RESTRICTED FROM MISSION DUTIES.\n`;
      context += `• Dr. Sian (MED): Readiness 94%, HR=68 bpm, SpO2=99%, Status: CLEARED FOR MISSION DUTIES.\n`;
      context += `• Specialist Leo (ENG): Readiness 94%, CoreTemp=36.8°C, SpO2=98.3%, Status: CLEARED FOR MISSION DUTIES.\n`;
    }

    // C. Active Alerts
    if (options.activeAlerts && options.activeAlerts.length > 0) {
      context += `\n[ACTIVE MISSION ALERTS]:\n`;
      options.activeAlerts.forEach((a) => {
        context += `• ${a.crewId || 'CABIN'}: ${a.title} (${a.severity || 'ACT'})\n`;
      });
    }

    return context;
  }

  /**
   * Fires racing requests against Gemini flash models.
   */
  private async queryGeminiWithRacing(
    query: string,
    ragContext: string,
    history?: ChatMessageContext[]
  ): Promise<{ spoken: string; display: string } | null> {
    // Construct contents array with history
    const contents: any[] = [];

    // Prior conversation history (last 4 turns for context retention)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      recentHistory.forEach((msg) => {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      });
    }

    // Current query augmented with RAG
    const augmentedUserText = `${ragContext}\n\n[USER INQUIRY]:\n${query}\n\nProvide your clinical response as HELIX-AI. Ensure your response is factually grounded in the live numbers above.`;
    contents.push({
      role: 'user',
      parts: [{ text: augmentedUserText }],
    });

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: HELIX_SYSTEM_INSTRUCTION }],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
        topP: 0.9,
      },
    };

    const tryModel = async (modelName: string): Promise<{ spoken: string; display: string } | null> => {
      const url = `${this.baseUrl}/${modelName}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) return null;

      // Clean spoken output: remove markdown asterisks and bullets
      const cleanSpoken = rawText
        .replace(/[*#_`•\[\]]/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      return {
        spoken: cleanSpoken,
        display: rawText,
      };
    };

    // Parallel racing: try primary model and fallback simultaneously
    try {
      const promises = this.models.map((m) =>
        tryModel(m).catch(() => null)
      );
      const results = await Promise.all(promises);
      const firstValid = results.find((r) => r !== null);
      return firstValid || null;
    } catch {
      return null;
    }
  }

  /**
   * Resilient, high-intelligence Local RAG Generator.
   */
  private generateLocalRagResponse(
    query: string,
    options: HelixQueryOptions
  ): { spoken: string; display: string } {
    const q = query.toLowerCase();

    // 1. Device queries
    const matchedDev = FLIGHT_DEVICES.find((d) =>
      q.includes(d.name.toLowerCase()) ||
      q.includes(d.id.toLowerCase()) ||
      d.measures.some((m) => q.includes(m.toLowerCase()))
    );

    if (matchedDev && (q.includes('device') || q.includes('how does') || q.includes('sensor') || q.includes('monitor') || q.includes('measure') || q.includes('explain'))) {
      const display = `Hardware Specification: ${matchedDev.name} (${matchedDev.category})\n` +
        `• Purpose: ${matchedDev.purpose}\n` +
        `• Telemetry Signals: ${matchedDev.measures.join(', ')}\n` +
        `• Operational Mode: ${matchedDev.mode} · Baseline: ${matchedDev.nominalBaseline}\n` +
        `• Clinical Protocol: ${matchedDev.protocols}`;

      const spoken = `${matchedDev.name} is a ${matchedDev.category.toLowerCase()} device operating in ${matchedDev.mode.toLowerCase()} mode. It monitors ${matchedDev.measures.slice(0, 3).join(', ')}. Nominal baseline is ${matchedDev.nominalBaseline.replace(/[;]/g, ',')}. Operational protocol is active.`;
      return { spoken, display };
    }

    // 2. Specific Signal Queries
    const matchedSignal = TELEMETRY_SIGNALS.find((s) =>
      q.includes(s.signalKey) || q.includes(s.name.toLowerCase())
    );

    if (matchedSignal && (q.includes('signal') || q.includes('threshold') || q.includes('normal') || q.includes('qtc') || q.includes('spo2') || q.includes('potassium') || q.includes('co2'))) {
      const display = `Telemetry Signal Analysis: ${matchedSignal.name} (${matchedSignal.unit})\n` +
        `• Nominal Range: ${matchedSignal.nominalRange}\n` +
        `• Warning Threshold: ${matchedSignal.warningThreshold}\n` +
        `• Critical Threshold: ${matchedSignal.criticalThreshold}\n` +
        `• Sensor Hardware: ${matchedSignal.measuredBy.join('; ')}\n` +
        `• Clinical Directive: ${matchedSignal.flightSurgeonDirective}`;

      const spoken = `${matchedSignal.name} nominal range is ${matchedSignal.nominalRange}. Warning triggers at ${matchedSignal.warningThreshold}. ${matchedSignal.flightSurgeonDirective.replace(/[•\[\]]/g, '')}`;
      return { spoken, display };
    }

    // 3. Mission / Spacewalk Duty Clearance
    if (/clearance|duty|spacewalk|cleared|mission duty|who is cleared/i.test(q)) {
      const display = `Mission Duty & Spacewalk Clearance Status (NASA-STD-3001 Standard):\n` +
        `• CLEARED FOR DUTY: Dr. Sian (MED) & Specialist Leo (ENG) — Readiness 94%.\n` +
        `• RESTRICTED: Commander Haley (Post-exercise SVT Arrhythmia, QTc 485ms) & Pilot Chris (Arterial Hypoxia SpO₂ 91%, Sleep deficit 4.6h).\n` +
        `Operational Directive: Reassign primary spacewalk egress roles to Dr. Sian and Specialist Leo until cardiac and SpO₂ markers return to baseline.`;

      const spoken = `Dr. Sian and Specialist Leo are fully cleared for mission duty with 94 percent readiness. Commander Haley and Pilot Chris remain restricted due to active arrhythmia and oxygen alerts. Primary spacewalk duties are reassigned to Sian and Leo.`;
      return { spoken, display };
    }

    // 4. Astronaut queries: Haley
    if (/haley|commander|cdr/i.test(q)) {
      const display = `Commander Haley Physiological Telemetry (NASA-STD-3001):\n` +
        `• Heart Rate: 62 bpm resting, peak exertion 148 bpm with episodic SVT bursts (+2.8σ).\n` +
        `• 12-Lead Patch: QTc 485 ms (borderline prolongation; potassium check recommended).\n` +
        `• Mission Duty: RESTRICTED from heavy EVA and high-intensity ARED resistive loading.\n` +
        `• Directive: Transition to seated microgravity recovery. 12-lead ECG telemetry queued for ground station pass.`;

      const spoken = `Commander Haley experienced post-exercise supraventricular arrhythmia bursts peaking at 148 beats per minute. Her corrected QT interval is 485 milliseconds. She is restricted from heavy physical exertion; seated recovery is enforced.`;
      return { spoken, display };
    }

    // 5. Astronaut queries: Chris
    if (/chris|pilot|plt/i.test(q)) {
      const display = `Pilot Chris Physiological Telemetry (NASA-STD-3001):\n` +
        `• Oxygenation: SpO₂ 91% (+3.2σ arterial desaturation observed via Astropal pulse oximeter).\n` +
        `• Rest & Sleep: 4.6 hours recorded on Actiwatch (-3.4σ deficit). PVT reaction latency slowed by +16%.\n` +
        `• Mission Duty: RESTRICTED from orbital rendezvous manual joystick operations.\n` +
        `• Directive: Enforce mandatory 45-minute tactical sleep nap in sleep quarters with optimized ambient oxygen.`;

      const spoken = `Pilot Chris exhibits arterial oxygen desaturation at 91 percent alongside a 4.6-hour sleep debt. Psychomotor vigilance reaction latency is delayed by 16 percent. A mandatory 45-minute tactical sleep nap is enforced.`;
      return { spoken, display };
    }

    // 6. Default Fallback
    const display = `Helix-AI Telemetry Synthesis (NASA-STD-3001 Standard):\n` +
      `• Hardware Network: 18 flight devices reporting active telemetry.\n` +
      `• Crew Status: Dr. Sian and Specialist Leo are cleared for mission duties; Commander Haley and Pilot Chris require operational recovery.\n` +
      `• Atmosphere: CDRA scrubber scrub cycle engaged. Solar proton flux monitored.`;

    const spoken = `Helix-AI active. All eighteen flight devices are synchronized. Dr. Sian and Specialist Leo are cleared for flight duty, while Commander Haley and Pilot Chris are resting. How may I assist your mission?`;
    return { spoken, display };
  }

  private categorizeQuery(query: string): HelixAIResponse['category'] {
    const q = query.toLowerCase();
    if (/device|sensor|hardware|monitor|patch|cuff|garment|oximeter/i.test(q)) return 'DEVICE';
    if (/duty|clearance|spacewalk|cleared|fit/i.test(q)) return 'MISSION_DUTY';
    if (/priority|triage|attention|worst|first/i.test(q)) return 'TRIAGE';
    if (/ridge|radiation|hazard|spe|storm|cosmic/i.test(q)) return 'RIDGE';
    if (/sbar|ground|handoff|report|houston/i.test(q)) return 'SBAR';
    if (/diagnos|prescri|medicine|pill|drug/i.test(q)) return 'SAFETY';
    return 'GENERAL';
  }
}

export const geminiService = new GeminiService();

