import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEnabledFlag,
  resolveSearchRuntimeConfig,
} from '../src/lib/searchRuntimeConfig.ts';

test('search feature flags tolerate runtime whitespace and quoted values without enabling arbitrary values', () => {
  for (const value of ['true', ' TRUE ', '"true"', "'true'"]) assert.equal(isEnabledFlag(value), true);
  for (const value of [undefined, null, '', 'false', '"false"', '1', 'yes']) assert.equal(isEnabledFlag(value), false);
});

test('published runtime prefers the standard server publishable key binding', () => {
  const config = resolveSearchRuntimeConfig({
    SP_M1B_SEARCH_ENABLED: '"true"',
    SP_PROD1_SEARCH_ENABLED: 'false',
    SUPABASE_URL: ' https://wmxbdirvlwuagouraobr.supabase.co ',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_primary',
    SUPABASE_ANON_KEY: 'legacy-anon',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'vite-publishable',
  });

  assert.equal(config.m1bEnabled, true);
  assert.equal(config.prod1Enabled, false);
  assert.equal(config.supabaseUrl, 'https://wmxbdirvlwuagouraobr.supabase.co');
  assert.equal(config.publishableKey, 'sb_publishable_primary');
});

test('runtime resolver keeps the established anon and VITE fallbacks', () => {
  assert.equal(
    resolveSearchRuntimeConfig({ SUPABASE_ANON_KEY: 'legacy-anon' }).publishableKey,
    'legacy-anon',
  );
  assert.equal(
    resolveSearchRuntimeConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'vite-publishable' }).publishableKey,
    'vite-publishable',
  );
});

import { selectSearchRoute, mergeSearchEnv, isExplicitlyDisabledFlag } from '../src/lib/searchRuntimeConfig.ts';

test('M1-B search launches when SP_M1B_SEARCH_ENABLED is omitted', () => {
  assert.equal(selectSearchRoute(resolveSearchRuntimeConfig({})), 'M1B');
  assert.equal(selectSearchRoute(resolveSearchRuntimeConfig({ SP_M1B_SEARCH_ENABLED: '' })), 'M1B');
});

test('explicit false is a kill switch for M1-B search', () => {
  for (const v of ['false', ' FALSE ', '"false"', '0', 'off']) {
    assert.equal(isExplicitlyDisabledFlag(v), true);
    assert.equal(selectSearchRoute(resolveSearchRuntimeConfig({ SP_M1B_SEARCH_ENABLED: v })), 'NOT_QUALIFIED');
  }
  assert.equal(selectSearchRoute(resolveSearchRuntimeConfig({ SP_M1B_SEARCH_ENABLED: 'false', SP_PROD1_SEARCH_ENABLED: 'true' })), 'LEGACY_MAKE');
});

test('public VITE build values fill missing server URL/key without overriding server env', () => {
  const vite = { VITE_SUPABASE_URL: 'https://wmxbdirvlwuagouraobr.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_vite' };
  const missing = resolveSearchRuntimeConfig(mergeSearchEnv({ SUPABASE_URL: '' }, vite));
  assert.equal(missing.supabaseUrl, vite.VITE_SUPABASE_URL);
  assert.equal(missing.publishableKey, 'sb_publishable_vite');
  const server = resolveSearchRuntimeConfig(mergeSearchEnv({ SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_server' }, vite));
  assert.equal(server.publishableKey, 'sb_publishable_server');
});
