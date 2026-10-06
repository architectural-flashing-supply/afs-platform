import os, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import fitz

OUT = r"C:\Users\manag\Documents\afs-overnight\audit"
F = r"C:\Windows\Fonts"
def font(names, size):
    for n in names:
        p = os.path.join(F, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

arial = lambda s: font(["arial.ttf"], s)
arialb = lambda s: font(["arialbd.ttf", "arial.ttf"], s)
hand = lambda s: font(["segoepr.ttf", "Inkfree.ttf", "ariali.ttf"], s)
random.seed(7)

def arrow_dim(d, x1, y1, x2, y2, text, f, off=0, vertical=False):
    d.line([(x1, y1), (x2, y2)], fill="black", width=2)
    for (x, y, dx, dy) in [(x1, y1, 1, 0), (x2, y2, -1, 0)] if not vertical else [(x1, y1, 0, 1), (x2, y2, 0, -1)]:
        if not vertical:
            d.polygon([(x, y), (x + 14 * dx, y - 5), (x + 14 * dx, y + 5)], fill="black")
        else:
            d.polygon([(x, y), (x - 5, y + 14 * dy), (x + 5, y + 14 * dy)], fill="black")
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    d.text((mx, my - 20 if not vertical else my), text, fill="black", font=f, anchor="mm" if not vertical else "lm")

# ---------- (a) clean CAD detail sheet ----------
W, H = 1700, 1100
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
d.rectangle([20, 20, W - 20, H - 20], outline="black", width=4)
d.rectangle([W - 520, H - 200, W - 20, H - 20], outline="black", width=2)
d.text((W - 500, H - 180), "ACME MEDICAL CENTER - ROOF", fill="black", font=arialb(22))
d.text((W - 500, H - 140), "SHEET A5.2  SHEET METAL DETAILS", fill="black", font=arial(22))
d.text((W - 500, H - 100), "SCALE: 3\" = 1'-0\"", fill="black", font=arial(20))
tf, sf = arialb(26), arial(22)
# Detail 1: coping cap: width 12, legs 4 down each side
d.text((120, 70), "1  PARAPET COPING CAP", fill="black", font=tf)
d.text((120, 105), "20 GA. GALVANIZED STEEL - 48 LF (NORTH PARAPET)", fill="black", font=sf)
x0, y0 = 250, 300
w = 480  # 12in scaled 40px/in
leg = 160  # 4in
d.line([(x0, y0 + leg), (x0, y0), (x0 + w, y0), (x0 + w, y0 + leg)], fill="black", width=6)
d.rectangle([x0 + 40, y0 + 6, x0 + w - 40, y0 + leg + 140], outline="gray", width=2)  # parapet wall
d.text((x0 + w / 2, y0 + 220), "EXISTING PARAPET", fill="gray", font=sf, anchor="mm")
arrow_dim(d, x0, y0 - 40, x0 + w, y0 - 40, '12"', arialb(24))
arrow_dim(d, x0 - 50, y0, x0 - 50, y0 + leg, '4"', arialb(24), vertical=True)
arrow_dim(d, x0 + w + 50, y0, x0 + w + 50, y0 + leg, '4"', arialb(24), vertical=True)
# Detail 2: drip edge 2x2
d.text((120, 600), "2  DRIP EDGE", fill="black", font=tf)
d.text((120, 635), ".040 ALUMINUM - 120 LF (ALL EAVES)", fill="black", font=sf)
x1, y1 = 300, 780
d.line([(x1, y1), (x1 + 80, y1), (x1 + 80, y1 + 80)], fill="black", width=6)
arrow_dim(d, x1, y1 - 30, x1 + 80, y1 - 30, '2"', arialb(24))
arrow_dim(d, x1 + 130, y1, x1 + 130, y1 + 80, '2"', arialb(24), vertical=True)
d.text((x1 + 200, y1 + 30), "(ROOF DECK BEYOND)", fill="gray", font=sf)
img.save(os.path.join(OUT, "fx_a_cad.png"))

# ---------- (b) hand sketch photo-like ----------
W, H = 1600, 1200
paper = Image.new("RGB", (W, H), (236, 230, 214))
px = paper.load()
for y in range(H):
    for x in range(W):
        g = int(18 * (x / W) + 12 * (y / H))  # lighting gradient
        n = random.randint(-5, 5)
        r, gg, b = px[x, y]
        px[x, y] = (max(0, r - g + n), max(0, gg - g + n), max(0, b - g + n))
d = ImageDraw.Draw(paper)
for y in range(100, H, 52):  # ruled lines
    d.line([(0, y), (W, y)], fill=(170, 190, 215), width=1)
ink = (25, 30, 80)
def wob(pts):
    out = []
    for (x, y) in pts:
        out.append((x + random.uniform(-3, 3), y + random.uniform(-3, 3)))
    return out
hf = hand(40); hs = hand(32)
d.text((80, 60), "Roof edge flashings - Smith Bldg", fill=ink, font=hf)
# counter flashing, height 4, lap 2, hem 1/2 on bottom edge
d.text((80, 160), "A) Counter flashing", fill=ink, font=hf)
d.line(wob([(300, 300), (300, 520), (440, 520)]), fill=ink, width=5)
d.line(wob([(440, 520), (440, 500)]), fill=ink, width=5)  # hem
d.text((140, 390), '4"', fill=ink, font=hf)
d.text((340, 540), '2" lap', fill=ink, font=hf)
d.text((470, 470), '1/2" hem', fill=ink, font=hs)
d.text((560, 260), "24 ga galv", fill=ink, font=hf)
d.text((560, 320), "30 LF", fill=ink, font=hf)
# gravel stop
d.text((80, 700), "B) Gravel stop", fill=ink, font=hf)
d.line(wob([(300, 820), (300, 960), (420, 960)]), fill=ink, width=5)
d.text((130, 880), '3" face', fill=ink, font=hs)
d.text((330, 980), '2" leg', fill=ink, font=hs)
d.text((560, 820), ".032 alum", fill=ink, font=hf)
d.text((560, 880), "60 ft", fill=ink, font=hf)
# coffee ring + tilt + blur
d.ellipse([1180, 80, 1420, 320], outline=(150, 110, 70), width=6)
paper = paper.rotate(2.5, resample=Image.BICUBIC, expand=True, fillcolor=(90, 80, 70))
paper = paper.filter(ImageFilter.GaussianBlur(1.1))
paper.save(os.path.join(OUT, "fx_b_sketch.jpg"), quality=82)
# keep as png for model media_type simplicity
paper.save(os.path.join(OUT, "fx_b_sketch.png"))

# ---------- (c) two-sheet PDF ----------
doc = fitz.open()
p1 = doc.new_page(width=1224, height=792)
p1.insert_text((60, 80), "WAREHOUSE ADDITION - GENERAL NOTES (SHEET G0.1)", fontsize=22)
notes = ["1. ALL WORK PER 2021 IBC.", "2. CONTRACTOR TO VERIFY ALL DIMENSIONS IN FIELD.",
         "3. COORDINATE WITH STRUCTURAL.", "4. PANEL MANUFACTURER TO PROVIDE SHOP DRAWINGS.",
         "5. SEE ROOF PLAN SHEET A1.1 FOR ROOF INFORMATION."]
for i, n in enumerate(notes):
    p1.insert_text((60, 140 + i * 30), n, fontsize=16)
p2 = doc.new_page(width=1224, height=792)
p2.insert_text((60, 60), "A1.1  ROOF PLAN", fontsize=22)
r = fitz.Rect(300, 200, 900, 500)  # 40 x 20 -> 15 px / ft
p2.draw_rect(r, width=2)
p2.insert_text((530, 190), "40'-0\"", fontsize=18)
p2.insert_text((920, 355), "20'-0\"", fontsize=18)
p2.draw_line((300, 520), (900, 520)); p2.draw_line((300, 520), (900, 520))
p2.insert_text((320, 350), "STANDING SEAM", fontsize=20)
p2.insert_text((320, 380), "METAL ROOF", fontsize=20)
p2.insert_text((600, 350), "SLOPE 6:12", fontsize=20)
p2.draw_line((600, 330), (700, 330), width=2)
p2.insert_text((60, 700), "NOTE: STANDING SEAM METAL ROOF - SEE SPEC SECTION 07 41 13", fontsize=14)
doc.save(os.path.join(OUT, "fx_c_roofplan.pdf"))

# ---------- (d) irrelevant ----------
img = Image.new("RGB", (1200, 900), (210, 225, 240))
d = ImageDraw.Draw(img)
d.ellipse([400, 250, 800, 650], fill=(240, 190, 90), outline=(120, 80, 20), width=6)  # a pizza-ish circle
for _ in range(25):
    x, y = random.randint(450, 750), random.randint(300, 600)
    if (x - 600) ** 2 + (y - 450) ** 2 < 170 ** 2:
        d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=(190, 40, 40))
d.text((600, 120), "LUNCH SPECIAL $7.99", fill="black", font=arialb(48), anchor="mm")
img.save(os.path.join(OUT, "fx_d_irrelevant.png"))
print("done", os.listdir(OUT))
