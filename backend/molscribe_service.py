"""
molscribe_service.py
Thin wrapper around the MolScribe model (Qian et al., 2023).

MolScribe: Robust Molecular Structure Recognition with Image-to-Graph Generation
Yujie Qian, Jiang Guo, Zhengkai Tu, et al.
J. Chem. Inf. Model. 2023, 63, 4321–4329.
https://github.com/thomas0809/MolScribe

Install: pip install molscribe
Model weights download automatically on first run (~500 MB, cached in ~/.cache/).
"""

from __future__ import annotations
from typing import Any
from PIL.Image import Image as PILImage

# MolScribe is imported lazily to avoid loading at module import time
_molscribe_model = None


def _get_model():
    global _molscribe_model
    if _molscribe_model is None:
        try:
            from molscribe import MolScribe
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # swin_base is the recommended checkpoint
            _molscribe_model = MolScribe("swin_base", device=device)
        except ImportError:
            raise RuntimeError(
                "MolScribe is not installed. Run: pip install molscribe"
            )
    return _molscribe_model


class MolScribeService:
    """Wraps MolScribe and normalises its output to MecHand's JSON schema."""

    def predict(self, image: PILImage) -> dict[str, Any]:
        model = _get_model()
        raw = model.predict_image(image, return_atoms_bonds=True)

        atoms = []
        for a in raw.get("atoms", []):
            atoms.append({
                "symbol":   a.get("atom_symbol", "C"),
                "x":        float(a.get("x", 0)) * 100,  # scale to Ketcher units
                "y":        float(a.get("y", 0)) * 100,
                "charge":   int(a.get("charge", 0)),
                "isotope":  a.get("isotope"),
            })

        bond_type_map = {
            "single":   "single",
            "double":   "double",
            "triple":   "triple",
            "aromatic": "aromatic",
            "wedge_up": "wedge",
            "wedge_down": "dash",
        }
        bonds = []
        for b in raw.get("bonds", []):
            bonds.append({
                "beginAtom": int(b["begin_atom_idx"]),
                "endAtom":   int(b["end_atom_idx"]),
                "type":      bond_type_map.get(b.get("bond_type", "single"), "single"),
            })

        return {
            "smiles":     raw.get("smiles", ""),
            "atoms":      atoms,
            "bonds":      bonds,
            "confidence": float(raw.get("score", 0.5)),
        }
