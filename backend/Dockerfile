FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download MolScribe weights at build time so the first request is instant.
# Remove this RUN line if you prefer to download them on first use (~500 MB).
RUN python - <<'EOF'
from molscribe import MolScribe
MolScribe("swin_base", device="cpu")  # downloads weights to ~/.cache/molscribe
EOF

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
