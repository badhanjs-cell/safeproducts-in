# SafeProducts — Production Cloud Build / Cloud Run

## Canonical source

- Repository: `badhanjs-cell/safeproducts`
- Production branch: `main`
- Cloud Run service: `safeproducts-web`
- Region: `asia-south1`
- Build config: `/cloudbuild.yaml`
- Container: `/Dockerfile`

The existing development Cloud Run service may be used for validation, but production cutover must target `safeproducts-web`.

## Deployment contract

The repository-owned Cloud Build config:

1. builds the exact Git commit into a Docker image;
2. pushes that image to Artifact Registry;
3. verifies that the target Cloud Run service already exists;
4. updates only that existing service to the exact commit-tagged image.

It intentionally does **not** create a Cloud Run service. This prevents an accidental second production service during cutover.

## Runtime configuration

The checked-in web environment contains only browser-publishable Supabase bindings and SafeProducts feature flags used at build time.

Do not add privileged credentials to:
- Vite variables,
- repository `.env`,
- Docker build arguments,
- `cloudbuild.yaml`.

Any future server-only secret must be stored in Secret Manager and injected at runtime.

## Google Cloud production project

Use a dedicated SafeProducts production project, separate from PEDOS and AI Dual SaaS.

Recommended project display name:
`SafeProducts-CloudRun-Prod`

Recommended project ID pattern:
`safeproducts-cloudrun-prod` (or the closest available globally unique ID).

Before enabling the production trigger:

1. create the Artifact Registry repository `cloud-run-source-deploy` in `asia-south1`;
2. create the Cloud Run service `safeproducts-web` in `asia-south1`;
3. configure public access only if the consumer web application is intended to be directly reachable;
4. use port 8080;
5. keep Railway/Lovable production routing unchanged until Cloud Run acceptance passes.

## Continuous deployment trigger

Connect GitHub repository `badhanjs-cell/safeproducts`.

- Event: push to branch
- Branch regex: `^main$`
- Configuration: repository Cloud Build configuration file
- Location: `cloudbuild.yaml`

Required trigger substitutions already have safe defaults in the file:
- `_SERVICE_NAME=safeproducts-web`
- `_DEPLOY_REGION=asia-south1`
- `_AR_HOSTNAME=asia-south1-docker.pkg.dev`
- `_AR_REPOSITORY=cloud-run-source-deploy`
- `_IMAGE_NAME=safeproducts-web`

## Production acceptance

Do not cut user traffic until all checks pass:

1. Cloud Build succeeds from the current `main` commit.
2. Cloud Run revision label contains that commit SHA.
3. Root application surface responds successfully.
4. Sign-in/authenticated flows work where applicable.
5. Search, profile/category browsing, Check My Label and other launch-critical SafeProducts workflows pass their existing production acceptance tests.
6. Any dependent OCR service URL remains valid.
7. Existing production host remains available as rollback until acceptance is complete.

## Isolation

This migration is SafeProducts-only. It does not alter PEDOS, AI Dual SaaS, GRIL, Supabase projects, or unrelated Make scenarios.
