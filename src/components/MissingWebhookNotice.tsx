export function MissingWebhookNotice() {
  return (
    <div className="rounded-lg border border-divider bg-card p-6 text-center">
      <p className="text-sm text-heading">
        Product checks are temporarily unavailable. Please try again later.
      </p>
    </div>
  );
}
