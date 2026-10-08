"""
Complete HELIOS Video Production Engine
Renders Scene 15A-C, 16A-C, 17A-D to 1080p 60fps MP4 matching exact pitch script timelines.
"""

import os
import sys
import math
import struct
import wave
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import cv2

WIDTH = 1920
HEIGHT = 1080
FPS = 60

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(WORKSPACE_DIR, "Video_Outputs")
ASSETS_DIR = os.path.join(OUTPUT_DIR, "assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# ----------------- FONTS & COLORS -----------------
COLOR_BG_DARK = (10, 15, 26)
COLOR_PANEL = (17, 26, 44)
COLOR_BORDER = (38, 56, 88)
COLOR_CYAN = (0, 240, 255)
COLOR_EMERALD = (0, 230, 118)
COLOR_AMBER = (255, 179, 0)
COLOR_RED = (255, 61, 87)
COLOR_TEXT_WHITE = (245, 248, 255)
COLOR_TEXT_MUTED = (130, 150, 180)

def get_font(name="segoe", size=24, bold=False):
    try:
        quantum_path = os.path.join(WORKSPACE_DIR, "Quantum.otf")
        if name == "quantum" and os.path.exists(quantum_path):
            return ImageFont.truetype(quantum_path, size)
        elif name == "mono":
            return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", size)
        elif bold:
            return ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", size)
        else:
            return ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", size)
    except Exception:
        return ImageFont.load_default()

# ----------------- AUDIO GENERATOR -----------------
def generate_audio_file(filename, duration, beeps=[]):
    sample_rate = 44100
    total_samples = int(duration * sample_rate)
    audio = np.zeros(total_samples, dtype=np.float32)
    
    # Ambient space/medical room hum (45 Hz + 90 Hz)
    t_full = np.linspace(0, duration, total_samples, endpoint=False)
    hum = 0.012 * np.sin(2 * np.pi * 48 * t_full) + 0.006 * np.sin(2 * np.pi * 96 * t_full)
    audio += hum
    
    for t_start, freq, beep_dur in beeps:
        start_idx = int(t_start * sample_rate)
        dur_samples = int(beep_dur * sample_rate)
        end_idx = min(total_samples, start_idx + dur_samples)
        
        if end_idx > start_idx:
            t = np.linspace(0, (end_idx - start_idx) / sample_rate, end_idx - start_idx, endpoint=False)
            envelope = np.sin(np.pi * np.linspace(0, 1, len(t))) ** 1.8
            tone = 0.32 * np.sin(2 * np.pi * freq * t) * envelope
            audio[start_idx:end_idx] += tone
        
    audio = np.clip(audio, -1.0, 1.0)
    
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for s in audio:
            wf.writeframes(struct.pack('<h', int(s * 32767)))

# ----------------- VIDEO ENCODER -----------------
class VideoEncoder:
    def __init__(self, output_path, duration_sec, fps=FPS, audio_path=None):
        self.output_path = output_path
        self.fps = fps
        self.total_frames = int(duration_sec * fps)
        self.audio_path = audio_path
        
        cmd = [
            "ffmpeg", "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", f"{WIDTH}x{HEIGHT}",
            "-pix_fmt", "bgr24",
            "-r", str(fps),
            "-i", "-"
        ]
        if audio_path and os.path.exists(audio_path):
            cmd.extend(["-i", audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"])
        else:
            cmd.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-c:a", "aac", "-b:a", "128k", "-shortest"])
            
        cmd.extend([
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "17",
            output_path
        ])
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def write_frame(self, frame_bgr):
        self.proc.stdin.write(frame_bgr.tobytes())

    def close(self):
        self.proc.stdin.close()
        self.proc.wait()

# ----------------- ECG LEAD-II MATH -----------------
def get_ecg_sample(t_val, hr=72.0, anomaly_factor=0.0):
    period = 60.0 / hr
    pos = (t_val % period) / period
    
    if anomaly_factor > 0.0:
        pos = (pos * 1.15) % 1.0
        p = 0.05 * math.exp(-((pos - 0.15) / 0.04) ** 2)
        q = -0.4 * math.exp(-((pos - 0.32) / 0.03) ** 2)
        r = 1.6 * math.exp(-((pos - 0.38) / 0.028) ** 2)
        s = -0.8 * math.exp(-((pos - 0.45) / 0.035) ** 2)
        t = -0.45 * math.exp(-((pos - 0.68) / 0.08) ** 2)
        return (p + q + r + s + t) * anomaly_factor + (1.0 - anomaly_factor) * _normal_ecg(pos, t_val)
    
    return _normal_ecg(pos, t_val)

def _normal_ecg(pos, t_val):
    p = 0.18 * math.exp(-((pos - 0.18) / 0.032) ** 2)
    q = -0.15 * math.exp(-((pos - 0.38) / 0.012) ** 2)
    r = 1.45 * math.exp(-((pos - 0.41) / 0.013) ** 2)
    s = -0.35 * math.exp(-((pos - 0.44) / 0.016) ** 2)
    t = 0.30 * math.exp(-((pos - 0.65) / 0.065) ** 2)
    baseline = 0.015 * math.sin(t_val * 1.5)
    return p + q + r + s + t + baseline

# ----------------- DRAWING HELPERS -----------------
def draw_header_bar(draw, mission_label="ARTEMIS II // ORION MISSION CONTROL", time_str="MET +142:08:19", sub_tag="HELIOS OSDR-SYNC"):
    draw.rectangle([0, 0, WIDTH, 54], fill=(12, 18, 30))
    draw.line([0, 54, WIDTH, 54], fill=(30, 45, 70), width=1)
    
    font_bold = get_font("segoe", 20, bold=True)
    font_mono = get_font("mono", 16)
    font_small = get_font("segoe", 13)
    
    draw.ellipse([32, 22, 42, 32], fill=(0, 230, 118))
    draw.text((54, 15), "H.E.L.I.O.S.", font=font_bold, fill=(255, 255, 255))
    draw.text((170, 18), f"|  {mission_label}", font=font_mono, fill=(160, 185, 215))
    
    draw.text((WIDTH - 440, 18), f"TIME: {time_str}", font=font_mono, fill=(0, 240, 255))
    draw.rounded_rectangle([WIDTH - 180, 12, WIDTH - 30, 42], radius=4, fill=(20, 35, 55), outline=(0, 240, 255))
    draw.text((WIDTH - 165, 17), sub_tag, font=font_small, fill=(0, 240, 255))

def draw_grid_background(draw, x0, y0, x1, y1, step=30, color=(18, 26, 40)):
    for x in range(x0, x1, step):
        draw.line([x, y0, x, y1], fill=color, width=1)
    for y in range(y0, y1, step):
        draw.line([x0, y, x1, y], fill=color, width=1)

def draw_ecg_canvas(draw, bbox, current_time, hr=72.0, anomaly=0.0, line_color=(0, 230, 118), sweep_width=3):
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    mid_y = y0 + h // 2
    
    draw.rectangle([x0, y0, x1, y1], fill=(8, 12, 20), outline=(28, 42, 65), width=1)
    draw_grid_background(draw, x0, y0, x1, y1, step=25, color=(16, 24, 38))
    
    time_window = 3.5
    points = []
    num_samples = 400
    for i in range(num_samples):
        px = x0 + int((i / num_samples) * w)
        t_sample = current_time - time_window * (1.0 - i / num_samples)
        v = get_ecg_sample(t_sample, hr=hr, anomaly_factor=anomaly)
        py = mid_y - int(v * (h * 0.38))
        py = max(y0 + 2, min(y1 - 2, py))
        points.append((px, py))
        
    if len(points) > 1:
        draw.line(points, fill=line_color, width=sweep_width)
        hx, hy = points[-1]
        draw.ellipse([hx - 4, hy - 4, hx + 4, hy + 4], fill=(255, 255, 255))

def load_and_cover_image(path, target_w=WIDTH, target_h=HEIGHT):
    img = Image.open(path).convert("RGB")
    orig_w, orig_h = img.size
    scale = max(target_w / orig_w, target_h / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    # Center crop
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))

def pil_to_cv2(pil_img):
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

def cv2_to_pil(cv_img):
    return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))


# =========================================================================
# SCENE 15A: 2:45–2:50 | EXTREME ISOLATION (5 seconds, 300 frames)
# =========================================================================
def render_scene_15a():
    filename = "Scene_15A_02-45_02-50_Extreme_Isolation.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    img_station = load_and_cover_image(os.path.join(ASSETS_DIR, "antarctic_station.jpg"))
    img_laptop = load_and_cover_image(os.path.join(ASSETS_DIR, "antarctic_laptop.jpg"))
    
    for f in range(total_frames):
        t = f / FPS
        
        if t < 1.7:
            # HELIOS Telemetry Console Push
            zoom = 1.0 + 0.22 * (t / 1.7)
            frame_img = Image.new("RGB", (WIDTH, HEIGHT), (10, 14, 24))
            draw = ImageDraw.Draw(frame_img)
            
            draw_header_bar(draw, "DEEP SPACE CREW HEALTH // ARTEMIS II", f"MET +142:08:{int(19+t):02d}")
            
            # Crew Card & Vitals
            card_x0, card_y0 = 60, 90
            card_x1, card_y1 = WIDTH - 60, HEIGHT - 90
            draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=10, fill=(14, 22, 38), outline=(32, 50, 80), width=2)
            
            # Astronaut Header
            font_title = get_font("segoe", 24, bold=True)
            font_mono = get_font("mono", 18)
            font_val = get_font("segoe", 36, bold=True)
            
            draw.text((card_x0 + 30, card_y0 + 25), "CREW MEMBER: CDR E. REID // PRIMARY FLIGHT SURGEON MONITOR", font=font_title, fill=COLOR_TEXT_WHITE)
            draw.text((card_x1 - 320, card_y0 + 28), "STATUS: NOMINAL [BIO-LOCK]", font=font_mono, fill=COLOR_EMERALD)
            
            # ECG Frame
            ecg_bbox = [card_x0 + 30, card_y0 + 80, card_x1 - 30, card_y0 + 380]
            draw_ecg_canvas(draw, ecg_bbox, t, hr=72.0, anomaly=0.0)
            
            # Vitals Metrics Row
            vitals = [
                ("HEART RATE", "72", "BPM", COLOR_EMERALD, "TARGET: 60-80"),
                ("SpO2", "98.4", "%", COLOR_CYAN, "NOMINAL > 95%"),
                ("CORE TEMP", "37.0", "°C", COLOR_TEXT_WHITE, "HOMEOSTATIC"),
                ("RESPIRATION", "14", "BRPM", COLOR_CYAN, "EUPNEIC RATE"),
                ("BLOOD PRESSURE", "118 / 76", "mmHg", COLOR_TEXT_WHITE, "MAP: 90 mmHg")
            ]
            
            box_w = (card_x1 - card_x0 - 60 - 4 * 16) // 5
            for i, (label, val, unit, col, sub) in enumerate(vitals):
                bx0 = card_x0 + 30 + i * (box_w + 16)
                by0 = card_y0 + 400
                bx1 = bx0 + box_w
                by1 = by0 + 130
                draw.rounded_rectangle([bx0, by0, bx1, by1], radius=8, fill=(10, 16, 28), outline=(26, 40, 64))
                draw.text((bx0 + 15, by0 + 12), label, font=get_font("segoe", 13), fill=COLOR_TEXT_MUTED)
                draw.text((bx0 + 15, by0 + 36), val, font=font_val, fill=col)
                draw.text((bx0 + 15 + len(val)*20, by0 + 48), unit, font=get_font("segoe", 14), fill=COLOR_TEXT_MUTED)
                draw.text((bx0 + 15, by0 + 94), sub, font=get_font("mono", 12), fill=COLOR_TEXT_MUTED)
                
            # Perform camera push zoom centered on ECG
            if zoom > 1.001:
                cx, cy = WIDTH // 2, HEIGHT // 2 - 40
                zw, zh = int(WIDTH / zoom), int(HEIGHT / zoom)
                crop_box = (cx - zw//2, cy - zh//2, cx + zw//2, cy + zh//2)
                cropped = frame_img.crop(crop_box)
                frame_img = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)
                
        elif t < 3.2:
            # Transition into Antarctic Research Station Blizzard
            prog = (t - 1.7) / 1.5
            zoom_factor = 1.0 + 0.08 * prog
            cw, ch = int(WIDTH / zoom_factor), int(HEIGHT / zoom_factor)
            cropped = img_station.crop(((WIDTH - cw)//2, (HEIGHT - ch)//2, (WIDTH + cw)//2, (HEIGHT + ch)//2))
            frame_img = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)
            
            # Snow wind particles overlay
            draw = ImageDraw.Draw(frame_img)
            np.random.seed(f)
            for _ in range(120):
                sx = np.random.randint(0, WIDTH)
                sy = np.random.randint(0, HEIGHT)
                length = np.random.randint(20, 60)
                draw.line([sx, sy, sx - length, sy + length//3], fill=(220, 235, 255, 180), width=1)
                
        else:
            # Inside Station: Rugged laptop running HELIOS
            prog = (t - 3.2) / 1.8
            zoom_factor = 1.0 + 0.05 * prog
            cw, ch = int(WIDTH / zoom_factor), int(HEIGHT / zoom_factor)
            cropped = img_laptop.crop(((WIDTH - cw)//2, (HEIGHT - ch)//2, (WIDTH + cw)//2, (HEIGHT + ch)//2))
            frame_img = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)
            
            draw = ImageDraw.Draw(frame_img)
            
            # Cinematic title overlays
            font_badge = get_font("mono", 15)
            font_title = get_font("quantum", 52)
            font_sub = get_font("segoe", 26, bold=True)
            font_desc = get_font("mono", 16)
            
            # Dark glass banner
            bx0, by0 = 100, HEIGHT - 270
            bx1, by1 = 820, HEIGHT - 70
            draw.rounded_rectangle([bx0, by0, bx1, by1], radius=8, fill=(8, 14, 24), outline=(0, 240, 255), width=2)
            
            draw.text((bx0 + 30, by0 + 20), "// DEPLOYMENT ARCHITECTURE", font=font_badge, fill=COLOR_CYAN)
            draw.text((bx0 + 30, by0 + 45), "EXTREME ISOLATION", font=font_title, fill=COLOR_TEXT_WHITE)
            draw.text((bx0 + 30, by0 + 115), "LOCAL INTELLIGENCE", font=font_sub, fill=COLOR_EMERALD)
            draw.text((bx0 + 30, by0 + 155), "OFFLINE-FIRST CORE // ZERO CLOUD DEPENDENCY", font=font_desc, fill=COLOR_TEXT_MUTED)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 15B: 2:50–2:55 | DISASTER MEDICINE (5 seconds, 300 frames)
# =========================================================================
def render_scene_15b():
    filename = "Scene_15B_02-50_02-55_Disaster_Medicine.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    img_clinic = load_and_cover_image(os.path.join(ASSETS_DIR, "disaster_clinic.jpg"))
    
    for f in range(total_frames):
        t = f / FPS
        # Slow camera pan/zoom into tablet
        zoom = 1.0 + 0.08 * (t / duration)
        cw, ch = int(WIDTH / zoom), int(HEIGHT / zoom)
        shift_x = int(60 * (t / duration))
        shift_y = int(40 * (t / duration))
        
        cropped = img_clinic.crop(((WIDTH - cw)//2 + shift_x, (HEIGHT - ch)//2 + shift_y, (WIDTH + cw)//2 + shift_x, (HEIGHT + ch)//2 + shift_y))
        frame_img = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)
        draw = ImageDraw.Draw(frame_img)
        
        # Overlay HUD: Tablet Telemetry Callout & Pipeline
        # Left HUD: Tablet Telemetry Ingestion Card
        card_w, card_h = 440, 290
        cx0, cy0 = 70, 90
        cx1, cy1 = cx0 + card_w, cy0 + card_h
        
        draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=8, fill=(10, 16, 28), outline=(0, 240, 255), width=2)
        
        draw.text((cx0 + 20, cy0 + 16), "HELIOS FIELD TRIAGE // RUGGEDIZED", font=get_font("mono", 13), fill=COLOR_CYAN)
        
        # Local processing badge
        pulse_col = COLOR_EMERALD if int(t * 3) % 2 == 0 else (0, 180, 90)
        draw.ellipse([cx1 - 180, cy0 + 18, cx1 - 170, cy0 + 28], fill=pulse_col)
        draw.text((cx1 - 162, cy0 + 16), "LOCAL PROCESSING", font=get_font("mono", 12), fill=COLOR_EMERALD)
        
        # Vitals entering locally
        draw.line([cx0 + 20, cy0 + 44, cx1 - 20, cy0 + 44], fill=(30, 45, 70), width=1)
        
        vitals = [
            ("HEART RATE", "114", "BPM", COLOR_AMBER, "TACHYCARDIA"),
            ("SpO2", "92.1", "%", COLOR_AMBER, "MILD HYPOXIA"),
            ("TEMPERATURE", "38.6", "°C", COLOR_RED, "FEBRILE ELEVATION"),
            ("RESPIRATION", "24", "BRPM", COLOR_AMBER, "TACHYPNEA")
        ]
        
        for i, (vname, val, unit, col, annot) in enumerate(vitals):
            vy = cy0 + 56 + i * 54
            draw.text((cx0 + 20, vy), vname, font=get_font("segoe", 12), fill=COLOR_TEXT_MUTED)
            draw.text((cx0 + 20, vy + 16), f"{val} {unit}", font=get_font("segoe", 20, bold=True), fill=col)
            draw.text((cx1 - 170, vy + 18), annot, font=get_font("mono", 11), fill=col)
            
        # Lower Third: On-Screen UI Sequence
        # TELEMETRY RECEIVED -> LOCAL ANALYSIS -> TREND DETECTED -> CLINICAL ALERT
        seq_y0 = HEIGHT - 140
        seq_y1 = HEIGHT - 40
        draw.rounded_rectangle([60, seq_y0, WIDTH - 60, seq_y1], radius=8, fill=(8, 14, 24), outline=(35, 55, 85), width=2)
        
        steps = [
            ("1. TELEMETRY RECEIVED", 0.0, 1.2, COLOR_CYAN),
            ("2. LOCAL ANALYSIS", 1.2, 2.6, COLOR_CYAN),
            ("3. TREND DETECTED", 2.6, 3.8, COLOR_AMBER),
            ("4. CLINICAL ALERT", 3.8, 5.0, COLOR_RED)
        ]
        
        step_w = (WIDTH - 120 - 40) // 4
        for i, (stitle, t_start, t_end, active_col) in enumerate(steps):
            sx0 = 80 + i * step_w
            is_active = t >= t_start
            is_current = t_start <= t < t_end
            
            box_col = (18, 30, 50) if is_active else (12, 18, 28)
            border_col = active_col if is_current else (active_col if is_active else (25, 40, 60))
            draw.rounded_rectangle([sx0, seq_y0 + 16, sx0 + step_w - 20, seq_y1 - 16], radius=6, fill=box_col, outline=border_col, width=2 if is_current else 1)
            
            txt_col = COLOR_TEXT_WHITE if is_active else (80, 100, 125)
            draw.text((sx0 + 15, seq_y0 + 32), stitle, font=get_font("segoe", 15, bold=True), fill=txt_col)
            
            if i < 3:
                draw.text((sx0 + step_w - 14, seq_y0 + 32), "→", font=get_font("segoe", 18, bold=True), fill=COLOR_CYAN)
                
        # If at stage 4 (CLINICAL ALERT active)
        if t >= 3.8:
            ax0, ay0 = WIDTH - 540, 90
            draw.rounded_rectangle([ax0, ay0, ax0 + 470, ay0 + 180], radius=8, fill=(24, 12, 16), outline=COLOR_RED, width=2)
            draw.text((ax0 + 20, ay0 + 16), "CLINICAL DECISION SUPPORT ADVISORY", font=get_font("mono", 13), fill=COLOR_RED)
            draw.text((ax0 + 20, ay0 + 44), "EPI INDEX ELEVATED (0.74)", font=get_font("segoe", 22, bold=True), fill=COLOR_TEXT_WHITE)
            draw.text((ax0 + 20, ay0 + 82), "Suggested Protocol: Check fluid responsiveness.\nAssess bilateral lung sounds. Review lactate.", font=get_font("segoe", 14), fill=(230, 210, 215))
            draw.text((ax0 + 20, ay0 + 140), "NON-AUTONOMOUS // PHYSICIAN IN THE LOOP", font=get_font("mono", 11), fill=COLOR_TEXT_MUTED)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 15C: 2:55–3:00 | ONE INTELLIGENCE ARCHITECTURE (5 seconds, 300 frames)
# =========================================================================
def render_scene_15c():
    filename = "Scene_15C_02-55_03-00_One_Intelligence_Architecture.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(14, 20, 34))
        draw_header_bar(draw, "HELIOS PLATFORM ARCHITECTURE", "UNIVERSAL DEPLOYMENT", "MULTI-ENVIRONMENT")
        
        # 3 Columns: SPACE, ANTARCTIC, DISASTER ZONE
        cols = [
            ("SPACE", "Astronaut Telemetry\n10 Hz Bio-Sensors & Radiation", "Deep-Space Decision Support\nMars Latency Triage Engine", (0, 240, 255)),
            ("ANTARCTIC", "Available Field Sensors\nMetabolic & Hypothermia Trackers", "Polar Station Support\nEvacuation Risk Stratification", (0, 230, 118)),
            ("DISASTER ZONE", "Available Medical Measurements\nField Pulse Ox, BP & Triage Vitals", "Austere Clinical Guidance\nMass Casualty Priority Support", (255, 179, 0))
        ]
        
        col_w = 460
        col_gap = 100
        total_w = 3 * col_w + 2 * col_gap
        start_x = (WIDTH - total_w) // 2
        
        # Central HELIOS Core Layer Y coordinates
        core_y0, core_y1 = 440, 560
        
        for i, (env_title, input_desc, output_desc, env_color) in enumerate(cols):
            cx0 = start_x + i * (col_w + col_gap)
            cx1 = cx0 + col_w
            
            # Top Box: Sensors / Input
            top_y0, top_y1 = 120, 270
            draw.rounded_rectangle([cx0, top_y0, cx1, top_y1], radius=8, fill=(14, 22, 38), outline=env_color, width=2)
            draw.text((cx0 + 25, top_y0 + 20), f"ENVIRONMENT 0{i+1}", font=get_font("mono", 12), fill=COLOR_TEXT_MUTED)
            draw.text((cx0 + 25, top_y0 + 44), env_title, font=get_font("segoe", 26, bold=True), fill=COLOR_TEXT_WHITE)
            draw.text((cx0 + 25, top_y0 + 88), input_desc, font=get_font("segoe", 15), fill=COLOR_TEXT_MUTED)
            
            # Flow line down to HELIOS CORE
            flow_x = cx0 + col_w // 2
            draw.line([flow_x, top_y1, flow_x, core_y0], fill=(40, 60, 90), width=2)
            
            # Animated data packets flowing down
            num_particles = 4
            for p in range(num_particles):
                p_progress = ((t * 1.5 + p / num_particles) % 1.0)
                py = top_y1 + int(p_progress * (core_y0 - top_y1))
                draw.ellipse([flow_x - 4, py - 4, flow_x + 4, py + 4], fill=env_color)
                
            # Middle HELIOS Node for this column
            draw.rounded_rectangle([cx0 + 40, core_y0, cx1 - 40, core_y1], radius=8, fill=(18, 30, 52), outline=(0, 240, 255), width=2)
            draw.text((cx0 + 65, core_y0 + 26), "H.E.L.I.O.S. CORE", font=get_font("quantum", 24), fill=COLOR_TEXT_WHITE)
            draw.text((cx0 + 65, core_y0 + 64), "EDGE REASONING & BASELINE SENTRY", font=get_font("mono", 12), fill=COLOR_CYAN)
            
            # Flow line down to Decision Support
            draw.line([flow_x, core_y1, flow_x, 700], fill=(40, 60, 90), width=2)
            for p in range(num_particles):
                p_progress = ((t * 1.5 + p / num_particles) % 1.0)
                py = core_y1 + int(p_progress * (700 - core_y1))
                draw.ellipse([flow_x - 4, py - 4, flow_x + 4, py + 4], fill=COLOR_EMERALD)
                
            # Bottom Box: Decision Support
            bot_y0, bot_y1 = 700, 850
            draw.rounded_rectangle([cx0, bot_y0, cx1, bot_y1], radius=8, fill=(14, 22, 38), outline=COLOR_EMERALD, width=2)
            draw.text((cx0 + 25, bot_y0 + 20), "DECISION SUPPORT OUTPUT", font=get_font("mono", 12), fill=COLOR_EMERALD)
            draw.text((cx0 + 25, bot_y0 + 48), output_desc, font=get_font("segoe", 16, bold=True), fill=COLOR_TEXT_WHITE)
            
        # Draw central unified bridging bus uniting all three
        draw.line([start_x + col_w//2, (core_y0 + core_y1)//2, start_x + 2*(col_w + col_gap) + col_w//2, (core_y0 + core_y1)//2], fill=(0, 240, 255), width=3)
        
        # Bottom Reveal Text (t >= 2.5)
        if t >= 2.5:
            banner_alpha = min(1.0, (t - 2.5) / 1.0)
            by0, by1 = HEIGHT - 180, HEIGHT - 50
            draw.rounded_rectangle([200, by0, WIDTH - 200, by1], radius=8, fill=(10, 16, 28), outline=(0, 240, 255), width=2)
            draw.text((WIDTH // 2 - 380, by0 + 25), "ONE INTELLIGENCE ARCHITECTURE", font=get_font("quantum", 38), fill=COLOR_TEXT_WHITE)
            draw.text((WIDTH // 2 - 320, by0 + 75), "MANY EXTREME ENVIRONMENTS", font=get_font("segoe", 22, bold=True), fill=COLOR_CYAN)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 16A: 3:00–3:05 | MODULAR TELEMETRY (5 seconds, 300 frames)
# =========================================================================
def render_scene_16a():
    filename = "Scene_16A_03-00_03-05_Modular_Telemetry.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    # 6 Radial sensor nodes
    base_sensors = [
        ("ECG", -90),
        ("SpO2", -30),
        ("TEMPERATURE", 30),
        ("RESPIRATION", 90),
        ("ENVIRONMENT", 150),
        ("LOCATION", 210)
    ]
    
    center_x, center_y = WIDTH // 2, HEIGHT // 2 - 20
    radius = 320
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(14, 20, 34))
        draw_header_bar(draw, "SYSTEM ARCHITECTURE SPECIFICATION", "MODULAR BUS v4.2", "HOT-PLUGGABLE")
        
        # Central HELIOS CORE Node (Circle & Hexagon)
        core_r = 110
        draw.ellipse([center_x - core_r, center_y - core_r, center_x + core_r, center_y + core_r], fill=(16, 26, 46), outline=(0, 240, 255), width=3)
        draw.ellipse([center_x - core_r + 14, center_y - core_r + 14, center_x + core_r - 14, center_y + core_r - 14], outline=(30, 50, 80), width=1)
        
        draw.text((center_x - 85, center_y - 25), "HELIOS CORE", font=get_font("quantum", 24), fill=COLOR_TEXT_WHITE)
        draw.text((center_x - 90, center_y + 12), "EDGE INTELLIGENCE", font=get_font("mono", 12), fill=COLOR_CYAN)
        
        # Render standard sensors
        sensors = list(base_sensors)
        # New sensor introduced at t >= 2.2
        new_sensor_active = t >= 2.2
        if new_sensor_active:
            # Placed dynamically at -60 deg
            sensors.append(("NEW SENSOR", -60))
            
        for name, deg in sensors:
            rad = math.radians(deg)
            nx = int(center_x + radius * math.cos(rad))
            ny = int(center_y + radius * math.sin(rad))
            
            is_new = (name == "NEW SENSOR")
            node_color = COLOR_EMERALD if is_new else COLOR_CYAN
            
            # Connecting line
            draw.line([nx, ny, center_x, center_y], fill=(30, 48, 75), width=2)
            
            # Flowing particles into core
            num_dots = 4
            for p in range(num_dots):
                p_prog = ((t * 1.8 + p / num_dots) % 1.0)
                px = int(nx + p_prog * (center_x - nx))
                py = int(ny + p_prog * (center_y - ny))
                draw.ellipse([px - 3, py - 3, px + 3, py + 3], fill=node_color)
                
            # Sensor Node Box
            nw, nh = 160, 60
            draw.rounded_rectangle([nx - nw//2, ny - nh//2, nx + nw//2, ny + nh//2], radius=8, fill=(14, 22, 38), outline=node_color, width=2)
            
            font_node = get_font("segoe", 15, bold=True)
            draw.text((nx - len(name)*4.5, ny - 10), name, font=font_node, fill=COLOR_TEXT_WHITE if not is_new else COLOR_EMERALD)
            
            if is_new:
                # Green handshake badge
                draw.text((nx - 45, ny + 12), "HOT-PLUGGED", font=get_font("mono", 10), fill=COLOR_EMERALD)
                
        # On-Screen Aerospace Text (Lower Banner)
        banner_y = HEIGHT - 130
        draw.rounded_rectangle([250, banner_y, WIDTH - 250, banner_y + 80], radius=8, fill=(10, 16, 28), outline=(0, 240, 255), width=2)
        
        draw.text((290, banner_y + 24), "MODULAR TELEMETRY", font=get_font("quantum", 26), fill=COLOR_TEXT_WHITE)
        draw.text((700, banner_y + 28), "|  EDGE INTELLIGENCE", font=get_font("segoe", 20, bold=True), fill=COLOR_CYAN)
        draw.text((1110, banner_y + 28), "|  EXTENSIBLE ARCHITECTURE", font=get_font("segoe", 20, bold=True), fill=COLOR_EMERALD)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 16B: 3:05–3:10 | MULTI-CREW SCALING (5 seconds, 300 frames)
# =========================================================================
def render_scene_16b():
    filename = "Scene_16B_03-05_03-10_Multi_Crew_Scaling.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    crew_data = [
        ("CREW 01 // CDR E. REID", 72.0, "98.4%", "37.0°C", "14 BRPM"),
        ("CREW 02 // PLT V. GLOVER", 68.0, "99.0%", "36.9°C", "13 BRPM"),
        ("CREW 03 // MS C. KOCH", 75.0, "98.1%", "37.1°C", "15 BRPM"),
        ("CREW 04 // MS J. HANSEN", 71.0, "98.6%", "36.8°C", "14 BRPM")
    ]
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(14, 20, 34))
        draw_header_bar(draw, "SYNCHRONIZED MULTI-CREW TELEMETRY MATRIX", "PARALLEL EVALUATION", "4-CREW BUS")
        
        # Transition progress from 1 crew to 4 crew grid
        if t < 1.6:
            # Single Crew Mode (Large Center Card)
            card_x0, card_y0 = 240, 120
            card_x1, card_y1 = WIDTH - 240, HEIGHT - 180
            
            draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=10, fill=(14, 22, 38), outline=(0, 240, 255), width=2)
            
            draw.text((card_x0 + 30, card_y0 + 20), crew_data[0][0], font=get_font("segoe", 24, bold=True), fill=COLOR_TEXT_WHITE)
            draw.text((card_x1 - 220, card_y0 + 24), "STATUS: NOMINAL", font=get_font("mono", 16), fill=COLOR_EMERALD)
            
            ecg_bbox = [card_x0 + 30, card_y0 + 70, card_x1 - 30, card_y0 + 400]
            draw_ecg_canvas(draw, ecg_bbox, t, hr=crew_data[0][1])
            
            draw.text((card_x0 + 40, card_y0 + 430), f"HEART RATE: {int(crew_data[0][1])} BPM    SpO2: {crew_data[0][2]}    TEMP: {crew_data[0][3]}    RESP: {crew_data[0][4]}", font=get_font("segoe", 20, bold=True), fill=COLOR_TEXT_WHITE)
            
        else:
            # Smoothly transition into 4-quadrant grid
            expand_prog = min(1.0, (t - 1.6) / 1.2)
            
            grid_coords = [
                (70, 90, 930, 480),          # Top-Left
                (990, 90, 1850, 480),        # Top-Right
                (70, 520, 930, 910),         # Bottom-Left
                (990, 520, 1850, 910)        # Bottom-Right
            ]
            
            for idx, (cname, chr_val, cspo2, ctemp, cresp) in enumerate(crew_data):
                gx0, gy0, gx1, gy1 = grid_coords[idx]
                
                # Card outline
                draw.rounded_rectangle([gx0, gy0, gx1, gy1], radius=8, fill=(14, 22, 38), outline=(32, 50, 80), width=2)
                
                # Crew title
                draw.text((gx0 + 20, gy0 + 16), cname, font=get_font("segoe", 18, bold=True), fill=COLOR_TEXT_WHITE)
                draw.text((gx1 - 160, gy0 + 18), "NOMINAL", font=get_font("mono", 13), fill=COLOR_EMERALD)
                
                # Mini ECG Waveform
                ecg_box = [gx0 + 20, gy0 + 52, gx1 - 20, gy0 + 280]
                draw_ecg_canvas(draw, ecg_box, t + idx * 0.7, hr=chr_val, sweep_width=2)
                
                # Mini Vitals strip
                draw.text((gx0 + 25, gy0 + 300), f"HR: {int(chr_val)} BPM  |  SpO2: {cspo2}  |  TEMP: {ctemp}  |  RESP: {cresp}", font=get_font("mono", 14), fill=COLOR_CYAN)
                
        # Lower Banner Message
        banner_y = HEIGHT - 85
        draw.rounded_rectangle([150, banner_y, WIDTH - 150, banner_y + 60], radius=6, fill=(10, 16, 28), outline=(0, 240, 255), width=1)
        draw.text((WIDTH // 2 - 380, banner_y + 18), "ONE CREW → MULTIPLE CREW MEMBERS → SAME CORE SYSTEM", font=get_font("segoe", 20, bold=True), fill=COLOR_TEXT_WHITE)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 16C: 3:10–3:15 | ORBITAL TO LUNAR SCALE (5 seconds, 300 frames)
# =========================================================================
def render_scene_16c():
    filename = "Scene_16C_03-10_03-15_Orbital_to_Lunar_Scale.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(14, 20, 34))
        
        if t < 2.5:
            # Orbital Spacecraft Interior Telemetry View
            draw_header_bar(draw, "COMMERCIAL ORBITAL PROFILE // LEO FLIGHT", "MET +024:14:02", "ORBITAL BIO-LOCK")
            
            # Orbit schematic graphic
            cx, cy = WIDTH // 2, HEIGHT // 2 - 40
            draw.ellipse([cx - 280, cy - 280, cx + 280, cy + 280], outline=(25, 45, 75), width=2)
            draw.ellipse([cx - 160, cy - 160, cx + 160, cy + 160], fill=(12, 28, 55), outline=(0, 240, 255), width=2)
            draw.text((cx - 45, cy - 12), "EARTH LEO", font=get_font("quantum", 18), fill=COLOR_CYAN)
            
            # Overlaid HELIOS HUD Cards
            draw.rounded_rectangle([100, 140, 520, 420], radius=8, fill=(12, 18, 30), outline=(0, 240, 255), width=2)
            draw.text((120, 160), "ORBITAL CREW MATRIX", font=get_font("mono", 14), fill=COLOR_CYAN)
            draw.text((120, 200), "● CREW 01: NOMINAL", font=get_font("segoe", 16, bold=True), fill=COLOR_EMERALD)
            draw.text((120, 240), "● CREW 02: NOMINAL", font=get_font("segoe", 16, bold=True), fill=COLOR_EMERALD)
            draw.text((120, 280), "● CREW 03: NOMINAL", font=get_font("segoe", 16, bold=True), fill=COLOR_EMERALD)
            draw.text((120, 320), "● CREW 04: NOMINAL", font=get_font("segoe", 16, bold=True), fill=COLOR_EMERALD)
            
            draw.rounded_rectangle([WIDTH - 520, 140, WIDTH - 100, 420], radius=8, fill=(12, 18, 30), outline=(0, 240, 255), width=2)
            draw.text((WIDTH - 500, 160), "ENVIRONMENTAL TELEMETRY", font=get_font("mono", 14), fill=COLOR_CYAN)
            draw.text((WIDTH - 500, 200), "CABIN pO2: 21.0 kPa", font=get_font("mono", 16), fill=COLOR_TEXT_WHITE)
            draw.text((WIDTH - 500, 240), "CABIN pCO2: 0.28 mmHg", font=get_font("mono", 16), fill=COLOR_EMERALD)
            draw.text((WIDTH - 500, 280), "RADIATION: 0.12 mSv/d", font=get_font("mono", 16), fill=COLOR_EMERALD)
            draw.text((WIDTH - 500, 320), "COMM DELAY: 0.05 SEC", font=get_font("mono", 16), fill=COLOR_CYAN)
            
        else:
            # Lunar Surface / Lunar Orbit Environment Transition
            draw_header_bar(draw, "LUNAR HABITAT // ARTEMIS BASE CAMP", "MET +184:02:40", "EXPEDITION ONE")
            
            # System Architecture Flow
            # CREW + SENSORS -> HELIOS -> MISSION AWARENESS
            flow_y = 260
            nodes = [
                ("CREW + SENSORS", "Bio-patches, EVA suits, Habitat ECLSS", COLOR_CYAN),
                ("H.E.L.I.O.S.", "Edge Reasoning & Baseline Engine", COLOR_EMERALD),
                ("MISSION AWARENESS", "Autonomous Crew Decision Support", (0, 240, 255))
            ]
            
            nw, nh = 420, 180
            for i, (ntitle, ndesc, ncol) in enumerate(nodes):
                nx0 = 120 + i * (nw + 200)
                nx1 = nx0 + nw
                
                draw.rounded_rectangle([nx0, flow_y, nx1, flow_y + nh], radius=10, fill=(14, 22, 38), outline=ncol, width=3)
                draw.text((nx0 + 30, flow_y + 35), ntitle, font=get_font("quantum", 26), fill=COLOR_TEXT_WHITE)
                draw.text((nx0 + 30, flow_y + 85), ndesc, font=get_font("segoe", 16), fill=COLOR_TEXT_MUTED)
                
                if i < 2:
                    # Arrow connecting
                    arrow_start = nx1 + 30
                    arrow_end = arrow_start + 140
                    draw.line([arrow_start, flow_y + nh//2, arrow_end, flow_y + nh//2], fill=(0, 240, 255), width=3)
                    draw.polygon([(arrow_end + 15, flow_y + nh//2), (arrow_end, flow_y + nh//2 - 10), (arrow_end, flow_y + nh//2 + 10)], fill=(0, 240, 255))
                    
            # Bottom Bold Titles
            draw.text((WIDTH // 2 - 360, HEIGHT - 320), "ADAPTABLE", font=get_font("quantum", 40), fill=COLOR_TEXT_WHITE)
            draw.text((WIDTH // 2 - 80, HEIGHT - 320), "|  SCALABLE", font=get_font("quantum", 40), fill=COLOR_CYAN)
            draw.text((WIDTH // 2 - 320, HEIGHT - 220), "ARTEMIS AND BEYOND", font=get_font("quantum", 48), fill=COLOR_EMERALD)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 17A: 3:15–3:19 | CINEMATIC CALLBACK & HEARTBEAT (4 seconds, 240 frames)
# =========================================================================
def render_scene_17a():
    filename = "Scene_17A_03-15_03-19_Cinematic_Callback_Heartbeat.mp4"
    audio_path = os.path.join(OUTPUT_DIR, "scene_17a_audio.wav")
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 4.0
    total_frames = int(duration * FPS)
    
    # Generate audio beeps matching heartbeats:
    # Stable beats at ~0.5s, 1.3s, then irregular ectopic beat at 2.05s, followed by pause and beat at 3.1s
    beeps = [
        (0.50, 880, 0.08),
        (1.33, 880, 0.08),
        (2.05, 980, 0.09),  # ectopic tone
        (3.10, 880, 0.08)
    ]
    generate_audio_file(audio_path, duration, beeps)
    
    encoder = VideoEncoder(out_path, duration, audio_path=audio_path)
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (6, 9, 16))
        draw = ImageDraw.Draw(frame_img)
        
        # Subtle medical grid centered
        grid_w, grid_h = 1600, 560
        gx0, gy0 = (WIDTH - grid_w) // 2, (HEIGHT - grid_h) // 2
        gx1, gy1 = gx0 + grid_w, gy0 + grid_h
        
        draw_grid_background(draw, gx0, gy0, gx1, gy1, step=30, color=(12, 18, 30))
        draw.rectangle([gx0, gy0, gx1, gy1], outline=(24, 36, 56), width=1)
        
        # Anomaly factor active between t=1.9s and 3.2s
        anomaly = 1.0 if 1.9 <= t <= 3.2 else 0.0
        
        # Center ECG line (Full focus, no text)
        time_window = 4.0
        points = []
        num_samples = 600
        mid_y = (gy0 + gy1) // 2
        
        for i in range(num_samples):
            px = gx0 + int((i / num_samples) * grid_w)
            t_sample = t - time_window * (1.0 - i / num_samples)
            v = get_ecg_sample(t_sample, hr=72.0, anomaly_factor=1.0 if (1.9 <= t_sample <= 3.2) else 0.0)
            py = mid_y - int(v * (grid_h * 0.42))
            py = max(gy0 + 2, min(gy1 - 2, py))
            points.append((px, py))
            
        line_color = COLOR_EMERALD if anomaly == 0.0 else (255, 190, 0)
        draw.line(points, fill=line_color, width=4)
        
        # Glowing cursor
        hx, hy = points[-1]
        draw.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], fill=(255, 255, 255))
        
        # Minimal Lead-II label
        draw.text((gx0 + 20, gy0 + 20), "LEAD-II // 1.0 mV/cm // REAL-TIME", font=get_font("mono", 14), fill=(80, 110, 150))

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 17B: 3:19–3:24 | SIGNAL TO ACTION (5 seconds, 300 frames)
# =========================================================================
def render_scene_17b():
    filename = "Scene_17B_03-19_03-24_Signal_to_Action.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 5.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(14, 20, 34))
        draw_header_bar(draw, "HELIOS SENTRY MATRIX REASONING", "CLINICAL AUGMENTATION", "ANOMALY EVAL")
        
        # Left Pane: Raw Telemetry
        left_w = 700
        draw.rounded_rectangle([60, 90, 60 + left_w, HEIGHT - 140], radius=10, fill=(14, 22, 38), outline=(30, 48, 76), width=2)
        draw.text((85, 115), "RAW PHYSIOLOGICAL TELEMETRY", font=get_font("mono", 15), fill=COLOR_CYAN)
        draw.text((85, 145), "LEAD-II VOLTAGE STREAM (10 Hz)", font=get_font("segoe", 18, bold=True), fill=COLOR_TEXT_WHITE)
        
        ecg_bbox = [85, 190, 60 + left_w - 25, 480]
        draw_ecg_canvas(draw, ecg_bbox, t, hr=72.0, anomaly=1.0 if t < 2.5 else 0.0, line_color=COLOR_AMBER)
        
        # Z-Score readouts
        draw.text((85, 520), "Z-SCORE DISPERSION:", font=get_font("mono", 14), fill=COLOR_TEXT_MUTED)
        draw.text((85, 550), "RR-INTERVAL: +2.82 σ [ANOMALOUS]", font=get_font("mono", 16), fill=COLOR_RED)
        draw.text((85, 590), "ST-DEVIATION: +0.41 σ [WITHIN BASELINE]", font=get_font("mono", 16), fill=COLOR_EMERALD)
        
        # Right Pane: Sequential Processing Flow (Step by Step Animation)
        rx0 = 820
        rx1 = WIDTH - 60
        
        stages = [
            ("1. SIGNAL", "10 Hz Bio-Sensor Telemetry Ingestion", 0.0, COLOR_CYAN),
            ("2. ANALYSIS", "Sentry Matrix Variance & Waveform Morphology", 1.0, COLOR_CYAN),
            ("3. CONTEXT", "Personal Baseline & Environmental Correlator", 2.0, COLOR_AMBER),
            ("4. RISK DETECTED", "Premature Ventricular Contraction // ARF 0.68", 3.0, COLOR_RED),
            ("5. RECOMMENDED RESPONSE", "Evaluate serum K+/Mg2+ & schedule 12-lead ECG", 4.0, COLOR_EMERALD)
        ]
        
        sy0 = 90
        for i, (stitle, sdesc, trigger_t, scol) in enumerate(stages):
            box_y0 = sy0 + i * 110
            box_y1 = box_y0 + 90
            
            is_active = t >= trigger_t
            bfill = (18, 30, 52) if is_active else (12, 18, 28)
            boutline = scol if is_active else (25, 40, 60)
            
            draw.rounded_rectangle([rx0, box_y0, rx1, box_y1], radius=8, fill=bfill, outline=boutline, width=2 if is_active else 1)
            
            draw.text((rx0 + 25, box_y0 + 16), stitle, font=get_font("segoe", 20, bold=True), fill=COLOR_TEXT_WHITE if is_active else (70, 90, 115))
            draw.text((rx0 + 25, box_y0 + 50), sdesc, font=get_font("segoe", 15), fill=scol if is_active else (50, 70, 95))
            
            if i < 4:
                draw.line([rx0 + 100, box_y1, rx0 + 100, box_y1 + 20], fill=(40, 60, 90), width=2)
                
        # Bottom Reveal Text
        draw.text((WIDTH // 2 - 320, HEIGHT - 80), "RAW DATA → UNDERSTANDING → ACTION", font=get_font("quantum", 32), fill=COLOR_TEXT_WHITE)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 17C: 3:24–3:27 | RESOLUTION & STABILIZATION (3 seconds, 180 frames)
# =========================================================================
def render_scene_17c():
    filename = "Scene_17C_03-24_03-27_Resolution_Stabilization.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 3.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    for f in range(total_frames):
        t = f / FPS
        fade_prog = min(1.0, max(0.0, (t - 1.5) / 1.5))
        
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 22))
        draw = ImageDraw.Draw(frame_img)
        
        # Grid fades out gradually
        grid_alpha = int((1.0 - fade_prog) * 30)
        if grid_alpha > 0:
            draw_grid_background(draw, 0, 0, WIDTH, HEIGHT, step=40, color=(grid_alpha//2, grid_alpha, int(grid_alpha * 1.5)))
            
        # ECG waveform continues smoothly and regularly
        ecg_bbox = [200, 180, WIDTH - 200, 480]
        draw_ecg_canvas(draw, ecg_bbox, t, hr=72.0, anomaly=0.0, line_color=COLOR_EMERALD)
        
        # Status summary panel (fades smoothly after t=1.5s)
        if fade_prog < 0.95:
            panel_alpha = 1.0 - fade_prog
            card_y0, card_y1 = 540, 840
            draw.rounded_rectangle([300, card_y0, WIDTH - 300, card_y1], radius=10, fill=(14, 22, 38), outline=COLOR_EMERALD, width=2)
            
            draw.text((WIDTH // 2 - 250, card_y0 + 35), "PHYSIOLOGICAL CHANGE DETECTED", font=get_font("segoe", 24, bold=True), fill=COLOR_TEXT_WHITE)
            draw.text((WIDTH // 2 - 140, card_y0 + 105), "CONTEXT ANALYZED", font=get_font("segoe", 22, bold=True), fill=COLOR_CYAN)
            draw.text((WIDTH // 2 - 240, card_y0 + 175), "RESPONSE GUIDANCE AVAILABLE", font=get_font("segoe", 22, bold=True), fill=COLOR_EMERALD)
            draw.text((WIDTH // 2 - 200, card_y0 + 245), "MONITORING RESUMED // STABLE STATE", font=get_font("mono", 14), fill=COLOR_TEXT_MUTED)
            
        # HELIOS Core Logo identity emerges prominently in center as elements fade
        if t >= 1.2:
            logo_alpha = min(1.0, (t - 1.2) / 1.0)
            draw.text((WIDTH // 2 - 180, HEIGHT // 2 - 30), "H.E.L.I.O.S.", font=get_font("quantum", 54), fill=COLOR_TEXT_WHITE)
            draw.text((WIDTH // 2 - 220, HEIGHT // 2 + 50), "HEALTH EVALUATION LOGISTIC INTELLIGENT ONBOARD SYSTEM", font=get_font("mono", 13), fill=COLOR_CYAN)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# SCENE 17D: 3:27–3:30 | FINAL TITLE CLOSE (3 seconds, 180 frames)
# =========================================================================
def render_scene_17d():
    filename = "Scene_17D_03-27_03-30_Final_Title_Close.mp4"
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"--> Rendering {filename}...")
    
    duration = 3.0
    total_frames = int(duration * FPS)
    encoder = VideoEncoder(out_path, duration)
    
    for f in range(total_frames):
        t = f / FPS
        frame_img = Image.new("RGB", (WIDTH, HEIGHT), (5, 8, 15))
        draw = ImageDraw.Draw(frame_img)
        
        # Subtle glowing center radial gradient
        cx, cy = WIDTH // 2, HEIGHT // 2 - 40
        
        # Reveal HELIOS Title
        draw.text((cx - 240, cy - 90), "H.E.L.I.O.S.", font=get_font("quantum", 74), fill=COLOR_TEXT_WHITE)
        draw.text((cx - 380, cy + 10), "HEALTH EVALUATION LOGISTIC INTELLIGENT ONBOARD SYSTEM", font=get_font("mono", 18), fill=COLOR_CYAN)
        
        # Reveal Tagline
        draw.text((cx - 300, cy + 80), "MONITOR.  UNDERSTAND.  ACT.", font=get_font("segoe", 32, bold=True), fill=COLOR_EMERALD)
        
        # Reveal Team identity
        draw.line([cx - 200, cy + 160, cx + 200, cy + 160], fill=(40, 60, 90), width=1)
        draw.text((cx - 170, cy + 185), "TEAM COSMIC PLUS", font=get_font("quantum", 28), fill=COLOR_TEXT_WHITE)
        draw.text((cx - 210, cy + 235), "NASA SPACE APPS CHALLENGE 2026", font=get_font("mono", 16), fill=COLOR_TEXT_MUTED)

        encoder.write_frame(pil_to_cv2(frame_img))
        
    encoder.close()
    print(f"Finished {filename}")


# =========================================================================
# MASTER CONCATENATION OF ALL SCENES (45.0s Master Sequence)
# =========================================================================
def stitch_all_scenes():
    print("--> Stitching Master Combined Cut: Scenes_15_to_17_02-45_03-30_Full_Sequence.mp4")
    scene_files = [
        "Scene_15A_02-45_02-50_Extreme_Isolation.mp4",
        "Scene_15B_02-50_02-55_Disaster_Medicine.mp4",
        "Scene_15C_02-55_03-00_One_Intelligence_Architecture.mp4",
        "Scene_16A_03-00_03-05_Modular_Telemetry.mp4",
        "Scene_16B_03-05_03-10_Multi_Crew_Scaling.mp4",
        "Scene_16C_03-10_03-15_Orbital_to_Lunar_Scale.mp4",
        "Scene_17A_03-15_03-19_Cinematic_Callback_Heartbeat.mp4",
        "Scene_17B_03-19_03-24_Signal_to_Action.mp4",
        "Scene_17C_03-24_03-27_Resolution_Stabilization.mp4",
        "Scene_17D_03-27_03-30_Final_Title_Close.mp4"
    ]
    
    list_path = os.path.join(OUTPUT_DIR, "concat_list.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for fname in scene_files:
            f.write(f"file '{fname}'\n")
            
    master_out = os.path.join(OUTPUT_DIR, "Scenes_15_to_17_02-45_03-30_Full_Sequence.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        master_out
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Master cut created successfully at: {master_out}")


def main():
    print("==================================================================")
    print("   HELIOS VIDEO RENDER ENGINE - SCENES 15, 16, 17 PRODUCTION     ")
    print("==================================================================")
    render_scene_15a()
    render_scene_15b()
    render_scene_15c()
    render_scene_16a()
    render_scene_16b()
    render_scene_16c()
    render_scene_17a()
    render_scene_17b()
    render_scene_17c()
    render_scene_17d()
    stitch_all_scenes()
    print("==================================================================")
    print("   ALL 10 SCENES & MASTER SEQUENCE COMPLETED SUCCESSFULLY!       ")
    print("==================================================================")

if __name__ == "__main__":
    main()
