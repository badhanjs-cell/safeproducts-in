# Check My Label transient failure recovery

## Scope
- Update only `src/lib/labels.functions.ts`.
- Keep the canonical Supabase URL/key guards, anonymous access token, request payload, 65-second overall ceiling, response validation, scoring fields, and consumer-facing contract unchanged.
- Retry the label Edge request once after a short delay only when it returns a transient `502`, `503`, or `504` response.
- Do not retry authentication, rate-limit, configuration, validation, or other terminal failures.
- Preserve safe server logging without exposing credentials, images, or tokens.

## Validation
- Run TypeScript checking and the development build.
- Re-run a synthetic authenticated request against the canonical label service to confirm the active endpoint still returns a valid v3 response.
- Do not publish or deploy.
