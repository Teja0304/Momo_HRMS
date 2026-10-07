import os
import cv2
import numpy as np
from typing import List, Optional

class FaceEngine:
    def __init__(self):
        weights_dir = os.path.join(os.path.dirname(__file__), "..", "weights")
        self.yunet_path = os.path.join(weights_dir, "face_detection_yunet_2023mar.onnx")
        self.sface_path = os.path.join(weights_dir, "face_recognition_sface_2021dec.onnx")

        if not os.path.exists(self.yunet_path) or not os.path.exists(self.sface_path):
            raise FileNotFoundError(f"Face model weights not found in {weights_dir}")

        # Initialize YuNet deep face detector and 5-landmark estimator
        self.detector = cv2.FaceDetectorYN.create(
            self.yunet_path, "", (320, 320), score_threshold=0.5, nms_threshold=0.3, top_k=5000
        )
        # Initialize SFace deep face recognizer (MobileFaceNet trained with ArcFace loss)
        self.recognizer = cv2.FaceRecognizerSF.create(self.sface_path, "")

        # Haar cascade fallback
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        self.embedding_dim = 128

    def detect_face(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Detects primary face using YuNet.
        Returns face array [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
        """
        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        ret, faces = self.detector.detect(image)
        if faces is not None and len(faces) > 0:
            # Pick largest face by area
            best_face = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
            return best_face

        # Fallback to Haar cascade if YuNet doesn't trigger
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h_faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=4, minSize=(60, 60))
        if len(h_faces) > 0:
            (x, y, fw, fh) = sorted(h_faces, key=lambda f: f[2] * f[3], reverse=True)[0]
            synth_face = np.array([
                float(x), float(y), float(fw), float(fh),
                float(x + fw * 0.30), float(y + fh * 0.35), # right eye
                float(x + fw * 0.70), float(y + fh * 0.35), # left eye
                float(x + fw * 0.50), float(y + fh * 0.55), # nose tip
                float(x + fw * 0.35), float(y + fh * 0.75), # right mouth corner
                float(x + fw * 0.65), float(y + fh * 0.75), # left mouth corner
                0.90 # confidence
            ], dtype=np.float32)
            return synth_face

        return None

    def extract_embedding(self, image: np.ndarray) -> Optional[List[float]]:
        """
        Detects face, performs 5-point affine alignment, and extracts
        128-dimensional deep metric embedding using SFace.
        """
        face = self.detect_face(image)
        if face is None:
            return None

        # Canonical alignment to 112x112 using facial landmarks
        aligned_face = self.recognizer.alignCrop(image, face)

        # Extract 128-D feature representation
        feature = self.recognizer.feature(aligned_face) # shape (1, 128)
        vec = feature[0]

        # L2-normalize to unit hypersphere
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        return vec.tolist()

    def compute_similarity(self, embedding_a: List[float], embedding_b: List[float]) -> float:
        """
        Computes Cosine Similarity between two 128-D deep embeddings.
        - Identical identity typically scores > 0.40 (up to 0.95+)
        - Different identities score < 0.363 (typically 0.0 to 0.25)
        """
        if not embedding_a or not embedding_b:
            return 0.0
        if len(embedding_a) != len(embedding_b):
            # Model dimension mismatch (e.g. legacy 512-D vs new 128-D)
            return 0.0

        vec_a = np.array(embedding_a, dtype=np.float32).reshape(1, -1)
        vec_b = np.array(embedding_b, dtype=np.float32).reshape(1, -1)

        sim = self.recognizer.match(vec_a, vec_b, cv2.FaceRecognizerSF_FR_COSINE)
        return float(np.clip(sim, -1.0, 1.0))

face_engine = FaceEngine()
