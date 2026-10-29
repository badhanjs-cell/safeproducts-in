import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { supabasePublicHeaders } from '../src/lib/supabasePublicHeaders.ts';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;

test('modern sb_publishable key is sent as apikey only, never as Bearer', () => {
  const h = supabasePublicHeaders('sb_publishable_abc123');
  assert.equal(h.apikey, 'sb_publishable_abc123');
  assert.equal(h['Content-Type'], 'application/json');
  assert.equal('Authorization' in h, false);
});

test('validated canonical legacy anon JWT is sent as apikey and Bearer', () => {
  const key = jwt({ role: 'anon', ref: 'wmxbdirvlwuagouraobr', iss: 'supabase' });
  const h = supabasePublicHeaders(key);
  assert.equal(h.apikey, key);
  assert.equal(h.Authorization, `Bearer ${key}`);
});

test('service_role and secret keys are rejected', () => {
  assert.throws(() => supabasePublicHeaders(jwt({ role: 'service_role', ref: 'wmxbdirvlwuagouraobr' })));
  assert.throws(() => supabasePublicHeaders('sb_secret_abc'));
});

test('search adapter routes v3 and label RPCs through the shared header helper', () => {
  const src = readFileSync('src/lib/productSearch.functions.ts', 'utf8');
  assert.doesNotMatch(src, /Bearer/);
  assert.equal(src.match(/headers:\s*supabasePublicHeaders\(key\)/g)?.length, 4);
  assert.match(src, /\/functions\/v1\/sp-us2-search-v3/);
  assert.match(src, /controller\.abort\(\), 40000\)/);
});

import { isRedirectResponse } from '../src/lib/supabasePublicHeaders.ts';

test('3xx, redirected, and opaqueredirect responses are rejected; 200 is not', () => {
  for (const status of [300, 301, 302, 307, 308, 399]) assert.equal(isRedirectResponse({ status }), true);
  assert.equal(isRedirectResponse({ status: 200, redirected: true }), true);
  assert.equal(isRedirectResponse({ status: 0, type: 'opaqueredirect' }), true);
  assert.equal(isRedirectResponse({ status: 200 }), false);
  assert.equal(isRedirectResponse({ status: 502 }), false);
});

test('search fetches use manual redirect and check for redirects before reading body', () => {
  const src = readFileSync('src/lib/productSearch.functions.ts', 'utf8');
  assert.doesNotMatch(src, /redirect:\s*"error"/);
  assert.equal(src.match(/redirect:\s*"manual"/g)?.length, 2);
  assert.equal(src.match(/if \(isRedirectResponse\(response\)\)/g)?.length, 2);
  assert.ok(src.indexOf('isRedirectResponse(response)') < src.indexOf('response.text()'));
});
