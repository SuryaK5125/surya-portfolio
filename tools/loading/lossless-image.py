"""Lossless encoding only. Any pixel difference fails the offline build."""
import io, sys
from PIL import Image
original = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
output = io.BytesIO()
original.save(output, format='WEBP', lossless=True, method=4, exact=True)
check = Image.open(io.BytesIO(output.getvalue())).convert('RGBA')
assert original.size == check.size and original.tobytes() == check.tobytes()
sys.stdout.buffer.write(output.getvalue())
