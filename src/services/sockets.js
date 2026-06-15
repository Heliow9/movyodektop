import { io } from 'socket.io-client';
import { API_URL } from './api';

export const SOCKET_STATUS_EVENT = 'movyo:socket-status';

function emit(status, detail={}){
  if(typeof window==='undefined') return;
  window.dispatchEvent(new CustomEvent(SOCKET_STATUS_EVENT,{detail:{status,at:new Date().toISOString(),...detail}}));
}

export const createSocket = () => {
  const token = typeof window!=='undefined' ? String(localStorage.getItem('_token')||'') : '';
  const socket = io(API_URL, {
    autoConnect:true,
    transports:['websocket','polling'],
    reconnection:true,
    reconnectionAttempts:Infinity,
    reconnectionDelay:1000,
    reconnectionDelayMax:15000,
    randomizationFactor:0.4,
    timeout:12000,
    auth: token ? {token: token.startsWith('Bearer ')?token.slice(7):token}:undefined,
  });
  socket.on('connect',()=>emit('online',{socketId:socket.id}));
  socket.on('disconnect',(reason)=>emit('offline',{reason}));
  socket.io.on('reconnect_attempt',(attempt)=>emit('reconectando',{attempt}));
  socket.io.on('reconnect',(attempt)=>emit('online',{attempt,socketId:socket.id}));
  socket.on('connect_error',(error)=>emit('erro',{error:error?.message||String(error)}));
  return socket;
};
