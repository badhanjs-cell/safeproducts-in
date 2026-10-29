import { readFileSync } from "node:fs";

const footer = readFileSync("src/components/Footer.tsx", "utf8");
const labelRoute = readFileSync("src/routes/check-my-label.tsx", "utf8");
const labelQualified = readFileSync("src/components/LabelQualifiedResult.tsx", "utf8");
const labelPending = readFileSync("src/components/LabelPendingResult.tsx", "utf8");
const label = `${labelRoute}\n${labelQualified}\n${labelPending}`;
const expert = readFileSync("src/components/ExpertCards.tsx", "utf8");

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function requireText(source, text, scope) {
  if (!normalize(source).includes(normalize(text))) {
    throw new Error(`${scope}: required disclaimer text missing: ${text}`);
  }
}

function forbidText(source, text, scope) {
  if (normalize(source).includes(normalize(text))) {
    throw new Error(`${scope}: outdated/overbroad disclaimer text still present: ${text}`);
  }
}

requireText(footer, "independent consumer-information and safety-intelligence platform", "Footer");
requireText(footer, "not a probability that a product is safe", "Footer");
requireText(footer, "provisional or insufficient-evidence status", "Footer");
requireText(footer, "maximum extent permitted by applicable law", "Footer");
requireText(footer, "liability that cannot lawfully be excluded or limited", "Footer");
requireText(footer, "does not manufacture, sell, stock or fulfil products", "Footer");
forbidText(footer, "No government publication, standard, or circular has been reproduced", "Footer");
forbidText(footer, "independent professional interpretation", "Footer");
forbidText(footer, "no liability shall attach", "Footer");

requireText(labelRoute, "LabelPendingResult", "Check My Label route");
requireText(labelRoute, "LabelQualifiedResult", "Check My Label route");
requireText(
  label,
  "A Safety Score is a SafeProducts analytical index—not a probability of safety, medical advice, government approval, regulatory certification, or a legal-compliance determination.",
  "Check My Label",
);
requireText(label, "Results may be provisional where evidence is incomplete or under review.", "Check My Label");
requireText(labelPending, "No Safety Score is shown for this pending result.", "Check My Label pending state");

requireText(expert, "Regulatory Intelligence + Pharmacy Expertise", "Homepage expertise card");
requireText(expert, "informed by doctoral-level pharmacy expertise", "Homepage expertise card");
requireText(expert, "SafeProducts' independent analytical methodology", "Homepage expertise card");
forbidText(expert, "the same standards your pharmacist relies on", "Homepage expertise card");

console.log("Disclaimer contract PASS");
