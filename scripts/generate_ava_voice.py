"""
Synthesize the pitch script using Microsoft Ava Natural voice (en-US-AvaNeural).
"""

import asyncio
import os
import subprocess
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Video_Outputs")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio_ava")
os.makedirs(AUDIO_DIR, exist_ok=True)

VOICE = "en-US-AvaNeural"

CLIPS = [
    ("sc15_a", "The true test of space medicine is not just deep space... It is extreme isolation.", "-2%"),
    ("sc15_bc", "HELIOS works without cloud dependency, providing clinical decision support in Antarctic stations, disaster zones, and other environments where evacuation is difficult, and communication can fail.", "+0%"),
    ("sc16_a", "Built for modular telemetry and edge intelligence, HELIOS can evolve with the mission.", "-2%"),
    ("sc16_bc", "From commercial orbital crews to multi-crewed lunar habitats, new sensors and additional crew members can be integrated without rebuilding the core intelligence.", "+0%"),
    ("sc17_a", "A heartbeat changes nearly four hundred thousand kilometers from Earth.", "-2%"),
    ("sc17_b", "HELIOS turns that change into understanding, so the crew can act before a signal becomes a crisis.", "+0%"),
    ("sc17_c", "Monitor. Understand. Act.", "-4%"),
    ("sc17_d", "We are Team Cosmic Plus.", "-1%")
]

async def run():
    print(f"Generating voice clips with {VOICE}...")
    for cid, text, rate in CLIPS:
        f = os.path.join(AUDIO_DIR, f"{cid}.mp3")
        com = edge_tts.Communicate(text, VOICE, rate=rate)
        await com.save(f)
        cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', f]
        d = float(subprocess.check_output(cmd).decode().strip())
        print(f"  {cid}: {d:.2f}s")

if __name__ == "__main__":
    asyncio.run(run())
