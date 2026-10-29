import { useEffect, useState } from 'react';
import { SEARCH_PROGRESS_NOTE, searchProgressPhase } from '@/lib/searchProgress';

// Purely presentational: the ticking clock never changes network behaviour and
// warm responses simply unmount this before later phases appear.
export function SearchProgress({ resetKey }: { resetKey: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, [resetKey]);

  return (
    <div className="space-y-2 py-12 text-center" aria-live="polite" aria-busy="true">
      <p className="text-heading">{searchProgressPhase(elapsed)}</p>
      <p className="text-xs text-body">{SEARCH_PROGRESS_NOTE}</p>
    </div>
  );
}
