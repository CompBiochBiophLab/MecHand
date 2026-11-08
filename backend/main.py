"""
MecHand backend — FastAPI service wrapping MolScribe + arrow detector.

Endpoints
---------
POST /recognize   receive a PNG sketch, return structured molecule + arrows
GET  /health      liveness probe

Run locally (Python 3.10–3.12):
    pip install -r requirements.txt
    uvicorn main:app --port 8000

The server loads MolScribe before it starts answering requests; the first run
downloads the ~1.1 GB checkpoint, so /health only responds once the model is ready.

Docker:
    docker build -t mechand-backend .
    docker run -p 8000:8000 mechand-backend
"""

from __future__ import annotations

import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from arrow_detector import ArrowDetector
from molscribe_service import MolScribeService

molscribe = MolScribeService()
arrow_detector = ArrowDetector()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print("[MecHand] Loading MolScribe (the first run downloads ~1.1 GB)...")
    molscribe.load()
    print("[MecHand] MolScribe ready.")
    yield


app = FastAPI(
    title="MecHand Recognition API",
    version="0.1.0",
    description="Sketch recognition backend for MecHand (Ketcher extension).",
    lifespan=lifespan,
)

# Allow the MecHand frontend (any origin in dev; restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": molscribe.loaded}


@app.post("/recognize")
def recognize(image: UploadFile = File(...)):
    """
    Accept a PNG of freehand strokes; return a structured recognition result.

    Response schema
    ---------------
    {
      "smiles":     str,
      "molfile":    str,           # MDL molfile from MolScribe
      "atoms":      [{"symbol", "x", "y", "charge", "isotope"}, ...],
      "bonds":      [{"beginAtom", "endAtom", "type"}, ...],
      "arrows":     [{"path", "fromAtom", "toAtom"}, ...],
      "confidence": float          # 0–1
    }

    Declared with `def` (not `async def`) so FastAPI runs the CPU-heavy model in
    a worker thread instead of blocking the event loop.
    """
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only image uploads are accepted.")

    try:
        pil_img = Image.open(io.BytesIO(image.file.read())).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Cannot decode image: {e}")

    mol_result = molscribe.predict(pil_img)            # structure recognition
    arrow_result = arrow_detector.detect(pil_img)      # curved mechanism arrows

    return {**mol_result, "arrows": arrow_result["arrows"]}
