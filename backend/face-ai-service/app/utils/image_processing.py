import base64
import io
import cv2
import numpy as np
from PIL import Image

def decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decodes base64 string (with or without data:image/jpeg;base64, header)
    into a BGR OpenCV NumPy array.
    """
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    
    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb_array = np.array(image)
    bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    return bgr_array

def resize_if_needed(image: np.ndarray, max_dim: int = 640) -> np.ndarray:
    """
    Downsamples the image proportionally if it exceeds max_dim to keep
    inference lightweight and fast.
    """
    h, w = image.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return image
