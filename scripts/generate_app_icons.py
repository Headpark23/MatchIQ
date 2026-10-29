"""Generate Bet Buddy mobile icons featuring a cute, high-contrast Panda logo.

Features:
- Premium stadium backdrop (#060d19) with radial floodlight ambiance.
- Glowing cyan/emerald confidence arc.
- Radiant emerald (#059669) to cyan (#06b6d4) stadium badge.
- Adorable, minimalist vector panda face centered on badge.
- Generates 512x512, 192x192, 180x180 (Apple Touch), and 32x32 (Favicon).
- Anti-aliased at 2048x2048 master resolution.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PUBLIC_ASSETS = ROOT / "public-dist" / "assets"

MASTER = 2048

def make_panda_icon():
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
    
    # Drop shadow
    shadow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        (b_left - 12, b_top + 36, b_right + 12, b_bottom + 60),
        radius=radius,
        fill=(0, 0, 0, 190)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    im = Image.alpha_composite(im, shadow)
    
    # Badge mask
    badge_mask = Image.new("L", (MASTER, MASTER), 0)
    m_draw = ImageDraw.Draw(badge_mask)
    m_draw.rounded_rectangle((b_left, b_top, b_right, b_bottom), radius=radius, fill=255)
    
    # Emerald-to-cyan gradient
    badge_grad = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pixels = badge_grad.load()
    c1 = (5, 150, 105)    # #059669
    c2 = (16, 185, 129)   # #10b981
    c3 = (52, 211, 153)   # #34d399
    c5 = (103, 232, 249)  # #67e8f9
    
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
    
    # 4. Cute Panda Face inside the badge
    panda = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(panda)
    dark_fur = (4, 18, 14, 255)      # Deep obsidian panda black
    white_fur = (252, 254, 255, 255) # Clean brilliant white
    mint_glow = (52, 211, 153, 255)  # Bet Buddy mint
    
    head_cy = cy + 40
    
    # Ears
    ear_r = 180
    left_ear_center = (cx - 360, head_cy - 360)
    right_ear_center = (cx + 360, head_cy - 360)
    
    pdraw.ellipse((left_ear_center[0] - ear_r, left_ear_center[1] - ear_r,
                   left_ear_center[0] + ear_r, left_ear_center[1] + ear_r), fill=dark_fur)
    pdraw.ellipse((right_ear_center[0] - ear_r, right_ear_center[1] - ear_r,
                   right_ear_center[0] + ear_r, right_ear_center[1] + ear_r), fill=dark_fur)
                   
    # Inner ear mint highlights
    inner_r = 90
    pdraw.ellipse((left_ear_center[0] - inner_r, left_ear_center[1] - inner_r,
                   left_ear_center[0] + inner_r, left_ear_center[1] + inner_r), fill=mint_glow)
    pdraw.ellipse((right_ear_center[0] - inner_r, right_ear_center[1] - inner_r,
                   right_ear_center[0] + inner_r, right_ear_center[1] + inner_r), fill=mint_glow)
    
    # Head Base (broad cute ellipse)
    head_rx = 490
    head_ry = 420
    pdraw.ellipse((cx - head_rx, head_cy - head_ry, cx + head_rx, head_cy + head_ry), fill=white_fur)
    
    # Big Eye Patches (classic tilted panda ovals)
    patch_w = 135
    patch_h = 175
    # Left patch
    left_patch_center = (cx - 190, head_cy - 30)
    pdraw.ellipse((left_patch_center[0] - patch_w, left_patch_center[1] - patch_h,
                   left_patch_center[0] + patch_w, left_patch_center[1] + patch_h), fill=dark_fur)
    # Right patch
    right_patch_center = (cx + 190, head_cy - 30)
    pdraw.ellipse((right_patch_center[0] - patch_w, right_patch_center[1] - patch_h,
                   right_patch_center[0] + patch_w, right_patch_center[1] + patch_h), fill=dark_fur)
    
    # Big Sparkly Eyes
    eye_r = 55
    # Left eye
    pdraw.ellipse((left_patch_center[0] - eye_r + 10, left_patch_center[1] - eye_r - 20,
                   left_patch_center[0] + eye_r + 10, left_patch_center[1] + eye_r - 20), fill=white_fur)
    pdraw.ellipse((left_patch_center[0] - 22 + 10, left_patch_center[1] - 22 - 20,
                   left_patch_center[0] + 22 + 10, left_patch_center[1] + 22 - 20), fill=mint_glow)
    # Right eye
    pdraw.ellipse((right_patch_center[0] - eye_r - 10, right_patch_center[1] - eye_r - 20,
                   right_patch_center[0] + eye_r - 10, right_patch_center[1] + eye_r - 20), fill=white_fur)
    pdraw.ellipse((right_patch_center[0] - 22 - 10, right_patch_center[1] - 22 - 20,
                   right_patch_center[0] + 22 - 10, right_patch_center[1] + 22 - 20), fill=mint_glow)
    
    # Cute Panda Nose (soft rounded triangle / oval)
    nose_rx = 75
    nose_ry = 50
    nose_y = head_cy + 90
    pdraw.ellipse((cx - nose_rx, nose_y - nose_ry, cx + nose_rx, nose_y + nose_ry), fill=dark_fur)
    # Nose shine
    pdraw.ellipse((cx - 25, nose_y - 30, cx + 5, nose_y - 12), fill=(60, 80, 75, 255))
    
    # Smiling Mouth
    pdraw.arc((cx - 90, nose_y + 10, cx, nose_y + 90), start=20, end=160, fill=dark_fur, width=24)
    pdraw.arc((cx, nose_y + 10, cx + 90, nose_y + 90), start=20, end=160, fill=dark_fur, width=24)
    
    # Cheeks (soft cute blush)
    blush_rx = 70
    blush_ry = 35
    pdraw.ellipse((cx - 330 - blush_rx, head_cy + 80 - blush_ry, cx - 330 + blush_rx, head_cy + 80 + blush_ry), fill=(52, 211, 153, 90))
    pdraw.ellipse((cx + 330 - blush_rx, head_cy + 80 - blush_ry, cx + 330 + blush_rx, head_cy + 80 + blush_ry), fill=(52, 211, 153, 90))

    im = Image.alpha_composite(im, panda)
    return im

def main():
    print("Generating Bet Buddy master panda icon (2048x2048)...")
    master = make_panda_icon()
    
    targets = [
        (512, "icon-512.png"),
        (192, "icon-192.png"),
        (180, "apple-touch-icon.png"),
        (32, "favicon-32.png"),
    ]
    
    ASSETS.mkdir(parents=True, exist_ok=True)
    PUBLIC_ASSETS.mkdir(parents=True, exist_ok=True)
    
    for size, filename in targets:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        out_path = ASSETS / filename
        resized.save(out_path, "PNG", optimize=True)
        print(f"Saved {out_path} ({size}x{size})")
        
        pub_path = PUBLIC_ASSETS / filename
        resized.save(pub_path, "PNG", optimize=True)
        print(f"Saved {pub_path} ({size}x{size})")

    print("All Bet Buddy panda icons successfully generated.")

if __name__ == "__main__":
    main()
