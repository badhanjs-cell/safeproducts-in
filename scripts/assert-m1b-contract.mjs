import { readFileSync } from 'node:fs';

const specPath = 'docs/superpowers/specs/2026-09-19-m1b-m1br-final-approved.md';
const spec = readFileSync(specPath, 'utf8');
const contract = JSON.parse(readFileSync('tools/m1a/contract.json', 'utf8'));

const required = [
  /automatic asynchronous ingredient-only recovery/i,
  /normal user search never waits for M1-BR/i,
  /expose\/display the newly qualified result/i,
  /only after the display response has been emitted successfully/i,
  /zero unsupported\/fabricated ingredients/i,
  /human review is the terminal fallback/i,
];

for (const pattern of required) {
  if (!pattern.test(spec)) throw new Error(`M1-B spec invariant missing: ${pattern}`);
}

if (contract?.canonical_supabase?.project_ref !== 'wmxbdirvlwuagouraobr') {
  throw new Error('M1-A canonical Supabase binding mismatch');
}
if (contract?.benchmark?.total_products !== 150) throw new Error('M1-A total_products must be 150');
if (contract?.benchmark?.split?.DEV !== 30 || contract?.benchmark?.split?.HOLDOUT !== 120) {
  throw new Error('M1-A split must be DEV=30 / HOLDOUT=120');
}
if (contract?.benchmark?.acceptance_gates?.holdout_unsupported_ingredient_count_max !== 0) {
  throw new Error('M1-A unsupported ingredient HOLDOUT gate must be zero');
}

console.log('M1-B contract guard: PASS');
