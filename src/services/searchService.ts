// Compatibility export for existing callers. Uses the same bounded server path.
import { searchProducts } from '@/lib/productSearch.functions';
import { unavailable, type ApiProfile } from '@/lib/searchContract';
export type UserProfile=ApiProfile;
export const ALLOWED_PROFILES:readonly UserProfile[]=['all','children','pregnant','seniors'];
export type SearchSafeProductsRow=Record<string,unknown>;
export type SearchResult={rows:SearchSafeProductsRow[];error:string|null};
export async function searchSafeProducts(searchQuery:string,userProfile:UserProfile):Promise<SearchResult> {
  if(!searchQuery.trim()) return {rows:[],error:null};
  if(!ALLOWED_PROFILES.includes(userProfile)) return {rows:[],error:'Invalid profile'};
  try { const result=await searchProducts({data:{query:searchQuery,profile:userProfile,limit:10,category:'all',location:null}});
    return {rows:result.results.map(p=>({...p})),error:result.error};
  } catch { return {rows:[],error:unavailable().error}; }
}
