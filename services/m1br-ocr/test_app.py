import base64
from fastapi.testclient import TestClient
import app as ocr_app

client = TestClient(ocr_app.app)

# Valid 1x1 transparent PNG.
SAMPLE_PNG = base64.b64encode(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
)).decode()

def auth_headers():
    return {'x-m1br-ocr-token': 'test-token'}

def test_rejects_missing_token(monkeypatch):
    monkeypatch.setenv('M1BR_OCR_TOKEN', 'test-token')
    r = client.post('/ocr', json={'content_type':'image/png','bytes_b64':SAMPLE_PNG})
    assert r.status_code == 401

def test_rejects_non_image_payload(monkeypatch):
    monkeypatch.setenv('M1BR_OCR_TOKEN', 'test-token')
    r = client.post('/ocr', headers=auth_headers(), json={'content_type':'text/plain','bytes_b64':'SGVsbG8='})
    assert r.status_code == 415

def test_returns_ordered_text_spans(monkeypatch):
    monkeypatch.setenv('M1BR_OCR_TOKEN', 'test-token')
    monkeypatch.setattr(ocr_app, '_ocr_image', lambda _image: [
        {'text':'Aqua','confidence':0.99,'order':0},
        {'text':'Glycerin','confidence':0.98,'order':1},
    ])
    r = client.post('/ocr', headers=auth_headers(), json={'content_type':'image/png','bytes_b64':SAMPLE_PNG})
    assert r.status_code == 200
    body = r.json()
    assert body['engine'] == 'paddleocr'
    assert body['text'] == 'Aqua Glycerin'
    assert [x['text'] for x in body['spans']] == ['Aqua','Glycerin']

def test_rejects_oversized_decoded_payload(monkeypatch):
    monkeypatch.setenv('M1BR_OCR_TOKEN', 'test-token')
    monkeypatch.setenv('M1BR_OCR_MAX_BYTES', '8')
    r = client.post('/ocr', headers=auth_headers(), json={'content_type':'image/png','bytes_b64':base64.b64encode(b'0123456789').decode()})
    assert r.status_code == 413
