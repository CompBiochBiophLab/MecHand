"""API tests with a fake MolScribe model (no 1.1 GB checkpoint needed).

Run:  pip install -r requirements-dev.txt && pytest
"""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import main
from molscribe_service import parse_atom_symbol


class FakeMolScribe:
    """Returns MolScribe's output format for bromomethane."""

    def predict_image(self, image, return_atoms_bonds=False, return_confidence=False):
        assert image.ndim == 3 and image.shape[2] == 3  # RGB numpy array
        return {
            "smiles": "CBr",
            "molfile": "",
            "confidence": 0.93,
            "atoms": [
                {"atom_symbol": "C", "x": 0.2, "y": 0.5},
                {"atom_symbol": "[Br]", "x": 0.8, "y": 0.5},
            ],
            "bonds": [{"bond_type": "single", "endpoint_atoms": (0, 1)}],
        }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main.molscribe, "load", lambda: None)
    main.molscribe._model = FakeMolScribe()
    with TestClient(main.app) as c:
        yield c


def png_bytes() -> bytes:
    img = Image.new("RGB", (200, 120), "white")
    d = ImageDraw.Draw(img)
    d.line((40, 60, 160, 60), fill="black", width=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "models_loaded": True}


def test_recognize(client):
    r = client.post("/recognize", files={"image": ("sketch.png", png_bytes(), "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["smiles"] == "CBr"
    assert [a["symbol"] for a in body["atoms"]] == ["C", "Br"]
    assert body["bonds"] == [{"beginAtom": 0, "endAtom": 1, "type": "single"}]
    assert isinstance(body["arrows"], list)


def test_rejects_non_images(client):
    r = client.post("/recognize", files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400


@pytest.mark.parametrize("raw,expected", [
    ("C", ("C", 0, None)),
    ("[O-]", ("O", -1, None)),
    ("[NH3+]", ("N", 1, None)),
    ("[13CH3]", ("C", 0, 13)),
    ("[C@@H]", ("C", 0, None)),
    ("[Fe+2]", ("Fe", 2, None)),
    ("[OMe]", ("OMe", 0, None)),
])
def test_parse_atom_symbol(raw, expected):
    assert parse_atom_symbol(raw) == expected
