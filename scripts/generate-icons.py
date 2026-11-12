"""Rebuild PWA icons from code, using Pillow on the development machine only."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / 'apps/web/public'
for size in (192, 512):
    factor = size / 64
    image = Image.new('RGB', (size, size), '#a3d8bc')
    draw = ImageDraw.Draw(image)
    points = [(14, 31), (32, 15), (50, 31), (50, 50), (37, 50), (37, 37), (27, 37), (27, 50), (14, 50), (14, 31)]
    draw.line([(int(x*factor), int(y*factor)) for x, y in points], fill='#172824', width=int(4*factor), joint='curve')
    image.save(destination / f'icon-{size}.png')
