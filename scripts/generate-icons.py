"""Turn the pen sketch in draft/IMG_2116.JPG into every icon asset.

The drawing is a cat, inked on ruled paper. This lifts the pen strokes off the
paper (the ruled lines are far lighter than the ink, so a darkness threshold
separates them), thickens them enough to read at icon sizes, and paints them in
the app's text color over its soft lavender.

    python3 scripts/generate-icons.py
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SKETCH = ROOT / 'draft' / 'IMG_2116.JPG'
ASSETS = ROOT / 'assets'

BG = (231, 234, 251)  # theme primarySoft
INK = (19, 26, 42)  # theme text
BLACK = (0, 0, 0)

# Ink is darker than INK_FULL; paper and ruled lines are lighter than INK_NONE.
INK_FULL = 45
INK_NONE = 105

# The photo also caught the edge of a neighbouring doodle. Keep the cat only.
# These are the photo's own pixels, before it is turned upright.
ROI = (1000, 700, 2900, 2400)  # left, top, right, bottom

# Pen width as a fraction of the drawing's long side, measured off the photo.
PEN = 0.011

# Dust on the paper. The four real marks are two strokes and two dots.
SPECK = 1000  # px

SUPERSAMPLE = 3


def sketch_mask():
    """The pen strokes as an alpha mask, cropped to the drawing."""
    gray = np.asarray(Image.open(SKETCH).convert('L').crop(ROI)).astype(np.float32)
    # Map [INK_FULL, INK_NONE] onto [opaque, transparent], with a soft edge.
    alpha = np.clip((INK_NONE - gray) / (INK_NONE - INK_FULL), 0, 1)

    labels, count = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
    areas = ndimage.sum(alpha > 0, labels, range(1, count + 1))
    keep = np.concatenate(([False], areas >= SPECK))
    alpha *= keep[labels]

    mask = Image.fromarray((alpha * 255).astype(np.uint8))
    # The phone was held sideways (EXIF orientation 6), so the cat is on its
    # side in the pixels. Turn it a quarter clockwise to stand it up.
    mask = mask.transpose(Image.ROTATE_270)
    return mask.crop(mask.getbbox())


def render(mask, size, ink, background=None, coverage=0.72, stroke=0.030):
    """Center the strokes on a square canvas of `size` px.

    `coverage` is the drawing's long side as a fraction of the canvas.
    `stroke` is the pen width wanted, as a fraction of that long side.
    """
    s = size * SUPERSAMPLE
    long_side = s * coverage
    width, height = mask.size
    scale = long_side / max(width, height)
    shape = (max(1, round(width * scale)), max(1, round(height * scale)))
    strokes = mask.resize(shape, Image.LANCZOS)

    # Dilate until the line is as heavy as `stroke` asks for. A round footprint
    # keeps the ends of the pen strokes round.
    grow = round(long_side * (stroke - PEN) / 2)
    if grow > 0:
        span = np.arange(-grow, grow + 1)
        disk = span[:, None] ** 2 + span[None, :] ** 2 <= grow * grow
        grown = ndimage.grey_dilation(np.asarray(strokes), footprint=disk)
        strokes = Image.fromarray(grown)

    alpha = Image.new('L', (s, s), 0)
    alpha.paste(strokes, ((s - shape[0]) // 2, (s - shape[1]) // 2))

    canvas = Image.new('RGBA', (s, s), (*background, 255) if background else (0, 0, 0, 0))
    layer = Image.new('RGBA', (s, s), (*ink, 0))
    layer.putalpha(alpha)
    canvas.alpha_composite(layer)
    return canvas.resize((size, size), Image.LANCZOS)


def write(image, name):
    path = ASSETS / name
    image.save(path)
    print(f'{path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}')


def main():
    if not SKETCH.exists():
        raise SystemExit(f'Sketch not found: {SKETCH.relative_to(ROOT)}')
    mask = sketch_mask()
    print(f'sketch ink {mask.size[0]}x{mask.size[1]}')
    write(render(mask, 1024, INK, BG, 0.72, 0.030).convert('RGB'), 'icon.png')
    write(render(mask, 1024, INK, None, 0.68, 0.030), 'splash-icon.png')
    write(render(mask, 48, INK, BG, 0.80, 0.052).convert('RGB'), 'favicon.png')
    # Adaptive icons keep their content inside the middle two thirds.
    write(render(mask, 512, INK, None, 0.52, 0.034), 'android-icon-foreground.png')
    write(Image.new('RGB', (512, 512), BG), 'android-icon-background.png')
    write(render(mask, 432, BLACK, None, 0.52, 0.040), 'android-icon-monochrome.png')


if __name__ == '__main__':
    main()
