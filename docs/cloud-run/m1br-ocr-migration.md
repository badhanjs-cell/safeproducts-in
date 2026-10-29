# SafeProducts M1-BR OCR — Cloud Run Migration

Scope is limited to the PaddleOCR microservice at `services/m1br-ocr`. SafeProducts Supabase, Make workflows, frontend, search architecture and other backend functions remain unchanged.

Target:
- Cloud Run service: `safeproducts-m1br-ocr`
- region: `asia-south1`
- health: `GET /health`
- protected OCR: `POST /ocr`
- application auth header: `x-m1br-ocr-token`
- concurrency: 1
- CPU: 2
- memory: 4 GiB

Secret Manager:
- `safeproducts-m1br-ocr-token` -> exposed to the container as `M1BR_OCR_TOKEN`

The secret value must equal the OCR-only token derived from the already validated SafeProducts worker token by the existing `deriveOcrToken` contract. Never store either token in source.

Cutover:
1. Create the Cloud Run service through Cloud Build after the Secret Manager binding is ready.
2. Verify `/health`.
3. Run one controlled authenticated OCR call.
4. Set the Supabase Edge Function server-side environment variable `M1BR_OCR_URL` to the Cloud Run URL. The existing code already prioritizes this variable over the Railway fallback.
5. Run a controlled M1-BR recovery task end-to-end.
6. Keep Railway alive until production acceptance is complete.
