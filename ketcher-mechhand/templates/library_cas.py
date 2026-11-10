"""
Adds CAS Registry Numbers to the structure library, for search (offline in the app).

For every structure of src/templates/library.json without R groups, asks PubChem (PUG REST) for
the compound with the same SMILES and takes the CAS numbers among its synonyms (pattern and check
digit validated). Writes src/templates/library-cas.json ({id: [cas, ...]}). Run it again after
build_library.py; results are cached in templates/.cas-cache.json.

    python templates/library_cas.py

Source: PubChem (https://pubchem.ncbi.nlm.nih.gov), NCBI/NIH. CAS Registry Numbers are a
trademark of the American Chemical Society; they are used here only as search keys.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parent / "src" / "templates" / "library.json"
OUT = HERE.parent / "src" / "templates" / "library-cas.json"
CACHE = HERE / ".cas-cache.json"
CAS_RE = re.compile(r"^(\d{2,7})-(\d{2})-(\d)$")


def valid_cas(s: str) -> bool:
    m = CAS_RE.match(s)
    if not m:
        return False
    digits = (m.group(1) + m.group(2))[::-1]
    return sum((i + 1) * int(d) for i, d in enumerate(digits)) % 10 == int(m.group(3))


def get(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": "MecHand library builder"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 + attempt * 3)
        except Exception:
            time.sleep(2 + attempt * 3)
    return None


def cas_for(smiles: str) -> list[str]:
    q = urllib.parse.quote(smiles, safe="")
    cids = get(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/{q}/cids/JSON")
    time.sleep(0.25)
    cid = ((cids or {}).get("IdentifierList", {}).get("CID") or [0])[0]
    if not cid:
        return []
    syn = get(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/synonyms/JSON")
    time.sleep(0.25)
    names = ((syn or {}).get("InformationList", {}).get("Information") or [{}])[0].get("Synonym", [])
    out = []
    for n in names:
        if valid_cas(n) and n not in out:
            out.append(n)
    return out[:3]


def main() -> None:
    lib = json.loads(LIB.read_text())
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    result = {}
    for e in lib:
        smi = e["smiles"]
        if "*" in smi:
            continue
        if smi not in cache:
            cache[smi] = cas_for(smi)
            CACHE.write_text(json.dumps(cache, indent=1, sort_keys=True))
        if cache[smi]:
            result[e["id"]] = cache[smi]
    OUT.write_text(json.dumps(result, indent=1, sort_keys=True) + "\n")
    print(f"{len(result)} of {sum(1 for e in lib if '*' not in e['smiles'])} structures have a CAS number -> {OUT}")


if __name__ == "__main__":
    main()
