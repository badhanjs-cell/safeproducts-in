import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudbuild = fs.readFileSync("cloudbuild.yaml", "utf8");
const dockerfile = fs.readFileSync("Dockerfile", "utf8");

test("SafeProducts Cloud Build targets canonical production Cloud Run service", () => {
  assert.match(cloudbuild, /_SERVICE_NAME:\s*safeproducts-web/);
  assert.match(cloudbuild, /_DEPLOY_REGION:\s*asia-south1/);
  assert.match(cloudbuild, /cloud-run-source-deploy/);
});

test("Cloud Build refuses to create an unintended second service", () => {
  assert.match(cloudbuild, /services\s*\n\s*- describe/);
  assert.match(cloudbuild, /services\s*\n\s*- update/);
  assert.doesNotMatch(cloudbuild, /services\s*\n\s*- deploy/);
});

test("Cloud Build deploys the exact commit-tagged image", () => {
  assert.match(cloudbuild, /\$COMMIT_SHA/);
  assert.match(cloudbuild, /--image=\$_AR_HOSTNAME\/\$PROJECT_ID\/\$_AR_REPOSITORY\/\$_IMAGE_NAME:\$COMMIT_SHA/);
});

test("Cloud Build does not inject privileged application secrets", () => {
  assert.doesNotMatch(cloudbuild, /SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|SERPAPI_API_KEY|sb_secret_/i);
  assert.doesNotMatch(cloudbuild, /--set-env-vars|--set-secrets/);
});

test("Cloud Run container still uses non-root Node runtime on port 8080", () => {
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /PORT=8080/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /CMD \["node", "\.output\/server\/index\.mjs"\]/);
});
