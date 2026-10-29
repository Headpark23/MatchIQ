"""Generate high-fidelity, vibrant MatchIQ PWA and iOS home screen icons.

Features:
- Premium pitch night stadium backdrop (#060d19) with radial floodlight ambiance.
- Glowing stadium confidence ring.
- Vibrant emerald (#059669) to cyan (#06b6d4) gradient stadium badge.
- Bold 3-tier stadium intelligence mark in obsidian (#03140d).
- Generates 512x512, 192x192, 180x180 (Apple Touch), and 32x32 (Favicon).
- Anti-aliased at 2048x2048 master resolution.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PUBLIC_ASSETS = ROOT / "public-dist" / "assets"

MASTER = 2048

def make_master_icon():
    im = Image.new("RGBA", (MASTER, MASTER), (6, 13, 25, 255))
    
    # 1. Radial stadium ambient floodlight
    glow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    cx, cy = MASTER // 2, MASTER // 2
    
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
    r_box = (cx - 780, cy - 780, cx + 780, cy + 780)
    # Background subtle track
    r_draw.arc(r_box, start=0, end=360, fill=(255, 255, 255, 24), width=28)
    # Glowing active arc
    r_draw.arc(r_box, start=-220, end=40, fill=(52, 211, 153, 200), width=36)
    r_draw.arc(r_box, start=-120, end=40, fill=(103, 232, 249, 230), width=36)
    
    # Soft glow around arc
    ring_glow = ring_layer.filter(ImageFilter.GaussianBlur(16))
    im = Image.alpha_composite(im, ring_glow)
    im = Image.alpha_composite(im, ring_layer)
    
    # 3. Main Stadium Badge (Squircle)
    b_inset = 320
    b_left, b_top = b_inset, b_inset
    b_right, b_bottom = MASTER - b_inset, MASTER - b_inset
    radius = 320
    
    # Drop shadow
    shadow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        (b_left - 10, b_top + 36, b_right + 10, b_bottom + 56),
        radius=radius,
        fill=(0, 0, 0, 190)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    im = Image.alpha_composite(im, shadow)
    
    # Badge mask
    badge_mask = Image.new("L", (MASTER, MASTER), 0)
    m_draw = ImageDraw.Draw(badge_mask)
    m_draw.rounded_rectangle((b_left, b_top, b_right, b_bottom), radius=radius, fill=255)
    
    # Vibrant emerald-to-cyan diagonal gradient
    badge_grad = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    pixels = badge_grad.load()
    c1 = (5, 150, 105)    # deep emerald (#059669)
    c2 = (16, 185, 129)   # pitch green (#10b981)
    c3 = (52, 211, 153)   # bright mint (#34d399)
    c4 = (6, 182, 212)    # electric cyan (#06b6d4)
    c5 = (103, 232, 249)  # sky cyan (#67e8f9)
    
    span_x = b_right - b_left
    span_y = b_bottom - b_top
    total_span = span_x + span_y
    
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
    
    # Subtle inner edge highlight on badge
    edge = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    edraw = ImageDraw.Draw(edge)
    edraw.rounded_rectangle((b_left, b_top, b_right, b_bottom), radius=radius, outline=(255, 255, 255, 75), width=8)
    edge.putalpha(badge_mask)
    im = Image.alpha_composite(im, edge)
    
    # 4. Bold 3-Tier Stadium Isometric Mark
    mark_draw = ImageDraw.Draw(im)
    obsidian = (4, 20, 13, 255)
    line_w = 64
    
    # Diamond (Tier 1)
    d1 = [
        (cx, cy - 350),
        (cx - 370, cy - 180),
        (cx, cy - 10),
        (cx + 370, cy - 180),
        (cx, cy - 350)
    ]
    mark_draw.line(d1, fill=obsidian, width=line_w, joint="round")
    
    # Middle Chevron (Tier 2)
    d2 = [
        (cx - 370, cy + 20),
        (cx, cy + 190),
        (cx + 370, cy + 20)
    ]
    mark_draw.line(d2, fill=obsidian, width=line_w, joint="round")
    
    # Bottom Chevron (Tier 3)
    d3 = [
        (cx - 370, cy + 220),
        (cx, cy + 390),
        (cx + 370, cy + 220)
    ]
    mark_draw.line(d3, fill=obsidian, width=line_w, joint="round")
    
    return im

def main():
    print("Generating master icon (2048x2048)...")
    master = make_master_icon()
    
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
        
        # Also copy to public-dist
        pub_path = PUBLIC_ASSETS / filename
        resized.save(pub_path, "PNG", optimize=True)
        print(f"Saved {pub_path} ({size}x{size})")

    print("All icons successfully generated.")

if __name__ == "__main__":
    main()

