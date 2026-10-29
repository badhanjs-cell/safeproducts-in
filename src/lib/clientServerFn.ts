// Browser-safe implementation of createServerFn and useServerFn
// Avoids bundling @tanstack/react-start server internals (node:async_hooks / AsyncLocalStorage)
// while executing the exact same Supabase Edge Function handlers directly.

export const SAFEPRODUCTS_RUNTIME_ENV: Record<string, string | undefined> = {
  SUPABASE_PROJECT_ID: "wmxbdirvlwuagouraobr",
  SUPABASE_URL: "https://wmxbdirvlwuagouraobr.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGJkaXJ2bHd1YWdvdXJhb2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTAwODgsImV4cCI6MjA5MjI2NjA4OH0.JMmfyKke6NkMYRkOsHi3WCG-_xAVvh-6BEo7v0mLMDA",
  VITE_SUPABASE_PROJECT_ID: "wmxbdirvlwuagouraobr",
  VITE_SUPABASE_URL: "https://wmxbdirvlwuagouraobr.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGJkaXJ2bHd1YWdvdXJhb2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTAwODgsImV4cCI6MjA5MjI2NjA4OH0.JMmfyKke6NkMYRkOsHi3WCG-_xAVvh-6BEo7v0mLMDA",
  SP_M1B_SEARCH_ENABLED: "true",
  SP_M1B_LABEL_ENABLED: "true",
  SP_PROD1_SEARCH_ENABLED: "false",
};

export function createServerFn(_options?: { method?: "GET" | "POST" }) {
  return {
    inputValidator<TIn>(validator: (input: unknown) => TIn) {
      return {
        handler<TOut>(fn: (ctx: { data: TIn }) => Promise<TOut> | TOut) {
          return async (opts?: { data?: unknown }): Promise<TOut> => {
            const parsed = validator(opts?.data);
            return await fn({ data: parsed });
          };
        },
      };
    },
    handler<TOut>(fn: (ctx: { data: undefined }) => Promise<TOut> | TOut) {
      return async (): Promise<TOut> => {
        return await fn({ data: undefined });
      };
    },
  };
}

export function useServerFn<TFn extends (...args: any[]) => any>(fn: TFn): TFn {
  return fn;
}
