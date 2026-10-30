import math
from PIL import Image, ImageDraw, ImageFont

def create_brand_icon(size):
    # High-resolution canvas for supersampling
    scale = 4
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded squircle / shield background
    pad = int(s * 0.04)
    corner = int(s * 0.22)
    
    # Outer subtle dark border
    draw.rounded_rectangle([pad, pad, s - pad, s - pad], radius=corner, fill=(11, 21, 38, 255), outline=(16, 185, 129, 200), width=int(scale * 3.5))

    # Inner dark radial gradient simulation / concentric glowing ring
    center = s / 2
    
    # Outer analytical radar circle
    radius_outer = s * 0.38
    draw.ellipse([center - radius_outer, center - radius_outer, center + radius_outer, center + radius_outer], outline=(56, 189, 248, 90), width=int(scale * 2))

    # Middle radar ring
    radius_mid = s * 0.28
    draw.ellipse([center - radius_mid, center - radius_mid, center + radius_mid, center + radius_mid], outline=(16, 185, 129, 140), width=int(scale * 2.5))

    # Crosshair tick marks
    tick_len = s * 0.08
    tick_w = int(scale * 2.5)
    # Top
    draw.line([center, center - radius_outer - tick_len * 0.3, center, center - radius_mid], fill=(56, 189, 248, 220), width=tick_w)
    # Bottom
    draw.line([center, center + radius_mid, center, center + radius_outer + tick_len * 0.3], fill=(56, 189, 248, 220), width=tick_w)
    # Left
    draw.line([center - radius_outer - tick_len * 0.3, center, center - radius_mid, center], fill=(56, 189, 248, 220), width=tick_w)
    # Right
    draw.line([center + radius_mid, center, center + radius_outer + tick_len * 0.3, center], fill=(56, 189, 248, 220), width=tick_w)

    # Center Hexagonal / Diamond Shield Core with Stylized "B" + Vector Football Edge
    # Draw central hexagon
    hex_r = s * 0.20
    hex_pts = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        px = center + hex_r * math.cos(angle)
        py = center + hex_r * math.sin(angle)
        hex_pts.append((px, py))
    draw.polygon(hex_pts, fill=(15, 28, 50, 255), outline=(52, 211, 153, 255))

    # In center: Bold geometric "B" in electric emerald & cyan
    # Vertical spine of B
    bx0 = center - s * 0.08
    bx1 = center + s * 0.07
    by0 = center - s * 0.12
    by1 = center + s * 0.12
    bw = int(scale * 5)
    
    # Draw crisp stylized double-arc B with lightning slash
    # Vertical stem
    draw.line([bx0, by0, bx0, by1], fill=(255, 255, 255, 255), width=bw)
    
    # Top lobe
    draw.arc([bx0 - s*0.04, by0, bx0 + s*0.13, center], start=-90, end=90, fill=(56, 189, 248, 255), width=bw)
    draw.line([bx0, by0, bx0 + s*0.04, by0], fill=(56, 189, 248, 255), width=bw)
    draw.line([bx0, center, bx0 + s*0.04, center], fill=(56, 189, 248, 255), width=bw)

    # Bottom lobe
    draw.arc([bx0 - s*0.04, center, bx0 + s*0.15, by1], start=-90, end=90, fill=(16, 185, 129, 255), width=bw)
    draw.line([bx0, by1, bx0 + s*0.05, by1], fill=(16, 185, 129, 255), width=bw)

    # Little cyan accuracy beacon dot
    dot_r = s * 0.025
    draw.ellipse([center + s * 0.12 - dot_r, by0 + s*0.02 - dot_r, center + s * 0.12 + dot_r, by0 + s*0.02 + dot_r], fill=(56, 189, 248, 255))

    # Resize with high-quality Lanczos resampling
    final = img.resize((size, size), Image.Resampling.LANCZOS)
    return final

for sz, path in [
    (192, 'assets/icon-192.png'),
    (512, 'assets/icon-512.png'),
    (180, 'assets/apple-touch-icon.png'),
    (32, 'assets/favicon-32.png')
]:
    icon = create_brand_icon(sz)
    icon.save(path, format='PNG')
    print(f"Generated {path} ({sz}x{sz})")

print("All brand icons generated successfully!")
