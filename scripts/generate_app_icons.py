import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PUBLIC_ASSETS = ROOT / "public-dist" / "assets"

MASTER = 2048

def draw_football(draw, cx, cy, r):
    # Base circle with border
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 255), outline=(15, 23, 42, 255), width=int(r * 0.04))
    
    # Central black pentagon
    p_rad = r * 0.35
    pent_pts = []
    for i in range(5):
        angle = -math.pi / 2 + i * (2 * math.pi / 5)
        pent_pts.append((cx + p_rad * math.cos(angle), cy + p_rad * math.sin(angle)))
    draw.polygon(pent_pts, fill=(15, 23, 42, 255))
    
    # Radiating seams to 5 outer black patches
    outer_rad = r * 0.72
    for i in range(5):
        angle = -math.pi / 2 + i * (2 * math.pi / 5)
        p1 = pent_pts[i]
        p2 = (cx + outer_rad * math.cos(angle), cy + outer_rad * math.sin(angle))
        draw.line([p1, p2], fill=(15, 23, 42, 255), width=int(r * 0.035))
        
        # Edge black patch
        a_left = angle - 0.28
        a_right = angle + 0.28
        edge_pt1 = (cx + r * math.cos(a_left), cy + r * math.sin(a_left))
        edge_pt2 = (cx + r * math.cos(a_right), cy + r * math.sin(a_right))
        draw.polygon([p2, edge_pt1, edge_pt2], fill=(15, 23, 42, 255))

def make_panda_football_icon():
    im = Image.new("RGBA", (MASTER, MASTER), (6, 13, 25, 255))
    cx, cy = MASTER // 2, MASTER // 2
    
    # 1. Radial stadium ambient floodlight
    glow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r in range(960, 0, -20):
        f = 1 - r / 960
        a = int(80 * (f ** 1.8))
        gdraw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(6, 182, 212, a))
    for r in range(640, 0, -16):
        f = 1 - r / 640
        a = int(110 * (f ** 1.5))
        gdraw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(52, 211, 153, a))
    im = Image.alpha_composite(im, glow)
    
    # 2. Glowing confidence arc in background
    ring_layer = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(ring_layer)
    r_box = (cx - 820, cy - 820, cx + 820, cy + 820)
    r_draw.arc(r_box, start=0, end=360, fill=(255, 255, 255, 24), width=32)
    r_draw.arc(r_box, start=-220, end=40, fill=(52, 211, 153, 200), width=40)
    r_draw.arc(r_box, start=-120, end=40, fill=(103, 232, 249, 230), width=40)
    ring_glow = ring_layer.filter(ImageFilter.GaussianBlur(20))
    im = Image.alpha_composite(im, ring_glow)
    im = Image.alpha_composite(im, ring_layer)
    
    # 3. Main Stadium Badge (Squircle)
    b_inset = 280
    b_left, b_top = b_inset, b_inset
    b_right, b_bottom = MASTER - b_inset, MASTER - b_inset
    radius = 340
    
    shadow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((b_left - 12, b_top + 36, b_right + 12, b_bottom + 60), radius=radius, fill=(0, 0, 0, 190))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    im = Image.alpha_composite(im, shadow)
    
    badge_mask = Image.new("L", (MASTER, MASTER), 0)
    m_draw = ImageDraw.Draw(badge_mask)
    m_draw.rounded_rectangle((b_left, b_top, b_right, b_bottom), radius=radius, fill=255)
    
    # Gradient badge
    badge_grad = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pixels = badge_grad.load()
    c1 = (5, 150, 105)
    c2 = (16, 185, 129)
    c3 = (52, 211, 153)
    c5 = (103, 232, 249)
    total_span = (b_right - b_left) + (b_bottom - b_top)
    for y in range(b_top, b_bottom):
        for x in range(b_left, b_right):
            t = ((x - b_left) + (y - b_top)) / total_span
            if t < 0.35:
                u = t / 0.35
                r = int(c1[0] * (1 - u) + c2[0] * u)
                g = int(c1[1] * (1 - u) + c2[1] * u)
                b = int(c1[2] * (1 - u) + c2[2] * u)
            elif t < 0.7:
                u = (t - 0.35) / 0.35
                r = int(c2[0] * (1 - u) + c3[0] * u)
                g = int(c2[1] * (1 - u) + c3[1] * u)
                b = int(c2[2] * (1 - u) + c3[2] * u)
            else:
                u = (t - 0.7) / 0.3
                r = int(c3[0] * (1 - u) + c5[0] * u)
                g = int(c3[1] * (1 - u) + c5[1] * u)
                b = int(c3[2] * (1 - u) + c5[2] * u)
            pixels[x, y] = (r, g, b, 255)
    badge_grad.putalpha(badge_mask)
    im = Image.alpha_composite(im, badge_grad)
    
    # 4. Panda Face + Classic Football Mascot Layer
    mascot = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(mascot)
    dark_fur = (4, 18, 14, 255)
    white_fur = (252, 254, 255, 255)
    mint_glow = (52, 211, 153, 255)
    
    head_cy = cy - 40  # raised slightly to make room for football at bottom
    
    # Ears
    ear_r = 170
    left_ear_center = (cx - 340, head_cy - 340)
    right_ear_center = (cx + 340, head_cy - 340)
    pdraw.ellipse((left_ear_center[0] - ear_r, left_ear_center[1] - ear_r, left_ear_center[0] + ear_r, left_ear_center[1] + ear_r), fill=dark_fur)
    pdraw.ellipse((right_ear_center[0] - ear_r, right_ear_center[1] - ear_r, right_ear_center[0] + ear_r, right_ear_center[1] + ear_r), fill=dark_fur)
    
    inner_r = 85
    pdraw.ellipse((left_ear_center[0] - inner_r, left_ear_center[1] - inner_r, left_ear_center[0] + inner_r, left_ear_center[1] + inner_r), fill=mint_glow)
    pdraw.ellipse((right_ear_center[0] - inner_r, right_ear_center[1] - inner_r, right_ear_center[0] + inner_r, right_ear_center[1] + inner_r), fill=mint_glow)
    
    # Head Base
    head_rx = 460
    head_ry = 390
    pdraw.ellipse((cx - head_rx, head_cy - head_ry, cx + head_rx, head_cy + head_ry), fill=white_fur)
    
    # Eye Patches
    patch_w = 125
    patch_h = 165
    left_patch_center = (cx - 180, head_cy - 30)
    right_patch_center = (cx + 180, head_cy - 30)
    pdraw.ellipse((left_patch_center[0] - patch_w, left_patch_center[1] - patch_h, left_patch_center[0] + patch_w, left_patch_center[1] + patch_h), fill=dark_fur)
    pdraw.ellipse((right_patch_center[0] - patch_w, right_patch_center[1] - patch_h, right_patch_center[0] + patch_w, right_patch_center[1] + patch_h), fill=dark_fur)
    
    # Big Sparkly Eyes
    eye_r = 50
    pdraw.ellipse((left_patch_center[0] - eye_r + 10, left_patch_center[1] - eye_r - 18, left_patch_center[0] + eye_r + 10, left_patch_center[1] + eye_r - 18), fill=white_fur)
    pdraw.ellipse((left_patch_center[0] - 20 + 10, left_patch_center[1] - 20 - 18, left_patch_center[0] + 20 + 10, left_patch_center[1] + 20 - 18), fill=mint_glow)
    pdraw.ellipse((right_patch_center[0] - eye_r - 10, right_patch_center[1] - eye_r - 18, right_patch_center[0] + eye_r - 10, right_patch_center[1] + eye_r - 18), fill=white_fur)
    pdraw.ellipse((right_patch_center[0] - 20 - 10, right_patch_center[1] - 20 - 18, right_patch_center[0] + 20 - 10, right_patch_center[1] + 20 - 18), fill=mint_glow)
    
    # Nose
    nose_rx = 70
    nose_ry = 46
    nose_y = head_cy + 85
    pdraw.ellipse((cx - nose_rx, nose_y - nose_ry, cx + nose_rx, nose_y + nose_ry), fill=dark_fur)
    pdraw.ellipse((cx - 22, nose_y - 28, cx + 5, nose_y - 10), fill=(60, 80, 75, 255))
    
    # Smile
    pdraw.arc((cx - 85, nose_y + 10, cx, nose_y + 85), start=20, end=160, fill=dark_fur, width=22)
    pdraw.arc((cx, nose_y + 10, cx + 85, nose_y + 85), start=20, end=160, fill=dark_fur, width=22)
    
    # Cheeks
    blush_rx = 65
    blush_ry = 32
    pdraw.ellipse((cx - 310 - blush_rx, head_cy + 75 - blush_ry, cx - 310 + blush_rx, head_cy + 75 + blush_ry), fill=(52, 211, 153, 90))
    pdraw.ellipse((cx + 310 - blush_rx, head_cy + 75 - blush_ry, cx + 310 + blush_rx, head_cy + 75 + blush_ry), fill=(52, 211, 153, 90))
    
    # 5. Classic Stitched Football (held in front by cute paws)
    ball_cx = cx
    ball_cy = cy + 440
    ball_r = 250
    draw_football(pdraw, ball_cx, ball_cy, ball_r)
    
    # Panda Paws holding the football
    paw_r = 85
    pdraw.ellipse((ball_cx - ball_r + 20, ball_cy - paw_r, ball_cx - ball_r + 20 + 2 * paw_r, ball_cy + paw_r), fill=dark_fur)
    pdraw.ellipse((ball_cx + ball_r - 20 - 2 * paw_r, ball_cy - paw_r, ball_cx + ball_r - 20, ball_cy + paw_r), fill=dark_fur)
    # Paw pads (mint highlight)
    pad_r = 30
    pdraw.ellipse((ball_cx - ball_r + 70, ball_cy - pad_r, ball_cx - ball_r + 70 + 2 * pad_r, ball_cy + pad_r), fill=(52, 211, 153, 160))
    pdraw.ellipse((ball_cx + ball_r - 130, ball_cy - pad_r, ball_cx + ball_r - 130 + 2 * pad_r, ball_cy + pad_r), fill=(52, 211, 153, 160))
    
    im = Image.alpha_composite(im, mascot)
    return im

def main():
    print("Generating Bet Buddy Panda + Football master icon (2048x2048)...")
    master = make_panda_football_icon()
    
    sizes = [
        (512, "icon-512.png"),
        (192, "icon-192.png"),
        (180, "apple-touch-icon.png"),
        (32, "favicon-32.png")
    ]
    
    for size, name in sizes:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        out1 = ASSETS / name
        resized.save(out1, "PNG", optimize=True)
        print(f"Saved {out1} ({size}x{size})")
        out2 = PUBLIC_ASSETS / name
        resized.save(out2, "PNG", optimize=True)
        print(f"Saved {out2} ({size}x{size})")

    # Update scripts/generate_app_icons.py with this new code
    script_file = ROOT / "scripts" / "generate_app_icons.py"
    with open(__file__, "r", encoding="utf-8") as f:
        script_file.write_text(f.read(), encoding="utf-8")

if __name__ == "__main__":
    main()
