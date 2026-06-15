import { getBotStatus, startBot, stopBot, getBotQr } from './api';

export async function verificarStatusBot(restauranteId, onConectar) {
  try {
    const { data } = await getBotStatus(restauranteId);
    const ligado = typeof data?.ligado === 'boolean' ? data.ligado : undefined;
    const conectado = typeof data?.conectado === 'boolean' ? data.conectado : undefined;
    if (ligado && !conectado) onConectar?.();
    return { ligado, conectado, erro: false, raw: data };
  } catch (e) {
    console.warn('Erro ao verificar bot:', e);
    // Não devolve false aqui para não desligar visualmente o switch por falha momentânea de polling/API.
    return { ligado: undefined, conectado: undefined, erro: true };
  }
}

export const ligarBot = async (restauranteId) => {
  await startBot(restauranteId);
  return { ligado: true, conectado: false };
};

export const desligarBot = async (restauranteId) => {
  await stopBot(restauranteId);
  return { ligado: false, conectado: false };
};
export const obterQrBot = async (restauranteId) => {
  const { data } = await getBotQr(restauranteId);
  return data;
};
