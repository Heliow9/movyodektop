// src/components/GlobalPedidosSync.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";

import { usePedidos } from "../contexts/PedidosContext";
import { fetchMe, fetchPedidos } from "../services/api";
import { createSocket } from "../services/sockets";
import { enqueuePrint } from '../services/printQueue';
import { resolveLogoUrl } from "../utils/resolveAssetUrl";
import { getPedidoCreatedMs } from "../utils/dateTime";

const PRINTED_IDS_STORAGE_KEY = "movyoAutoPrintPedidos";

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}

function round2(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNumberBRL(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? round2(v) : 0;

  let str = String(v)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!str) return 0;

  const hasComma = str.includes(",");
  const hasDot = str.includes(".");

  if (hasComma) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = str.split(".");
    const last = parts[parts.length - 1];
    // 1.234 -> 1234 | 2.50 -> 2.50
    str = last.length === 3 && parts.length > 1 ? parts.join("") : str;
  }

  const n = Number(str);
  return Number.isFinite(n) ? round2(n) : 0;
}

function getItemTotal(item) {
  const qtd = Math.max(1, toNumberBRL(item?.quantidade ?? item?.qtd ?? item?.quantity ?? 1));
  const unit = toNumberBRL(item?.precoUnitario ?? item?.preco ?? item?.valorUnitario ?? item?.valor ?? item?.price ?? 0);
  const total = toNumberBRL(item?.precoTotal ?? item?.total ?? item?.valorTotal ?? item?.subtotal);
  return total > 0 ? total : round2(qtd * unit);
}

function getPedidoTotal(pedido) {
  const direto = toNumberBRL(
    pedido?.valorTotal ??
      pedido?.total ??
      pedido?.valor ??
      pedido?.subtotal ??
      pedido?.totalPedido ??
      pedido?.totalGeral
  );
  if (direto > 0) return direto;

  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return round2(itens.reduce((acc, item) => acc + getItemTotal(item), 0));
}

function normKey(v) {
  return safeText(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarStatusPainel(pedido) {
  const origem = normKey(pedido?.origem || pedido?.tipo || pedido?.tipoPedido);
  const status = normKey(pedido?.status || pedido?.situacao);
  const statusPagamento = normKey(pedido?.statusPagamento || pedido?.pagamento?.status || pedido?.paymentStatus);

  if (["cancelado", "cancelada", "canceled", "cancelled"].includes(status)) return "cancelado";
  if (["entregue", "concluido", "concluida", "finalizado", "finalizada", "delivered"].includes(status)) return "entregue";
  if (["em_entrega", "em entrega", "em_rota", "em rota", "rota", "saiu_entrega", "saiu para entrega"].includes(status)) return "em_entrega";
  if (["em_producao", "em producao", "em_produção", "em produção", "producao", "produção", "preparo", "em_preparo", "em preparo", "preparando", "cozinha"].includes(status)) return "em_producao";

  const pago = ["pago", "paid", "approved", "aprovado"].includes(status) || ["pago", "paid", "approved", "aprovado"].includes(statusPagamento);
  if (pago && ["balcao", "balcão", "salao", "salão", "mesa", "garcom", "garçom"].includes(origem)) return "em_producao";
  if (pago) return "pago";

  if (["aguardando", "recebido", "recebida", "novo", "novo_pedido", "pendente", "aguardando_resposta"].includes(status)) return "pago";
  return status || "pago";
}

function getPedidoTimestamp(pedido) {
  const ms = getPedidoCreatedMs(pedido);
  return Number.isFinite(ms) ? ms : 0;
}

function numeroPedidoRank(pedido) {
  const raw = safeText(pedido?.numeroPedido || pedido?.numero || pedido?.codigo || pedido?.code);
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return 0;
  const n = Number(matches.join(""));
  return Number.isFinite(n) ? n : 0;
}

function sortPedidosNewest(lista) {
  return [...(Array.isArray(lista) ? lista : [])].sort((a, b) => {
    const tb = getPedidoTimestamp(b);
    const ta = getPedidoTimestamp(a);
    if (tb !== ta) return tb - ta;
    return numeroPedidoRank(b) - numeroPedidoRank(a);
  });
}

function parsePedidosResponse(res) {
  const raw = res?.data ?? res;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.pedidos)) return raw.pedidos;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.result)) return raw.result;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function formatPedidoServidor(p) {
  const id = p?._id || p?.id || p?.pedidoId || "";
  const numeroPedido = p?.numeroPedido || p?.numero || p?.codigoPedido || p?.codigo || "";
  const itens = Array.isArray(p?.itens) ? p.itens : [];
  const valorTotal = getPedidoTotal(p);

  return {
    ...p,
    _id: p?._id || id,
    id,
    numeroPedido,
    origem: p?.origem || p?.tipo || p?.tipoPedido || "",
    status: normalizarStatusPainel(p),
    statusOriginal: p?.status,
    statusPagamento: p?.statusPagamento || p?.pagamento?.status || p?.paymentStatus || "",
    nomeCliente: p?.nomeCliente || p?.cliente || p?.clienteNome || "Cliente",
    cliente: p?.cliente || p?.nomeCliente || p?.clienteNome || "Cliente",
    telefoneCliente: p?.telefoneCliente || p?.telefone || p?.celular || "",
    mesaNumero: p?.mesaNumero || p?.numeroMesa || p?.mesa?.numero || p?.mesa?.nome || "",
    formaPagamento: p?.formaPagamento || p?.metodoPagamento || p?.pagamento?.forma || p?.pagamento?.tipo || "",
    vendedorNome:
      p?.vendedorNome ||
      p?.nomeVendedor ||
      p?.garcomNome ||
      p?.nomeGarcom ||
      p?.usuarioNome ||
      p?.criadoPorNome ||
      p?.vendedor?.nome ||
      p?.garcom?.nome ||
      p?.usuario?.nome ||
      "",
    itens,
    valorTotal,
    total: valorTotal,
    criadoEm: p?.criadoEm || p?.createdAt || p?.created_at || p?.dataCriacao,
    updatedAt: p?.updatedAt || p?.updated_at,
  };
}

function getStoredPrintedIds() {
  try {
    const raw = sessionStorage.getItem(PRINTED_IDS_STORAGE_KEY) || "[]";
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function savePrintedIds(set) {
  try {
    sessionStorage.setItem(PRINTED_IDS_STORAGE_KEY, JSON.stringify(Array.from(set).slice(-400)));
  } catch {
    // noop
  }
}

function isPrintablePedido(pedido) {
  const origem = normKey(pedido?.origem || pedido?.tipo);
  const status = normalizarStatusPainel(pedido);
  const statusPagamento = normKey(pedido?.statusPagamento || pedido?.pagamento?.status || "");
  const pago = status === "pago" || status === "em_producao" || ["pago", "paid", "approved", "aprovado"].includes(statusPagamento);
  if (!pago) return false;
  return ["balcao", "balcão", "salao", "salão", "mesa", "garcom", "garçom", "vitrine", "delivery", "site", "web"].includes(origem);
}

export default function GlobalPedidosSync({ authenticated }) {
  const { setPedidos } = usePedidos();
  const [restauranteId, setRestauranteId] = useState("");
  const [ctx, setCtx] = useState({ nomeRestaurante: "", logoUrl: "" });

  const knownIdsRef = useRef(new Set());
  const printedIdsRef = useRef(getStoredPrintedIds());
  const autoPrintRef = useRef(localStorage.getItem("autoImprimir") === "true");
  const refreshTimerRef = useRef(null);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    window.__MOVYO_GLOBAL_AUTO_PRINT__ = true;
    return () => {
      window.__MOVYO_GLOBAL_AUTO_PRINT__ = false;
    };
  }, []);

  useEffect(() => {
    const syncAutoPrint = () => {
      autoPrintRef.current = localStorage.getItem("autoImprimir") === "true";
    };

    syncAutoPrint();
    window.addEventListener("storage", syncAutoPrint);
    window.addEventListener("movyo:auto-print-changed", syncAutoPrint);
    const t = setInterval(syncAutoPrint, 1200);

    return () => {
      window.removeEventListener("storage", syncAutoPrint);
      window.removeEventListener("movyo:auto-print-changed", syncAutoPrint);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setRestauranteId("");
      return;
    }

    let alive = true;
    const loadSession = async () => {
      const sessao = (await window.electron?.obterSessao?.()) ?? null;
      const id = sessao?.restauranteId || localStorage.getItem("_id") || "";
      const nomeSessao = sessao?.nome || sessao?.nomeRestaurante || localStorage.getItem("nomeRestaurante") || "";
      if (!alive) return;

      setRestauranteId(id);
      setCtx((prev) => ({ ...prev, nomeRestaurante: nomeSessao || prev.nomeRestaurante || "" }));

      try {
        const token = localStorage.getItem("_token") || localStorage.getItem("tokenRestaurante") || "";
        if (!token) return;
        const me = await fetchMe(token);
        if (!alive) return;
        const nomeMe = me?.data?.nome || me?.data?.nomeFantasia || me?.data?.restaurante?.nome || "";
        const logo = resolveLogoUrl(me?.data, sessao?.logoUrl || sessao?.logoSlug || "");
        setCtx({ nomeRestaurante: nomeMe || nomeSessao || "", logoUrl: logo || "" });
      } catch (e) {
        console.warn("[MovyoSync] Não consegui carregar dados do restaurante:", e?.message || e);
      }
    };

    loadSession();
    return () => {
      alive = false;
    };
  }, [authenticated]);

  const publishPedidos = useCallback((listaFormatada) => {
    const ordenada = sortPedidosNewest(listaFormatada);
    setPedidos(ordenada);
    window.dispatchEvent(new CustomEvent("movyo:pedidos:changed", { detail: { pedidos: ordenada } }));
    return ordenada;
  }, [setPedidos]);

  const imprimirSeNecessario = useCallback(async (pedido, source = "socket") => {
    const id = pedido?.id || pedido?._id;
    if (!id || !autoPrintRef.current || !isPrintablePedido(pedido)) return;
    if (printedIdsRef.current.has(id)) return;

    printedIdsRef.current.add(id);
    savePrintedIds(printedIdsRef.current);

    try {
      await enqueuePrint(pedido, {
        restauranteId,
        nomeRestaurante: ctx.nomeRestaurante,
        logoUrl: ctx.logoUrl,
        tipoImpressao: normKey(pedido?.origem) === "cozinha" ? "cozinha" : "balcao",
      }, source);
      window.dispatchEvent(new CustomEvent("movyo:autoprint:ok", { detail: { pedidoId: id, source } }));
    } catch (e) {
      console.warn("[MovyoSync] Auto Print falhou:", e?.message || e);
      // libera para o próximo evento tentar novamente
      printedIdsRef.current.delete(id);
      savePrintedIds(printedIdsRef.current);
      window.dispatchEvent(new CustomEvent("movyo:autoprint:error", { detail: { pedidoId: id, error: e?.message || String(e), source } }));
    }
  }, [ctx.logoUrl, ctx.nomeRestaurante, restauranteId]);

  const fetchPedidosFresh = useCallback(async ({ allowPrintNew = false } = {}) => {
    if (!restauranteId) return [];

    const now = Date.now();
    if (now - lastFetchRef.current < 250) return [];
    lastFetchRef.current = now;

    const res = await fetchPedidos(restauranteId);
    const lista = parsePedidosResponse(res).map(formatPedidoServidor);
    const ordenada = publishPedidos(lista);

    if (allowPrintNew) {
      for (const pedido of ordenada) {
        const id = pedido?.id || pedido?._id;
        if (!id || knownIdsRef.current.has(id)) continue;
        imprimirSeNecessario(pedido, "refresh");
        window.electron?.notificarPedido?.({
          pedidoId: id,
          cliente: pedido?.nomeCliente || pedido?.cliente || "Cliente",
        });
      }
    }

    knownIdsRef.current = new Set(ordenada.map((p) => p.id || p._id).filter(Boolean));
    return ordenada;
  }, [imprimirSeNecessario, publishPedidos, restauranteId]);

  useEffect(() => {
    if (!restauranteId) return undefined;
    fetchPedidosFresh({ allowPrintNew: false }).catch((e) => console.warn("[MovyoSync] Fetch inicial falhou:", e?.message || e));
  }, [restauranteId, fetchPedidosFresh]);

  useEffect(() => {
    if (!restauranteId) return undefined;

    const socket = createSocket();

    const scheduleRefresh = (allowPrintNew = true) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        fetchPedidosFresh({ allowPrintNew }).catch((e) => console.warn("[MovyoSync] Refresh após socket falhou:", e?.message || e));
      }, 350);
    };

    const upsertFromSocket = (payload, shouldPrint = true, shouldNotify = false) => {
      const pedidoPayload = payload?.pedido || payload?.data || payload;
      const id = pedidoPayload?._id || pedidoPayload?.id || pedidoPayload?.pedidoId;
      if (!id) {
        scheduleRefresh(true);
        return;
      }

      const formatado = formatPedidoServidor({ ...pedidoPayload, _id: id, id });
      if (shouldPrint) imprimirSeNecessario(formatado, "socket");
      if (shouldNotify) {
        window.electron?.notificarPedido?.({
          pedidoId: id,
          cliente: formatado?.nomeCliente || formatado?.cliente || "Cliente",
        });
      }

      setPedidos((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const status = normalizarStatusPainel(formatado);
        let next;
        if (["entregue", "cancelado"].includes(status)) {
          next = base.filter((p) => (p.id || p._id) !== id);
        } else {
          const existe = base.some((p) => (p.id || p._id) === id);
          next = existe
            ? base.map((p) => ((p.id || p._id) === id ? { ...p, ...formatado } : p))
            : [formatado, ...base];
        }
        const ordenada = sortPedidosNewest(next);
        window.dispatchEvent(new CustomEvent("movyo:pedidos:changed", { detail: { pedidos: ordenada } }));
        knownIdsRef.current.add(id);
        return ordenada;
      });

      scheduleRefresh(false);
    };

    socket.on("connect", () => {
      socket.emit("joinRestaurante", { restauranteId });
      socket.emit("join-restaurante", restauranteId);
      socket.emit("joinRestaurant", restauranteId);
      scheduleRefresh(false);
    });

    [
      "novoPedido",
      "pedidoCriado",
      "pedido_criado",
      "pedidoNovo",
      "novo_pedido",
      "balcaoPedidoCriado",
      "balcao:pedido:criado",
      "garcomPedidoCriado",
      "garcom:pedido:criado",
      "mesaPedidoCriado",
      "mesa:pedido:criado",
      "comandaPedidoCriado",
    ].forEach((ev) => socket.on(ev, (payload) => upsertFromSocket(payload, true, true)));

    [
      "pedidoAtualizado",
      "pedido_atualizado",
      "pedidoPago",
      "pedido_pago",
      "balcaoPedidoAtualizado",
      "balcao:pedido:atualizado",
      "garcomPedidoAtualizado",
      "garcom:pedido:atualizado",
      "mesaPedidoAtualizado",
      "mesa:pedido:atualizado",
      "comandaAtualizada",
      "caixaAtualizado",
      "caixa:atualizado",
      "resumoGarcomAtualizado",
      "rankingGarcomAtualizado",
    ].forEach((ev) => socket.on(ev, (payload) => upsertFromSocket(payload, true, false)));

    socket.on("connect_error", (err) => console.warn("[MovyoSync] Socket erro:", err?.message || err));

    const poll = setInterval(() => scheduleRefresh(true), 10000);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearInterval(poll);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [fetchPedidosFresh, imprimirSeNecessario, restauranteId, setPedidos]);

  return null;
}
