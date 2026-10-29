# SafeProducts independent safety validation and controlled-score promotion — v1

## Intended use and non-claims
This workflow qualifies a **consumer ingredient risk screening algorithm**, not the clinical safety or efficacy of any finished product. No numerical product Safety Score may be published from multi-source evidence solely because a source matches. Indian regulatory applicability must be independently determined and is distinct from NIH/FDA scientific advice.

This validation approach is informed by the [IMDRF/FDA Good Machine Learning Practice principles](https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/good-machine-learning-practice-medical-device-development-guiding-principles) concerning independent test sets, clinically relevant references, representative subgroups, human-AI performance, lifecycle monitoring and change control. These principles are used as process guidance, not as certification by FDA or IMDRF.

## Independent benchmark governance
1. **Pre-register** a policy checksum, exact code SHA, intended category, profiles, route, exposure assumptions, and a frozen holdout set. Cases must come from documented external, product-realistic sources with permitted reuse; label-images are not copied into the benchmark. Minimum 100 holdout cases per category (supplement, food, cosmetic), at least 20 positive clinically high-concern examples each; further sample sizes must be justified statistically before final launch. Household products stay out of scope until domain evidence exists.
2. Two independently credentialed clinical reviewers and two independently credentialed regulatory reviewers annotate each holdout case blinded to the candidate prediction. Individual reviews are immutable. Each dimension requires agreement of both reviewers; disagreements require an independent adjudication process before inclusion. Reviewers are distinct from software builders. Evidence documents, jurisdictions, dates and dosing assumptions are part of the case reference record.
3. Candidate predictions are frozen before any reviewer judgments are released to the scoring engineer. Test instances are separated from development, tuning and prompt iteration by product family/brand and provenance. Any alteration to the policy or dataset requires a new version and rerun.
4. **Clinical benchmark:** severe-harm/contraindication sensitivity >=98%, zero unmitigated high-concern cases assigned LOW_CONCERN, and coverage >=90%. Regulatory benchmark: zero cases with PROHIBITED/RESTRICTED reference assessed as PERMITTED; report per-category confusion matrices and uncertainty. Any false reassurance fails the gate irrespective of aggregate accuracy.
5. Auditor independently reviews reference quality, subgroup coverage, confidence intervals, conflict cases, category and licensing applicability, data contamination, reproducibility and cost/latency; release authority separately approves a bounded scope. An automated PASS without these two approvals is insufficient. Clinical and regulatory reviewers cannot perform auditor or release roles on the same candidate.
6. **Controlled promotion:** start SHADOW_ONLY. Promotion authority may activate an exact version/checksum only after independent PASS and human attestations, with expiry and rollback. Main qualified Safety Score pipeline remains unchanged until a separately qualified scoring adapter and product-evidence completeness policy exist. Unknown products, missing doses, unpublished ingredients, profile-critical warnings and insufficient reference coverage abstain.
7. Monitor drift, post-deployment false-safe alerts, source-version changes, performance by category/profile and runtime errors; any critical incident triggers immediate revocation. No automatic promotion or automatic human approval.

## Current readiness
PR introducing governance is **not** independent validation itself. The initial SafeProducts evidence corpus has 11 manually coded concern rules and a small set of official science sources. No blinded externally reviewed 100-case-per-category holdout set, four independent expert labels per case, audited confusion matrix, or independent product-level numeric calibration exists yet. Therefore no new product Safety Score may be released from this lane at installation. Keep existing qualified-score path untouched.

## Primary failure classes
- Ashwagandha Ayurvedic proprietary medicine misrouted as FSSAI food supplement
- Identical-image recognition variance; source-grounded text cache only
- Dose units vs daily serving; FDA general-adult recommendations misapplied to pregnancy or children
- Cosmetic topical salicylic acid incorrectly applied to oral food
- Ingredient alias false positive (e.g., 'iron' inside unrelated names)
- Undisclosed fragrance/excipients treated as assessed individual substances
- Regulatory source not locally applicable or superseded
- Incomplete labels incorrectly receiving high safety scores
- Duplicate brand variants/pack cross-contamination and photo privacy leakage

## Gate acceptance
Production must not show the new multi-source numeric score while any item remains PENDING. A qualified release is **scoped**, revocable, time bounded and required to include externally reviewed outcomes and explicit human attestation. Do not equate software CI green with external clinical/regulatory validation.
