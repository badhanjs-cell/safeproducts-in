import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..');
const READY_FILES = [1, 2, 3, 4, 5, 6].map((n) => `src/data/m1b-dev-review-ready-${n}.json`);
const BLOCKED_FILE = 'src/data/m1b-dev-review-blocked.json';

async function importTsModule(relativePath) {
  const source = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
  }).outputText;
  const encoded = Buffer.from(output, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

test('Admin Human Review route, reusable contract, and DEV snapshot are installed', () => {
  const required = [
    'src/routes/admin.human-review.tsx',
    'src/lib/m1bHumanReview.ts',
    'src/data/m1b-dev-reviewer-packets.json',
    ...READY_FILES,
    BLOCKED_FILE,
  ];
  for (const path of required) {
    assert.equal(existsSync(resolve(ROOT, path)), true, `${path} must exist`);
  }

  const shell = readFileSync(resolve(ROOT, 'src/components/admin/AdminShell.tsx'), 'utf8');
  assert.match(shell, /\/admin\/human-review/);
  assert.match(shell, /Human Review/);

  const route = readFileSync(resolve(ROOT, 'src/routes/admin.human-review.tsx'), 'utf8');
  assert.match(route, /createFileRoute\("\/admin\/human-review"\)/);
  assert.match(route, /sp_catalog_review_queue_v1/);
  assert.match(route, /source_context/);
  assert.match(route, /APPROVE/);
  assert.match(route, /CORRECT/);
  assert.match(route, /REJECT/);
  assert.match(route, /Validate Human Review/);
  assert.match(route, /Export Decisions/);
  assert.match(route, /gold_status/i);
  assert.match(route, /promotion remains disabled|never assigns benchmark gold|never.*promot/i);
});

test('bundled DEV snapshot is the first batch, not hard-coded UI logic', () => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src/data/m1b-dev-reviewer-packets.json'), 'utf8'));
  const ready = READY_FILES.flatMap((path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')));
  const blocked = JSON.parse(readFileSync(resolve(ROOT, BLOCKED_FILE), 'utf8'));

  assert.equal(manifest.packet_count, 30);
  assert.equal(manifest.ready_count, 26);
  assert.equal(manifest.blocked_count, 4);
  assert.equal(manifest.gold_status, 'UNASSIGNED');
  assert.equal(manifest.human_adjudication_required, true);
  assert.equal(ready.length, 26);
  assert.equal(blocked.length, 4);
  assert.ok(ready.every((packet) => packet.candidate_id));
  assert.ok(blocked.every((packet) => packet.do_not_adjudicate_gold === true));
});

test('bundled DEV snapshot carries full direct review evidence and route consumes it', () => {
  const ready = READY_FILES.flatMap((path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')));
  const blocked = JSON.parse(readFileSync(resolve(ROOT, BLOCKED_FILE), 'utf8'));

  assert.ok(ready.every((packet) => packet.identity_summary));
  assert.ok(ready.every((packet) => packet.ingredient_declaration));
  assert.ok(ready.every((packet) => Array.isArray(packet.evidence_sources) && packet.evidence_sources.length > 0));
  assert.ok(blocked.every((packet) => packet.evidence_gap_reason));
  assert.ok(ready.some((packet) => Array.isArray(packet.rejected_evidence) && packet.rejected_evidence.length > 0));

  const route = readFileSync(resolve(ROOT, 'src/routes/admin.human-review.tsx'), 'utf8');
  for (let n = 1; n <= 6; n += 1) assert.match(route, new RegExp(`m1b-dev-review-ready-${n}\\.json`));
  assert.match(route, /m1b-dev-review-blocked\.json/);
  assert.doesNotMatch(route, /DecompressionStream/);
});

test('human-review decision evaluator remains fail-closed', async () => {
  const review = await importTsModule('src/lib/m1bHumanReview.ts');

  const approved = review.evaluateDecisionDraft({
    identity_decision: 'APPROVE',
    ingredient_declaration_decision: 'APPROVE',
    correction_note: '',
  });
  assert.equal(approved.complete, true);
  assert.equal(approved.decision_status, 'HUMAN_APPROVED_FOR_GOLD_STAGING');
  assert.equal(approved.gold_status, 'UNASSIGNED');
  assert.equal(approved.promotion_allowed, false);

  const correctionWithoutNote = review.evaluateDecisionDraft({
    identity_decision: 'CORRECT',
    ingredient_declaration_decision: 'APPROVE',
    correction_note: '',
  });
  assert.equal(correctionWithoutNote.complete, false);
  assert.deepEqual(correctionWithoutNote.errors, ['CORRECTION_NOTE_REQUIRED']);

  const rejected = review.evaluateDecisionDraft({
    identity_decision: 'REJECT',
    ingredient_declaration_decision: 'APPROVE',
    correction_note: '',
  });
  assert.equal(rejected.complete, true);
  assert.equal(rejected.decision_status, 'HUMAN_REJECTED');
  assert.equal(rejected.gold_status, 'UNASSIGNED');
  assert.equal(rejected.promotion_allowed, false);
});

test('future compatible live review packets can be merged without hard-coded candidate IDs', async () => {
  const review = await importTsModule('src/lib/m1bHumanReview.ts');
  const snapshot = {
    ready_packets: [{ candidate_id: 'existing', curation_status: 'READY_FOR_HUMAN_ADJUDICATION' }],
    blocked_packets: [],
  };
  const livePacket = {
    candidate_id: 'future-candidate-001',
    curation_status: 'READY_FOR_HUMAN_ADJUDICATION',
    ingredient_declaration: 'Aqua, Glycerin',
  };

  const merged = review.mergeReviewPackets(snapshot, [livePacket]);
  assert.deepEqual(merged.ready_packets.map((packet) => packet.candidate_id), ['existing', 'future-candidate-001']);
  assert.equal(merged.blocked_packets.length, 0);
});
