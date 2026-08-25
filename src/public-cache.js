const PREFIX='elvira-cache:';
const TTL=60000;
export async function cachedRead(key, loader){
  const cacheKey=PREFIX+key;
  try{
    const raw=localStorage.getItem(cacheKey);
    if(raw){const item=JSON.parse(raw); if(Date.now()-item.time<TTL) return item.value;}
  }catch{}
  const value=await loader();
  try{localStorage.setItem(cacheKey,JSON.stringify({time:Date.now(),value}));}catch{}
  return value;
}
export function invalidatePublicCache(){try{Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)).forEach(k=>localStorage.removeItem(k));}catch{}}
