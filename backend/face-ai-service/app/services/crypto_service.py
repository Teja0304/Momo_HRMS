import os
import json
import base64
import hashlib
from typing import List
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

class BiometricCryptoService:
    def __init__(self):
        # Derive a 256-bit (32 bytes) key from the secret
        secret = getattr(settings, "FACE_ENCRYPTION_KEY", None) or settings.FACE_JWT_SECRET
        self.key = hashlib.sha256(secret.encode("utf-8")).digest()
        self.aesgcm = AESGCM(self.key)

    def encrypt_embedding(self, embedding: List[float]) -> dict:
        """
        Encrypts a 512-D float vector using AES-256-GCM with a random 96-bit nonce.
        Returns a dict suitable for storing in a JSON column.
        """
        raw_json = json.dumps(embedding).encode("utf-8")
        nonce = os.urandom(12)  # Standard 96-bit nonce for AES-GCM
        ciphertext = self.aesgcm.encrypt(nonce, raw_json, None)
        
        return {
            "algorithm": "AES-256-GCM",
            "encrypted": True,
            "nonce": base64.b64encode(nonce).decode("utf-8"),
            "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
        }

    def decrypt_embedding(self, stored_payload) -> List[float]:
        """
        Decrypts stored biometric embedding from AES-256-GCM.
        Backwards-compatible if payload was stored as a raw list of floats.
        """
        # If already a list of floats (legacy/unencrypted), return as is
        if isinstance(stored_payload, list):
            return stored_payload
            
        if isinstance(stored_payload, dict) and stored_payload.get("encrypted"):
            nonce = base64.b64decode(stored_payload["nonce"])
            ciphertext = base64.b64decode(stored_payload["ciphertext"])
            decrypted_bytes = self.aesgcm.decrypt(nonce, ciphertext, None)
            return json.loads(decrypted_bytes.decode("utf-8"))
            
        raise ValueError("Invalid embedding storage format")

biometric_crypto = BiometricCryptoService()
