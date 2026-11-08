FROM python:3.11-slim

WORKDIR /app

# System libraries used by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-nodeps.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && pip install --no-cache-dir --no-deps -r requirements-nodeps.txt

# Download the MolScribe checkpoint (~1.1 GB) at build time so the first
# request is fast. Remove this line to download it on first start instead.
RUN python -c "from huggingface_hub import hf_hub_download; hf_hub_download('yujieq/MolScribe', 'swin_base_char_aux_1m.pth')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
