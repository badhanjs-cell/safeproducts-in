import base64
import binascii
import hmac
import io
import os
import time
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

app = FastAPI(title="SafeProducts M1-BR OCR", docs_url=None, redoc_url=None, openapi_url=None)
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

class OCRRequest(BaseModel):
    content_type: str
    bytes_b64: str

@lru_cache(maxsize=1)
def _engine():
    from paddleocr import PaddleOCR
    return PaddleOCR(lang=os.getenv("M1BR_OCR_LANG", "en"), use_doc_orientation_classify=True, use_doc_unwarping=True, use_textline_orientation=True)

def _v3_spans(result):
    spans = []
    order = 0
    for item in result or []:
        payload = item
        if hasattr(item, "json"):
            payload = item.json
            if callable(payload):
                payload = payload()
        if isinstance(payload, str):
            import json
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        if isinstance(payload, dict) and "res" in payload and isinstance(payload["res"], dict):
            payload = payload["res"]
        if not isinstance(payload, dict):
            continue
        texts = payload.get("rec_texts") or payload.get("texts") or []
        scores = payload.get("rec_scores") or payload.get("scores") or []
        for i, text in enumerate(texts):
            if not isinstance(text, str) or not text.strip():
                continue
            score = float(scores[i]) if i < len(scores) else 0.0
            spans.append({"text": text.strip(), "confidence": max(0.0, min(1.0, score)), "order": order})
            order += 1
    return spans

def _v2_spans(result):
    spans = []
    order = 0
    def walk(node):
        nonlocal order
        if not isinstance(node, list):
            return
        if len(node) == 2 and isinstance(node[1], (list, tuple)) and len(node[1]) >= 2 and isinstance(node[1][0], str):
            text = node[1][0].strip()
            if text:
                try:
                    score = float(node[1][1])
                except Exception:
                    score = 0.0
                spans.append({"text": text, "confidence": max(0.0, min(1.0, score)), "order": order})
                order += 1
            return
        for child in node:
            walk(child)
    walk(result)
    return spans

def _ocr_image(image: Image.Image):
    import numpy as np
    engine = _engine()
    array = np.asarray(image.convert("RGB"))
    if hasattr(engine, "predict"):
        spans = _v3_spans(engine.predict(array))
        if spans:
            return spans
    if hasattr(engine, "ocr"):
        return _v2_spans(engine.ocr(array, cls=True))
    return []

def _authorized(provided: str | None) -> bool:
    expected = os.getenv("M1BR_OCR_TOKEN", "")
    return bool(expected and provided and hmac.compare_digest(provided, expected))

@app.get("/health")
def health():
    return {"ok": True, "engine": "paddleocr"}

@app.post("/ocr")
def ocr(payload: OCRRequest, x_m1br_ocr_token: str | None = Header(default=None)):
    started = time.perf_counter()
    if not _authorized(x_m1br_ocr_token):
        raise HTTPException(status_code=401, detail="OCR_AUTH_REQUIRED")
    mime = payload.content_type.lower().split(";", 1)[0].strip()
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="UNSUPPORTED_IMAGE_TYPE")
    try:
        raw = base64.b64decode(payload.bytes_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="INVALID_BASE64")
    max_bytes = int(os.getenv("M1BR_OCR_MAX_BYTES", str(8 * 1024 * 1024)))
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="EMPTY_IMAGE")
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="IMAGE_TOO_LARGE")
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
        image = Image.open(io.BytesIO(raw))
        width, height = image.size
        if width <= 0 or height <= 0 or width * height > int(os.getenv("M1BR_OCR_MAX_PIXELS", "24000000")):
            raise HTTPException(status_code=413, detail="IMAGE_DIMENSIONS_TOO_LARGE")
        image.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="INVALID_IMAGE")
    spans = sorted(_ocr_image(image), key=lambda x: int(x.get("order", 0)))
    text = " ".join(str(x.get("text", "")).strip() for x in spans if str(x.get("text", "")).strip())
    return {
        "engine": "paddleocr",
        "engine_version": os.getenv("M1BR_OCR_ENGINE_VERSION", "3.x"),
        "text": text,
        "spans": spans,
        "latency_ms": round((time.perf_counter() - started) * 1000),
        "width_px": width,
        "height_px": height,
    }
