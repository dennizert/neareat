from PIL import Image, ImageDraw
import os

def draw_icon(size, transparent_bg=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = size // 2
    cy = size // 2

    if not transparent_bg:
        # Orange rounded square background
        r = int(size * 0.22)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(255, 107, 53, 255))
        # Subtle darker strip at bottom for depth
        draw.rounded_rectangle([0, int(size * 0.72), size - 1, size - 1],
                                radius=r, fill=(220, 75, 20, 80))

    # --- White plate circle ---
    pr = int(size * 0.285)
    draw.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=(255, 255, 255, 255))

    # Inner soft fill
    ir = int(size * 0.228)
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(255, 248, 244, 255))

    # --- Fork (left of center) ---
    col = (255, 107, 53, 255)   # orange
    fw = max(3, int(size * 0.024))  # fork line width
    fx = cx - int(size * 0.078)    # fork center x

    # Three tines
    tw = max(2, int(size * 0.016))
    for dx_frac in (-0.028, 0, 0.028):
        tx = fx + int(size * dx_frac)
        draw.rounded_rectangle(
            [tx - tw // 2, cy - int(size * 0.175),
             tx + tw // 2, cy - int(size * 0.048)],
            radius=tw // 2, fill=col)

    # Horizontal connector bar between tines and handle
    bh = max(2, int(size * 0.016))
    draw.rounded_rectangle(
        [fx - int(size * 0.044), cy - int(size * 0.048) - bh,
         fx + int(size * 0.044), cy - int(size * 0.048)],
        radius=bh // 2, fill=col)

    # Handle
    draw.rounded_rectangle(
        [fx - fw // 2, cy - int(size * 0.048),
         fx + fw // 2, cy + int(size * 0.165)],
        radius=fw // 2, fill=col)

    # --- Knife (right of center) ---
    kx = cx + int(size * 0.078)
    kw = max(3, int(size * 0.022))

    # Blade — slightly wider at top
    blade_top = cy - int(size * 0.175)
    blade_mid = cy - int(size * 0.045)
    bwt = max(4, int(size * 0.032))  # blade top width
    draw.polygon([
        (kx - bwt // 2, blade_top),
        (kx + bwt // 2, blade_top),
        (kx + kw // 2, blade_mid),
        (kx - kw // 2, blade_mid),
    ], fill=col)

    # Guard
    gw = int(size * 0.048)
    gh = max(2, int(size * 0.018))
    draw.rounded_rectangle(
        [kx - gw, blade_mid, kx + gw, blade_mid + gh],
        radius=gh // 2, fill=col)

    # Handle
    draw.rounded_rectangle(
        [kx - kw // 2, blade_mid + gh,
         kx + kw // 2, cy + int(size * 0.165)],
        radius=kw // 2, fill=col)

    # --- Location pin (top-right accent) ---
    pcx = cx + int(size * 0.155)
    pcy = cy - int(size * 0.19)
    pin_r = int(size * 0.07)

    # Pin shadow (subtle)
    draw.ellipse([pcx - pin_r - 1, pcy - pin_r - 1,
                  pcx + pin_r + 1, pcy + pin_r + 1],
                 fill=(200, 80, 20, 120))

    # Pin circle
    draw.ellipse([pcx - pin_r, pcy - pin_r,
                  pcx + pin_r, pcy + pin_r],
                 fill=(255, 255, 255, 255))

    # Pin tail triangle
    tail_hw = int(pin_r * 0.52)
    tail_bottom = pcy + int(pin_r * 1.85)
    draw.polygon([
        (pcx - tail_hw, pcy + int(pin_r * 0.68)),
        (pcx + tail_hw, pcy + int(pin_r * 0.68)),
        (pcx, tail_bottom),
    ], fill=(255, 255, 255, 255))

    # Pin inner dot
    dot_r = int(pin_r * 0.42)
    draw.ellipse([pcx - dot_r, pcy - dot_r,
                  pcx + dot_r, pcy + dot_r],
                 fill=(255, 107, 53, 255))

    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, quality=95)
    print(f'  OK {path}')


BASE = r'C:\projects\firstproject\neareat-mobile'

print('Generating NearEat icons...')

# Full icon (with orange background)
for size, rel in [
    (1024, r'assets\icon.png'),
]:
    save(draw_icon(size, transparent_bg=False), os.path.join(BASE, rel))

# Adaptive foreground (transparent bg, icon centred in safe zone ~66%)
adaptive = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
inner = draw_icon(680, transparent_bg=True)   # safe zone ~66% of 1024
adaptive.paste(inner, (172, 172), inner)
save(adaptive, os.path.join(BASE, r'assets\adaptive-icon.png'))

# Android mipmap icons (full orange bg)
MIPMAPS = [
    ('mipmap-mdpi',    48),
    ('mipmap-hdpi',    72),
    ('mipmap-xhdpi',   96),
    ('mipmap-xxhdpi',  144),
    ('mipmap-xxxhdpi', 192),
]
for folder, size in MIPMAPS:
    base_dir = os.path.join(BASE, 'android', 'app', 'src', 'main', 'res', folder)
    icon = draw_icon(size)
    for name in ('ic_launcher.webp', 'ic_launcher_round.webp'):
        save(icon, os.path.join(base_dir, name))

    # Foreground for adaptive (transparent bg)
    fg_size = int(size * 1.4)
    fg_img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    inner_fg = draw_icon(int(fg_size * 0.66), transparent_bg=True)
    offset = (fg_size - inner_fg.width) // 2
    fg_img.paste(inner_fg, (offset, offset), inner_fg)
    fg_img = fg_img.resize((size, size), Image.LANCZOS)
    save(fg_img, os.path.join(base_dir, 'ic_launcher_foreground.webp'))

print('Done!')
