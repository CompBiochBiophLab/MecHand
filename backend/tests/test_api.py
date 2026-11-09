"""API tests with a fake DECIMER model (no TensorFlow or model download needed).

Run:  pip install -r requirements-dev.txt && pytest
"""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import main
from decimer_service import graph_from_smiles


class FakeDecimer:
    """Stands in for DecimerService.predict: 'reads' bromomethane."""

    loaded = True
    engine = "fake DECIMER"

    def load(self):
        pass

    def predict(self, image):
        return {"smiles": "CBr", "confidence": 0.9, "engine": self.engine, **graph_from_smiles("CBr")}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "decimer", FakeDecimer())
    with TestClient(main.app) as c:
        yield c


def png_bytes() -> bytes:
    img = Image.new("RGB", (200, 120), "white")
    ImageDraw.Draw(img).line((40, 60, 160, 60), fill="black", width=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "models_loaded": True, "engine": "fake DECIMER"}


def test_recognize(client):
    r = client.post("/recognize", files={"image": ("sketch.png", png_bytes(), "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["smiles"] == "CBr"
    assert body["valid"] is True
    assert sorted(a["symbol"] for a in body["atoms"]) == ["Br", "C"]
    assert body["bonds"] == [{"beginAtom": 0, "endAtom": 1, "type": "single"}]
    assert "M  END" in body["molfile"]


def test_rejects_non_images(client):
    r = client.post("/recognize", files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_private_network_preflight(client):
    r = client.options("/recognize", headers={
        "Origin": "https://compbiochbiophlab.github.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Private-Network": "true",
    })
    assert r.headers.get("access-control-allow-private-network") == "true"


@pytest.mark.parametrize("smiles,ok", [("C1CCC(CC1)O", True), ("CC(=O)[O-]", True), ("C1CC(", False), ("", False)])
def test_graph_from_smiles(smiles, ok):
    g = graph_from_smiles(smiles)
    assert g["valid"] is ok
    assert (len(g["atoms"]) > 0) is ok
