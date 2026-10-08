"""
Precise voiceover timing generator for HELIOS Pitch Script Scenes 15, 16, 17.
Aligns speech pace naturally to match 15s per scene (45s total).
"""

import asyncio
import os
import subprocess
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Video_Outputs")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

VOICE = "en-US-AriaNeural"

VO_SECTIONS = [
    {
        "name": "vo_scene_15_full",
        "text": "The true test of space medicine is not just deep space. It is extreme isolation. HELIOS works without cloud dependency, providing clinical decision support in Antarctic stations, disaster zones, and other environments where evacuation is difficult and communication can fail.",
        "rate": "+15%",
        "pitch": "+0Hz"
    },
    {
        "name": "vo_scene_16_full",
        "text": "Built for modular telemetry and edge intelligence, HELIOS can evolve with the mission. From commercial orbital crews to multi-crewed lunar habitats, new sensors and additional crew members can be integrated without rebuilding the core intelligence.",
        "rate": "+12%",
        "pitch": "+0Hz"
    },
    {
        "name": "vo_scene_17_p1",
        "text": "A heartbeat changes nearly four hundred thousand kilometers from Earth.",
        "rate": "+4%",
        "pitch": "-1Hz"
    },
    {
        "name": "vo_scene_17_p2",
        "text": "HELIOS turns that change into understanding, so the crew can act before a signal becomes a crisis.",
        "rate": "+10%",
        "pitch": "+0Hz"
    },
    {
        "name": "vo_scene_17_p3",
        "text": "Monitor. Understand. Act.",
        "rate": "-3%",
        "pitch": "-1Hz"
    },
    {
        "name": "vo_scene_17_p4",
        "text": "We are Team Cosmic Plus.",
        "rate": "+0%",
        "pitch": "+0Hz"
    }
]

async def run_synthesis():
    print("Synthesizing refined neural voice clips...")
    for sec in VO_SECTIONS:
        out_path = os.path.join(AUDIO_DIR, f"{sec['name']}.mp3")
        com = edge_tts.Communicate(sec['text'], VOICE, rate=sec['rate'], pitch=sec['pitch'])
        await com.save(out_path)
        
        dur_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', out_path]
        dur = float(subprocess.check_output(dur_cmd).decode().strip())
        print(f"  {sec['name']}: {dur:.2f}s")

if __name__ == "__main__":
    asyncio.run(run_synthesis())
