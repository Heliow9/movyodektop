const KEY='movyoLicenseValidationV1';
export const OFFLINE_GRACE_MS=Number(import.meta.env.VITE_OFFLINE_GRACE_HOURS||12)*60*60*1000;
export function saveValidLicense(restaurante){
  const payload={validatedAt:Date.now(),restauranteId:String(restaurante?._id||restaurante?.id||localStorage.getItem('_id')||''),dataFimPlano:restaurante?.dataFimPlano||null,plano:restaurante?.plano||null};
  localStorage.setItem(KEY,JSON.stringify(payload)); return payload;
}
export function getLicenseCache(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
export function getOfflineGrace(){
  const cache=getLicenseCache(); const elapsed=cache?.validatedAt?Date.now()-Number(cache.validatedAt):Infinity;
  return {cache,elapsed,allowed:elapsed<=OFFLINE_GRACE_MS,remainingMs:Math.max(0,OFFLINE_GRACE_MS-elapsed)};
}
export function clearLicenseCache(){localStorage.removeItem(KEY)}
