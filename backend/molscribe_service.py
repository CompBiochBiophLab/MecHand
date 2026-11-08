"""
molscribe_service.py
Thin wrapper around the MolScribe model (Qian et al., 2023).

MolScribe: Robust Molecular Structure Recognition with Image-to-Graph Generation
Yujie Qian, Jiang Guo, Zhengkai Tu, et al.
J. Chem. Inf. Model. 2023, 63, 4321–4329.
https://github.com/thomas0809/MolScribe

The checkpoint (~1.1 GB) is downloaded from the Hugging Face Hub on first use and
cached in ~/.cache/huggingface. Set MOLSCRIBE_CKPT=/path/to/checkpoint.pth to use a
local file instead.
"""

from __future__ import annotations

import os
import re
from typing import Any

import numpy as np
from PIL.Image import Image as PILImage

HF_REPO = "yujieq/MolScribe"
HF_FILE = "swin_base_char_aux_1m.pth"

# MolScribe bond names → MecHand bond types (see MolScribeClient.ts BondResult)
BOND_TYPE_MAP = {
    "single": "single",
    "double": "double",
    "triple": "triple",
    "aromatic": "aromatic",
    "solid wedge": "wedge",
    "dashed wedge": "dash",
}

_ELEMENT_WITH_H = re.compile(r"([A-Z][a-z]?)(H\d*)?")
_BRACKET_ATOM = re.compile(r"^(\d+)?(.*?)([+-]\d+|[+-]+)?$")


def parse_atom_symbol(raw: str) -> tuple[str, int, int | None]:
    """Split a MolScribe atom token into (symbol, formal charge, isotope).

    MolScribe returns SMILES-like tokens: "C", "[O-]", "[NH3+]", "[13CH3]",
    "[C@@H]", or abbreviations such as "[OMe]" (kept as they are).
    """
    s = raw.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    m = _BRACKET_ATOM.match(s)
    isotope = int(m.group(1)) if m.group(1) else None
    body = m.group(2).replace("@", "")
    sign = m.group(3)
    charge = 0
    if sign:
        magnitude = int(sign[1:]) if sign[1:].isdigit() else len(sign)
        charge = magnitude if sign[0] == "+" else -magnitude
    element = _ELEMENT_WITH_H.fullmatch(body)
    symbol = element.group(1) if element else body
    return symbol or "C", charge, isotope


class MolScribeService:
    """Wraps MolScribe and normalises its output to MecHand's JSON schema."""

    def __init__(self) -> None:
        self._model = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load the model (downloads the checkpoint on first run)."""
        if self._model is not None:
            return
        try:
            import torch
            from molscribe import MolScribe
        except ImportError as e:
            raise RuntimeError(
                "MolScribe is not installed: pip install -r requirements.txt"
            ) from e

        ckpt = os.environ.get("MOLSCRIBE_CKPT")
        if not ckpt:
            from huggingface_hub import hf_hub_download

            ckpt = hf_hub_download(HF_REPO, HF_FILE)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._model = MolScribe(ckpt, device=device)

    def predict(self, image: PILImage) -> dict[str, Any]:
        self.load()
        rgb = np.array(image.convert("RGB"))  # MolScribe expects an RGB array
        raw = self._model.predict_image(
            rgb, return_atoms_bonds=True, return_confidence=True
        )

        atoms = []
        for a in raw.get("atoms", []):
            symbol, charge, isotope = parse_atom_symbol(a.get("atom_symbol", "C"))
            atoms.append({
                "symbol": symbol,
                # MolScribe coordinates are relative (0–1); scale to the units
                # the exporters expect (see TikzExporter.ts SCALE).
                "x": float(a.get("x", 0)) * 100,
                "y": float(a.get("y", 0)) * 100,
                "charge": charge,
                "isotope": isotope,
            })

        bonds = []
        for b in raw.get("bonds", []):
            begin, end = b["endpoint_atoms"]
            bonds.append({
                "beginAtom": int(begin),
                "endAtom": int(end),
                "type": BOND_TYPE_MAP.get(b.get("bond_type", "single"), "single"),
            })

        return {
            "smiles": raw.get("smiles", ""),
            "molfile": raw.get("molfile", ""),
            "atoms": atoms,
            "bonds": bonds,
            "confidence": float(raw.get("confidence", 0.5)),
        }
