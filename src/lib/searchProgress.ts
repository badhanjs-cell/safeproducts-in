// Neutral, local-elapsed-time-only progress wording for the search wait.
// No percentage, no ETA, no safety conclusion, and no cache/warm-vs-cold inference:
// the backend does not expose cache metadata and the frontend must not guess it.
export const SEARCH_PROGRESS_NOTE='Some searches take longer when more evidence must be checked.';

export const SEARCH_PROGRESS_PHASES=[
  {atMs:0,label:'Finding matching products…'},
  {atMs:4000,label:'Checking available product evidence…'},
  {atMs:15000,label:'Completing independent regulatory safety checks…'},
  {atMs:35000,label:'Finalizing eligible results…'},
] as const;

export function searchProgressPhase(elapsedMs:number):string {
  const t=Number.isFinite(elapsedMs) && elapsedMs>0 ? elapsedMs : 0;
  let label:string=SEARCH_PROGRESS_PHASES[0].label;
  for(const phase of SEARCH_PROGRESS_PHASES) if(t>=phase.atMs) label=phase.label;
  return label;
}
