import os
import uuid

from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_image(upload):
    if upload.size > MAX_IMAGE_BYTES:
        raise ValidationError("Image trop lourde (2 Mo maximum).")

    try:
        image = Image.open(upload)
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ValidationError("Dimensions d'image trop importantes.")
        image_format = image.format
        image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValidationError("Fichier image invalide.") from None
    finally:
        upload.seek(0)

    if image_format not in ALLOWED_FORMATS:
        raise ValidationError("Format non autorisé.")


def dish_image_path(instance, filename):
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        extension = ".bin"
    return f"dishes/{uuid.uuid4().hex}{extension}"
