import uuid
import random
import time
from typing import Dict, Optional

CHALLENGE_ACTIONS = {
    "BLINK": "Blink your eyes naturally toward the camera",
    "TURN_LEFT": "Turn your head slightly to the left",
    "TURN_RIGHT": "Turn your head slightly to the right",
    "SMILE": "Smile gently at the camera",
}

class ChallengeService:
    def __init__(self, ttl_seconds: int = 180):
        self.ttl_seconds = ttl_seconds
        # In-memory store: challenge_id -> { employee_id, action, created_at, expires_at }
        self._challenges: Dict[str, dict] = {}

    def create_challenge(self, employee_id: str) -> dict:
        self._cleanup_expired()
        
        challenge_id = str(uuid.uuid4())
        action, instruction = random.choice(list(CHALLENGE_ACTIONS.items()))
        now = time.time()
        
        challenge_data = {
            "challenge_id": challenge_id,
            "employee_id": employee_id,
            "action": action,
            "instruction": instruction,
            "created_at": now,
            "expires_at": now + self.ttl_seconds,
        }
        
        self._challenges[challenge_id] = challenge_data
        return {
            "challenge_id": challenge_id,
            "employee_id": employee_id,
            "action": action,
            "instruction": instruction,
            "expires_in_seconds": self.ttl_seconds,
        }

    def validate_and_consume(self, challenge_id: str, employee_id: str, candidate_ids: Optional[list] = None) -> Optional[dict]:
        self._cleanup_expired()
        
        challenge = self._challenges.get(challenge_id)
        if not challenge:
            return None
            
        allowed = set([employee_id] + (candidate_ids or []))
        if challenge["employee_id"] not in allowed:
            return None
            
        if time.time() > challenge["expires_at"]:
            del self._challenges[challenge_id]
            return None
            
        # One-time use: consume challenge
        del self._challenges[challenge_id]
        return challenge

    def _cleanup_expired(self):
        now = time.time()
        expired = [cid for cid, c in self._challenges.items() if now > c["expires_at"]]
        for cid in expired:
            del self._challenges[cid]

challenge_service = ChallengeService(ttl_seconds=180)
