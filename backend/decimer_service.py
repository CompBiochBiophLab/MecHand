"""
decimer_service.py
Optional server-side structure recognition with DECIMER.

DECIMER (Deep lEarning for Chemical ImagE Recognition), Rajan, Brinkhaus et al.:
  - DECIMER.ai, Nat. Commun. 2023, 14, 5045.
  - Hand-drawn model: J. Cheminform. 2024, 16, 78.
  https://github.com/Kohulan/DECIMER-Image_Transformer (MIT licence)

MecHand's default recognizer runs in the browser and reads the strokes. This
service is an alternative engine for the *structure* part: it receives a PNG of
the ink and returns a SMILES string. Model weights (~285 MB per model) are
downloaded on first use into $PYSTOW_HOME/DECIMER-V2 (~/.data by default).

Set MECHAND_HAND_DRAWN=0 to use DECIMER's printed-structure model instead.
"""

from __future__ import annotations

import importlib.metadata
import os
from typing import Any

import numpy as np
from PIL.Image import Image as PILImage


def graph_from_smiles(smiles: str) -> dict[str, Any]:
    """SMILES → molfile plus atoms/bonds with 2D coordinates (RDKit)."""
    from rdkit import Chem
    from rdkit.Chem import AllChem

    mol = Chem.MolFromSmiles(smiles) if smiles else None
    if mol is None:
        return {"molfile": "", "atoms": [], "bonds": [], "valid": False}
    AllChem.Compute2DCoords(mol)
    conf = mol.GetConformer()
    atoms = [
        {
            "symbol": a.GetSymbol(),
            "x": conf.GetAtomPosition(a.GetIdx()).x,
            "y": conf.GetAtomPosition(a.GetIdx()).y,
            "charge": a.GetFormalCharge(),
            "isotope": a.GetIsotope() or None,
        }
        for a in mol.GetAtoms()
    ]
    order = {
        Chem.BondType.SINGLE: "single",
        Chem.BondType.DOUBLE: "double",
        Chem.BondType.TRIPLE: "triple",
        Chem.BondType.AROMATIC: "aromatic",
    }
    bonds = [
        {"beginAtom": b.GetBeginAtomIdx(), "endAtom": b.GetEndAtomIdx(), "type": order.get(b.GetBondType(), "single")}
        for b in mol.GetBonds()
    ]
    return {"molfile": Chem.MolToMolBlock(mol), "atoms": atoms, "bonds": bonds, "valid": True}


class DecimerService:
    """Wraps DECIMER and returns MecHand's JSON schema."""

    def __init__(self, hand_drawn: bool | None = None) -> None:
        self.hand_drawn = (os.environ.get("MECHAND_HAND_DRAWN", "1") != "0") if hand_drawn is None else hand_drawn
        self._loaded = False

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def engine(self) -> str:
        try:
            version = importlib.metadata.version("decimer")
        except importlib.metadata.PackageNotFoundError:
            version = "not installed"
        return f"DECIMER {version} ({'hand-drawn' if self.hand_drawn else 'printed'} model)"

    def load(self) -> None:
        """Download (first run only) and load the model."""
        if self._loaded:
            return
        try:
            import DECIMER
        except ImportError as e:
            raise RuntimeError("DECIMER is not installed: pip install -r requirements.txt") from e
        DECIMER.load_models(printed=not self.hand_drawn, hand_drawn=self.hand_drawn)
        self._loaded = True

    def predict(self, image: PILImage) -> dict[str, Any]:
        self.load()
        from DECIMER import predict_SMILES

        rgb = np.array(image.convert("RGB"))
        smiles, tokens = predict_SMILES(rgb, confidence=True, hand_drawn=self.hand_drawn)
        scores = [float(score) for _, score in tokens] if tokens else []
        graph = graph_from_smiles(smiles)
        confidence = float(np.mean(scores)) if scores and graph["valid"] else 0.0
        return {"smiles": smiles, "confidence": confidence, "engine": self.engine, **graph}
