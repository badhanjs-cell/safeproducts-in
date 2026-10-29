# SafeProducts Architecture Rules

- The frontend has exactly one search authority: `searchProductsClient` → the `searchProducts` server function → SP-US2 `sp-us2-search-v3`. Result UI must not call Supabase resilience/discovery RPCs directly, because a second client-side source can render products that bypass backend qualification.
- Safety refreshes in `SearchResults` are bounded and best-effort: a refresh that fails or returns nothing keeps the last visible result instead of clearing the screen.
