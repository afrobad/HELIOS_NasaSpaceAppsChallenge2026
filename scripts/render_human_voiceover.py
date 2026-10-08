"""
Ultra-Realistic Human Female Voiceover Engine for HELIOS Pitch Script
Implements:
  1. Full SSML Emotional Modeling (mstts:express-as with empathetic, serious, hopeful styles)
  2. Human breath breaks (<break time="..."/>) and natural unhurried speech rates
  3. Studio vocal mastering (highpass, chest EQ warmth, presence clarity, broadcast compander)
  4. Muxing into 1080p 60fps video deliverables
"""

import asyncio
import os
import subprocess
import numpy as np
import wave
import struct
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Video_Outputs")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio_human")
os.makedirs(AUDIO_DIR, exist_ok=True)

SAMPLE_RATE = 44100
TOTAL_DURATION = 45.0
TOTAL_SAMPLES = int(TOTAL_DURATION * SAMPLE_RATE)

# SSML scripts with emotional modeling and natural human pauses
SSML_SCRIPTS = {
    "sc15_isolation": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="empathetic" styledegree="1.8">
            <prosody rate="-2%" pitch="+0Hz">
                The true test of space medicine is not just deep space. <break time="400ms"/> It is extreme isolation.
                <break time="500ms"/>
                HELIOS works without cloud dependency, <break time="250ms"/> providing clinical decision support in Antarctic stations, <break time="200ms"/> disaster zones, <break time="200ms"/> and other environments where evacuation is difficult <break time="200ms"/> and communication can fail.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",

    "sc16_scalability": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="hopeful" styledegree="1.5">
            <prosody rate="-1%" pitch="+0Hz">
                Built for modular telemetry and edge intelligence, <break time="250ms"/> HELIOS can evolve with the mission.
                <break time="450ms"/>
                From commercial orbital crews to multi-crewed lunar habitats, <break time="250ms"/> new sensors and additional crew members can be integrated <break time="200ms"/> without rebuilding the core intelligence.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",

    "sc17_heartbeat": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="serious" styledegree="1.9">
            <prosody rate="-4%" pitch="-1Hz">
                A heartbeat changes <break time="350ms"/> nearly four hundred thousand kilometers from Earth.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",

    "sc17_understanding": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="hopeful" styledegree="1.6">
            <prosody rate="-1%" pitch="+0Hz">
                HELIOS turns that change into understanding, <break time="300ms"/> so the crew can act before a signal becomes a crisis.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",

    "sc17_motto": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="serious" styledegree="1.6">
            <prosody rate="-6%" pitch="+0Hz">
                Monitor. <break time="380ms"/> Understand. <break time="380ms"/> Act.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",

    "sc17_team": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="hopeful" styledegree="1.5">
            <prosody rate="-2%" pitch="+1Hz">
                We are Team Cosmic Plus.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>"""
}

async def generate_ssml_clips():
    print("Synthesizing emotional SSML clips...")
    for key, ssml in SSML_SCRIPTS.items():
        raw_path = os.path.join(AUDIO_DIR, f"{key}_raw.mp3")
        mastered_path = os.path.join(AUDIO_DIR, f"{key}_mastered.wav")
        
        com = edge_tts.Communicate(ssml, "en-US-JennyNeural")
        await com.save(raw_path)
        
        # Apply Studio Vocal Mastering Chain:
        # 1. highpass at 80 Hz (removes sub-mumble)
        # 2. equalizer at 250 Hz (+2.0 dB) adds natural chest warmth
        # 3. equalizer at 3500 Hz (+2.5 dB) adds crisp human vocal presence
        # 4. subtle dynamic compander for broadcast smoothness
        cmd = [
            "ffmpeg", "-y",
            "-i", raw_path,
            "-af", "highpass=f=80,equalizer=f=250:t=q:w=1.2:g=2.0,equalizer=f=3500:t=q:w=1.0:g=2.5,compand=attacks=0.02:decays=0.2:points=-80/-80|-24/-20|0/-2",
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            mastered_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        dur_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mastered_path]
        dur = float(subprocess.check_output(dur_cmd).decode().strip())
        print(f"  + {key}: {dur:.2f}s (Mastered Studio Quality)")

def load_audio(path):
    cmd = [
        "ffmpeg", "-i", path,
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    raw, _ = proc.communicate()
    return np.frombuffer(raw, dtype=np.float32)

def assemble_master_human_audio():
    print("Assembling continuous 45.0s master broadcast audio...")
    
    # Warm cinematic ambient drone
    t = np.linspace(0, TOTAL_DURATION, TOTAL_SAMPLES, endpoint=False)
    drone = 0.035 * np.sin(2 * np.pi * 55.0 * t) + 0.02 * np.sin(2 * np.pi * 82.4 * t)
    shimmer = 0.006 * np.sin(2 * np.pi * 330.0 * t) * np.sin(2 * np.pi * 0.15 * t)
    fade_in = np.minimum(1.0, t / 1.5)
    fade_out = np.minimum(1.0, (TOTAL_DURATION - t) / 2.0)
    master = (drone + shimmer) * fade_in * fade_out
    
    # Authentic Lead-II ECG audio tones in Scene 17 (30.0s to 34.0s)
    beeps = [
        (30.3, 880, 0.08),
        (31.1, 880, 0.08),
        (31.95, 980, 0.09),  # ectopic beat
        (33.05, 880, 0.08),
        (33.85, 880, 0.08)
    ]
    for b_start, freq, b_dur in beeps:
        s_idx = int(b_start * SAMPLE_RATE)
        e_idx = min(TOTAL_SAMPLES, s_idx + int(b_dur * SAMPLE_RATE))
        t_b = np.linspace(0, (e_idx - s_idx)/SAMPLE_RATE, e_idx - s_idx, endpoint=False)
        envelope = np.sin(np.pi * np.linspace(0, 1, len(t_b))) ** 1.8
        master[s_idx:e_idx] += 0.28 * np.sin(2 * np.pi * freq * t_b) * envelope
        
    # Seamless timeline cues for the emotional human voice
    cues = [
        (0.4, os.path.join(AUDIO_DIR, "sc15_isolation_mastered.wav")),
        (15.2, os.path.join(AUDIO_DIR, "sc16_scalability_mastered.wav")),
        (30.2, os.path.join(AUDIO_DIR, "sc17_heartbeat_mastered.wav")),
        (34.8, os.path.join(AUDIO_DIR, "sc17_understanding_mastered.wav")),
        (40.1, os.path.join(AUDIO_DIR, "sc17_motto_mastered.wav")),
        (42.5, os.path.join(AUDIO_DIR, "sc17_team_mastered.wav")),
    ]
    
    for start_sec, clip_f in cues:
        clip = load_audio(clip_f)
        s_idx = int(start_sec * SAMPLE_RATE)
        e_idx = min(TOTAL_SAMPLES, s_idx + len(clip))
        master[s_idx:e_idx] += clip[:e_idx - s_idx] * 1.25
        
    # Peak normalization
    peak = np.max(np.abs(master))
    if peak > 0.98:
        master = (master / peak) * 0.96
        
    out_master_wav = os.path.join(OUTPUT_DIR, "master_human_voiceover_track.wav")
    with wave.open(out_master_wav, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in master:
            wf.writeframes(struct.pack('<h', int(s * 32767)))
            
    print(f"Master human audio saved to: {out_master_wav}")
    
    # Mux into master video
    master_v_src = os.path.join(OUTPUT_DIR, "Scenes_15_to_17_02-45_03-30_Full_Sequence.mp4")
    master_v_out = os.path.join(OUTPUT_DIR, "Scenes_15_to_17_02-45_03-30_Full_Sequence_With_Voiceover.mp4")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", master_v_src,
        "-i", out_master_wav,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        master_v_out
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Master Video updated with realistic human voice: {master_v_out}")
    
    # Also update individual scene clips with their corresponding slice
    scene_slices = [
        ("Scene_15A_02-45_02-50_Extreme_Isolation.mp4", 0.0, 5.0),
        ("Scene_15B_02-50_02-55_Disaster_Medicine.mp4", 5.0, 10.0),
        ("Scene_15C_02-55_03-00_One_Intelligence_Architecture.mp4", 10.0, 15.0),
        ("Scene_16A_03-00_03-05_Modular_Telemetry.mp4", 15.0, 20.0),
        ("Scene_16B_03-05_03-10_Multi_Crew_Scaling.mp4", 20.0, 25.0),
        ("Scene_16C_03-10_03-15_Orbital_to_Lunar_Scale.mp4", 25.0, 30.0),
        ("Scene_17A_03-15_03-19_Cinematic_Callback_Heartbeat.mp4", 30.0, 34.0),
        ("Scene_17B_03-19_03-24_Signal_to_Action.mp4", 34.0, 39.0),
        ("Scene_17C_03-24_03-27_Resolution_Stabilization.mp4", 39.0, 42.0),
        ("Scene_17D_03-27_03-30_Final_Title_Close.mp4", 42.0, 45.0)
    ]
    for s_name, t_start, t_end in scene_slices:
        s_src = os.path.join(OUTPUT_DIR, s_name)
        s_temp = os.path.join(OUTPUT_DIR, f"temp_{s_name}")
        dur = t_end - t_start
        s_cmd = [
            "ffmpeg", "-y",
            "-i", s_src,
            "-ss", str(t_start),
            "-t", str(dur),
            "-i", out_master_wav,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            s_temp
        ]
        res = subprocess.run(s_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0 and os.path.exists(s_temp):
            os.replace(s_temp, s_src)
            print(f"  + Updated with realistic human voice: {s_name}")

if __name__ == "__main__":
    asyncio.run(generate_ssml_clips())
    assemble_master_human_audio()
