"""
MecHand optional recognition server — FastAPI + DECIMER.

MecHand works without this server: its default recognizer runs in the browser.
Run this only to try DECIMER's image-based structure recognition as an
alternative engine for the structures (About → Structure engine → DECIMER
server). Curved arrows and charges always come from the in-browser recognizer.

Endpoints
---------
GET  /health      liveness probe (answers once the model is loaded)
POST /recognize   PNG of the ink → SMILES, molfile, atoms, bonds

Run locally (Python 3.10–3.13):
    pip install -r requirements.txt
    uvicorn main:app --port 8000

The first start downloads the DECIMER hand-drawn model (~285 MB).

Docker:
    docker build -t mechand-server .
    docker run -p 8000:8000 mechand-server
"""

from __future__ import annotations

import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from decimer_service import DecimerService

decimer = DecimerService()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print(f"[MecHand] Loading {decimer.engine} (the first run downloads ~285 MB)...")
    decimer.load()
    print("[MecHand] Ready.")
    yield


app = FastAPI(
    title="MecHand Recognition Server",
    version="0.2.0",
    description="Optional image-based structure recognition for MecHand, using DECIMER.",
    lifespan=lifespan,
)

# The MecHand web app may be served from GitHub Pages or from localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.middleware("http")
async def private_network_access(request, call_next):
    """Allow https pages (e.g. GitHub Pages) to call this server on localhost.

    Chromium asks local servers for permission with a preflight carrying
    Access-Control-Request-Private-Network (Private Network Access).
    """
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": decimer.loaded, "engine": decimer.engine}


@app.post("/recognize")
def recognize(image: UploadFile = File(...)):
    """
    Accept a PNG of freehand strokes; return a structured recognition result.

    Response schema
    ---------------
    {
      "smiles":     str,
      "molfile":    str,           # MDL molfile with 2D coordinates (RDKit)
      "atoms":      [{"symbol", "x", "y", "charge", "isotope"}, ...],
      "bonds":      [{"beginAtom", "endAtom", "type"}, ...],
      "confidence": float,         # mean token confidence, 0–1 (0 if the SMILES is invalid)
      "valid":      bool,          # RDKit could parse the SMILES
      "engine":     str
    }

    Declared with `def` (not `async def`) so FastAPI runs the model in a
    worker thread instead of blocking the event loop.
    """
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only image uploads are accepted.")
    try:
        pil_img = Image.open(io.BytesIO(image.file.read())).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Cannot decode image: {e}")

    return decimer.predict(pil_img)
