import { enviarParaImpressao } from '../utils/enviarImpressao';

const KEY = 'movyoPrintQueueV2';
const MAX_ATTEMPTS = 8;
let processing = false;
let timer = null;

function read() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function write(items) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-300)));
  window.dispatchEvent(new CustomEvent('movyo:print-queue-changed', { detail:getPrintQueueStatus() }));
}
function idOf(p){ return String(p?.id || p?._id || p?.pedidoId || ''); }

export function getPrintQueue(){ return read(); }
export function getPrintQueueStatus(){
  const items=read();
  return { total:items.length, pendentes:items.filter(i=>i.status==='pendente'||i.status==='processando').length, falhas:items.filter(i=>i.status==='falha').length, impressos:items.filter(i=>i.status==='impresso').length, items };
}
export function retryPrintJob(jobId){
  write(read().map(j=>j.jobId===jobId?{...j,status:'pendente',tentativas:0,proximaTentativaEm:0,erro:''}:j));
  processPrintQueue();
}
export function clearFinishedPrintJobs(){ write(read().filter(j=>j.status!=='impresso')); }

export async function enqueuePrint(pedido, options={}, source='manual'){
  const pedidoId=idOf(pedido);
  if(!pedidoId) throw new Error('Pedido sem identificador para impressão.');
  const items=read();
  const existing=items.find(j=>j.pedidoId===pedidoId && !['falha'].includes(j.status));
  if(existing) return existing;
  const job={jobId:`${pedidoId}-${Date.now()}`,pedidoId,pedido,options,source,status:'pendente',tentativas:0,criadoEm:new Date().toISOString(),proximaTentativaEm:0,erro:''};
  items.push(job); write(items); processPrintQueue(); return job;
}

export async function processPrintQueue(){
  if(processing) return;
  processing=true;
  try{
    let items=read();
    for(let i=0;i<items.length;i++){
      const job=items[i];
      if(!['pendente','processando'].includes(job.status)) continue;
      if(Number(job.proximaTentativaEm||0)>Date.now()) continue;
      items[i]={...job,status:'processando'}; write(items);
      try{
        await enviarParaImpressao(job.pedido,job.options||{});
        items=read();
        const idx=items.findIndex(j=>j.jobId===job.jobId);
        if(idx>=0) items[idx]={...items[idx],status:'impresso',impressoEm:new Date().toISOString(),erro:''};
        write(items);
        window.dispatchEvent(new CustomEvent('movyo:autoprint:ok',{detail:{pedidoId:job.pedidoId,source:job.source,queue:true}}));
      }catch(error){
        items=read();
        const idx=items.findIndex(j=>j.jobId===job.jobId);
        if(idx>=0){
          const tentativas=Number(items[idx].tentativas||0)+1;
          const final=tentativas>=MAX_ATTEMPTS;
          items[idx]={...items[idx],tentativas,status:final?'falha':'pendente',erro:error?.message||String(error),proximaTentativaEm:final?0:Date.now()+Math.min(60000,2000*(2**Math.min(tentativas,5)))};
        }
        write(items);
        window.dispatchEvent(new CustomEvent('movyo:autoprint:error',{detail:{pedidoId:job.pedidoId,error:error?.message||String(error),source:job.source,queue:true}}));
      }
    }
  }finally{
    processing=false;
    clearTimeout(timer);
    timer=setTimeout(processPrintQueue,5000);
  }
}

if(typeof window!=='undefined'){
  window.addEventListener('online',processPrintQueue);
  setTimeout(processPrintQueue,1000);
}
