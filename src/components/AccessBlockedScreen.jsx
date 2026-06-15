import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

const SUPPORT_URL=import.meta.env.VITE_MOVYO_SUPPORT_URL||'https://movyo.delivery';
export default function AccessBlockedScreen({message,onRetry,onLogout}){
  const isOffline=String(message||'').toLowerCase().includes('conex');
  return <Box sx={{minHeight:'100vh',display:'grid',placeItems:'center',p:3,background:'radial-gradient(circle at 20% 10%,rgba(255,59,138,.2),transparent 28rem),linear-gradient(135deg,#fff7fb,#f6f8fc)'}}>
    <Paper elevation={0} sx={{maxWidth:620,width:'100%',p:{xs:3,md:5},borderRadius:5,border:'1px solid rgba(255,59,138,.18)',boxShadow:'0 28px 80px rgba(15,23,42,.14)',textAlign:'center'}}>
      <Box sx={{width:76,height:76,borderRadius:4,mx:'auto',display:'grid',placeItems:'center',color:'white',background:'linear-gradient(135deg,#ff3b8a,#ff8a35)',boxShadow:'0 18px 40px rgba(255,59,138,.28)'}}><LockClockRoundedIcon sx={{fontSize:38}}/></Box>
      <Typography variant="h4" sx={{mt:3,fontWeight:950,color:'#111827'}}>{isOffline?'Validação temporariamente indisponível':'Acesso Movyo suspenso'}</Typography>
      <Typography sx={{mt:1.5,color:'#64748b',fontSize:17,lineHeight:1.65}}>{message}</Typography>
      <Typography sx={{mt:2,color:'#94a3b8'}}>Se o pagamento já foi regularizado, conecte o computador à internet e tente novamente.</Typography>
      <Box sx={{display:'flex',gap:1.5,justifyContent:'center',flexWrap:'wrap',mt:4}}>
        <Button variant="contained" startIcon={<RefreshRoundedIcon/>} onClick={onRetry} sx={{borderRadius:3,px:3,background:'linear-gradient(135deg,#ff3b8a,#ff7a45)'}}>Validar novamente</Button>
        <Button variant="outlined" startIcon={<SupportAgentRoundedIcon/>} onClick={()=>window.electron?.openExternal?.(SUPPORT_URL)} sx={{borderRadius:3,px:3}}>Falar com suporte</Button>
        <Button color="inherit" onClick={onLogout}>Trocar conta</Button>
      </Box>
    </Paper>
  </Box>;
}
