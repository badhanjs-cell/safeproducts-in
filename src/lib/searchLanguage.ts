export type VoiceLocale = "en-IN" | "hi-IN" | "pa-IN";

export const VOICE_LOCALE_OPTIONS: ReadonlyArray<{
  value: VoiceLocale;
  label: string;
  shortLabel: string;
}> = [
  { value: "en-IN", label: "English (India)", shortLabel: "EN" },
  { value: "hi-IN", label: "हिंदी", shortLabel: "हिं" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ", shortLabel: "ਪੰ" },
];

const PHRASE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["प्रोटीन पाउडर", "protein powder"],
  ["बेबी लोशन", "baby lotion"],
  ["बच्चों का लोशन", "baby lotion"],
  ["बेबी ऑयल", "baby oil"],
  ["बालों का तेल", "hair oil"],
  ["फेस वॉश", "face wash"],
  ["फेस वाश", "face wash"],
  ["मल्टीविटामिन", "multivitamin"],
  ["मॉइस्चराइज़र", "moisturizer"],
  ["मॉइस्चराइजर", "moisturizer"],
  ["सन स्क्रीन", "sunscreen"],
  ["सनस्क्रीन", "sunscreen"],
  ["शैम्पू", "shampoo"],
  ["शैंपू", "shampoo"],
  ["कंडीशनर", "conditioner"],
  ["टूथपेस्ट", "toothpaste"],
  ["प्रोबायोटिक", "probiotic"],
  ["कैल्शियम", "calcium"],
  ["सप्लीमेंट", "supplement"],
  ["न्यूट्रास्यूटिकल", "nutraceutical"],
  ["लिपस्टिक", "lipstick"],
  ["विटामिन", "vitamin"],
  ["लोशन", "lotion"],
  ["साबुन", "soap"],
  ["क्रीम", "cream"],
  ["सीरम", "serum"],
  ["आयरन", "iron"],
  ["ओमेगा 3", "omega 3"],
  ["डायपर", "diaper"],
  ["वाइप्स", "wipes"],
  ["तेल", "oil"],
  ["ਪ੍ਰੋਟੀਨ ਪਾਊਡਰ", "protein powder"],
  ["ਬੇਬੀ ਲੋਸ਼ਨ", "baby lotion"],
  ["ਬੱਚਿਆਂ ਦਾ ਲੋਸ਼ਨ", "baby lotion"],
  ["ਬੇਬੀ ਆਇਲ", "baby oil"],
  ["ਬੇਬੀ ਤੇਲ", "baby oil"],
  ["ਵਾਲਾਂ ਦਾ ਤੇਲ", "hair oil"],
  ["ਫੇਸ ਵਾਸ਼", "face wash"],
  ["ਫੇਸ ਵਾਸ਼", "face wash"],
  ["ਮਲਟੀਵਿਟਾਮਿਨ", "multivitamin"],
  ["ਮੋਇਸਚਰਾਈਜ਼ਰ", "moisturizer"],
  ["ਮੌਇਸਚਰਾਈਜ਼ਰ", "moisturizer"],
  ["ਸਨ ਸਕ੍ਰੀਨ", "sunscreen"],
  ["ਸਨਸਕ੍ਰੀਨ", "sunscreen"],
  ["ਸ਼ੈਂਪੂ", "shampoo"],
  ["ਸ਼ੈਂਪੂ", "shampoo"],
  ["ਕੰਡੀਸ਼ਨਰ", "conditioner"],
  ["ਕੰਡੀਸ਼ਨਰ", "conditioner"],
  ["ਟੂਥਪੇਸਟ", "toothpaste"],
  ["ਪ੍ਰੋਬਾਇਓਟਿਕ", "probiotic"],
  ["ਕੈਲਸ਼ੀਅਮ", "calcium"],
  ["ਕੈਲਸ਼ੀਅਮ", "calcium"],
  ["ਸਪਲੀਮੈਂਟ", "supplement"],
  ["ਨਿਊਟਰਾਸਿਊਟੀਕਲ", "nutraceutical"],
  ["ਲਿਪਸਟਿਕ", "lipstick"],
  ["ਵਿਟਾਮਿਨ", "vitamin"],
  ["ਲੋਸ਼ਨ", "lotion"],
  ["ਲੋਸ਼ਨ", "lotion"],
  ["ਸਾਬਣ", "soap"],
  ["ਕ੍ਰੀਮ", "cream"],
  ["ਸੀਰਮ", "serum"],
  ["ਆਇਰਨ", "iron"],
  ["ਓਮੇਗਾ 3", "omega 3"],
  ["ਡਾਇਪਰ", "diaper"],
  ["ਵਾਈਪਸ", "wipes"],
  ["ਤੇਲ", "oil"],
];

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", ळ: "l",
  क़: "q", ख़: "kh", ग़: "g", ज़: "z", ड़: "r", ढ़: "rh", फ़: "f", य़: "y",
};
const DEVANAGARI_VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
};
const DEVANAGARI_MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};
const GURMUKHI_CONSONANTS: Record<string, string> = {
  ਕ: "k", ਖ: "kh", ਗ: "g", ਘ: "gh", ਙ: "ng",
  ਚ: "ch", ਛ: "chh", ਜ: "j", ਝ: "jh", ਞ: "ny",
  ਟ: "t", ਠ: "th", ਡ: "d", ਢ: "dh", ਣ: "n",
  ਤ: "t", ਥ: "th", ਦ: "d", ਧ: "dh", ਨ: "n",
  ਪ: "p", ਫ: "ph", ਬ: "b", ਭ: "bh", ਮ: "m",
  ਯ: "y", ਰ: "r", ਲ: "l", ਵ: "v", ੜ: "r", ਸ: "s", ਹ: "h", ਸ਼: "sh", ਖ਼: "kh", ਗ਼: "g", ਜ਼: "z", ਫ਼: "f", ਲ਼: "l",
};
const GURMUKHI_VOWELS: Record<string, string> = {
  ਅ: "a", ਆ: "aa", ਇ: "i", ਈ: "ee", ਉ: "u", ਊ: "oo", ਏ: "e", ਐ: "ai", ਓ: "o", ਔ: "au",
};
const GURMUKHI_MATRAS: Record<string, string> = {
  "ਾ": "aa", "ਿ": "i", "ੀ": "ee", "ੁ": "u", "ੂ": "oo", "ੇ": "e", "ੈ": "ai", "ੋ": "o", "ੌ": "au",
};

function replacePhrases(value: string) {
  let result = value;
  for (const [source, target] of PHRASE_ALIASES) result = result.split(source).join(target);
  return result;
}

function stripVoiceCommands(value: string) {
  let result = value.trim();
  const patterns = [
    /^\s*(?:मुझे|मेरे\s+लिए)\s+/u,
    /^\s*(?:सर्च\s+करो|सर्च|खोजो|ढूंढो|ढूँढो|दिखाओ)\s*/u,
    /\s*(?:दिखाओ|खोजो|ढूंढो|ढूँढो|चाहिए)\s*$/u,
    /^\s*(?:ਮੈਨੂੰ|ਮੇਰੇ\s+ਲਈ)\s+/u,
    /^\s*(?:ਸਰਚ\s+ਕਰੋ|ਸਰਚ|ਖੋਜੋ|ਲੱਭੋ|ਦਿਖਾਓ)\s*/u,
    /\s*(?:ਦਿਖਾਓ|ਖੋਜੋ|ਲੱਭੋ|ਚਾਹੀਦਾ|ਚਾਹੀਦੀ|ਚਾਹੀਦੇ)\s*$/u,
    /^\s*(?:mujhe|mere\s+liye|mainu|menu|mere\s+lai)\s+/iu,
    /^\s*(?:please\s+)?(?:search\s+karo|khojo|dhundho|dhoondo|dhundo|dikhao|labho|labh\s+ke\s+dikhao)\s+/iu,
    /\s*(?:dikhao|khojo|dhundho|dhoondo|dhundo|chahiye|chaahiye|labho|chaahida|chahida|chahidi|chahide)\s*$/iu,
    /^\s*(?:please\s+)?(?:search(?:\s+for)?|find|show\s+me|look\s+for)\s+/iu,
  ];
  for (const pattern of patterns) result = result.replace(pattern, " ").trim();
  return result;
}

function transliterateIndic(value: string) {
  let result = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const devanagariConsonant = DEVANAGARI_CONSONANTS[char];
    if (devanagariConsonant) {
      let cursor = i + 1;
      if (value[cursor] === "़") cursor += 1;
      const next = value[cursor];
      if (next === "्") { result += devanagariConsonant; i = cursor; }
      else if (DEVANAGARI_MATRAS[next] !== undefined) { result += devanagariConsonant + DEVANAGARI_MATRAS[next]; i = cursor; }
      else { result += devanagariConsonant + "a"; i = cursor - 1; }
      continue;
    }
    if (DEVANAGARI_VOWELS[char] !== undefined) { result += DEVANAGARI_VOWELS[char]; continue; }
    if (char === "ं" || char === "ँ") { result += "n"; continue; }
    if (char === "ः") { result += "h"; continue; }
    if (char === "़" || char === "्") continue;

    const gurmukhiConsonant = GURMUKHI_CONSONANTS[char];
    if (gurmukhiConsonant) {
      const next = value[i + 1];
      if (next === "੍") { result += gurmukhiConsonant; i += 1; }
      else if (GURMUKHI_MATRAS[next] !== undefined) { result += gurmukhiConsonant + GURMUKHI_MATRAS[next]; i += 1; }
      else result += gurmukhiConsonant + "a";
      continue;
    }
    if (GURMUKHI_VOWELS[char] !== undefined) { result += GURMUKHI_VOWELS[char]; continue; }
    if (char === "ੰ" || char === "ਂ") { result += "n"; continue; }
    if (char === "ੱ" || char === "੍") continue;
    result += char;
  }
  return result;
}

function normalizePhoneticProductWords(value: string) {
  return value
    .replace(/\b(?:bebi|beybi)\b/giu, "baby")
    .replace(/\b(?:loshan|losion)\b/giu, "lotion")
    .replace(/\b(?:sun\s*screen|san\s*screen|suns?kr(?:ee|i)n|sans?kr(?:ee|i)n)\b/giu, "sunscreen")
    .replace(/\b(?:shaimpu|shampu|shaampu)\b/giu, "shampoo")
    .replace(/\b(?:toothapest|tooth\s*pest)\b/giu, "toothpaste")
    .replace(/\b(?:proteen|protin)\b/giu, "protein")
    .replace(/\b(?:multi\s+vitamin|malti\s*vitamin)\b/giu, "multivitamin")
    .replace(/\b(?:pro\s+biotic|probayotik)\b/giu, "probiotic")
    .replace(/\b(?:moisturiser|moist\s*urizer|moischarizer)\b/giu, "moisturizer")
    .replace(/\bomega\s+three\b/giu, "omega 3")
    .replace(/\bvaitamin\b/giu, "vitamin")
    .replace(/\b(?:kailshiam|calshium|calcium)\b/giu, "calcium")
    .replace(/\b(?:paudar|powdar)\b/giu, "powder");
}

/** Canonical search text shared by typed, voice, live and resilience paths. */
export function normalizeSearchQuery(input: string): string {
  let value = input.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, " ");
  value = stripVoiceCommands(value);
  value = replacePhrases(value);
  value = transliterateIndic(value);
  value = normalizePhoneticProductWords(value);
  value = stripVoiceCommands(value);
  return value
    .replace(/[“”‘’"']/g, " ")
    .replace(/[^\p{L}\p{N}+\-./% ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function preferredVoiceLocale(languages: readonly string[]): VoiceLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized === "pa" || normalized.startsWith("pa-")) return "pa-IN";
    if (normalized === "hi" || normalized.startsWith("hi-")) return "hi-IN";
    if (normalized === "en" || normalized.startsWith("en-")) return "en-IN";
  }
  return "en-IN";
}

type VoiceCandidateGroup = {
  transcript: string;
  query: string;
  bestConfidence: number;
  confidenceSum: number;
  votes: number;
  firstIndex: number;
};

/**
 * Select a usable recognition result from up to five browser alternatives.
 * Alternatives that normalize to the same canonical product query vote
 * together, which makes accent/spelling variants more stable without creating
 * a second search path or changing backend search semantics.
 */
export function selectBestVoiceTranscript(
  alternatives: ReadonlyArray<{ transcript?: unknown; confidence?: unknown }>,
): { transcript: string; query: string } | null {
  const groups = new Map<string, VoiceCandidateGroup>();
  const boundedAlternatives = alternatives.slice(0, 5);

  for (let index = 0; index < boundedAlternatives.length; index += 1) {
    const alternative = boundedAlternatives[index];
    if (typeof alternative.transcript !== "string") continue;

    const transcript = alternative.transcript.trim();
    const query = normalizeSearchQuery(transcript);
    if (!query) continue;

    const confidence = typeof alternative.confidence === "number" && Number.isFinite(alternative.confidence)
      ? Math.max(0, Math.min(1, alternative.confidence))
      : 0;
    const key = query.toLocaleLowerCase("en-IN");
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        transcript,
        query,
        bestConfidence: confidence,
        confidenceSum: confidence,
        votes: 1,
        firstIndex: index,
      });
      continue;
    }

    current.votes += 1;
    current.confidenceSum += confidence;
    if (confidence > current.bestConfidence) {
      current.bestConfidence = confidence;
      current.transcript = transcript;
    }
  }

  let best: VoiceCandidateGroup | null = null;
  let bestScore = -Infinity;
  for (const group of groups.values()) {
    const agreementBonus = Math.min(group.votes - 1, 4) * 4;
    const supportingConfidence = Math.max(0, group.confidenceSum - group.bestConfidence);
    const supportBonus = Math.min(supportingConfidence, 1) * 3;
    const score = group.bestConfidence * 100 + agreementBonus + supportBonus - group.firstIndex * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = group;
    }
  }

  return best ? { transcript: best.transcript, query: best.query } : null;
}
