import axios from "axios";
import { getAuthBlockMessageFromError } from "../utils/licenseGuard";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";
export const ACCESS_BLOCK_EVENT = "movyo:access-blocked";


function getStoredToken() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage?.getItem('_token') || window.localStorage?.getItem('tokenRestaurante') || '').trim();
}

function attachAuthInterceptor(instance) {
  if (!instance?.interceptors?.request || instance.__movyoAuthAttached) return instance;
  Object.defineProperty(instance, '__movyoAuthAttached', { value:true, enumerable:false });
  instance.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token && !config.headers?.Authorization) {
      config.headers = { ...(config.headers || {}), Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
    }
    config.headers = { ...(config.headers || {}), 'X-Movyo-Client':'desktop', 'X-Movyo-Version': window.electron?.appVersion || 'web' };
    return config;
  });
  return instance;
}

let lastBlockEvent = { message: "", at: 0 };

function emitAccessBlock(message) {
  if (!message || typeof window === "undefined") return;

  // Só encerra uma sessão existente. No login, o próprio formulário mostra o erro.
  const hasSession = Boolean(String(window.localStorage?.getItem("_token") || "").trim());
  if (!hasSession) return;

  const now = Date.now();
  if (lastBlockEvent.message === message && now - lastBlockEvent.at < 1500) return;
  lastBlockEvent = { message, at: now };

  window.dispatchEvent(
    new CustomEvent(ACCESS_BLOCK_EVENT, {
      detail: { message },
    })
  );
}

export function attachAccessGuardInterceptor(instance) {
  if (!instance?.interceptors?.response) return instance;
  if (instance.__movyoAccessGuardAttached) return instance;

  Object.defineProperty(instance, "__movyoAccessGuardAttached", {
    value: true,
    enumerable: false,
    configurable: false,
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const message = getAuthBlockMessageFromError(error);
      if (message) emitAccessBlock(message);
      return Promise.reject(error);
    }
  );

  return instance;
}

// Grande parte do projeto usa o axios padrão diretamente.
attachAuthInterceptor(axios);
attachAccessGuardInterceptor(axios);

export const api = attachAccessGuardInterceptor(attachAuthInterceptor(
  axios.create({ baseURL: API_URL, timeout: 20000 })
));

// Pedidos
export const fetchPedidos = (restauranteId) => api.get(`/api/pedidos/${restauranteId}`);
export const atualizarStatusPedido = (id, novoStatus) =>
  api.put(`/api/pedidos/status/${id}`, { novoStatus });

// Restaurante
export const fetchMe = (token) =>
  api.get(`/api/restaurantes/me`, { headers: { Authorization: token } });

// Bot
export const getBotStatus = (restauranteId) => api.get(`/api/bot/status/${restauranteId}`);
export const startBot = (restauranteId) => api.post(`/api/bot/start`, { restauranteId });
export const stopBot = (restauranteId) => api.delete(`/api/bot/stop/${restauranteId}`);
export const getBotQr = (restauranteId) => api.get(`/api/bot/qr/${restauranteId}`);

// Entregadores / Motoristas
export const fetchEntregadores = (restauranteId) =>
  api.get(`/api/entregadores/byRestaurante/${restauranteId}`);
export const criarEntregador = (payload) => api.post(`/api/entregadores/register`, payload);
export const atualizarEntregador = (id, payload) =>
  api.put(`/api/entregadores/editar/${id}`, payload);
export const excluirEntregador = (id) =>
  api.delete(`/api/entregadores/entregadordelete/${id}`);

// Caixa
export const fetchCaixaAtual = (restauranteId) =>
  api.get(`/api/caixa/${restauranteId}/atual`);
export const fetchOperadoresCaixa = (restauranteId) =>
  api.get(`/api/caixa/${restauranteId}/operadores`);
export const salvarOperadorCaixa = (restauranteId, payload, operadorId) =>
  operadorId
    ? api.put(`/api/caixa/${restauranteId}/operadores/${operadorId}`, payload)
    : api.post(`/api/caixa/${restauranteId}/operadores`, payload);
export const alternarOperadorCaixa = (restauranteId, operadorId, ativo) =>
  api.patch(`/api/caixa/${restauranteId}/operadores/${operadorId}/status`, { ativo });
export const abrirCaixa = (restauranteId, payload) =>
  api.post(`/api/caixa/${restauranteId}/abrir`, payload);
export const fecharCaixa = (restauranteId, payload) =>
  api.post(`/api/caixa/${restauranteId}/fechar`, payload);
export const movimentarCaixa = (restauranteId, payload) =>
  api.post(`/api/caixa/${restauranteId}/movimento`, payload);
export const fetchRelatorioCaixa = (restauranteId, params) =>
  api.get(`/api/caixa/${restauranteId}/relatorios`, { params });
