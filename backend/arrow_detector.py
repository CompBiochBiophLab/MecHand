"""
arrow_detector.py
Detects curved mechanism arrows in a sketch image.

Current implementation: rule-based contour + curvature analysis via OpenCV.
Planned: replace with a fine-tuned model on the SMiCRM dataset
(SMiCRM: A Benchmark Dataset of Mechanistic Molecular Images, arXiv 2407.18338).

The detector returns arrow paths as SVG path strings so the frontend can
overlay them on the Ketcher canvas and let the user associate them with atoms.
"""

from __future__ import annotations
import cv2
import numpy as np
from PIL.Image import Image as PILImage


class ArrowDetector:
    """
    Detects curved arrows in a sketch.

    Strategy
    --------
    1. Threshold to binary (Otsu).
    2. Find contours.
    3. For each contour, compute:
       - Aspect ratio and arc/chord ratio to distinguish curved strokes.
       - Presence of a sharp endpoint (arrowhead) via convexity defects.
    4. Convert qualifying contours to simplified SVG path strings.
    """

    def __init__(
        self,
        min_arc_length: int = 40,
        min_curvature: float = 0.25,   # 1 − chord/arc; higher = more curved
        arrowhead_angle_threshold: float = 0.4,  # radians
    ):
        self.min_arc = min_arc_length
        self.min_curv = min_curvature
        self.arrow_thresh = arrowhead_angle_threshold

    def detect(self, image: PILImage) -> dict:
        img_np = np.array(image.convert("L"))
        _, binary = cv2.threshold(img_np, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        arrows = []
        for cnt in contours:
            arc = cv2.arcLength(cnt, closed=False)
            if arc < self.min_arc:
                continue

            # Chord (start-to-end distance)
            start = cnt[0][0]
            end   = cnt[-1][0]
            chord = float(np.linalg.norm(end - start))
            if chord < 1:
                continue
            curvature = 1.0 - chord / arc
            if curvature < self.min_curv:
                continue

            # Check for arrowhead: sharp direction change at endpoint
            if not self._has_arrowhead(cnt):
                continue

            path = self._contour_to_svg_path(cnt)
            arrows.append({"path": path, "fromAtom": None, "toAtom": None})

        return {"arrows": arrows}

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _has_arrowhead(self, cnt: np.ndarray) -> bool:
        """Checks for a sharp direction change in the last 15% of the contour."""
        n = len(cnt)
        if n < 10:
            return False
        tail_start = int(n * 0.85)
        main_vec  = cnt[-1][0] - cnt[0][0]
        tail_vec  = cnt[-1][0] - cnt[tail_start][0]
        norm_main = np.linalg.norm(main_vec)
        norm_tail = np.linalg.norm(tail_vec)
        if norm_main < 1 or norm_tail < 1:
            return False
        cos_a = np.dot(main_vec, tail_vec) / (norm_main * norm_tail)
        angle = np.arccos(np.clip(cos_a, -1, 1))
        return self.arrow_thresh < angle < (np.pi - self.arrow_thresh)

    @staticmethod
    def _contour_to_svg_path(cnt: np.ndarray) -> str:
        """Convert a simplified contour to an SVG path string (M + L commands)."""
        pts = cnt[:, 0, :]
        # Simplify to ≤30 points with Ramer-Douglas-Peucker
        eps = max(2.0, cv2.arcLength(cnt, False) * 0.02)
        simplified = cv2.approxPolyDP(cnt, eps, closed=False)[:, 0, :]
        cmds = [f"M {simplified[0][0]:.1f} {simplified[0][1]:.1f}"]
        for p in simplified[1:]:
            cmds.append(f"L {p[0]:.1f} {p[1]:.1f}")
        return " ".join(cmds)
