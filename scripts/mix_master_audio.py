"""
Master Audio Production and Video Muxing Pipeline for HELIOS Scenes 15, 16, 17.
Composes:
  1. Neural Human Female Voiceover (en-US-AriaNeural)
  2. Medical telemetry tone beeps (Lead-II heartbeat callback)
  3. Cinematic ambient space pad / atmospheric score
  4. Muxes into Master Full Sequence (45s) and all 10 individual scene videos.
"""

import os
import subprocess
import numpy as np
import wave
import struct

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Video_Outputs")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

SAMPLE_RATE = 44100
TOTAL_DURATION = 45.0
TOTAL_SAMPLES = int(TOTAL_DURATION * SAMPLE_RATE)

def load_audio_file(filepath):
    """Loads an audio file (mp3/wav) into a float32 numpy array at 44.1kHz mono."""
    cmd = [
        "ffmpeg", "-i", filepath,
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    raw, _ = proc.communicate()
    return np.frombuffer(raw, dtype=np.float32)

def generate_ambient_score(duration_sec):
    """Generates a warm, cinematic ambient space drone with gentle chords and filtering."""
    t = np.linspace(0, duration_sec, int(duration_sec * SAMPLE_RATE), endpoint=False)
    
    # Sub-bass warmth
    drone = 0.04 * np.sin(2 * np.pi * 55.0 * t)       # A1 (55 Hz)
    drone += 0.025 * np.sin(2 * np.pi * 82.4 * t)     # E2 (82.4 Hz)
    drone += 0.018 * np.sin(2 * np.pi * 110.0 * t)    # A2 (110 Hz)
    drone += 0.012 * np.sin(2 * np.pi * 164.8 * t)    # E3 (164.8 Hz)
    
    # Slow LFO modulation
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.12 * t)
    drone *= (0.7 + 0.3 * lfo)
    
    # Subtle space shimmer (high-frequency overtone)
    shimmer = 0.005 * np.sin(2 * np.pi * 440.0 * t) * np.sin(2 * np.pi * 0.25 * t)
    
    # Fade in over 1.5s, fade out over 2.0s
    fade_in = np.minimum(1.0, t / 1.5)
    fade_out = np.minimum(1.0, (duration_sec - t) / 2.0)
    
    return (drone + shimmer) * fade_in * fade_out

def main():
    print("Building Master 45-Second Voiceover Audio Track...")
    
    # 1. Start with ambient score
    master_audio = generate_ambient_score(TOTAL_DURATION)
    
    # 2. Add ECG monitor tones at Scene 17A (time: 30.0s to 34.0s)
    beeps = [
        (30.4, 880, 0.08),
        (31.2, 880, 0.08),
        (32.05, 980, 0.09),  # ectopic tone
        (33.1, 880, 0.08),
        (33.9, 880, 0.08)
    ]
    for b_start, freq, b_dur in beeps:
        start_idx = int(b_start * SAMPLE_RATE)
        dur_samples = int(b_dur * SAMPLE_RATE)
        end_idx = min(TOTAL_SAMPLES, start_idx + dur_samples)
        t_b = np.linspace(0, (end_idx - start_idx) / SAMPLE_RATE, end_idx - start_idx, endpoint=False)
        envelope = np.sin(np.pi * np.linspace(0, 1, len(t_b))) ** 1.8
        tone = 0.28 * np.sin(2 * np.pi * freq * t_b) * envelope
        master_audio[start_idx:end_idx] += tone

    # 3. Voiceover schedule
    vo_cues = [
        # Scene 15 (0.0s - 15.0s)
        (0.4, os.path.join(AUDIO_DIR, "vo_15A.mp3")),
        (5.5, os.path.join(AUDIO_DIR, "vo_15BC.mp3")),
        
        # Scene 16 (15.0s - 30.0s)
        (15.3, os.path.join(AUDIO_DIR, "vo_16A.mp3")),
        (20.6, os.path.join(AUDIO_DIR, "vo_16BC.mp3")),
        
        # Scene 17 (30.0s - 45.0s)
        (30.3, os.path.join(AUDIO_DIR, "vo_17A.mp3")),
        (34.8, os.path.join(AUDIO_DIR, "vo_17B.mp3")),
        (40.2, os.path.join(AUDIO_DIR, "vo_17C.mp3")),
        (42.6, os.path.join(AUDIO_DIR, "vo_17D.mp3")),
    ]
    
    for start_sec, clip_path in vo_cues:
        if not os.path.exists(clip_path):
            print(f"Warning: {clip_path} does not exist, skipping.")
            continue
            
        clip = load_audio_file(clip_path)
        start_idx = int(start_sec * SAMPLE_RATE)
        end_idx = min(TOTAL_SAMPLES, start_idx + len(clip))
        
        # Overlay voice (amplified for prominence)
        master_audio[start_idx:end_idx] += clip[:end_idx - start_idx] * 1.15
        
    # Master limiter & normalization
    peak = np.max(np.abs(master_audio))
    if peak > 0.98:
        master_audio = (master_audio / peak) * 0.96
        
    # Export master audio WAV
    master_wav_path = os.path.join(OUTPUT_DIR, "master_voiceover_track.wav")
    with wave.open(master_wav_path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in master_audio:
            wf.writeframes(struct.pack('<h', int(s * 32767)))
            
    print(f"Master voiceover audio exported to: {master_wav_path}")
    
    # 4. Mux into Master Full Sequence Video
    master_video_src = os.path.join(OUTPUT_DIR, "Scenes_15_to_17_02-45_03-30_Full_Sequence.mp4")
    master_video_out = os.path.join(OUTPUT_DIR, "Scenes_15_to_17_02-45_03-30_Full_Sequence_With_Voiceover.mp4")
    
    print("Muxing full audio into master video...")
    cmd = [
        "ffmpeg", "-y",
        "-i", master_video_src,
        "-i", master_wav_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        master_video_out
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Master Video with Voiceover created at: {master_video_out}")
    
    # 5. Extract scene-by-scene audio slices and mux into each individual scene MP4
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
        
        # Mux matching time range from master audio
        s_cmd = [
            "ffmpeg", "-y",
            "-i", s_src,
            "-ss", str(t_start),
            "-t", str(dur),
            "-i", master_wav_path,
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
            print(f"  + Updated with voiceover: {s_name}")
            
    print("All scene videos and master sequence successfully updated with full voiceover!")

if __name__ == "__main__":
    main()
