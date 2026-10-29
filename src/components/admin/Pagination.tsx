export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-body">
      <span>{total} total · page {page} of {pages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded border border-divider px-3 py-1 disabled:opacity-40 hover:border-brand-blue">Prev</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded border border-divider px-3 py-1 disabled:opacity-40 hover:border-brand-blue">Next</button>
      </div>
    </div>
  );
}
