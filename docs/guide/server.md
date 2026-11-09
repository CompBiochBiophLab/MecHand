# Optional DECIMER server

MecHand does **not** need a server. If you want to compare its recognizer with an image-based
deep-learning model, it can send a picture of your ink to **DECIMER** (Rajan, Brinkhaus et al.;
*Nat. Commun.* 2023; hand-drawn model: *J. Cheminform.* 2024), running on your own computer.
DECIMER then provides the structure (as SMILES); curved arrows, charges and the electron-flow check
still come from MecHand's in-browser recognizer.

Requirements: **Python 3.10–3.13** (TensorFlow 2.20, used by DECIMER, has no wheels for 3.14 yet)
and about 1.5 GB of disk for TensorFlow and the model.

```sh
cd MecHand/backend
python3.13 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000         # first start downloads the hand-drawn model (~285 MB)
```

Or with Docker (model included in the image):

```sh
docker build -t mechand-server backend
docker run -p 8000:8000 mechand-server
```

Then in MecHand open **About → Structure engine → DECIMER server** (the address defaults to
`http://localhost:8000`), or open the app with `?engine=server&server=http://localhost:8000`.
The dialog shows what DECIMER read and its confidence; **Insert** uses DECIMER's structure.

| Endpoint | Description |
| --- | --- |
| `GET /health` | `{"status":"ok","models_loaded":true,"engine":"DECIMER 2.8.1 (hand-drawn model)"}` once ready |
| `POST /recognize` | multipart `image` (PNG) → `smiles`, `molfile`, `atoms`, `bonds`, `confidence`, `valid`, `engine` |

Set `MECHAND_HAND_DRAWN=0` to use DECIMER's printed-structure model instead.

::: info Why not MolScribe?
Earlier MecHand versions used MolScribe. Its last release (April 2023) depends on OpenNMT-py 2.2,
torchtext 0.5 and pyonmttok 1.x, which no longer install on current Python versions or on Apple
Silicon, and it is weak on hand-drawn structures. DECIMER is maintained, installs with a plain
`pip install`, and has a model trained for hand-drawn structures.
:::
