import React,{useEffect,useState} from 'react';
import { Alert,Backdrop,Box,Button,LinearProgress,Paper,Snackbar,Typography } from '@mui/material';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';

export default function UpdateManager(){
  const [state,setState]=useState(null); const [open,setOpen]=useState(false);
  useEffect(()=>{
    let off; window.electron?.obterStatusAtualizacao?.().then(s=>{setState(s);if(['available','downloading','ready','error'].includes(s?.status))setOpen(true)});
    off=window.electron?.onStatusAtualizacao?.(s=>{setState(s);setOpen(true)}); return ()=>off?.();
  },[]);
  if(!state) return null;
  const ready=state.status==='ready'; const downloading=state.status==='downloading'; const error=state.status==='error';
  const text=ready?`Versão ${state.availableVersion||'nova'} pronta para instalar.`:downloading?`Baixando atualização: ${state.progress||0}%`:error?`Falha ao verificar atualização: ${state.error}`:state.status==='available'?`Nova versão ${state.availableVersion||''} encontrada.`:'';
  const action=ready?<Button color="inherit" size="small" onClick={()=>window.electron?.aplicarAtualizacao?.()}>REINICIAR E ATUALIZAR</Button>:error?<Button color="inherit" size="small" onClick={()=>window.electron?.verificarAtualizacao?.()}>TENTAR NOVAMENTE</Button>:null;
  return <>
    {state.mandatory&&<Backdrop open sx={{zIndex:20000,background:'rgba(15,23,42,.86)',backdropFilter:'blur(10px)'}}><Paper sx={{width:'min(560px,92vw)',p:5,borderRadius:5,textAlign:'center'}}><SystemUpdateAltRoundedIcon sx={{fontSize:64,color:'#ff3b8a'}}/><Typography variant="h4" fontWeight={950} mt={2}>Atualização obrigatória</Typography><Typography color="text.secondary" mt={1.5}>Uma versão essencial do Movyo precisa ser instalada para manter compatibilidade, segurança e funcionamento correto.</Typography>{downloading&&<Box mt={3}><LinearProgress variant="determinate" value={state.progress||0}/><Typography mt={1}>{state.progress||0}%</Typography></Box>}{error&&<Alert severity="error" sx={{mt:3}}>{state.error}</Alert>}<Button fullWidth size="large" variant="contained" disabled={!ready&&downloading} sx={{mt:3,borderRadius:3,background:'linear-gradient(135deg,#ff3b8a,#ff7a45)'}} onClick={()=>ready?window.electron?.aplicarAtualizacao?.():window.electron?.verificarAtualizacao?.()}>{ready?'Reiniciar e instalar agora':error?'Tentar novamente':'Baixando atualização...'}</Button></Paper></Backdrop>}
    {!state.mandatory&&text&&<Snackbar open={open} onClose={()=>setOpen(false)} anchorOrigin={{vertical:'bottom',horizontal:'right'}}><Alert severity={error?'error':ready?'success':'info'} variant="filled" sx={{minWidth:380,alignItems:'center'}} action={action}>{text}{downloading&&<Box sx={{mt:1}}><LinearProgress variant="determinate" value={state.progress||0}/></Box>}</Alert></Snackbar>}
  </>;
}
