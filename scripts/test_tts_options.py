import asyncio
import edge_tts
import subprocess
import os

ssml_text = """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="empathetic" styledegree="1.5">
            The true test of space medicine is not just deep space. It is extreme isolation.
        </mstts:express-as>
    </voice>
</speak>"""

async def test():
    try:
        # Edge-TTS parses SSML when text starts with <speak
        com = edge_tts.Communicate(ssml_text, "en-US-JennyNeural")
        await com.save("test_ssml_jenny.mp3")
        print("SSML Jenny generated successfully!")
    except Exception as e:
        print(f"SSML error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
