import asyncio
import edge_tts
import os

# Test Jenny and Aria with full SSML emotional markup
ssml_samples = {
    "jenny_empathetic": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="empathetic" styledegree="1.8">
            <prosody rate="-3%" pitch="+1Hz">
                The true test of space medicine is not just deep space. <break time="450ms"/> It is extreme isolation.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",
    "jenny_serious_heartbeat": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-JennyNeural">
        <mstts:express-as style="serious" styledegree="1.6">
            <prosody rate="-5%" pitch="-1Hz">
                A heartbeat changes <break time="300ms"/> nearly four hundred thousand kilometers from Earth.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>""",
    "aria_hopeful": """<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="en-US-AriaNeural">
        <mstts:express-as style="hopeful" styledegree="1.6">
            <prosody rate="-2%" pitch="+0Hz">
                HELIOS turns that change into understanding, so the crew can act before a signal becomes a crisis.
            </prosody>
        </mstts:express-as>
    </voice>
</speak>"""
}

async def run():
    for name, ssml in ssml_samples.items():
        out_f = f"Video_Outputs/audio/{name}.mp3"
        com = edge_tts.Communicate(ssml, "en-US-JennyNeural" if "jenny" in name else "en-US-AriaNeural")
        await com.save(out_f)
        print(f"Generated {out_f}")

if __name__ == "__main__":
    asyncio.run(run())
