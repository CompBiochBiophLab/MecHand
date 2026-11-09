FROM python:3.13-slim

WORKDIR /app

# Libraries used by OpenCV (a DECIMER dependency)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgomp1 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the DECIMER hand-drawn model (~285 MB) at build time so the first
# request is fast. Remove this line to download it on first start instead.
ENV PYSTOW_HOME=/models
RUN python -c "import DECIMER; DECIMER.load_models(printed=False, hand_drawn=True)"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
