"""Contact sheet of PNG stills: python contact.py out.png img1 img2 ..."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
cols = 3; tw, th = 640, 360
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 24)), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th))
    x, y = i % cols * tw, i // cols * (th + 24)
    sheet.paste(im, (x, y + 24)); d.text((x + 4, y + 4), f.split("/")[-1], fill=(0, 0, 0))
sheet.save(out)
