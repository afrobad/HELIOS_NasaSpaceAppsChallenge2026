import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

def create_simplified_report_docx(output_path):
    doc = docx.Document()

    # 1. Page Setup
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Palette
    COLOR_PRIMARY = RGBColor(11, 61, 145)    # NASA Blue (#0B3D91)
    COLOR_SECONDARY = RGBColor(22, 101, 192) # Cobalt (#1665C0)
    COLOR_DARK = RGBColor(26, 32, 44)        # Charcoal (#1A202C)
    COLOR_MUTED = RGBColor(100, 116, 139)    # Slate (#64748B)
    COLOR_ALERT = RGBColor(197, 48, 48)      # Crimson (#C53030)
    COLOR_SUCCESS = RGBColor(34, 139, 34)    # Green (#228B22)

    HEX_PRIMARY = "0B3D91"
    HEX_SECONDARY = "1665C0"
    HEX_LIGHT_BG = "F8FAFC"
    HEX_BORDER = "CBD5E1"
    HEX_ACCENT_BG = "EFF6FF"
    HEX_OLD_BG = "FFF5F5"
    HEX_NEW_BG = "F0FFF4"

    FONT_FAMILY = "Segoe UI"

    # Helpers
    def set_cell_background(cell, hex_color):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'''
            <w:tcMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tcMar>
        ''')
        tcPr.append(tcMar)

    def set_cell_borders(cell, top="CBD5E1", bottom="CBD5E1", left="CBD5E1", right="CBD5E1", sz="4"):
        tcPr = cell._tc.get_or_add_tcPr()
        borders_elm = f'<w:tcBorders {nsdecls("w")}>'
        for side, col in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
            if col:
                borders_elm += f'<w:{side} w:val="single" w:sz="{sz}" w:space="0" w:color="{col}"/>'
            else:
                borders_elm += f'<w:{side} w:val="none"/>'
        borders_elm += '</w:tcBorders>'
        tcPr.append(parse_xml(borders_elm))

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = FONT_FAMILY
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = FONT_FAMILY
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = COLOR_SECONDARY
        return p

    def add_p(text, bold_prefix=None, space_after=4):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.name = FONT_FAMILY
            r_pre.font.size = Pt(9.5)
            r_pre.font.bold = True
            r_pre.font.color.rgb = COLOR_DARK
        run = p.add_run(text)
        run.font.name = FONT_FAMILY
        run.font.size = Pt(9.5)
        run.font.color.rgb = COLOR_DARK
        return p

    def add_callout(title, body_text):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        cell = tbl.cell(0, 0)
        cell.width = Inches(7.0)
        set_cell_background(cell, HEX_ACCENT_BG)
        set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
        set_cell_borders(cell, top=HEX_SECONDARY, bottom=HEX_SECONDARY, left=HEX_SECONDARY, right=HEX_SECONDARY, sz="8")
        
        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after = Pt(2)
        r_title = cp.add_run(title)
        r_title.font.name = FONT_FAMILY
        r_title.font.size = Pt(10)
        r_title.font.bold = True
        r_title.font.color.rgb = COLOR_PRIMARY

        cp2 = cell.add_paragraph()
        cp2.paragraph_format.space_before = Pt(0)
        cp2.paragraph_format.space_after = Pt(0)
        cp2.paragraph_format.line_spacing = 1.15
        r_body = cp2.add_run(body_text)
        r_body.font.name = FONT_FAMILY
        r_body.font.size = Pt(9.0)
        r_body.font.color.rgb = COLOR_DARK

        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(4)

    # ==================== TITLE ====================
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    r_main_title = title_p.add_run("H.E.L.I.O.S — SCRIPT MODIFICATION GUIDE & PLAYBOOK")
    r_main_title.font.name = FONT_FAMILY
    r_main_title.font.size = Pt(18)
    r_main_title.font.bold = True
    r_main_title.font.color.rgb = COLOR_PRIMARY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(6)
    r_sub = sub_p.add_run("What to Change, Where to Change It, and the Purpose of Every Element")
    r_sub.font.name = FONT_FAMILY
    r_sub.font.size = Pt(11)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_SECONDARY

    meta_p = doc.add_paragraph()
    meta_p.paragraph_format.space_before = Pt(0)
    meta_p.paragraph_format.space_after = Pt(10)
    r_meta = meta_p.add_run("NASA Space Apps Challenge 2026 | Team X: Md Raisul Islam Khan • Zihaduzzaman • Md Miraz • Ashfia Tasnim")
    r_meta.font.name = FONT_FAMILY
    r_meta.font.size = Pt(9.0)
    r_meta.font.bold = True
    r_meta.font.color.rgb = COLOR_MUTED

    # ==================== PART 1: UNDERSTANDING THE ELEMENTS ====================
    add_h1("Part 1: The Purpose of Each Element in a Video Script")
    add_p("A professional pitch script uses 4 distinct elements. Here is what each element is for:")

    elem_table = doc.add_table(rows=5, cols=3)
    elem_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    elem_table.autofit = False
    
    e_widths = [Inches(1.5), Inches(2.3), Inches(3.2)]
    e_headers = ["Element Name", "What It Represents", "Its Exact Purpose in the Video"]

    for ci, h in enumerate(e_headers):
        cell = elem_table.cell(0, ci)
        cell.width = e_widths[ci]
        set_cell_background(cell, HEX_PRIMARY)
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        set_cell_borders(cell, top=HEX_PRIMARY, bottom=HEX_PRIMARY, left=HEX_PRIMARY, right=HEX_PRIMARY)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.name = FONT_FAMILY
        r.font.size = Pt(9.0)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    elem_rows = [
        ("VOICE (Voiceover)", "What the narrator says into the microphone.",
         "Drives the story, explains the medical danger, and emotionally hooks the judges so they care about the problem."),
        ("VISUAL (Video)", "What is shown on the screen (footage, app UI).",
         "Provides visual proof. Judges want to see your real working software and UI, not just hear you talk."),
        ("ON-SCREEN TEXT", "Bold words and badges displayed over the video.",
         "Acts as a memory anchor. Judges skim while watching; on-screen text locks the key takeaway into their minds."),
        ("SFX (Sound Effects)", "Subtle audio cues (beeps, radio static, hums).",
         "Creates a cinematic, high-budget atmosphere that feels like an authentic NASA Mission Control control room.")
    ]

    for ri, row in enumerate(elem_rows):
        for ci, val in enumerate(row):
            cell = elem_table.cell(ri + 1, ci)
            cell.width = e_widths[ci]
            bg_col = HEX_LIGHT_BG if ri % 2 == 0 else "FFFFFF"
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            set_cell_borders(cell, top=HEX_BORDER, bottom=HEX_BORDER, left=HEX_BORDER, right=HEX_BORDER)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.name = FONT_FAMILY
            r.font.size = Pt(8.5)
            r.font.color.rgb = COLOR_DARK
            if ci == 0:
                r.font.bold = True

    p_sp1 = doc.add_paragraph()
    p_sp1.paragraph_format.space_before = Pt(0)
    p_sp1.paragraph_format.space_after = Pt(4)

    # ==================== PART 2: THE 4 BIG CHANGES EXPLAINED ====================
    add_h1("Part 2: Why We Must Change the Original Script (In Plain English)")
    
    add_p("If a NASA judge watched the original script as written, they would deduct points for 4 specific reasons. Here is how we fix each one:", bold_prefix="The 4 Traps We Are Fixing: ")

    p_c1 = doc.add_paragraph()
    p_c1.paragraph_format.space_before = Pt(2)
    p_c1.paragraph_format.space_after = Pt(2)
    r_t1 = p_c1.add_run("1. The Mission & Dataset Confusion (Inspiration4 vs. Artemis):\n")
    r_t1.bold = True
    r_t1.font.color.rgb = COLOR_PRIMARY
    p_c1.add_run("• What happened: ")
    p_c1.runs[-1].bold = True
    p_c1.add_run("Your script said Artemis II lands on the Moon (it doesn't), but your dashboard clearly shows 'Inspiration4 (C001)'. The judge thinks you mixed up space missions.\n")
    p_c1.add_run("• The Fix: ")
    p_c1.runs[-1].bold = True
    p_c1.add_run("We explicitly state that Inspiration4 is the authentic NASA OSDR training dataset we used to build the baselines, and Artemis is the deep-space mission we built it for. Now you look like a genius data scientist instead of looking confused.")

    p_c2 = doc.add_paragraph()
    p_c2.paragraph_format.space_before = Pt(4)
    p_c2.paragraph_format.space_after = Pt(2)
    r_t2 = p_c2.add_run("2. The Telemetry Contradiction in Scene 9:\n")
    r_t2.bold = True
    r_t2.font.color.rgb = COLOR_PRIMARY
    p_c2.add_run("• What happened: ")
    p_c2.runs[-1].bold = True
    p_c2.add_run("You said 'Distance creates delay,' but in Scene 9 you said Earth has a 'continuous view' of astronaut health. If Earth can monitor them 24/7, they don't need your onboard AI!\n")
    p_c2.add_run("• The Fix: ")
    p_c2.runs[-1].bold = True
    p_c2.add_run("We state clearly that HELIOS runs 100% offline during communication blackouts, and syncs data to Earth later when radio links reconnect. This protects your core value proposition.")

    p_c3 = doc.add_paragraph()
    p_c3.paragraph_format.space_before = Pt(4)
    p_c3.paragraph_format.space_after = Pt(2)
    r_t3 = p_c3.add_run("3. Team Member Names at 0:28 Killed Your Momentum:\n")
    r_t3.bold = True
    r_t3.font.color.rgb = COLOR_PRIMARY
    p_c3.add_run("• What happened: ")
    p_c3.runs[-1].bold = True
    p_c3.add_run("At second 28, the audience is waiting to see the invention. Halting the video to read team names aloud bores the judge.\n")
    p_c3.add_run("• The Fix: ")
    p_c3.runs[-1].bold = True
    p_c3.add_run("We reveal the HELIOS software at 0:28, and put all four team members (Md Raisul Islam Khan, Zihaduzzaman, Md Miraz, and Ashfia Tasnim) at the very end (3:52) with sleek on-screen titles.")

    p_c4 = doc.add_paragraph()
    p_c4.paragraph_format.space_before = Pt(4)
    p_c4.paragraph_format.space_after = Pt(6)
    r_t4 = p_c4.add_run("4. You Hid Your Real Code Under 'Heart Rate and O2':\n")
    r_t4.bold = True
    r_t4.font.color.rgb = COLOR_PRIMARY
    p_c4.add_run("• What happened: ")
    p_c4.runs[-1].bold = True
    p_c4.add_run("Your codebase has Lead II ECG streaming at 10 Hz, Z-score math, exercise workout gating, lab assays, and local JARVIS AI. But your script only talked about basic vitals like an Apple Watch!\n")
    p_c4.add_run("• The Fix: ")
    p_c4.runs[-1].bold = True
    p_c4.add_run("We directly showcase the 10 Hz ECG canvas, Clinical Sentry Matrix, and JARVIS offline voice assistant in Scenes 7, 8, 10, and 13.")

    # ==================== PART 3: SCENE-BY-SCENE CHANGE PLAYBOOK ====================
    add_h1("Part 3: Master Scene-by-Scene Change Table (Where to Change & What to Put)")
    add_p("Open your original document. For every scene, replace the OLD text with the NEW text. The PURPOSE column explains exactly why this wins points:")

    scenes_master = [
        # Scene 1
        ("Scene 1\n(0:00–0:13)\n\nOpening Hook",
         "VOICE: \"A heartbeat changes in deep space. Who notices? April 1st, 2026. More than half a century after Apollo, humanity journeyed back toward the Moon. Four astronauts left Earth aboard Artemis II.\"",
         "VOICE: \"A heartbeat changes in deep space. Who notices? As humanity prepares to journey beyond low Earth orbit with the Artemis missions, four astronauts will travel farther from emergency hospital care than ever before.\"",
         "Fixes the factually incorrect April 1st date and eliminates the claim that Artemis II lands on the Moon. Sets up the deep-space medical crisis immediately."),

        # Scene 2
        ("Scene 2\n(0:13–0:28)\n\nThe Problem",
         "VOICE: \"As Orion traveled deeper into space, Earth grew smaller behind them. And hundreds of thousands of kilometers from home, the human body begins to change. But who recognizes it? Who is watching? Who recognizes the symptoms? And most importantly—Who tells the astronaut what to do next?\"",
         "VOICE: \"Hundreds of thousands of kilometers from home, extreme microgravity and cosmic radiation stress the human body. But when communications black out on the far side of the Moon—who catches the early warning signs? And who tells the astronaut what to do next?\"",
         "Cuts 4 rushed, repetitive questions down to 2 punchy, memorable questions. Introduces the real danger: communication blackout."),

        # Scene 3
        ("Scene 3\n(0:28–0:45)\n\nThe Solution",
         "VOICE: \"This is Team X—researchers, developers, designers and storytellers... Our team consists of: Team Leader Md Raisul Islam Khan, Developer Zihaduzzaman... And our answer is HELIOS.\"",
         "VOICE: \"Our answer is H.E.L.I.O.S—the Health Evaluation Logistic Intelligent Onboard System. An offline-first, AI-powered medical decision support platform engineered to keep deep-space crews healthy, completely autonomous from Earth.\"",
         "Moves team member names to the closing credits. Reveals your actual product at second 28 while viewer attention is at its peak."),

        # Scene 4
        ("Scene 4\n(0:45–1:05)\n\nThe Latency",
         "VOICE: \"In deep space, distance changes everything. An astronaut may be hundreds of thousands of kilometers from Earth... Every heartbeat, every change, every warning matters.\"",
         "VOICE: \"In deep space, distance creates dangerous delays. Radio signals take minutes to travel back and forth. In an acute medical emergency—like a cardiac arrhythmia or toxic exposure—the crew cannot wait for Mission Control in Houston to reply.\"",
         "Replaces generic motivational quotes with the real aerospace problem: speed-of-light radio delay makes Earth telemedicine impossible."),

        # Scene 5
        ("Scene 5\n(1:05–1:25)\n\nThe Data (Bridge)",
         "VOICE: \"But health information shouldn’t be buried in screens, scattered across systems... On Earth, the control centre needs a continuous picture. In the spacecraft, the astronaut needs their own information...\"",
         "VOICE: \"To solve this, we didn’t guess. We grounded HELIOS in authentic human spaceflight data from the NASA Open Science Data Repository—utilizing cardiovascular, immune, and blood panels from the Inspiration4 SOMA spaceflight atlas to set real clinical baseline standards.\"",
         "THE CRITICAL BRIDGE: Explains why your dashboard displays 'Inspiration4 (C001)'. Proves to judges that you used authentic NASA open science data."),

        # Scene 6
        ("Scene 6\n(1:25–1:45)\n\nThe Edge AI",
         "VOICE: \"So we asked a simple question: What if an astronaut’s health could follow them—wherever they are? Not just monitored from Earth. Not just stored in a system. But available to the person who needs it...\"",
         "VOICE: \"What if an astronaut had an intelligent clinical flight surgeon running directly on their local hardware? No internet. No cloud servers. A private, edge-native system that processes biometrics at 10 Hz and catches subtle abnormalities before they become critical.\"",
         "Explains your technical architecture: 100% offline edge computing with zero cloud dependencies."),

        # Scene 7
        ("Scene 7\n(1:45–2:05)\n\nLive 4-Crew HUD",
         "VOICE: \"HELIOS is a real-time astronaut health monitoring system designed to keep the entire crew connected to their vital health data.\" (Only 20 words in 20 seconds!)",
         "VOICE: \"This is HELIOS in action. The 4-crew Command HUD streams real-time physiological telemetry at 10 Hz. The Crew Medical Officer can monitor all four astronauts simultaneously, with individual physiological baselines derived directly from verified NASA flight records.\"",
         "Eliminates 10 seconds of dead silence. Directly explains what is visible on screen: 4 astronauts streaming at 10 Hz."),

        # Scene 8
        ("Scene 8\n(2:05–2:25)\n\nECG & Sentry",
         "VOICE: \"At the heart of HELIOS is a live monitoring dashboard. The crew can be monitored simultaneously, while individual health data remains available for each astronaut.\"",
         "VOICE: \"Behind every vital is our Clinical Sentry Matrix. HELIOS renders live Lead II ECG waveforms and calculates real-time Z-scores against personal flight baselines. Intelligent activity gating recognizes when an astronaut is exercising, preventing false alarms.\"",
         "Highlights your actual code! Mentions Lead II ECG waveforms, Z-score math, and workout gating so you don't look like a basic smartwatch."),

        # Scene 9
        ("Scene 9\n(2:25–2:35)\n\nBlackout Sync",
         "VOICE: \"The same health information is visible from the control centre on Earth, giving mission teams a continuous view of the crew’s condition while the astronauts remain far beyond Earth.\"",
         "VOICE: \"During communication blackouts, HELIOS operates with complete local autonomy, saving all data safely to local storage. When ground links reconnect, telemetry syncs asynchronously with Earth using Delay-Tolerant Networking.\"",
         "Fixes the fatal contradiction. Explains that HELIOS works offline first, and syncs with Earth later when radio links are available."),

        # Scene 10
        ("Scene 10\n(2:35–2:45)\n\nJARVIS Voice AI",
         "VOICE: \"And when screens aren’t practical, HELIOS works through voice commands with biometric authentication—allowing the system to recognize the astronaut and provide the information they need, hands-free.\"",
         "VOICE: \"When hands are busy or gloves are on, our onboard AI voice assistant—JARVIS—delivers proactive clinical advice, powered by a local language model running entirely on the spacecraft's local machine.\"",
         "Explicitly names your AI assistant (JARVIS) and highlights that it runs on a local LLM (Ollama Llama 3.2)."),

        # Scene 11
        ("Scene 11\n(2:45–3:00)\n\nEVA Expansion",
         "VOICE: \"But HELIOS doesn’t stop at the spacecraft. When an astronaut steps outside, their health information goes with them.\"",
         "VOICE: \"HELIOS doesn’t stop at the cabin door. For lunar surface exploration on future Artemis missions, the system links module telemetry directly to astronaut spacesuits for extravehicular activity.\"",
         "Fixes the Artemis II landing mistake. Accurately frames lunar surface spacewalks as future Artemis exploration."),

        # Scene 12
        ("Scene 12\n(3:00–3:25)\n\nHUD & Logistics",
         "VOICE: \"During an EVA, essential health data can be displayed directly through the astronaut’s helmet interface—keeping critical information within their field of view without requiring them to return to a console.\"",
         "VOICE: \"During a spacewalk, metabolic workload and oxygen margins display directly inside the helmet heads-up display. Inside the ship, our medical logistics system tracks medicine shelf-life and recommends in-flight lab assays the moment symptoms emerge.\"",
         "Explains the 'L' in HELIOS (Logistics) and in-flight lab assays, proving you built a full medical system."),

        # Scene 13
        ("Scene 13\n(3:25–3:40)\n\nWorking Prototype",
         "VOICE: \"And this isn’t just a concept. This is HELIOS.\" (Only 9 words in 15 seconds! Awkward dead air).",
         "VOICE: \"This is not a concept animation—this is a fully operational software prototype. Built with FastAPI and React 19, tested against simulated clinical crises, and proven to guide non-physician astronauts step-by-step through emergency triage.\"",
         "Kills 11 seconds of dead silence! Proves to judges that your software is built, running, and validated."),

        # Scene 14
        ("Scene 14\n(3:40–3:52)\n\nThe Vision",
         "VOICE: \"Our vision is a unified health interface that connects astronaut, spacecraft, and mission control—so that wherever the astronaut goes, their health information is never out of reach.\"",
         "VOICE: \"Our vision is an autonomous bioastronautics ecosystem that protects human life when Earth is unreachable, bridging the gap between raw biometrics and actionable medical decisions.\"",
         "High-impact aerospace closing statement that frames HELIOS as the future of deep-space medicine."),

        # Scene 15
        ("Scene 15\n(3:52–4:00)\n\nAll 4 Team Members",
         "VOICE: \"Because when humanity goes farther than ever before, health shouldn’t be left behind.\"",
         "VOICE: \"Developed by Team X: Md Raisul Islam Khan, Zihaduzzaman, Md Miraz, and Ashfia Tasnim. Because when humanity journeys into deep space, human health can never be left behind.\"",
         "Properly credits all four team members with pride and delivers the final emotional closer.")
    ]

    # Create Table
    playbook_table = doc.add_table(rows=len(scenes_master) + 1, cols=4)
    playbook_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    playbook_table.autofit = False

    p_widths = [Inches(1.1), Inches(2.0), Inches(2.2), Inches(1.7)]
    p_headers = ["Where (Scene)", "OLD Text (What You Had)", "NEW Text (What to Put)", "PURPOSE (Why We Changed It)"]

    for ci, h in enumerate(p_headers):
        cell = playbook_table.cell(0, ci)
        cell.width = p_widths[ci]
        set_cell_background(cell, HEX_PRIMARY)
        set_cell_margins(cell, top=80, bottom=80, left=80, right=80)
        set_cell_borders(cell, top=HEX_PRIMARY, bottom=HEX_PRIMARY, left=HEX_PRIMARY, right=HEX_PRIMARY)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.name = FONT_FAMILY
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    for ri, (sc_name, old_t, new_t, purp_t) in enumerate(scenes_master):
        row_cells = playbook_table.rows[ri + 1].cells
        
        # Col 0: Where
        row_cells[0].width = p_widths[0]
        set_cell_background(row_cells[0], HEX_LIGHT_BG)
        set_cell_margins(row_cells[0], top=60, bottom=60, left=70, right=70)
        set_cell_borders(row_cells[0], top=HEX_BORDER, bottom=HEX_BORDER, left=HEX_BORDER, right=HEX_BORDER)
        p0 = row_cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(sc_name)
        r0.font.name = FONT_FAMILY
        r0.font.size = Pt(8.0)
        r0.font.bold = True
        r0.font.color.rgb = COLOR_PRIMARY

        # Col 1: OLD Text
        row_cells[1].width = p_widths[1]
        set_cell_background(row_cells[1], HEX_OLD_BG)
        set_cell_margins(row_cells[1], top=60, bottom=60, left=70, right=70)
        set_cell_borders(row_cells[1], top=HEX_BORDER, bottom=HEX_BORDER, left=HEX_BORDER, right=HEX_BORDER)
        p1 = row_cells[1].paragraphs[0]
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        p1.paragraph_format.line_spacing = 1.1
        r1 = p1.add_run(old_t)
        r1.font.name = FONT_FAMILY
        r1.font.size = Pt(7.5)
        r1.font.color.rgb = COLOR_ALERT

        # Col 2: NEW Text
        row_cells[2].width = p_widths[2]
        set_cell_background(row_cells[2], HEX_NEW_BG)
        set_cell_margins(row_cells[2], top=60, bottom=60, left=70, right=70)
        set_cell_borders(row_cells[2], top=HEX_BORDER, bottom=HEX_BORDER, left=HEX_BORDER, right=HEX_BORDER)
        p2 = row_cells[2].paragraphs[0]
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        p2.paragraph_format.line_spacing = 1.1
        r2 = p2.add_run(new_t)
        r2.font.name = FONT_FAMILY
        r2.font.size = Pt(8.0)
        r2.font.bold = True
        r2.font.color.rgb = COLOR_DARK

        # Col 3: PURPOSE
        row_cells[3].width = p_widths[3]
        set_cell_background(row_cells[3], "FFFFFF")
        set_cell_margins(row_cells[3], top=60, bottom=60, left=70, right=70)
        set_cell_borders(row_cells[3], top=HEX_BORDER, bottom=HEX_BORDER, left=HEX_BORDER, right=HEX_BORDER)
        p3 = row_cells[3].paragraphs[0]
        p3.paragraph_format.space_before = Pt(0)
        p3.paragraph_format.space_after = Pt(0)
        p3.paragraph_format.line_spacing = 1.1
        r3 = p3.add_run(purp_t)
        r3.font.name = FONT_FAMILY
        r3.font.size = Pt(7.5)
        r3.font.color.rgb = COLOR_DARK

    # Save
    doc.save(output_path)
    print(f"Successfully generated simplified guide DOCX at: {output_path}")

if __name__ == "__main__":
    out_dir = r"c:\Users\ZISHAN\Desktop\WORK\NSAC- PROJECT_1\Video_Script"
    out_file = os.path.join(out_dir, "HELIOS_Script_Master_Change_Guide.docx")
    create_simplified_report_docx(out_file)
