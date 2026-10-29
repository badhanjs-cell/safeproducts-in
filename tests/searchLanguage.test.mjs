import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSearchQuery,
  preferredVoiceLocale,
  selectBestVoiceTranscript,
} from "../src/lib/searchLanguage.ts";

test("English typed search is preserved", () => {
  assert.equal(normalizeSearchQuery("Himalaya baby lotion"), "Himalaya baby lotion");
});

test("Hindi product speech normalizes to canonical English search", () => {
  assert.equal(normalizeSearchQuery("मुझे सनस्क्रीन दिखाओ"), "sunscreen");
  assert.equal(normalizeSearchQuery("मुझे सन स्क्रीन दिखाओ"), "sunscreen");
  assert.equal(normalizeSearchQuery("बेबी लोशन"), "baby lotion");
  assert.equal(normalizeSearchQuery("प्रोटीन पाउडर"), "protein powder");
});

test("Punjabi product speech normalizes to canonical English search", () => {
  assert.equal(normalizeSearchQuery("ਮੈਨੂੰ ਸਨਸਕ੍ਰੀਨ ਦਿਖਾਓ"), "sunscreen");
  assert.equal(normalizeSearchQuery("ਮੈਨੂੰ ਸਨ ਸਕ੍ਰੀਨ ਦਿਖਾਓ"), "sunscreen");
  assert.equal(normalizeSearchQuery("ਬੇਬੀ ਲੋਸ਼ਨ"), "baby lotion");
  assert.equal(normalizeSearchQuery("ਪ੍ਰੋਟੀਨ ਪਾਊਡਰ"), "protein powder");
});

test("Romanized Hindi Punjabi accent forms normalize without changing search path", () => {
  assert.equal(normalizeSearchQuery("mujhe san screen dikhao"), "sunscreen");
  assert.equal(normalizeSearchQuery("mainu sun screen dikhao"), "sunscreen");
  assert.equal(normalizeSearchQuery("menu bebi loshan chahida"), "baby lotion");
  assert.equal(normalizeSearchQuery("search karo proteen paudar"), "protein powder");
});

test("Indic brand words are transliterated rather than discarded", () => {
  const hindi = normalizeSearchQuery("हिमालय बेबी लोशन");
  const punjabi = normalizeSearchQuery("ਹਿਮਾਲਿਆ ਬੇਬੀ ਲੋਸ਼ਨ");
  assert.match(hindi, /baby lotion$/i);
  assert.match(punjabi, /baby lotion$/i);
  assert.doesNotMatch(hindi, /[\u0900-\u097f]/u);
  assert.doesNotMatch(punjabi, /[\u0a00-\u0a7f]/u);
});

test("Voice locale follows Punjabi Hindi and Indian English device preferences", () => {
  assert.equal(preferredVoiceLocale(["pa-IN", "en-US"]), "pa-IN");
  assert.equal(preferredVoiceLocale(["hi-IN", "en-US"]), "hi-IN");
  assert.equal(preferredVoiceLocale(["en-GB"]), "en-IN");
});

test("Voice alternatives select the highest-confidence usable transcript", () => {
  const selected = selectBestVoiceTranscript([
    { transcript: "बेबी लोशन", confidence: 0.62 },
    { transcript: "सनस्क्रीन", confidence: 0.91 },
  ]);
  assert.deepEqual(selected, { transcript: "सनस्क्रीन", query: "sunscreen" });
});

test("Voice alternatives use canonical-query consensus for accent variants", () => {
  const selected = selectBestVoiceTranscript([
    { transcript: "shampoo", confidence: 0.73 },
    { transcript: "san screen", confidence: 0.71 },
    { transcript: "sun screen", confidence: 0.69 },
    { transcript: "sunscreen", confidence: 0.65 },
  ]);
  assert.equal(selected?.query, "sunscreen");
});
