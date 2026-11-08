"""
MecHand backend — FastAPI service wrapping MolScribe + arrow detector.

Endpoints
---------
POST /recognize   receive PNG sketch, return structured molecule + arrows
GET  /health      liveness probe

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Docker:
    docker build -t mechhand-backend .
    docker run -p 8000:8000 mechhand-backend
"""

import io
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from molscribe_service import MolScribeService
from arrow_detector import ArrowDetector

app = FastAPI(
    title="MecHand Recognition API",
    version="0.1.0",
    description="Sketch recognition backend for MecHand (Ketcher extension).",
)

# Allow the Ketcher frontend (any origin in dev; restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Lazy-load heavy models once at startup ─────────────────────────────────────

_molscribe: MolScribeService | None = None
_arrow_detector: ArrowDetector | None = None


@app.on_event("startup")
async def load_models():
    global _molscribe, _arrow_detector
    _molscribe = MolScribeService()
    _arrow_detector = ArrowDetector()


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": _molscribe is not None}


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    """
    Accept a PNG of freehand strokes; return a structured recognition result.

    Response schema
    ---------------
    {
      "smiles":     str,
      "atoms":      [{"symbol", "x", "y", "charge", "isotope"}, ...],
      "bonds":      [{"beginAtom", "endAtom", "type"}, ...],
      "arrows":     [{"path", "fromAtom", "toAtom"}, ...],
      "confidence": float          # 0–1
    }
    """
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "Only image uploads are accepted.")

    raw = await image.read()
    try:
        pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Cannot decode image: {e}")

    # ── MolScribe: structure recognition ──────────────────────────────────────
    mol_result = _molscribe.predict(pil_img)

    # ── Arrow detector: curved mechanism arrows ────────────────────────────────
    arrow_result = _arrow_detector.detect(pil_img)

    return {
        "smiles":     mol_result["smiles"],
        "atoms":      mol_result["atoms"],
        "bonds":      mol_result["bonds"],
        "arrows":     arrow_result["arrows"],
        "confidence": mol_result["confidence"],
    }
