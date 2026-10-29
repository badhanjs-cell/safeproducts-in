import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dockerfilePath = 'services/m1br-ocr/Dockerfile';
const workerPath = 'supabase/functions/sp-m1br-recovery-worker-v1/index.ts';

test('M1-BR OCR has an explicit production container contract', () => {
  assert.equal(existsSync(dockerfilePath), true, `${dockerfilePath} must exist`);
  const source = readFileSync(dockerfilePath, 'utf8');
  assert.match(source, /FROM\s+python:3\.11-slim/i);
  assert.match(source, /pip\s+install[^\n]+-r\s+requirements\.txt/i);
  assert.match(source, /uvicorn\s+app:app\s+--host\s+0\.0\.0\.0/i);
  assert.match(source, /\$\{PORT:-8080\}/);
  assert.match(source, /--workers\s+1/i);
});

test('OCR container keeps model/runtime files local and excludes repository secrets', () => {
  const ignorePath = 'services/m1br-ocr/.dockerignore';
  assert.equal(existsSync(ignorePath), true, `${ignorePath} must exist`);
  const source = readFileSync(ignorePath, 'utf8');
  assert.match(source, /^\.env\*?$/m);
  assert.match(source, /^__pycache__\/?$/m);
  assert.match(source, /^\.git\/?$/m);
});

test('M1-BR worker has a live Railway OCR default without embedding the OCR credential', () => {
  const source = readFileSync(workerPath, 'utf8');
  assert.match(source, /m1br-ocr-production\.up\.railway\.app/i);
  assert.match(source, /M1BR_OCR_URL/);
  assert.doesNotMatch(source, /Deno\.env\.get\(["']M1BR_OCR_TOKEN["']\)/);
});

test('M1-BR derives an OCR-only credential from the already-validated high-entropy worker token', () => {
  const source = readFileSync(workerPath, 'utf8');
  assert.match(source, /deriveOcrToken/);
  assert.match(source, /crypto\.subtle\.digest\(["']SHA-256["']/);
  assert.match(source, /SafeProducts:M1BR:OCR:v1/);
  assert.match(source, /x-m1br-ocr-token/);
  const auth = source.indexOf('sp_internal_worker_token_valid_v1');
  const derive = source.indexOf('deriveOcrToken(token)', auth);
  const claim = source.indexOf('sp_m1br_claim_tasks_v1', auth);
  assert.ok(auth >= 0 && derive > auth && claim > derive, 'OCR credential must be derived only after backend worker authentication and before task claim');
});
