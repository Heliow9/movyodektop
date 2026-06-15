import { io } from "socket.io-client";

const SERVICE_URL = "http://localhost:9100";

let socket;

export function getPrintSocket() {
  if (!socket) {
    socket = io(SERVICE_URL, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 3000,
    });
  }
  return socket;
}

export function connectPrintService() {
  const s = getPrintSocket();
  if (!s.connected) s.connect();
  return s;
}
