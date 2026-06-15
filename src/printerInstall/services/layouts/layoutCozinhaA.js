const iconv = require("iconv-lite");
const moment = require("moment");

const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

const ALIGN_LEFT = ESC + "a" + "\x00";
const ALIGN_CENTER = ESC + "a" + "\x01";
const TEXT_NORMAL = ESC + "!" + "\x00";
const TEXT_DOUBLE = ESC + "!" + "\x30";
const TEXT_BOLD = ESC + "E" + "\x01";
const TEXT_BOLD_OFF = ESC + "E" + "\x00";
const CUT_FULL = GS + "V" + "\x00";
const CUT_PARTIAL = GS + "V" + "\x01";

function safeStr(v, fallback = "") {
  const s = (v ?? "").toString().trim();
  return s || fallback;
}
function firstValue(...values) {
  for (const v of values) {
    const s = safeStr(v, "");
    if (s) return s;
  }
  return "";
}
function getNumeroPedido(dados = {}) {
  const n = firstValue(dados.numeroPedido, dados.numeroDoPedido, dados.pedidoNumero, dados.codigoPedido, dados.codigo, dados.code, dados.numero);
  if (n) return n;
  return dados?._id ? String(dados._id).slice(-6) : "----";
}
function getRestaurantName(dados = {}, printSettings = {}) {
  return firstValue(
    printSettings?.restaurantName,
    printSettings?.nomeRestaurante,
    printSettings?.empresaNome,
    dados?.nomeRestaurante,
    dados?.restauranteNome,
    dados?.nomeLoja,
    dados?.lojaNome,
    dados?.nomeEmpresa,
    dados?.empresaNome,
    dados?.estabelecimentoNome,
    dados?.merchantName,
    dados?.restaurantName,
    dados?.restaurante?.nome,
    dados?.restaurante?.nomeFantasia,
    dados?.empresa?.nome,
    dados?.empresa?.nomeFantasia,
    dados?.loja?.nome,
    dados?.estabelecimento?.nome
  ) || "Movyo Food";
}
function wrapText(text, columns) {
  const maxCol = Number(columns) || 48;
  const t = safeStr(text, "");
  if (!t) return [];
  const out = [];
  let rest = t;
  while (rest.length > maxCol) {
    let idx = rest.lastIndexOf(" ", maxCol);
    if (idx <= 0) idx = maxCol;
    out.push(rest.slice(0, idx));
    rest = rest.slice(idx).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
function getCutCmd(cutMode) {
  const mode = (cutMode || "full").toLowerCase();
  if (mode === "none") return "";
  if (mode === "partial") return CUT_PARTIAL;
  return CUT_FULL;
}
function normalizeExtrasList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value).flat();
  if (typeof value === "string") return value.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  return [];
}
function getExtraName(extra) {
  if (typeof extra === "string") return extra;
  return firstValue(extra?.nome, extra?.name, extra?.titulo, extra?.descricao, extra?.label, extra?.opcao, extra?.sabor, extra?.opcaoNome);
}
function getExtraQty(extra) {
  if (typeof extra !== "object" || !extra) return "";
  const qtd = extra.qtd ?? extra.quantidade ?? extra.qty;
  const n = Number(qtd);
  return Number.isFinite(n) && n > 1 ? `${n}x ` : "";
}
function collectExtras(item = {}) {
  const lists = [
    item.adicionais,
    item.adicionaisSelecionados,
    item.extras,
    item.opcoes,
    item.opcoesSelecionadas,
    item.opcionais,
    item.complementos,
    item.complementosSelecionados,
    item.personalizacoes,
    item.personalizados,
    item.modificadores,
    item.saboresSelecionados,
    item.sabores,
  ];
  const out = [];
  lists.forEach((list) => {
    normalizeExtrasList(list).forEach((extra) => {
      const name = getExtraName(extra);
      if (!name) return;
      out.push(`${getExtraQty(extra)}${name}`);
    });
  });
  return Array.from(new Set(out));
}
function itemName(item = {}) {
  return firstValue(item.nome, item.produto, item.descricao, item.titulo, item.title, item.name) || "Item";
}
function itemQty(item = {}) {
  return safeStr(item.qtd ?? item.quantidade ?? item.quantity ?? 1, "1");
}
function getObsItem(item = {}) {
  return firstValue(item.observacao, item.obs, item.observacoes, item.observacaoItem, item.observacaoProduto, item.nota, item.notes);
}
function getObsPedido(dados = {}) {
  return firstValue(dados.observacao, dados.obs, dados.observacoes, dados.observacaoPedido, dados.observacaoCliente);
}
function isEntrega(item = {}) {
  return itemName(item).toLowerCase() === "entrega";
}

module.exports = function gerarTextoCozinhaA(dados, printSettings = {}) {
  const columns = Number(printSettings?.columns) || 48;
  const feedLines = Number(printSettings?.feedLines ?? 3) || 3;
  const cutMode = printSettings?.cutMode || "full";
  const encoding = (printSettings?.encoding || "win1252").toLowerCase();
  const viaAtual = Number(dados?.viaAtual || printSettings?.viaAtual || 1);
  const totalVias = Number(dados?.totalVias || printSettings?.totalVias || printSettings?.copies || 1);

  let texto = "";
  texto += ALIGN_CENTER + TEXT_DOUBLE + TEXT_BOLD;
  texto += "*** COZINHA ***" + LF;
  texto += TEXT_NORMAL + TEXT_BOLD_OFF;
  wrapText(getRestaurantName(dados, printSettings), columns).forEach((l) => (texto += l + LF));
  texto += `PEDIDO #${getNumeroPedido(dados)}` + LF;
  if (totalVias > 1) texto += `VIA ${viaAtual}/${totalVias}` + LF;
  texto += moment().format("DD/MM/YYYY HH:mm") + LF;
  texto += "=".repeat(columns) + LF;

  const origem = firstValue(dados.origem, dados.tipo, dados.tipoPedido);
  const cliente = firstValue(dados.cliente, dados.nomeCliente, dados.clienteObj?.nome, dados.customer?.name);
  const mesa = firstValue(dados.mesa, dados.numeroMesa, dados.mesaNumero, dados.comanda, dados.comandaNumero);
  texto += ALIGN_LEFT;
  if (origem) texto += `Origem: ${origem}` + LF;
  if (mesa) texto += `Mesa/Comanda: ${mesa}` + LF;
  if (cliente) texto += `Cliente: ${cliente}` + LF;

  const obsPedido = getObsPedido(dados);
  if (obsPedido) {
    texto += "-".repeat(columns) + LF;
    texto += TEXT_BOLD + "OBS. DO PEDIDO:" + TEXT_BOLD_OFF + LF;
    wrapText(obsPedido, columns).forEach((l) => (texto += l + LF));
  }

  texto += "=".repeat(columns) + LF;
  texto += TEXT_BOLD + "ITENS PARA PRODUÇÃO" + TEXT_BOLD_OFF + LF;
  texto += "-".repeat(columns) + LF;

  const itens = Array.isArray(dados?.itens) ? dados.itens.filter((i) => !isEntrega(i)) : [];
  if (!itens.length) {
    texto += "Nenhum item de cozinha." + LF;
  }

  itens.forEach((item, index) => {
    texto += TEXT_BOLD;
    wrapText(`${itemQty(item)}x ${itemName(item)}`, columns).forEach((l) => (texto += l + LF));
    texto += TEXT_BOLD_OFF;

    collectExtras(item).forEach((extra) => {
      wrapText(`  + ${extra}`, columns).forEach((l) => (texto += l + LF));
    });

    const obsItem = getObsItem(item);
    if (obsItem) {
      wrapText(`  OBS: ${obsItem}`, columns).forEach((l) => (texto += l + LF));
    }

    if (index < itens.length - 1) texto += "-".repeat(columns) + LF;
  });

  texto += LF + ALIGN_CENTER + TEXT_BOLD + "FIM COZINHA" + TEXT_BOLD_OFF + LF;
  texto += LF.repeat(Math.max(0, feedLines));
  texto += getCutCmd(cutMode);

  try {
    if (encoding === "utf8" || encoding === "utf-8") return Buffer.from(texto, "utf8");
    return iconv.encode(texto, encoding);
  } catch (e) {
    return iconv.encode(texto, "win1252");
  }
};
