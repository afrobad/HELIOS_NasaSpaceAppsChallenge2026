"""
Master Production Engine: Realistic Human Female Voiceover using en-US-EmmaNeural.
Includes:
  - Microsoft Emma Neural voice (warm, articulate, empathetic, documentary cadence)
  - Studio vocal mastering chain (warm EQ, presence boost, broadcast dynamic compander)
  - Synchronized Lead-II ECG audio tones in Scene 17
  - Ambient space telemetry score
  - Muxing into 1080p 60fps video files and ZIP package
"""

import asyncio
import os
import subprocess
import numpy as np
import wave
import struct
import shutil
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Video_Outputs")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio_emma")
os.makedirs(AUDIO_DIR, exist_ok=True)

SAMPLE_RATE = 44100
TOTAL_DURATION = 45.0
TOTAL_SAMPLES = int(TOTAL_DURATION * SAMPLE_RATE)
VOICE = "en-US-EmmaNeural"

CLIPS = [
    ("sc15_a", "The true test of space medicine is not just deep space... It is extreme isolation.", "+2%"),
    ("sc15_bc", "HELIOS works without cloud dependency, providing clinical decision support in Antarctic stations, disaster zones, and other environments where evacuation is difficult, and communication can fail.", "+8%"),
    ("sc16_a", "Built for modular telemetry and edge intelligence, HELIOS can evolve with the mission.", "+4%"),
    ("sc16_bc", "From commercial orbital crews to multi-crewed lunar habitats, new sensors and additional crew members can be integrated without rebuilding the core intelligence.", "+6%"),
    ("sc17_a", "A heartbeat changes nearly four hundred thousand kilometers from Earth.", "+2%"),
    ("sc17_b", "HELIOS turns that change into understanding, so the crew can act before a signal becomes a crisis.", "+6%"),
    ("sc17_c", "Monitor. Understand. Act.", "+0%"),
    ("sc17_d", "We are Team Cosmic Plus.", "+0%")
]

async def generate_emma_clips():
    print(f"Generating voice clips using {VOICE}...")
    for cid, text, rate in CLIPS:
        raw_f = os.path.join(AUDIO_DIR, f"{cid}_raw.mp3")
        mastered_f = os.path.join(AUDIO_DIR, f"{cid}_mastered.wav")
        
        com = edge_tts.Communicate(text, VOICE, rate=rate)
        await com.save(raw_f)
        
        # Studio Vocal Chain:
        # Highpass 80Hz (anti-rumble), Warmth EQ at 220Hz (+1.8dB), Presence EQ at 3200Hz (+2.0dB),
        # subtle compression (smooths dynamics), and light room acoustics
        cmd = [
            "ffmpeg", "-y",
            "-i", raw_f,
            "-af", "highpass=f=80,equalizer=f=220:t=q:w=1.2:g=1.8,equalizer=f=3200:t=q:w=1.0:g=2.0,compand=attacks=0.03:decays=0.25:points=-80/-80|-24/-20|0/-1.5,aecho=0.8:0.6:25:0.1",
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            mastered_f
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        dur_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mastered_f]
        dur = float(subprocess.check_output(dur_cmd).decode().strip())
        print(f"  + {cid}: {dur:.2f}s")

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

def assemble_master_track():
    print("Assembling 45s Master Audio Track with Emma Neural voice...")
    
    # 1. Warm cinematic ambient drone
    t = np.linspace(0, TOTAL_DURATION, TOTAL_SAMPLES, endpoint=False)
    drone = 0.03 * np.sin(2 * np.pi * 55.0 * t) + 0.018 * np.sin(2 * np.pi * 82.4 * t)
    shimmer = 0.005 * np.sin(2 * np.pi * 330.0 * t) * np.sin(2 * np.pi * 0.15 * t)
    fade_in = np.minimum(1.0, t / 1.5)
    fade_out = np.minimum(1.0, (TOTAL_DURATION - t) / 2.0)
    master = (drone + shimmer) * fade_in * fade_out
    
    # 2. Authentic Lead-II ECG audio tones in Scene 17 (30.0s to 34.0s)
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
        
    # 3. Synchronized speech cues
    cues = [
        (0.3, os.path.join(AUDIO_DIR, "sc15_a_mastered.wav")),
        (5.5, os.path.join(AUDIO_DIR, "sc15_bc_mastered.wav")),
        (15.2, os.path.join(AUDIO_DIR, "sc16_a_mastered.wav")),
        (20.4, os.path.join(AUDIO_DIR, "sc16_bc_mastered.wav")),
        (30.2, os.path.join(AUDIO_DIR, "sc17_a_mastered.wav")),
        (34.8, os.path.join(AUDIO_DIR, "sc17_b_mastered.wav")),
        (40.2, os.path.join(AUDIO_DIR, "sc17_c_mastered.wav")),
        (42.6, os.path.join(AUDIO_DIR, "sc17_d_mastered.wav")),
    ]
    
    for start_sec, clip_f in cues:
        clip = load_audio(clip_f)
        s_idx = int(start_sec * SAMPLE_RATE)
        e_idx = min(TOTAL_SAMPLES, s_idx + len(clip))
        master[s_idx:e_idx] += clip[:e_idx - s_idx] * 1.30
        
    # Peak normalization
    peak = np.max(np.abs(master))
    if peak > 0.98:
        master = (master / peak) * 0.96
        
    out_master_wav = os.path.join(OUTPUT_DIR, "master_emma_voiceover_track.wav")
    with wave.open(out_master_wav, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in master:
            wf.writeframes(struct.pack('<h', int(s * 32767)))
            
    print(f"Master Emma track created: {out_master_wav}")
    
    # 4. Mux into Master Full Sequence Video
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
    print(f"Master Video successfully updated with Emma voice: {master_v_out}")
    
    # 5. Update individual scene clips
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
            print(f"  + Updated with Emma voice: {s_name}")

    # 6. Refresh ZIP package
    print("Refreshing ZIP archive...")
    zip_name = os.path.join(OUTPUT_DIR, "HELIOS_Pitch_Videos_Scenes_15_to_17.zip")
    import glob
    videos = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.mp4")))
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for v in videos:
            zipf.write(v, arcname=os.path.basename(v))
        if os.path.exists('Video_Script/HELIOS_Pitch_Script_Scenes_15_to_17.docx'):
            zipf.write('Video_Script/HELIOS_Pitch_Script_Scenes_15_to_17.docx', arcname='HELIOS_Pitch_Script_Scenes_15_to_17.docx')
        zipf.write(out_master_wav, arcname='master_emma_voiceover_track.wav')
    
    shutil.copyfile(zip_name, 'HELIOS_Pitch_Videos_Scenes_15_to_17.zip')
    print(f"ZIP package refreshed: {os.path.getsize(zip_name)/(1024*1024):.2f} MB")

if __name__ == "__main__":
    import zipfile
    asyncio.run(generate_emma_clips())
    assemble_master_track()
