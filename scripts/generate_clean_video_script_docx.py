import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_docx(output_path):
    doc = docx.Document()

    # 1-inch margins
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Document Header
    p_badge = doc.add_paragraph()
    p_badge.paragraph_format.space_before = Pt(0)
    p_badge.paragraph_format.space_after = Pt(2)
    r_badge = p_badge.add_run("NASA SPACE APPS CHALLENGE 2026 // PRODUCTION SCRIPT & TIMELINE")
    r_badge.font.name = 'Segoe UI'
    r_badge.font.size = Pt(9.5)
    r_badge.font.bold = True
    r_badge.font.color.rgb = RGBColor(0x02, 0x84, 0xC7) # Sky / Cyan

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("H.E.L.I.O.S. — Master Video Production Document")
    r_title.font.name = 'Segoe UI'
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A) # Slate 900

    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_before = Pt(0)
    p_meta.paragraph_format.space_after = Pt(14)
    r_meta = p_meta.add_run("Team: Aero Vitals   |   Runtime: Exactly 240 Seconds (4:00 Mins)   |   Speech Duration: 3:50 – 3:55 Mins")
    r_meta.font.name = 'Segoe UI'
    r_meta.font.size = Pt(9.5)
    r_meta.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

    # ----------------------------------------------------
    # BOX INDEX (MASTER SCENE & TIMELINE TABLE)
    # ----------------------------------------------------
    p_idx_head = doc.add_paragraph()
    p_idx_head.paragraph_format.space_before = Pt(8)
    p_idx_head.paragraph_format.space_after = Pt(6)
    r_idx_head = p_idx_head.add_run("BOX INDEX: SCENE & TIMELINE DIRECTORY")
    r_idx_head.font.name = 'Segoe UI'
    r_idx_head.font.size = Pt(13)
    r_idx_head.font.bold = True
    r_idx_head.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    index_data = [
        ("PART 1: WHO\n(0:00 – 0:45)", "01", "0:00 – 0:15", "The Hook & Artemis II Launch", "NASA SLS Liftoff 4K Broadcast"),
        ("PART 1: WHO\n(0:00 – 0:45)", "02", "0:15 – 0:30", "Deep-Space Human Hazards", "Orion in Deep Space & Microgravity Hazard HUD"),
        ("PART 1: WHO\n(0:00 – 0:45)", "03", "0:30 – 0:45", "Who We Are: Team Aero Vitals", "5-Member Role Badges with Cyan HUD Glow"),
        ("PART 2: WHY\n(0:45 – 1:35)", "04", "0:45 – 1:05", "NASA OSDR Scientific Foundation", "OSD-569 & OSD-575 Inspiration4 Dataset Modal"),
        ("PART 2: WHY\n(0:45 – 1:35)", "05", "1:05 – 1:25", "Command Dashboard & Lead II ECG", "4-Crew Vitals, 90 FPS ECG, Cabin ECLSS Life Support"),
        ("PART 3: WHAT\n(1:25 – 2:55)", "06", "1:25 – 1:45", "3D Holographic Bio-Twin", "360° Bio-Twin Rotation, Organ Peels (Cardiac, Bone, SANS)"),
        ("PART 3: WHAT\n(1:25 – 2:55)", "07", "1:45 – 2:00", "Astronaut Health Telemetry (AHTS)", "10 Physiological Categories · 119 NASA OSDR Biomarkers"),
        ("PART 3: WHAT\n(1:25 – 2:55)", "08", "2:00 – 2:20", "Self-Check & Routine (ARED + PVT)", "Symptom/Pain Map + Adaptive ARED & Millisecond PVT Drill"),
        ("PART 3: WHAT\n(1:25 – 2:55)", "09", "2:20 – 2:40", "Crisis: Solar Radiation Storm & SOLVED", "85 mGy/h Radiation Storm, Helix-Ai Voice, SOLVED Button"),
        ("PART 3: WHAT\n(1:25 – 2:55)", "10", "2:40 – 2:55", "3D ISS Station Deck Walkthrough", "3D Glide across 10 Modules into Cupola Earth View"),
        ("PART 4: SO WHAT\n(2:55 – 4:00)", "11", "2:55 – 3:15", "EVA Suit HUD Visor Navigation", "First-Person Helmet Visor, Mars Surface 3D & Waypoints"),
        ("PART 4: SO WHAT\n(2:55 – 4:00)", "12", "3:15 – 3:30", "Earth Mission Control (Light Delay)", "Physics-based Light Delay Engine (LEO to Mars Conjunction)"),
        ("PART 4: SO WHAT\n(2:55 – 4:00)", "13", "3:30 – 3:45", "Earth Transfer (Dual-Use Architecture)", "Firefighter HUD POV & Rugged Wilderness Rescue Tablet"),
        ("PART 4: SO WHAT\n(2:55 – 4:00)", "14", "3:45 – 4:00", "Vision & Final Close", "Heartbeat Harmonic Stabilization & Final HELIOS Title Card"),
    ]

    table_idx = doc.add_table(rows=len(index_data) + 1, cols=5)
    table_idx.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_idx.autofit = False
    set_table_borders(table_idx, color="CBD5E1", sz="4")

    # Column widths (Total ~6.9 inches)
    col_widths = [Inches(1.4), Inches(0.6), Inches(1.1), Inches(1.9), Inches(1.9)]
    for row in table_idx.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    # Table Header
    headers = ["Part", "Scene", "Timecode", "Scene Title & Focus", "Visual & Clip Reference"]
    hdr_row = table_idx.rows[0]
    for idx, text in enumerate(headers):
        cell = hdr_row.cells[idx]
        set_cell_background(cell, "0F172A") # Dark Navy
        set_cell_margins(cell, top=140, bottom=140, left=120, right=120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx in [1, 2] else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(text)
        r.font.name = 'Segoe UI'
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # Fill Table Data
    for row_idx, data in enumerate(index_data, start=1):
        row = table_idx.rows[row_idx]
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(data):
            cell = row.cells[col_idx]
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [1, 2] else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.font.name = 'Segoe UI'
            r.font.size = Pt(8.5)
            if col_idx == 1:
                r.font.bold = True
                r.font.color.rgb = RGBColor(0x02, 0x84, 0xC7)
            elif col_idx == 2:
                r.font.bold = True

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(16)
    p_sp.paragraph_format.space_after = Pt(4)

    # ----------------------------------------------------
    # SCENE-BY-SCENE PRODUCTION SPECIFICATIONS
    # ----------------------------------------------------
    scenes_full = [
        # PART 1
        {
            "part": "PART 1: WHO — THE HOOK & HUMAN ISOLATION (0:00 – 0:45)",
            "part_color": "0284C7",
            "scene_num": "01",
            "time": "0:00 – 0:15 (15 Seconds)",
            "title": "THE HOOK & ARTEMIS II",
            "voiceover": "A heartbeat changes four hundred thousand kilometers from Earth. Who notices? On Artemis missions to the Moon and Mars, twenty-four minutes of radio delay cuts astronauts off from mission control.",
            "title_in_visual": "LAUNCH COMPLEX 39B\nKENNEDY SPACE CENTER, FLORIDA\nARTEMIS DEEP-SPACE MISSION",
            "visual": "Black screen with crisp location text overlay → sudden fiery rocket ignition → SLS engines powerful blast → rocket climbing into deep space darkness.",
            "clips": "Official NASA Artemis I / SLS Liftoff 4K Ultra HD Broadcast (Public Domain)\nURL: https://images.nasa.gov/details/KSC-20221116-MH-MRA01-0001-Artemis_I_Launch_4K-3323067"
        },
        {
            "part": "PART 1: WHO — THE HOOK & HUMAN ISOLATION (0:00 – 0:45)",
            "part_color": "0284C7",
            "scene_num": "02",
            "time": "0:15 – 0:30 (15 Seconds)",
            "title": "THE HUMAN HAZARDS & SURVIVAL",
            "voiceover": "When microgravity leaches bone density, shifts body fluids to the skull, and swells optic nerves, crew survival depends on one thing: autonomous onboard intelligence.",
            "title_in_visual": "MICROGRAVITY HAZARDS // DEEP-SPACE LATENCY\nBone Loss · Cephalic Fluid Shift · SANS Optic Swelling",
            "visual": "SLS stage separation → Orion spacecraft traveling through deep space void → Earth visibly shrinking in the spacecraft window → astronaut silhouette with animated microgravity hazard callouts.",
            "clips": "Official NASA Orion Spacecraft Deep Space Render & In-Cabin Astronaut B-Roll (Public Domain)\nURL: https://images.nasa.gov/details/jsc2022m000570_Orion_Deep_Space_B-Roll"
        },
        {
            "part": "PART 1: WHO — THE HOOK & HUMAN ISOLATION (0:00 – 0:45)",
            "part_color": "0284C7",
            "scene_num": "03",
            "time": "0:30 – 0:45 (15 Seconds)",
            "title": "WHO WE ARE — TEAM AERO VITALS",
            "voiceover": "We are Team Aero Vitals—uniting our team lead, developer, system architect, researcher, and video editor to answer NASA Space Apps Challenge 2026 with HELIOS: Health Evaluation Logistic Intelligent Onboard System.",
            "title_in_visual": "TEAM Aero Vitals\nNASA International Space Apps Challenge 2026\nCHALLENGE: Create Health Monitoring Software for Astronauts on Space Missions",
            "visual": "Team photo card with five animated role badges lighting up in glowing cyan:\n• Team Leader — Raisul Islam\n• Developer — Mohammad Zihaduzzaman\n• CyberSecurity Architect — Mohammed Meraj\n• Researcher — Ashfia Tasnim\n• Video Editor — Mohammad Sabbir",
            "clips": "Team Aero Vitals Official Crew Graphic Asset (5-Member Role Badges with Cyan HUD Border)"
        },

        # PART 2
        {
            "part": "PART 2: WHY — SCIENTIFIC GROUNDING & LIVE COMMAND (0:45 – 1:35)",
            "part_color": "0D9488", # Teal
            "scene_num": "04",
            "time": "0:45 – 1:05 (20 Seconds)",
            "title": "NASA OSDR SCIENTIFIC FOUNDATION",
            "voiceover": "HELIOS is an offline-first health sentry running directly on spacecraft flight computers without cloud dependence. We grounded our platform in authentic NASA science, fusing SpaceX Inspiration4 datasets from the NASA Open Science Data Repository—OSD-569 for hematology and OSD-575 for multi-omics biomarkers—with live 10 Hz telemetry across 149 parameters.",
            "title_in_visual": "POWERED BY NASA OPEN SCIENCE DATA REPOSITORY (OSDR)\nSpaceX Inspiration4 Mission (SOMA Cohort)\n• OSD-569: Whole Blood & Hematological Baselines\n• OSD-575: Multi-Omics, Metabolic & Immune Biomarkers\n• 149 Physiological Parameters Streaming at 10 Hz",
            "visual": "Open EVIDENCE / OSDR modal on the bottom control bar: highlight OSD-569 whole-blood CBC and OSD-575 multi-omics biomarker tables and Inspiration4 datasets.",
            "clips": "Official NASA Open Science Data Repository (OSDR):\n• OSD-569 Study Portal: https://osdr.nasa.gov/bio/repo/data/study/OSD-569\n• OSD-575 Study Portal: https://osdr.nasa.gov/bio/repo/data/study/OSD-575\n+ Screen recording of HELIOS OSDR Evidence View at http://localhost:3000"
        },
        {
            "part": "PART 2: WHY — SCIENTIFIC GROUNDING & LIVE COMMAND (0:45 – 1:35)",
            "part_color": "0D9488",
            "scene_num": "05",
            "time": "1:05 – 1:25 (20 Seconds)",
            "title": "LIVE COMMAND DASHBOARD & LEAD II ECG",
            "voiceover": "The flight Dashboard gives instant situational awareness: streaming four-crew vitals, hardware-decoupled Lead II ECG waveforms that capture subtle arrhythmia shifts in real time, and cabin ECLSS life-support telemetry monitoring oxygen, carbon dioxide, and air pressure.",
            "title_in_visual": "UNIFIED FLIGHT COMMAND DASHBOARD\n• 4-Crew Simultaneous Biometric Stream\n• 90 FPS Lead II ECG & SpO₂ Real-Time Waveforms\n• Cabin ECLSS Life Support (Pressure, O₂, CO₂, Radiation Flux)",
            "visual": "4K live screen recording of flight command deck at localhost:3000: smooth zoom into 4 crew vitals (Commander Haley, Pilot Chris, Dr. Sian, Specialist Leo). Highlight 90 FPS Lead II ECG waveform pulsing in real-time, then pan to the top cabin ECLSS life support bar.",
            "clips": "Direct Screen Capture (Original Copyright-Free): Screen recording of live flight deck at http://localhost:3000 (4-crew stream, 90 FPS Lead II ECG, ECLSS environmental bar)"
        },

        # PART 3
        {
            "part": "PART 3: WHAT — CORE AUTONOMOUS INNOVATIONS (1:25 – 2:55)",
            "part_color": "4F46E5", # Indigo
            "scene_num": "06",
            "time": "1:25 – 1:45 (20 Seconds)",
            "title": "3D HOLOGRAPHIC BIO-TWIN",
            "voiceover": "At its core is the interactive 3D Holographic Bio-Twin. Astronauts rotate a live anatomical twin through 360 degrees, peeling back layers to inspect organ-level strain, bone demineralization, and optic nerve sheath swelling from SANS—turning abstract biomarkers into intuitive spatial insight.",
            "title_in_visual": "3D HOLOGRAPHIC BIO-TWIN // SPATIAL ANATOMY\n• 360° Rotational Anatomical Inspection\n• Cardiac Strain & Arrhythmia Mapping\n• Musculoskeletal Demineralization (Zero-G Bone Loss)\n• Ocular Sheath Diameter & SANS Intracranial Pressure",
            "visual": "Click and drag 3D Holographic Bio-Twin in a full 360° rotational sweep. Select CARDIAC to inspect heart rhythm dynamics, SKELETAL to inspect bone mineral density demineralization, and OCULAR to inspect optic nerve sheath diameter (SANS ICP swelling).",
            "clips": "Direct Screen Capture: 3D Holographic Bio-Twin interactive inspection at http://localhost:3000"
        },
        {
            "part": "PART 3: WHAT — CORE AUTONOMOUS INNOVATIONS (1:25 – 2:55)",
            "part_color": "4F46E5",
            "scene_num": "07",
            "time": "1:45 – 2:00 (15 Seconds)",
            "title": "ASTRONAUT HEALTH TELEMETRY SYSTEM (AHTS)",
            "voiceover": "Our Astronaut Health Telemetry System organizes measurements across ten physiological categories—linking 119 biomarkers, from cosmic radiation dosimetry to bone resorption and immune cytokines, into actionable operational insight.",
            "title_in_visual": "AHTS — ASTRONAUT HEALTH TELEMETRY SYSTEM\n10 PHYSIOLOGICAL CATEGORIES · 119 BIOMARKERS\nSensor Telemetry → Baseline Envelopes → Operational Insight",
            "visual": "Navigate through Telemetry view displaying 119 NASA OSDR biomarkers grouped into ten tabs (Cardiovascular, Respiratory, Thermoregulation, Musculoskeletal, Hematology, etc.).",
            "clips": "Direct Screen Capture: Screen recording of HELIOS Telemetry Tab at http://localhost:3000 (10 physiological categories, 119 biomarkers, real-time 10 Hz cadence)"
        },
        {
            "part": "PART 3: WHAT — CORE AUTONOMOUS INNOVATIONS (1:25 – 2:55)",
            "part_color": "4F46E5",
            "scene_num": "08",
            "time": "2:00 – 2:20 (20 Seconds)",
            "title": "SELF-CHECK & DYNAMIC MISSION ROUTINE (ARED + PVT)",
            "voiceover": "Because deep-space wellness must be proactive, HELIOS introduces daily Self-Check and dynamic Mission Routine. In Self-Check, crew members log subjective symptoms and pain locations that instantly cross-correlate with biosensors. In Routine, daily schedules dynamically adapt to biometric fatigue: tracking hydration, scheduling targeted ARED resistance exercises to stop microgravity bone loss, and measuring millisecond cognitive alertness with a validated Psychomotor Vigilance Task.",
            "title_in_visual": "SELF-CHECK // PROACTIVE WELLNESS LOGGING\n• Subjective Symptom & Pain Localization Mapping\nMISSION ROUTINE // ADAPTIVE FLIGHT TIMELINE\n• Countermeasures: Adaptive ARED Bone-Loss Workouts\n• Cognitive Readiness: Millisecond PVT Reaction Drill",
            "visual": "1. Open Self-Check view: show astronaut logging symptom tags, 3D anatomical pain localization map, and mood slider.\n2. Switch to Routine view: show adaptive timeline updating dynamically with ARED resistance loads and hydration targets, then launch interactive PVT cognitive reaction drill locking in 218 ms.",
            "clips": "Direct Screen Capture: HELIOS Self-Check & Mission Routine views at http://localhost:3000"
        },
        {
            "part": "PART 3: WHAT — CORE AUTONOMOUS INNOVATIONS (1:25 – 2:55)",
            "part_color": "4F46E5",
            "scene_num": "09",
            "time": "2:20 – 2:40 (20 Seconds)",
            "title": "REAL-TIME CRISIS: SOLAR RADIATION STORM & 'SOLVED'",
            "voiceover": "When an in-flight crisis strikes, HELIOS acts within forty milliseconds. In our live simulator, trigger a deep-space Solar Radiation Storm: radiation spikes to 85 milligrays per hour, alarms flash crimson, and our offline voice AI, Helix-AI, speaks directly into crew headsets, commanding them into the water-shielded storm shelter. Once shielded, one click on the green SOLVED button harmonically resets systems to nominal flight cruise.",
            "title_in_visual": "CRISIS SCENARIO: DEEP-SPACE SOLAR PARTICLE STORM\n• Radiation Flux Surge: 85 mGy/h\n• Autonomous Helix-Ai Voice Directive (<40ms)\n• One-Click 'SOLVED // ALL NOMINAL' Stabilization Engine",
            "visual": "1. Open Scenario Controller: trigger '03 · Deep-Space Solar Radiation Storm'.\n2. Screen flashes amber-crimson: 'Helix-Ai Analyst // CRITICAL: Solar Particle Radiation Storm (85 mGy/h)'. Helix-Ai commands crew to shelter.\n3. Cursor clicks green 'SOLVED // ALL NOMINAL' button. Telemetry immediately resets to nominal green cruise.",
            "clips": "Direct Screen Capture: HELIOS Live Scenario Simulator & Crisis Resolution at http://localhost:3000"
        },
        {
            "part": "PART 3: WHAT — CORE AUTONOMOUS INNOVATIONS (1:25 – 2:55)",
            "part_color": "4F46E5",
            "scene_num": "10",
            "time": "2:40 – 2:55 (15 Seconds)",
            "title": "3D ISS STATION DECK WALKTHROUGH",
            "voiceover": "Inside our 3D ISS Deck, astronauts can navigate ten station modules to inspect bulkhead sensor telemetry.",
            "title_in_visual": "3D ORBITAL FLIGHT DECK & BULKHEAD TELEMETRY\n10 Station Modules · Bulkhead Sensors · Cupola Orbital View",
            "visual": "Switch to ISS Deck tab: smooth 3D first-person camera glide through station corridor into the Cupola module with Earth spinning beneath, displaying real-time orbital velocity (27,600 km/h) on bulkhead monitors.",
            "clips": "Direct Screen Capture: HELIOS 3D ISS Orbital Deck Module Navigation at http://localhost:3000"
        },

        # PART 4
        {
            "part": "PART 4: SO WHAT — CONTINUITY & EARTH IMPACT (2:55 – 4:00)",
            "part_color": "15803D", # Emerald
            "scene_num": "11",
            "time": "2:55 – 3:15 (20 Seconds)",
            "title": "EVA SUIT HUD (HANDS-FREE VISOR NAVIGATION)",
            "voiceover": "Health follows the astronaut wherever they go. During lunar and planetary spacewalks, astronauts cannot carry tablets. The hands-free HELIOS Suit HUD projects real-time vitals, suit pressure, oxygen reserves, and tactical waypoint navigation directly onto the helmet visor.",
            "title_in_visual": "HELIOS // SUIT HUD\nHEALTH FOLLOWS THE ASTRONAUT.\nHands-Free EVA Visor · Life Support · Waypoint Navigation",
            "visual": "Suit HUD first-person view: curved helmet visor with reflections, Mars surface 3D terrain, tactical optical compass, and real-time SpO2 and heart rate vital meters.",
            "clips": "Official NASA Spacewalk Footage (Public Domain):\nURL: https://images.nasa.gov/details/jsc2023m000085_ISS_EVA_Spacewalk_85_4K_b-roll\n+ Direct Screen Capture: Live HELIOS Suit HUD at http://localhost:3000"
        },
        {
            "part": "PART 4: SO WHAT — CONTINUITY & EARTH IMPACT (2:55 – 4:00)",
            "part_color": "15803D",
            "scene_num": "12",
            "time": "3:15 – 3:30 (15 Seconds)",
            "title": "EARTH MISSION CONTROL CENTER (LIGHT-SPEED DELAY)",
            "voiceover": "Meanwhile, at Earth Mission Control, flight support teams monitor synchronized telemetry through a physics-based speed-of-light delay engine simulating communication latency from low Earth orbit out to Mars conjunction.",
            "title_in_visual": "EARTH MISSION CONTROL CENTER\nPHYSICAL SPEED-OF-LIGHT PROPAGATION DELAY ENGINE\nLEO (0s) · Lunar (1.3s) · Mars Conjunction (24 min)",
            "visual": "Earth MCC view with propagation delay slider calculating 0.0s LEO up to 24-minute Mars conjunction signal delay countdown.",
            "clips": "Official NASA Mission Control Center B-Roll (Public Domain):\nURL: https://images.nasa.gov/details/jsc2020m000456_Mission_Control_Center_B-Roll\n+ Direct Screen Capture: Live HELIOS Earth MCC at http://localhost:3000"
        },
        {
            "part": "PART 4: SO WHAT — CONTINUITY & EARTH IMPACT (2:55 – 4:00)",
            "part_color": "15803D",
            "scene_num": "13",
            "time": "3:30 – 3:45 (15 Seconds)",
            "title": "EARTH TRANSFER (DUAL-USE ARCHITECTURE)",
            "voiceover": "HELIOS solves the greatest challenge of deep-space human flight, but its architecture extends everywhere on Earth—protecting firefighters in smoke-filled buildings and remote rescue teams operating without network connectivity.",
            "title_in_visual": "ONE ARCHITECTURE. MULTIPLE ENVIRONMENTS.\nDeep Space · First Responders · Extreme Remote Environments",
            "visual": "• Shot 13A: Transition from space flight deck to dual-use architecture schematic.\n• Shot 13B: Firefighter in smoke-filled building with tactical HUD showing heart rate, ambient heat, and safety alert: HEART RATE ↑ · HEAT STRESS DETECTED · EVACUATE.\n• Shot 13C: Remote search-and-rescue team using offline rugged biosentry tablet.",
            "clips": "Production Assets & Copyright-Free Footage:\n• Shot 13A Architecture Render: documentation/videos/SHOT_13A_HELIOS_DUAL_USE_ARCHITECTURE.jpg\n• Shot 13B Firefighter HUD Render: documentation/videos/SHOT_13B_FIREFIGHTER_TACTICAL_HUD.jpg\n• Firefighter Emergency B-Roll (CC0): https://www.pexels.com/search/videos/firefighter/\n• Remote Search & Rescue B-Roll (CC0): https://pixabay.com/videos/search/rescue/"
        },
        {
            "part": "PART 4: SO WHAT — CONTINUITY & EARTH IMPACT (2:55 – 4:00)",
            "part_color": "15803D",
            "scene_num": "14",
            "time": "3:45 – 4:00 (15 Seconds)",
            "title": "VISION & FINAL CLOSE",
            "voiceover": "Because in deep space, a heartbeat is just data until someone understands it. HELIOS turns raw signals into life-saving action. Monitor. Understand. Act. We are Team Aero Vitals.",
            "title_in_visual": "H.E.L.I.O.S.\nHealth Evaluation Logistic Intelligent Onboard System\nMONITOR. UNDERSTAND. ACT.\nTEAM Aero Vitals\nNASA Space Apps Challenge 2026",
            "visual": "• Shot 14A: Cut back to deep space; single steady heartbeat line enters HELIOS engine and harmonically stabilizes into nominal green.\n• Shot 14B: High-resolution cinematic final title card with glowing HELIOS emblem, 'MONITOR · UNDERSTAND · ACT', Team Aero Vitals, and NASA Space Apps Challenge 2026 logo.",
            "clips": "Official HELIOS Project Brand Asset & Cinematic Deep Space Outro Render"
        }
    ]

    current_part = ""
    for s in scenes_full:
        # Part Header (if changed)
        if s["part"] != current_part:
            current_part = s["part"]
            p_part = doc.add_paragraph()
            p_part.paragraph_format.space_before = Pt(22)
            p_part.paragraph_format.space_after = Pt(8)
            r_part = p_part.add_run(current_part)
            r_part.font.name = 'Segoe UI'
            r_part.font.size = Pt(13)
            r_part.font.bold = True
            r_part.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

        # Scene Card Table (2-column key-value boxed format)
        table = doc.add_table(rows=6, cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        set_table_borders(table, color="CBD5E1", sz="4")

        table.rows[0].cells[0].width = Inches(1.5)
        table.rows[0].cells[1].width = Inches(5.4)
        for row in table.rows:
            row.cells[0].width = Inches(1.5)
            row.cells[1].width = Inches(5.4)

        # Row 0: Scene Header Banner
        hdr_cell = table.rows[0].cells[0]
        val_cell = table.rows[0].cells[1]
        set_cell_background(hdr_cell, "0F172A")
        set_cell_background(val_cell, "0F172A")
        set_cell_margins(hdr_cell, top=100, bottom=100, left=120, right=120)
        set_cell_margins(val_cell, top=100, bottom=100, left=120, right=120)

        p0_l = hdr_cell.paragraphs[0]
        r0_l = p0_l.add_run(f"SCENE {s['scene_num']}")
        r0_l.font.name = 'Segoe UI'
        r0_l.font.size = Pt(11)
        r0_l.font.bold = True
        r0_l.font.color.rgb = RGBColor(0x38, 0xBD, 0xF8) # Sky blue

        p0_r = val_cell.paragraphs[0]
        r0_r = p0_r.add_run(s['title'])
        r0_r.font.name = 'Segoe UI'
        r0_r.font.size = Pt(11)
        r0_r.font.bold = True
        r0_r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        rows_def = [
            ("Time", s["time"], True),
            ("Voiceover", s["voiceover"], False),
            ("Title in Visual", s["title_in_visual"], False),
            ("Visual", s["visual"], False),
            ("Clips", s["clips"], False),
        ]

        for i, (label, value, is_bold) in enumerate(rows_def, start=1):
            c_label = table.rows[i].cells[0]
            c_val = table.rows[i].cells[1]
            set_cell_background(c_label, "F1F5F9") # Slate 100
            set_cell_background(c_val, "FFFFFF")
            set_cell_margins(c_label, top=90, bottom=90, left=120, right=120)
            set_cell_margins(c_val, top=90, bottom=90, left=120, right=120)

            p_lbl = c_label.paragraphs[0]
            r_lbl = p_lbl.add_run(label)
            r_lbl.font.name = 'Segoe UI'
            r_lbl.font.size = Pt(9.5)
            r_lbl.font.bold = True
            r_lbl.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

            p_val = c_val.paragraphs[0]
            for line_idx, line in enumerate(value.split("\n")):
                if line_idx > 0:
                    p_val.add_run("\n")
                r_val = p_val.add_run(line)
                r_val.font.name = 'Segoe UI'
                r_val.font.size = Pt(9.5)
                if is_bold:
                    r_val.font.bold = True
                    r_val.font.color.rgb = RGBColor(0x02, 0x84, 0xC7)
                elif label == "Voiceover":
                    r_val.font.italic = False
                    r_val.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
                elif label == "Title in Visual":
                    r_val.font.name = 'Consolas'
                    r_val.font.size = Pt(9)
                    r_val.font.color.rgb = RGBColor(0x03, 0x69, 0xA1) # Cyan font for on-screen text
                elif label == "Clips":
                    if "http" in line or ".jpg" in line or ".mp4" in line or ".webm" in line:
                        r_val.font.color.rgb = RGBColor(0x25, 0x63, 0xEB) # Blue link style
                    else:
                        r_val.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

        # Spacing between scene cards
        p_gap = doc.add_paragraph()
        p_gap.paragraph_format.space_before = Pt(4)
        p_gap.paragraph_format.space_after = Pt(4)

    doc.save(output_path)
    print(f"Successfully generated clean production Word document at: {output_path}")

if __name__ == "__main__":
    out_file = os.path.join(r"c:\Users\Meraj\Downloads\HELIOS_NasaSpaceAppsChallenge2026-main\HELIOS_NasaSpaceAppsChallenge2026-main - Copy\documentation", "HELIOS_VIDEO_PRODUCTION_SCRIPT_CLEAN.docx")
    build_docx(out_file)

