"""
Eatlas — Play Store Feature Graphic
Boyut: 1024x500 px
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1024, 500
OUT = r"C:\projects\firstproject\neareat-mobile\assets\feature-graphic.png"

CORAL = (232, 97, 76)
AMBER = (245, 166, 35)
WHITE = (255, 255, 255)
MUTED = (170, 160, 185)

# --- Arka plan gradyanı ---
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)
for y in range(H):
    t = y / H
    draw.line([(0, y), (W, y)], fill=(
        int(16 + t * 10), int(12 + t * 6), int(22 + t * 14)
    ))

# --- Sağ taraf dekoratif ışık efektleri ---
def glow(cx, cy, r, color, af=0.07):
    for i in range(r, 0, -5):
        a = int(255 * af * (1 - i / r))
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(lay).ellipse([cx-i, cy-i, cx+i, cy+i], fill=(*color, a))
        img.paste(Image.alpha_composite(img.convert('RGBA'), lay).convert('RGB'))

glow(820, 250, 280, CORAL, 0.06)
glow(920, 110, 160, AMBER, 0.05)
glow(780, 410, 140, (140, 80, 200), 0.04)
draw = ImageDraw.Draw(img)

# --- Font yükleme ---
FONTS = r"C:\Windows\Fonts"
def load(name, size):
    p = os.path.join(FONTS, name)
    if not os.path.exists(p):
        p = os.path.join(FONTS, name.lower())
    return ImageFont.truetype(p, size)

fE     = load("segoeuib.ttf", 96)
fatlas = load("segoeuib.ttf", 72)
ftag   = load("segoeui.ttf",  27)
fsub   = load("segoeui.ttf",  20)

PX = 70    # sol kenar boşluğu
LY = 140   # logo satırı üst y

# ── "E" harfi: coral→amber gradyan ─────────────────────────────────────────────
# getbbox (x0, y0, x1, y1) döndürür; x0/y0 sıfır olmayabilir.
# draw offset = (-x0, -y0) ile glif görüntünün sol-üst köşesinden başlar.
bb = fE.getbbox("E")
ex0, ey0, ex1, ey1 = bb
ew = ex1 - ex0   # glif genişliği
eh = ey1 - ey0   # glif yüksekliği

ei = Image.new('RGBA', (ew + 2, eh + 2), (0, 0, 0, 0))
ImageDraw.Draw(ei).text((1 - ex0, 1 - ey0), "E", font=fE, fill=WHITE)

# Piksel piksel coral→amber yatay gradyan uygula
px = ei.load()
for x in range(ei.width):
    t = x / ei.width
    c = (
        int(CORAL[0] + t * (AMBER[0] - CORAL[0])),
        int(CORAL[1] + t * (AMBER[1] - CORAL[1])),
        int(CORAL[2] + t * (AMBER[2] - CORAL[2])),
    )
    for y in range(ei.height):
        if px[x, y][3] > 0:
            px[x, y] = (*c, px[x, y][3])

img.paste(ei, (PX, LY), ei)
E_BOTTOM = LY + eh + 2   # E görselinin alt kenarı (canvas koordinatı)
E_RIGHT  = PX + ew + 2   # E görselinin sağ kenarı

# ── "atlas" beyaz, E ile alt hiza ──────────────────────────────────────────────
abb = fatlas.getbbox("atlas")
ax0, ay0, ax1, ay1 = abb

# E_BOTTOM = a_y_draw + ay1  →  a_y_draw = E_BOTTOM - ay1
a_y_draw = E_BOTTOM - ay1
a_x_draw = E_RIGHT + 4 - ax0   # ax0 offset'ini çıkar, E'nin hemen sağından başlat

draw.text((a_x_draw, a_y_draw), "atlas", font=fatlas, fill=WHITE)

LOGO_BOTTOM = max(E_BOTTOM, a_y_draw + ay1)   # logo satırının gerçek alt kenarı

# ── Tagline: logo altında yeterli boşlukla ──────────────────────────────────────
TAG_Y = LOGO_BOTTOM + 32
draw.text((PX, TAG_Y), "AI Destekli Restoran Keşfi", font=ftag, fill=MUTED)

# ── Ayraç çizgisi ───────────────────────────────────────────────────────────────
tbb   = ftag.getbbox("AI Destekli Restoran Keşfi")
LINE_Y = TAG_Y + (tbb[3] - tbb[1]) + 18
draw.line([(PX, LINE_Y), (PX + 300, LINE_Y)], fill=(80, 60, 110), width=1)

# ── Özellik maddeleri ────────────────────────────────────────────────────────────
items = [
    "Kişisel AI Öneri",
    "Yakın Restoran Keşfi",
    "Rezervasyon & Sosyal",
]
fy = LINE_Y + 16
for item in items:
    draw.ellipse([PX, fy + 9, PX + 6, fy + 15], fill=CORAL)
    draw.text((PX + 16, fy), item, font=fsub, fill=(210, 200, 225))
    fy += 32

img.save(OUT, "PNG")
print("OK Feature graphic kaydedildi:", OUT)
print("   Boyut:", W, "x", H, "px")
