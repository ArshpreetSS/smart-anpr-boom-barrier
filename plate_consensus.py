"""Time-bounded, confidence-aware voting for one camera stream.

Recognition format validation happens upstream. A new instance must be used for
each stream so cameras and reconnects cannot contribute to each other's votes.
"""

from collections import Counter, deque
from dataclasses import dataclass
import math
import re
import time
from typing import Callable, Optional


@dataclass(frozen=True)
class Consensus:
    plate: str
    count: int
    confidence: float


class PlateConsensus:
    def __init__(
        self,
        min_count: int = 3,
        window_size: int = 7,
        max_age_seconds: float = 5.0,
        min_confidence: float = 0.75,
        min_share: float = 0.6,
        clock: Callable[[], float] = time.monotonic,
    ):
        if min_count < 1 or window_size < min_count:
            raise ValueError("The voting window must hold the required observations")
        if not math.isfinite(max_age_seconds) or max_age_seconds <= 0:
            raise ValueError("Observation lifetime must be positive and finite")
        if not 0 <= min_confidence <= 1 or not 0.5 < min_share <= 1:
            raise ValueError("Confidence must be 0..1 and support must exceed half")
        self.min_count = min_count
        self.max_age_seconds = max_age_seconds
        self.min_confidence = min_confidence
        self.min_share = min_share
        self._clock = clock
        self._observations = deque(maxlen=window_size)

    def _expire(self, now: float) -> None:
        while self._observations and now - self._observations[0][0] >= self.max_age_seconds:
            self._observations.popleft()

    def observe(self, plate: Optional[str], confidence: float, is_valid: bool) -> Optional[Consensus]:
        """Append exactly one observation per frame, including empty frames."""
        now = self._clock()
        self._expire(now)
        normalized = re.sub(r"[^A-Z0-9]", "", (plate or "").upper())
        accepted = (
            is_valid and normalized and math.isfinite(confidence)
            and self.min_confidence <= confidence <= 1.0
        )
        self._observations.append((now, normalized if accepted else "", confidence if accepted else 0.0))
        return self.get_consensus()

    @property
    def current_count(self) -> int:
        """Support for the currently visible plate, never for a stale winner."""
        self._expire(self._clock())
        if not self._observations or not self._observations[-1][1]:
            return 0
        current = self._observations[-1][1]
        return sum(plate == current for _, plate, _ in self._observations)

    def get_consensus(self) -> Optional[Consensus]:
        self._expire(self._clock())
        if not self._observations or not self._observations[-1][1]:
            return None
        current = self._observations[-1][1]
        counts = Counter(plate for _, plate, _ in self._observations if plate)
        count = counts[current]
        if count < self.min_count or count / len(self._observations) < self.min_share:
            return None
        # Strict dominance also rejects ties if the support policy changes.
        if any(other != current and frequency >= count for other, frequency in counts.items()):
            return None
        confidence = min(conf for _, plate, conf in self._observations if plate == current)
        return Consensus(current, count, confidence)
