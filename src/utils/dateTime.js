/**
 * Converte datas vindas da API para timestamp de forma previsível.
 *
 * Regras importantes:
 * - aceita Date, epoch em segundos/milisegundos, Mongo Extended JSON e strings;
 * - ISO sem fuso é tratado como UTC, pois a API Movyo persiste horários em UTC;
 * - datas brasileiras DD/MM/AAAA HH:mm[:ss] são tratadas no horário local;
 * - valores inválidos retornam NaN em vez de gerar contadores incorretos.
 */
export function parseDateTimeMs(value) {
  if (value == null || value === "") return NaN;

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  if (typeof value === "object") {
    const nested =
      value.$date ??
      value.date ??
      value.iso ??
      value.value ??
      value.timestamp ??
      null;
    return nested == null ? NaN : parseDateTimeMs(nested);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return NaN;
    // Epoch em segundos normalmente possui 10 dígitos; em milissegundos, 13.
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  }

  const raw = String(value).trim();
  if (!raw) return NaN;

  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return parseDateTimeMs(Number(raw));
  }

  // Formato brasileiro local: 14/06/2026 22:35:10
  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/
  );
  if (br) {
    const [, dd, mm, yyyy, hh = "0", min = "0", sec = "0", milli = "0"] = br;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(sec),
      Number(String(milli).padEnd(3, "0"))
    );
    const ms = date.getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  // A API trabalha em UTC. Alguns serializers removem o sufixo Z; recolocamos
  // apenas quando a string é um timestamp ISO completo e realmente não tem fuso.
  const isNaiveIsoDateTime =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(raw);
  const normalized = isNaiveIsoDateTime ? `${raw.replace(" ", "T")}Z` : raw;

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : NaN;
}

export function firstValidDateTimeMs(...values) {
  for (const value of values) {
    const ms = parseDateTimeMs(value);
    if (Number.isFinite(ms)) return ms;
  }
  return NaN;
}

function normalizeStatus(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Momento original de criação do pedido, com fallback para o ObjectId Mongo. */
export function getPedidoCreatedMs(pedido) {
  const ms = firstValidDateTimeMs(
    pedido?.criadoEm,
    pedido?.createdAt,
    pedido?.created_at,
    pedido?.dataCriacao,
    pedido?.data_criacao,
    pedido?.pedido?.criadoEm,
    pedido?.pedido?.createdAt
  );
  if (Number.isFinite(ms)) return ms;

  const id = String(pedido?._id || pedido?.id || pedido?.pedidoId || "");
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return Number.parseInt(id.slice(0, 8), 16) * 1000;
  }
  return NaN;
}

/**
 * Início do estágio atual. Quando a API fornece um marco específico, o contador
 * reinicia corretamente ao entrar em Produção/Entrega. Sem esse marco, usa a
 * criação do pedido, evitando reset artificial baseado em updatedAt genérico.
 */
export function getPedidoTimerStartMs(pedido) {
  const status = normalizeStatus(
    pedido?.status || pedido?.situacao || pedido?.statusOriginal
  );

  let stageMs = NaN;

  if (["em_entrega", "em_rota", "rota", "saiu_para_entrega"].includes(status)) {
    stageMs = firstValidDateTimeMs(
      pedido?.emEntregaEm,
      pedido?.em_entrega_em,
      pedido?.saiuParaEntregaEm,
      pedido?.entregaIniciadaEm,
      pedido?.rotaIniciadaEm,
      pedido?.statusEmEntregaEm,
      pedido?.statusAtualizadoEm,
      pedido?.statusUpdatedAt,
      pedido?.historicoStatus?.em_entrega,
      pedido?.historico?.em_entrega
    );
  } else if (
    ["em_producao", "producao", "preparo", "em_preparo", "cozinha"].includes(status)
  ) {
    stageMs = firstValidDateTimeMs(
      pedido?.emProducaoEm,
      pedido?.em_producao_em,
      pedido?.producaoEm,
      pedido?.producaoIniciadaEm,
      pedido?.preparoIniciadoEm,
      pedido?.statusEmProducaoEm,
      pedido?.statusAtualizadoEm,
      pedido?.statusUpdatedAt,
      pedido?.cozinha?.iniciadoEm,
      pedido?.historicoStatus?.em_producao,
      pedido?.historico?.em_producao
    );
  } else if (["pago", "recebido", "novo", "aguardando"].includes(status)) {
    stageMs = firstValidDateTimeMs(
      pedido?.recebidoEm,
      pedido?.pagoEm,
      pedido?.paymentApprovedAt,
      pedido?.pagamento?.aprovadoEm,
      pedido?.statusPagoEm
    );
  }

  return Number.isFinite(stageMs) ? stageMs : getPedidoCreatedMs(pedido);
}

export function elapsedSecondsFromMs(startMs, nowMs = Date.now()) {
  if (!Number.isFinite(startMs)) return 0;
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  return Math.max(0, Math.floor((now - startMs) / 1000));
}
