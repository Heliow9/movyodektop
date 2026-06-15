const iconv = require("iconv-lite");
const moment = require("moment");

const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

const ALIGN_LEFT = ESC + "a" + "\x00";
const ALIGN_CENTER = ESC + "a" + "\x01";
const ALIGN_RIGHT = ESC + "a" + "\x02";
const TEXT_NORMAL = ESC + "!" + "\x00";
const TEXT_DOUBLE = ESC + "!" + "\x30";
const CUT_FULL = GS + "V" + "\x00";
const CUT_PARTIAL = GS + "V" + "\x01";

function safeStr(v, fallback = "") {
  const s = (v ?? "").toString().trim();
  return s || fallback;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function moneyBR(v) {
  return `R$ ${safeNumber(v, 0).toFixed(2).replace(".", ",")}`;
}

function labelize(v) {
  const s = safeStr(v, "").toLowerCase();
  if (!s) return "---";
  const map = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    cartão: "Cartão",
    credito: "Cartão crédito",
    crédito: "Cartão crédito",
    debito: "Cartão débito",
    débito: "Cartão débito",
    misto: "Misto",
    pendente: "Pendente",
    pago: "Pago",
    approved: "Aprovado",
    aguardando_pagamento: "Aguardando pagamento",
  };
  return map[s] || safeStr(v, "---");
}

function firstValue(...values) {
  for (const v of values) {
    const s = safeStr(v, "");
    if (s) return s;
  }
  return "";
}

function getNumeroPedido(dados = {}) {
  const n = firstValue(
    dados.numeroPedido,
    dados.numeroDoPedido,
    dados.pedidoNumero,
    dados.codigoPedido,
    dados.codigo,
    dados.code,
    dados.numero
  );
  if (n) return n;
  return dados?._id ? String(dados._id).slice(-6) : "----";
}

function getRestaurantName(dados = {}, printSettings = {}) {
  return firstValue(
    printSettings?.restaurantName,
    printSettings?.nomeRestaurante,
    printSettings?.restauranteNome,
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

function getFormaPagamento(dados = {}) {
  return firstValue(
    dados.formaPagamento,
    dados.metodoPagamento,
    dados.tipoPagamento,
    dados.pagamento?.forma,
    dados.pagamento?.metodo,
    dados.pagamento?.tipo,
    dados.paymentMethod,
    dados.payment_method
  );
}

function getStatusPagamento(dados = {}) {
  return firstValue(
    dados.statusPagamento,
    dados.pagamentoStatus,
    dados.pagamento?.status,
    dados.status_payment,
    dados.paymentStatus
  );
}

function getVendedor(dados = {}) {
  return firstValue(
    dados.vendedor,
    dados.vendedorNome,
    dados.nomeVendedor,
    dados.garcom,
    dados.garcomNome,
    dados.nomeGarcom,
    dados.usuario,
    dados.usuarioNome,
    dados.criadoPor,
    dados.atendente
  );
}

function getCutCmd(cutMode) {
  const mode = (cutMode || "full").toLowerCase();
  if (mode === "none") return "";
  if (mode === "partial") return CUT_PARTIAL;
  return CUT_FULL;
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

function formatarLinha(nome, valor, columns) {
  const maxCol = Number(columns) || 48;
  const v = safeStr(valor, "");
  const maxNome = Math.max(1, maxCol - v.length - 1);
  let n = safeStr(nome, "");
  if (n.length > maxNome) n = n.substring(0, maxNome);
  const espacos = maxCol - n.length - v.length;
  return n + " ".repeat(espacos > 0 ? espacos : 1) + v + LF;
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
  return firstValue(extra?.nome, extra?.name, extra?.titulo, extra?.descricao, extra?.label, extra?.opcao, extra?.sabor);
}

function getExtraQty(extra) {
  if (typeof extra !== "object" || !extra) return "";
  const qtd = extra.qtd ?? extra.quantidade ?? extra.qty;
  const n = Number(qtd);
  return Number.isFinite(n) && n > 1 ? `${n}x ` : "";
}

function getExtraPrice(extra) {
  if (typeof extra !== "object" || !extra) return null;
  const val = extra.precoTotal ?? extra.valorTotal ?? extra.preco ?? extra.valor ?? extra.price;
  const n = Number(val);
  return Number.isFinite(n) && n !== 0 ? moneyBR(n) : null;
}

function collectExtras(item = {}) {
  const lists = [
    item.adicionais,
    item.adicionaisSelecionados,
    item.opcoes,
    item.opcoesSelecionadas,
    item.opcionais,
    item.complementos,
    item.complementosSelecionados,
    item.personalizacoes,
    item.modificadores,
    item.extras,
    item.saboresSelecionados,
    item.sabores,
  ];

  const out = [];
  lists.forEach((list) => {
    normalizeExtrasList(list).forEach((extra) => {
      const name = getExtraName(extra);
      if (!name) return;
      const qty = getExtraQty(extra);
      const price = getExtraPrice(extra);
      out.push({ text: `${qty}${name}`, price });
    });
  });
  return out;
}

module.exports = function gerarTextoEntregaA(dados, printSettings = {}) {
  const columns = Number(printSettings?.columns) || 48;
  const feedLines = Number(printSettings?.feedLines ?? 3) || 3;
  const cutMode = printSettings?.cutMode || "full";
  const encoding = (printSettings?.encoding || "win1252").toLowerCase();

  const numeroPedido = getNumeroPedido(dados);
  const formaPagamento = getFormaPagamento(dados);
  const statusPagamento = getStatusPagamento(dados);
  const vendedor = getVendedor(dados);

  const rua = firstValue(dados?.enderecoRua, dados?.enderecoCliente, dados?.endereco, dados?.rua) || "---";
  const numCasa = firstValue(dados?.enderecoNumero, dados?.residenciaNumero, dados?.numeroCasa);
  const bairro = firstValue(dados?.enderecoBairro, dados?.residenciaBairro, dados?.bairro);
  const complemento = firstValue(dados?.complemento, dados?.Complemento, dados?.residenciaComplemento);
  const referencia = firstValue(dados?.referencia, dados?.enderecoReferencia, dados?.residenciaReferencia);
  const observacaoPedido = firstValue(dados?.observacao, dados?.obs, dados?.observacoes);

  let texto = "";
  wrapText(getRestaurantName(dados, printSettings), columns).forEach((l) => (texto += ALIGN_CENTER + TEXT_DOUBLE + l + LF));
  texto += TEXT_NORMAL + ALIGN_CENTER + `PEDIDO #${numeroPedido}` + LF;
  texto += ALIGN_CENTER + moment().format("DD/MM/YYYY HH:mm") + LF;
  texto += "-".repeat(columns) + LF;

  texto += ALIGN_LEFT;
  texto += `Cliente: ${firstValue(dados?.cliente, dados?.nomeCliente) || "---"}` + LF;
  const telefone = firstValue(dados?.telefone, dados?.telefoneCliente, dados?.celular);
  if (telefone) texto += `Telefone: ${telefone}` + LF;
  if (formaPagamento) texto += `Pagamento: ${labelize(formaPagamento)}` + LF;
  if (statusPagamento) texto += `Status pag.: ${labelize(statusPagamento)}` + LF;
  if (vendedor) texto += `Vendedor: ${vendedor}` + LF;

  const enderecoCompleto = numCasa ? `${rua}, ${numCasa}` : rua;
  if (enderecoCompleto && enderecoCompleto !== "---") texto += `Endereço: ${enderecoCompleto}` + LF;
  if (bairro) texto += `Bairro: ${bairro}` + LF;
  if (complemento) texto += `Complemento: ${complemento}` + LF;
  if (referencia) texto += `Referência: ${referencia}` + LF;

  if (observacaoPedido) {
    texto += "-".repeat(columns) + LF;
    texto += "OBSERVAÇÃO DO PEDIDO:" + LF;
    wrapText(observacaoPedido, columns).forEach((l) => (texto += l + LF));
  }

  texto += "-".repeat(columns) + LF;

  const itens = Array.isArray(dados?.itens) ? dados.itens : [];
  itens.forEach((item) => {
    const nomeItem = firstValue(item?.nome, item?.produto, item?.descricao);
    if (!nomeItem || nomeItem.toLowerCase() === "entrega") return;

    const qtd = safeStr(item?.qtd ?? item?.quantidade ?? 1, "1");
    const precoNum = item?.precoTotal ?? item?.valorTotal ?? item?.subtotal ?? item?.preco ?? item?.precoUnitario ?? item?.valor ?? 0;
    texto += formatarLinha(`${qtd}x ${nomeItem}`, moneyBR(precoNum), columns);

    collectExtras(item).forEach((extra) => {
      if (extra.price) texto += formatarLinha(`  + ${extra.text}`, extra.price, columns);
      else wrapText(`  + ${extra.text}`, columns).forEach((l) => (texto += l + LF));
    });

    const obsItem = firstValue(item?.observacao, item?.obs, item?.observacoes, item?.observacaoItem);
    if (obsItem) wrapText(`  Obs: ${obsItem}`, columns).forEach((l) => (texto += l + LF));

    texto += "-".repeat(columns) + LF;
  });

  const entregaItem = itens.find((i) => safeStr(i?.nome, "").toLowerCase() === "entrega");
  if (entregaItem) {
    const vEntrega = entregaItem?.precoTotal ?? entregaItem?.valorTotal ?? entregaItem?.preco ?? entregaItem?.valor ?? 0;
    texto += formatarLinha("Taxa de entrega", moneyBR(vEntrega), columns);
  }

  texto += LF + ALIGN_RIGHT + TEXT_DOUBLE + `Total: ${moneyBR(dados?.total ?? dados?.valorTotal ?? dados?.subtotal ?? 0)}` + LF;
  texto += LF.repeat(2);
  texto += ALIGN_CENTER + TEXT_NORMAL;
  texto += "Obrigado pela preferência!" + LF;
  texto += LF.repeat(Math.max(0, feedLines));
  texto += getCutCmd(cutMode);

  try {
    if (encoding === "utf8" || encoding === "utf-8") return Buffer.from(texto, "utf8");
    return iconv.encode(texto, encoding);
  } catch (e) {
    return iconv.encode(texto, "win1252");
  }
};
