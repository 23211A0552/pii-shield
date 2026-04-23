#!/usr/bin/env bash
set -e

echo "==> Installing system dependencies..."
apt-get update -qq
apt-get install -y tesseract-ocr poppler-utils libgl1-mesa-glx

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Downloading spaCy model..."
python -m spacy download en_core_web_sm

echo "==> Build complete!"
