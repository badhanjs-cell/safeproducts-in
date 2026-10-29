import type { Profile } from '@/components/HeroSearch';
import { searchProducts } from './productSearch.functions';
import { normalizeSearchQuery } from './searchLanguage';
import { toApiProfile, unavailable, type ApiProfile, type ContractResult } from './searchContract';
import { rememberQualifiedProducts } from './qualifiedSearchSession';
export { toApiProfile };
export type { ApiProfile };
export async function searchProductsClient(input:{query:string;profile:Profile;limit?:number;category?:string;location?:string|null}):Promise<ContractResult> {
  const query=normalizeSearchQuery(input.query);
  if(!query) return {results:[],error:null,missingUrl:false,status:'EMPTY_QUERY',rejectedCount:0,
    trustPromise:null,trustPromiseDisplayRequired:false,consumerNotice:null};
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const request=searchProducts({data:{query,profile:toApiProfile(input.profile),limit:input.limit??10,
      category:input.category??'all',location:input.location??null}});
    // The server owns the 120s resilience ceiling, including the bounded SerpAPI retry path.
    // Keep the browser deadline slightly above it so the server's own TIMED_OUT result wins first.
    const deadline=new Promise<ContractResult>(resolve=>{timer=setTimeout(()=>resolve(unavailable('TIMED_OUT')),125000);});
    const result=await Promise.race([request,deadline]);
    rememberQualifiedProducts(result.results);
    return result;
  } catch { return unavailable(); }
  finally { if(timer) clearTimeout(timer); }
}
