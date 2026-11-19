"""Check the shipped Corte PNG and ICO pixels against their SVG layers."""

from collections import deque
from io import BytesIO
from pathlib import Path
from subprocess import run
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent
SVG = "{http://www.w3.org/2000/svg}"
ET.register_namespace("", SVG[1:-1])
SIZES = (16, 32, 48, 64, 128, 256, 512, 1024)
ICO_SIZES = SIZES[:6]
WHITE = (244, 246, 255, 255)
CORAL = (255, 158, 171, 255)


def rasterize(source, size):
	process = run(
		["rsvg-convert", "-w", str(size), "-h", str(size)],
		input=ET.tostring(source),
		capture_output=True,
		check=True,
	)
	with Image.open(BytesIO(process.stdout)) as image:
		return image.convert("RGBA")


def same_pixels(first, second):
	return ImageChops.difference(first, second).getbbox(alpha_only=False) is None


def check_join(core, coral, size):
	"""Find one coral region and a join to the white part of the letter."""
	start = next(iter(coral))
	seen = {start}
	pending = deque([start])
	touches_white = False
	while pending:
		x, y = pending.popleft()
		edges = ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
		corners = ((x - 1, y - 1), (x - 1, y + 1), (x + 1, y - 1), (x + 1, y + 1))
		for point in (*edges, *corners):
			if point in coral and point not in seen:
				seen.add(point)
				pending.append(point)
		touches_white |= any(core.get(point, 0) >= 244 for point in edges)
	assert seen == coral, f"{size}px: coral desconectado"
	assert touches_white, f"{size}px: falta contacto con la R blanca"


def check_overlay(asset, mask, underlay, size):
	core = {}
	coral = set()
	opaque_coral = 0
	for index, (pixel, base, coverage) in enumerate(zip(
		asset.get_flattened_data(), underlay.get_flattened_data(), mask.getchannel("A").get_flattened_data(),
	)):
		if not coverage:
			assert pixel == base, f"{size}px: coral fuera de la silueta en el píxel {index}"
			continue
		if size <= 48:
			assert coverage == 255 and pixel in (CORAL, WHITE), f"{size}px: tinta fraccionaria en el píxel {index}"
		if coverage != 255:
			continue

		x, y = index % size, index // size
		red, green, blue, alpha = pixel
		assert base == WHITE and alpha == 255, f"{size}px: hueco en ({x}, {y})"
		# Inside the opaque letter, green identifies the antialias blend.
		# The other channels must agree with the same blend of the two inks.
		amount = (WHITE[1] - green) / (WHITE[1] - CORAL[1])
		assert (
			0 <= amount <= 1
			and abs(red - (WHITE[0] + amount * (CORAL[0] - WHITE[0]))) <= 2
			and abs(blue - (WHITE[2] + amount * (CORAL[2] - WHITE[2]))) <= 2
		), f"{size}px: color ajeno a las dos tintas en ({x}, {y})"
		core[x, y] = green
		if amount >= .5:
			coral.add((x, y))
		opaque_coral += pixel == CORAL
	assert opaque_coral >= 4, f"{size}px: cobertura coral insuficiente"
	check_join(core, coral, size)
	return opaque_coral


def check_version(folder):
	counts = []
	with Image.open(folder / "icon.ico") as ico, Image.open(folder / "icon-16.png") as master_grid:
		assert ico.ico.sizes() == {(size, size) for size in ICO_SIZES}
		for size in SIZES:
			source = ET.parse(folder / ("icon-small.svg" if size <= 48 else "icon.svg")).getroot()
			with Image.open(folder / f"icon-{size}.png") as asset:
				assert asset.size == (size, size) and asset.mode == "RGBA"
				assert same_pixels(asset, rasterize(source, size))
				if size <= 48:
					assert same_pixels(asset, master_grid.resize(asset.size, Image.Resampling.NEAREST))
				if size in ICO_SIZES:
					assert same_pixels(asset, ico.ico.getimage(asset.size).convert("RGBA"))

				inks = source.find(f"{SVG}g")
				inks.remove(inks.find(f"{SVG}path[@id='accent']"))
				underlay = rasterize(source, size)
				for layer in list(source.findall(f"{SVG}path")):
					source.remove(layer)
				mask = rasterize(source, size)
				counts.append(check_overlay(asset, mask, underlay, size))
	print(folder.name, *counts, sep=" | ")


if __name__ == "__main__":
	print("PNG en px", *SIZES, sep=" | ")
	for version in (ROOT, ROOT / "variantes/banda", ROOT / "variantes/puntera"):
		check_version(version)
