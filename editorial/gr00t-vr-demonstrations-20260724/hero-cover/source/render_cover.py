"""Render the Sim XR article hero and its platform-specific crops."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent
BASE = ROOT / "hero-generated-base.png"
LOGO = ROOT / "sim-xr-logo.png"
DISPLAY_FONT = ROOT.parent.parent / "video/public/fonts/space-grotesk-700.ttf"
BODY_FONT = ROOT.parent.parent / "video/public/fonts/dm-sans-700.ttf"

WIDTH = 1920
HEIGHT = 1080
INK = "#09111f"
BLUE = "#1d65ff"


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def add_text_field(image: Image.Image) -> None:
    overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
    pixels = overlay.load()
    for y in range(0, 620):
        vertical = max(0.0, 1.0 - max(0, y - 520) / 100)
        for x in range(0, 1220):
            horizontal = max(0.0, 1.0 - max(0, x - 880) / 340)
            alpha = round(247 * min(vertical, horizontal))
            pixels[x, y] = (255, 255, 255, alpha)
    image.alpha_composite(overlay)


def render() -> Image.Image:
    base = cover(Image.open(BASE).convert("RGBA"), WIDTH, HEIGHT)
    add_text_field(base)
    draw = ImageDraw.Draw(base)

    logo = Image.open(LOGO).convert("RGBA")
    logo.thumbnail((215, 90), Image.Resampling.LANCZOS)
    base.alpha_composite(logo, (112, 58))

    label_font = ImageFont.truetype(str(BODY_FONT), 18)
    headline_font = ImageFont.truetype(str(DISPLAY_FONT), 54)
    detail_font = ImageFont.truetype(str(BODY_FONT), 27)
    simulation_font = ImageFont.truetype(str(BODY_FONT), 21)

    # Keep the photorealistic illustration explicitly inside the simulation
    # frame, including when the cover is reduced to a feed thumbnail.
    draw.rounded_rectangle((1450, 52, 1844, 104), radius=6, fill=BLUE)
    draw.text(
        (1476, 66),
        "ISAAC LAB / CLOUD SIMULATION",
        font=simulation_font,
        fill="#ffffff",
    )

    draw.text(
        (116, 178),
        "SIMULATION CASE STUDY",
        font=label_font,
        fill=BLUE,
        stroke_width=0,
    )
    draw.text(
        (110, 220),
        "FROM NVIDIA’S 208",
        font=headline_font,
        fill=INK,
        stroke_width=0,
    )
    draw.text(
        (110, 280),
        "DEMONSTRATIONS TO A NEW",
        font=headline_font,
        fill=INK,
        stroke_width=0,
    )
    draw.text(
        (110, 340),
        "SKILL WITH 50 REMOTE",
        font=headline_font,
        fill=INK,
        stroke_width=0,
    )
    draw.text(
        (110, 400),
        "VR EPISODES",
        font=headline_font,
        fill=INK,
        stroke_width=0,
    )

    draw.rounded_rectangle((116, 485, 172, 490), radius=2, fill=BLUE)
    draw.text(
        (116, 516),
        "Remote XR teleoperation → VLA fine-tuning",
        font=detail_font,
        fill="#14223a",
    )
    return base


master = render()
master.save(OUT / "hero-master-1920x1080.png", optimize=True)
master.convert("RGB").save(
    OUT / "hero-linkedin-article-1920x1080.jpg",
    quality=94,
    optimize=True,
    progressive=True,
)
master.resize((1600, 900), Image.Resampling.LANCZOS).convert("RGB").save(
    OUT / "hero-medium-1600x900.jpg",
    quality=94,
    optimize=True,
    progressive=True,
)

preview_height = round(WIDTH / (1200 / 627))
preview_top = (HEIGHT - preview_height) // 2
preview = master.crop((0, preview_top, WIDTH, preview_top + preview_height))
preview.resize((1200, 627), Image.Resampling.LANCZOS).convert("RGB").save(
    OUT / "hero-linkedin-link-preview-1200x627.jpg",
    quality=94,
    optimize=True,
    progressive=True,
)
