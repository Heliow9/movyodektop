// src/utils/enviarImpressao.js
/* =========================================================
   ✅ IMPRESSÃO (Movyo) — preferindo Serviço 9100
   - Usa SEMPRE as configs salvas em localStorage ("printSettings")
   - Primeiro tenta imprimir via Socket.IO (localhost:9100)
   - Fallback: Electron (window.electron.printContent / printTicket / imprimir / printHtml)
   - Fallback final: janela do browser (dev)

   ✅ NOVO (COZINHA INTELIGENTE)
   - enviarParaImpressaoCozinha(): filtra itens que NÃO são feitos na cozinha
     (bebidas/refrigerantes/itens "prontos")
   - Ticket/HTML mostra "IMPRESSÃO: COZINHA"
   - Também envia no payload pro serviço 9100: dados.tipoImpressao = "cozinha"
========================================================= */

import { io } from "socket.io-client";

const PRINT_SERVICE_URL = "http://localhost:9100";

/** =========================
 *  Helpers
 *  ========================= */
const PRINT_SETTINGS_KEY = "printSettings";
const KITCHEN_PRINT_SETTINGS_KEY = "kitchenPrintSettings";

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function formatBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pedidoCode(pedido) {
  const num =
    pedido?.numeroPedido ??
    pedido?.numeroDoPedido ??
    pedido?.numero ??
    pedido?.code ??
    pedido?.codigo ??
    pedido?.pedidoNumero;

  if (num != null && String(num).trim() !== "") return String(num);

  const id = pedido?._id || pedido?.id || "";
  return id ? String(id).slice(-6) : "-";
}
function getFormaPagamentoLabel(pedido) {
  const raw =
    pedido?.formaPagamento ||
    pedido?.metodoPagamento ||
    pedido?.pagamento?.forma ||
    pedido?.pagamento?.tipo ||
    "";
  const v = String(raw || "").trim().toLowerCase();
  const map = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cash: "Dinheiro",
    cartao: "Cartão",
    cartão: "Cartão",
    credito: "Cartão crédito",
    crédito: "Cartão crédito",
    debito: "Cartão débito",
    débito: "Cartão débito",
    misto: "Misto",
  };
  return map[v] || (raw ? String(raw) : "Não informado");
}

function getVendedorNome(pedido) {
  return safeText(
    pedido?.vendedorNome ||
    pedido?.nomeVendedor ||
    pedido?.garcomNome ||
    pedido?.nomeGarcom ||
    pedido?.usuarioNome ||
    pedido?.criadoPorNome ||
    pedido?.vendedor?.nome ||
    pedido?.garcom?.nome ||
    pedido?.usuario?.nome ||
    ""
  );
}

function normalizePhoneBR(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function tryParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * ✅ Usa a MESMA key da tela Configurações.jsx:
 * localStorage.setItem("printSettings", JSON.stringify(ps))
 */
function loadPrintSettings(tipoImpressao = "balcao") {
  const key = tipoImpressao === "cozinha" ? KITCHEN_PRINT_SETTINGS_KEY : PRINT_SETTINGS_KEY;
  const raw = localStorage.getItem(key) || (tipoImpressao === "cozinha" ? localStorage.getItem(PRINT_SETTINGS_KEY) : null);
  if (raw) {
    const ps = tryParseJSON(raw);
    if (ps && typeof ps === "object") {
      return {
        printerName: safeText(ps.printerName || ""),
        brand: safeText(ps.brand || ""),
        layout: safeText(ps.layout || "entregaA") || "entregaA",
        columns: clampInt(ps.columns, 20, 64, 48),
        feedLines: clampInt(ps.feedLines, 0, 10, 3),
        cutMode: safeText(ps.cutMode || "full") || "full",
        encoding: safeText(ps.encoding || "win1252") || "win1252",
        copies: clampInt(ps.copies, 1, 10, 1),
      };
    }
  }

  // fallback legado
  return {
    printerName: safeText(localStorage.getItem("impressoraSelecionada") || ""),
    brand: safeText(localStorage.getItem("modeloImpressora") || ""),
    layout: safeText(localStorage.getItem("layoutSelecionado") || "entregaA") || "entregaA",
    columns: 48,
    feedLines: 3,
    cutMode: "full",
    encoding: "win1252",
    copies: 1,
  };
}

/** =========================
 *  ✅ COZINHA INTELIGENTE (filtro de itens)
 *  - Tenta usar categoriaType / categoria / tags.
 *  - Cai pra heurística por nome (bebidas/refrigerantes etc.)
 *  ========================= */
function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BEBIDA_KEYWORDS = [
  "refrigerante",
  "refri",
  "coca",
  "coca-cola",
  "coca cola",
  "guarana",
  "fanta",
  "sprite",
  "soda",
  "tubaina",
  "suco",
  "agua",
  "água",
  "h2o",
  "tonica",
  "tônica",
  "cha",
  "chá",
  "cafe",
  "café",
  "energetico",
  "energético",
  "red bull",
  "monster",
  "cerveja",
  "vinho",
  "drink",
  "bebida",
  "lata",
  "long neck",
];

const NAO_COZINHA_CATEG_TYPES = [
  "bebida",
  "bebidas",
  "drink",
  "drinks",
  "refrigerante",
  "refri",
  "agua",
  "água",
  "suco",
  "sobremesa_pronta",
];

function isItemCozinha(it) {
  // 1) categoriaType (o seu Home já manda em itens)
  const catType = normKey(it?.categoriaType || it?.categoriaTipo || it?.categoria?.tipo || "");
  if (catType && NAO_COZINHA_CATEG_TYPES.some((k) => catType.includes(normKey(k)))) return false;

  // 2) categoria nome (se existir)
  const catNome = normKey(it?.categoriaNome || it?.categoria?.nome || "");
  if (catNome && NAO_COZINHA_CATEG_TYPES.some((k) => catNome.includes(normKey(k)))) return false;

  // 3) heurística pelo nome do item
  const nome = normKey(it?.nome || "");
  if (nome && BEBIDA_KEYWORDS.some((k) => nome.includes(normKey(k)))) return false;

  // ✅ default: vai pra cozinha
  return true;
}

/** =========================
 *  Normalização do pedido pro serviço 9100
 *  (evita conflitos tipo "numero" ser pedido/casa)
 *  ========================= */
function normalizePedidoParaServico(pedido, opts = {}) {
  const numeroPedido = pedidoCode(pedido);

  // endereço (vários nomes possíveis)
  const enderecoRua =
    safeText(pedido?.enderecoRua) ||
    safeText(pedido?.enderecoCliente) ||
    safeText(pedido?.endereco) ||
    safeText(pedido?.rua) ||
    "";

  const enderecoNumero =
    safeText(pedido?.enderecoNumero) ||
    safeText(pedido?.residenciaNumero) ||
    safeText(pedido?.numeroCasa) ||
    safeText(pedido?.numero) || // último caso
    "";

  const bairro =
    safeText(pedido?.enderecoBairro) ||
    safeText(pedido?.residenciaBairro) ||
    safeText(pedido?.bairro) ||
    "";

  const complemento =
    safeText(pedido?.complemento) ||
    safeText(pedido?.Complemento) ||
    safeText(pedido?.residenciaComplemento) ||
    "";

  const referencia =
    safeText(pedido?.referencia) ||
    safeText(pedido?.residenciaReferencia) ||
    "";

  // observação geral do pedido
  const observacaoPedido =
    safeText(pedido?.observacao) ||
    safeText(pedido?.obs) ||
    safeText(pedido?.observacoes) ||
    safeText(pedido?.observacaoCliente) ||
    "";

  const tipoImpressao = safeText(opts?.tipoImpressao || "balcao"); // "cozinha" | "balcao"
  const nomeRestaurante =
    safeText(opts?.nomeRestaurante) ||
    safeText(opts?.restauranteNome) ||
    safeText(opts?.restaurantName) ||
    safeText(pedido?.nomeRestaurante) ||
    safeText(pedido?.restauranteNome) ||
    safeText(pedido?.restaurantName) ||
    safeText(pedido?.restaurante?.nome) ||
    safeText(pedido?.restaurante?.nomeFantasia) ||
    "Movyo Food";

  // itens: garantir sabores/observação existindo
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const itensNormalizados = itens.map((it) => {
    const sabores =
      Array.isArray(it?.saboresSelecionados) ? it.saboresSelecionados :
      Array.isArray(it?.sabores) ? it.sabores :
      [];

    const qtd = Number(it?.qtd ?? it?.quantidade ?? it?.quantity ?? 1) || 1;
    const precoUnitario = Number(it?.precoUnitario ?? it?.preco ?? it?.valorUnitario ?? it?.valor ?? it?.price ?? 0) || 0;
    const precoTotalRaw = Number(it?.precoTotal ?? it?.total ?? it?.valorTotal ?? it?.subtotal);
    const precoTotal = Number.isFinite(precoTotalRaw) ? round2(precoTotalRaw) : round2(precoUnitario * qtd);

    return {
      ...it,
      nome: safeText(it?.nome || it?.titulo || it?.title || it?.descricao || "Item"),
      quantidade: qtd,
      qtd,
      precoUnitario,
      preco: precoUnitario,
      precoTotal,
      total: precoTotal,
      valorTotal: precoTotal,
      saboresSelecionados: sabores,
      observacao: safeText(it?.observacao || it?.obs || it?.observacoes || ""),
    };
  });

  // ✅ se for cozinha, filtra itens que não são de cozinha.
  // Mas nunca manda comanda vazia: se o filtro zerar, envia todos para o plugin imprimir algo útil.
  const filtradosCozinha = tipoImpressao === "cozinha" ? itensNormalizados.filter(isItemCozinha) : itensNormalizados;
  const itensFiltrados = tipoImpressao === "cozinha" && filtradosCozinha.length === 0 ? itensNormalizados : filtradosCozinha;

  return {
    ...pedido,

    // ✅ pedido
    numeroPedido,
    tipoImpressao, // ✅ útil pro serviço/layout
    nomeRestaurante,
    restauranteNome: nomeRestaurante,
    restaurantName: nomeRestaurante,
    empresaNome: nomeRestaurante,
    nomeLoja: nomeRestaurante,

    // ✅ endereço separado (sem brigar com numeroPedido)
    endereco: enderecoRua,
    enderecoRua,
    enderecoNumero,
    residenciaNumero: enderecoNumero,
    bairro,
    residenciaBairro: bairro,
    complemento,
    residenciaComplemento: complemento,
    referencia,
    residenciaReferencia: referencia,

    // ✅ observação geral
    observacao: observacaoPedido,

    // ✅ pagamento / vendedor
    formaPagamento: pedido?.formaPagamento || pedido?.metodoPagamento || pedido?.pagamento?.forma || "",
    formaPagamentoLabel: getFormaPagamentoLabel(pedido),
    vendedorNome: getVendedorNome(pedido),

    // ✅ itens
    itens: itensFiltrados,

    // total
    total: pedido?.total ?? pedido?.valorTotal ?? pedido?.valor ?? itensFiltrados.reduce((acc, it) => acc + Number(it.precoTotal || 0), 0),
    valorTotal: pedido?.valorTotal ?? pedido?.total ?? pedido?.valor ?? itensFiltrados.reduce((acc, it) => acc + Number(it.precoTotal || 0), 0),
  };
}

/** =========================
 *  Socket.IO (Serviço 9100)
 *  ========================= */
let _socket = null;

function getPrintSocket() {
  if (_socket) return _socket;

  _socket = io(PRINT_SERVICE_URL, {
    transports: ["websocket"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 300,
    reconnectionDelayMax: 1200,
    timeout: 2500,
  });

  return _socket;
}

function ensureConnected(socket) {
  if (!socket.connected) socket.connect();
}

function printWithService9100({ layout, nomeImpressora, modeloImpressora, dados, printSettings }, timeoutMs = 7000) {
  const socket = getPrintSocket();

  const payload = {
    layout,
    nomeImpressora,
    modeloImpressora,
    // aliases para versões diferentes do MovyoPrinterService
    printerName: nomeImpressora,
    impressora: nomeImpressora,
    brand: modeloImpressora,
    modelo: modeloImpressora,
    dados,
    pedido: dados,
    data: dados,
    printSettings,
    settings: printSettings,
  };

  return new Promise((resolve, reject) => {
    let done = false;

    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("impressao-sucesso", onOk);
      socket.off("print-success", onOk);
      socket.off("impressao-erro", onErr);
      socket.off("print-error", onErr);
      socket.off("connect_error", onConnErr);
      clearTimeout(t);
      clearTimeout(okTimer);
    };

    const finishOk = (res = {}) => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ ok: true, via: "plugin9100_socket", payload: res });
    };

    const finishErr = (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err || "Erro ao imprimir no plugin 9100.")));
    };

    const emitPrint = () => {
      try {
        // Evento oficial do plugin Movyo. Mantém aliases para compatibilidade, mas sempre na porta 9100.
        socket.emit("imprimir-pedido", payload, (ack) => {
          if (ack?.ok || ack?.success) finishOk(ack);
          if (ack?.error || ack?.messageErro) finishErr(new Error(ack.error || ack.messageErro));
        });
        socket.emit("print-pedido", payload);
        socket.emit("imprimir", payload);
        // Alguns plugins apenas executam e não retornam evento de sucesso. Nesse caso, considerar enviado.
        okTimer = setTimeout(() => finishOk({ message: "enviado ao plugin 9100" }), 700);
      } catch (e) {
        finishErr(e);
      }
    };

    const onConnect = () => emitPrint();
    const onOk = (payloadOk) => finishOk(payloadOk);
    const onErr = (payloadErr) => finishErr(new Error(payloadErr?.message || payloadErr?.error || "Erro ao imprimir no plugin 9100."));
    const onConnErr = () => finishErr(new Error("Não consegui conectar no plugin de impressão em http://localhost:9100."));

    let okTimer;
    const t = setTimeout(() => finishErr(new Error("Timeout ao enviar para o plugin de impressão em http://localhost:9100.")), timeoutMs);

    socket.on("connect", onConnect);
    socket.on("impressao-sucesso", onOk);
    socket.on("print-success", onOk);
    socket.on("impressao-erro", onErr);
    socket.on("print-error", onErr);
    socket.on("connect_error", onConnErr);

    if (socket.connected) emitPrint();
    else socket.connect();
  });
}

async function printWithPluginHTTP({ layout, nomeImpressora, modeloImpressora, dados, printSettings }, timeoutMs = 5000) {
  const payload = {
    layout,
    nomeImpressora,
    modeloImpressora,
    printerName: nomeImpressora,
    impressora: nomeImpressora,
    brand: modeloImpressora,
    modelo: modeloImpressora,
    dados,
    pedido: dados,
    data: dados,
    printSettings,
    settings: printSettings,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoints = [
    `${PRINT_SERVICE_URL}/imprimir-pedido`,
    `${PRINT_SERVICE_URL}/imprimir`,
    `${PRINT_SERVICE_URL}/print-pedido`,
    `${PRINT_SERVICE_URL}/print`,
    `${PRINT_SERVICE_URL}/api/imprimir-pedido`,
    `${PRINT_SERVICE_URL}/api/imprimir`,
    `${PRINT_SERVICE_URL}/api/print`,
  ];

  let lastError = null;
  try {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (res.ok) {
          let data = null;
          try { data = await res.json(); } catch { data = await res.text(); }
          return { ok: true, via: "plugin_http", endpoint: url, payload: data };
        }
        lastError = new Error(`Plugin HTTP ${res.status} em ${url}`);
      } catch (err) {
        lastError = err;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  throw lastError || new Error("Plugin local não respondeu por HTTP.");
}

/** =========================
 *  Electron fallback (se tiver)
 *  ========================= */
async function printWithElectronFallback(html, meta = {}) {
  if (window?.electron?.printContent) {
    const r = await window.electron.printContent(html, meta);
    return r ?? { ok: true };
  }

  if (window?.electron?.printTicket) return await window.electron.printTicket({ html, options: meta });
  if (window?.electron?.imprimir) return await window.electron.imprimir({ html, options: meta });
  if (window?.electron?.printHtml) return await window.electron.printHtml({ html, options: meta });

  return null;
}

/** =========================
 *  Ticket HTML (fallback DEV)
 *  - agora com OBS do pedido
 *  - agora com TAG "IMPRESSÃO: COZINHA/BALCÃO"
 *  - agora com filtro cozinha (quando tipoImpressao === "cozinha")
 *  ========================= */
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getResumoItemLinhas(item) {
  const linhas = [];

  const sabores =
    Array.isArray(item?.saboresSelecionados) ? item.saboresSelecionados :
    Array.isArray(item?.sabores) ? item.sabores :
    [];

  if (sabores.length) linhas.push(`Sabores: ${sabores.join(", ")}`);

  // ✅ observação do item (sempre mostra)
  if (safeText(item?.observacao)) linhas.push(`Obs: ${safeText(item.observacao)}`);

  return linhas;
}

function buildTicketHTML(pedido, ctx = {}, ps = {}, opts = {}) {
  const nomeRestaurante = safeText(ctx.nomeRestaurante || "Movyo Food");
  const restauranteTelefone = safeText(ctx.restauranteTelefone || "");

  const tipoImpressao = safeText(opts?.tipoImpressao || "balcao"); // "cozinha" | "balcao"
  const isCozinha = tipoImpressao === "cozinha";

  const cliente = safeText(pedido?.cliente || pedido?.nomeCliente || "Cliente");
  const telefone = safeText(pedido?.telefone || pedido?.telefoneCliente || "");
  const tel = normalizePhoneBR(telefone);

  const endereco = safeText(pedido?.enderecoRua || pedido?.enderecoCliente || pedido?.endereco || "");
  const numero = safeText(pedido?.enderecoNumero || pedido?.residenciaNumero || "");
  const bairro = safeText(pedido?.enderecoBairro || pedido?.residenciaBairro || "");
  const referencia = safeText(pedido?.referencia || pedido?.residenciaReferencia || "");
  const observacaoPedido = safeText(pedido?.observacao || pedido?.obs || "");
  const formaPagamento = getFormaPagamentoLabel(pedido);
  const vendedorNome = getVendedorNome(pedido);

  const itens0 = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const itens = isCozinha ? itens0.filter(isItemCozinha) : itens0;

  const total = round2(Number(pedido?.total ?? pedido?.valorTotal ?? 0));
  const enderecoLinha = [endereco, numero && `Nº ${numero}`, bairro && `Bairro ${bairro}`].filter(Boolean).join(" • ");

  const tagHtml = isCozinha
    ? `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#111;color:#fff;font-weight:900;font-size:12px;letter-spacing:.3px;margin-top:8px;">IMPRESSÃO: COZINHA</div>`
    : `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#e5e7eb;color:#111;font-weight:900;font-size:12px;letter-spacing:.3px;margin-top:8px;">IMPRESSÃO: BALCÃO</div>`;

  const linesItens = itens
    .map((it) => {
      const qtd = Math.max(1, Number(it?.qtd ?? it?.quantidade ?? 1));
      const nome = escapeHtml(safeText(it?.nome || "Item"));
      const unit = round2(Number(it?.precoUnitario ?? it?.preco ?? 0));
      const tot = round2(Number(it?.precoTotal ?? unit * qtd));

      const extras = getResumoItemLinhas(it);
      const extrasHtml = extras.length
        ? `<div style="margin-top:6px;font-size:12px;line-height:1.25;">${extras.map((x) => `<div>• ${escapeHtml(x)}</div>`).join("")}</div>`
        : "";

      return `
        <div style="padding:8px 0;border-bottom:1px dashed #ddd;">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <div style="flex:1;"><b>${qtd}x</b> ${nome}</div>
            <div style="white-space:nowrap;"><b>${formatBRL(tot)}</b></div>
          </div>
          <div style="color:#555;font-size:12px;margin-top:4px;">Unit: ${formatBRL(unit)}</div>
          ${extrasHtml}
        </div>
      `;
    })
    .join("");

  const contactLine = tel
    ? `<div style="color:#555;font-size:12px;">WhatsApp: ${escapeHtml(tel)}</div>`
    : telefone
      ? `<div style="color:#555;font-size:12px;">Telefone: ${escapeHtml(telefone)}</div>`
      : "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Ticket</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="padding:14px 12px;">
    <div style="text-align:center;">
      <div style="font-size:18px;font-weight:900;">${escapeHtml(nomeRestaurante)}</div>
      ${restauranteTelefone ? `<div style="color:#555;font-size:12px;">${escapeHtml(restauranteTelefone)}</div>` : ""}
      <div style="margin-top:8px;font-weight:900;font-size:18px;">PEDIDO #${escapeHtml(pedidoCode(pedido))}</div>
      ${tagHtml}
    </div>

    <div style="border-top:1px dashed #999;margin:10px 0;"></div>

    <div>
      <div style="font-weight:900;font-size:13px;margin-bottom:6px;">CLIENTE</div>
      <div><b>${escapeHtml(cliente)}</b></div>
      ${contactLine}
      ${enderecoLinha ? `<div style="color:#555;font-size:12px;">${escapeHtml(enderecoLinha)}</div>` : ""}
      ${referencia ? `<div style="color:#555;font-size:12px;">Ref: ${escapeHtml(referencia)}</div>` : ""}
    </div>

    <div style="border-top:1px dashed #999;margin:10px 0;"></div>

    <div>
      <div style="font-weight:900;font-size:13px;margin-bottom:6px;">PAGAMENTO</div>
      <div style="font-size:13px;"><b>Forma:</b> ${escapeHtml(formaPagamento)}</div>
      ${vendedorNome ? `<div style="font-size:13px;"><b>Vendedor:</b> ${escapeHtml(vendedorNome)}</div>` : ""}
    </div>

    ${observacaoPedido ? `
      <div style="border-top:1px dashed #999;margin:10px 0;"></div>
      <div style="font-weight:900;font-size:13px;margin-bottom:6px;">OBSERVAÇÃO</div>
      <div style="font-size:12px;">${escapeHtml(observacaoPedido)}</div>
    ` : ""}

    <div style="border-top:1px dashed #999;margin:10px 0;"></div>

    <div>
      <div style="font-weight:900;font-size:13px;margin-bottom:6px;">ITENS</div>
      ${linesItens || `<div style="color:#555;font-size:12px;">Nenhum item</div>`}
      ${isCozinha && itens0.length !== itens.length ? `<div style="color:#666;font-size:12px;margin-top:8px;"><b>Obs:</b> itens não-produção (bebidas/etc.) foram ocultados nesta via.</div>` : ""}
    </div>

    <div style="border-top:1px dashed #999;margin:10px 0;"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="color:#555;font-size:12px;">TOTAL</div>
      <div style="font-weight:900;font-size:18px;">${formatBRL(total)}</div>
    </div>
  </div>
</body>
</html>`;
}

function openFallbackWindow(html) {
  const w = window.open("", "_blank", "width=520,height=780");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/** =========================================================
 *  ✅ API Pública (BALCÃO / PADRÃO)
 *  ========================================================= */
export async function enviarParaImpressao(pedido, ctx = {}) {
  const tipoImpressao = safeText(ctx.tipoImpressao || "balcao");
  const ps = loadPrintSettings(tipoImpressao);

  const nomeRestaurante = safeText(ctx.nomeRestaurante || ctx.restauranteNome || ctx.restaurantName || "Movyo Food");

  const printSettings = {
    columns: clampInt(ps.columns, 20, 64, 48),
    feedLines: clampInt(ps.feedLines, 0, 10, 3),
    cutMode: ps.cutMode || "full",
    encoding: ps.encoding || "win1252",
    brand: ps.brand || "",
    copies: clampInt(ctx.copies ?? ps.copies, 1, 10, 1),
    nomeRestaurante,
    restauranteNome: nomeRestaurante,
    restaurantName: nomeRestaurante,
    empresaNome: nomeRestaurante,
  };

  // layout pode ser sobrescrito via ctx.layout
  const layout = safeText(ctx.layout || ps.layout || (tipoImpressao === "cozinha" ? "cozinhaA" : "entregaA"));
  const nomeImpressora = safeText(ctx.printerName || ps.printerName || "");
  const modeloImpressora = safeText(ctx.brand || ps.brand || "");

  // ✅ aqui é o ponto: envia normalizado pro serviço
  const dados = normalizePedidoParaServico(pedido, {
    tipoImpressao,
    nomeRestaurante,
    restauranteNome: nomeRestaurante,
    restaurantName: nomeRestaurante,
  });

  const pluginOnly = !!ctx.pluginOnly;

  // Serviço/plugin 9100 é a ÚNICA saída de impressão.
  // Não usa mais fallback do Windows/Electron para evitar abrir janela/polling.
  if (!nomeImpressora) throw new Error("Impressora não selecionada nas configurações.");
  if (!modeloImpressora) throw new Error("Marca/modelo não selecionado nas configurações.");

  const copies = clampInt(printSettings.copies, 1, 10, 1);
  const results = [];

  for (let via = 1; via <= copies; via += 1) {
    const dadosVia = { ...dados, viaAtual: via, totalVias: copies };
    const printSettingsVia = { ...printSettings, copies, viaAtual: via, totalVias: copies };

    try {
      results.push(await printWithService9100({ layout, nomeImpressora, modeloImpressora, dados: dadosVia, printSettings: printSettingsVia }, 8000));
    } catch (err) {
      console.warn("🖨️ Socket do plugin 9100 falhou, tentando HTTP do mesmo plugin:", err?.message || err);
      results.push(await printWithPluginHTTP({ layout, nomeImpressora, modeloImpressora, dados: dadosVia, printSettings: printSettingsVia }, 5000));
    }
  }

  return { ok: true, copies, results };
}

/** =========================================================
 *  ✅ API Pública (COZINHA INTELIGENTE)
 *  - filtra bebidas/refrigerantes/itens não-cozinha
 *  - marca tipoImpressao = "cozinha"
 *  ========================================================= */
export async function enviarParaImpressaoCozinha(pedido, ctx = {}) {
  return enviarParaImpressao(pedido, { ...ctx, tipoImpressao: "cozinha" });
}
