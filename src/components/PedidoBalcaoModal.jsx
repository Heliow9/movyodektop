// src/components/PedidoBalcaoModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PaymentsIcon from "@mui/icons-material/Payments";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RefreshIcon from "@mui/icons-material/Refresh";
import RemoveIcon from "@mui/icons-material/Remove";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import SearchIcon from "@mui/icons-material/Search";

import axios from "axios";

import { enviarParaImpressao } from "../utils/enviarImpressao";
import iconPath from "../assets/movyo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

const ENDPOINTS = {
  buscarClientePorTelefone: (telefone) => `${API_URL}/api/clientes/${encodeURIComponent(telefone)}`,
  criarOuAtualizarPedidoBalcao: `${API_URL}/api/balcao`,
  pagamentoCandidates: (pedidoId) => [
    `${API_URL}/api/balcao/${pedidoId}/pagamento`,
    `${API_URL}/api/pedidos/${pedidoId}/pagamento`,
    `${API_URL}/api/pedidos/${pedidoId}/pagamentos`,
    `${API_URL}/api/pedidos/pagamento/${pedidoId}`,
    `${API_URL}/api/mesas/pedido/${pedidoId}/pagamento`,
  ],
  pixCandidates: (pedidoId) => [
    `${API_URL}/api/balcao/${pedidoId}/pix`,
    `${API_URL}/api/pedidos/${pedidoId}/pix`,
    `${API_URL}/api/pedidos/${pedidoId}/pagamento/pix`,
    `${API_URL}/api/pedidos/pix/${pedidoId}`,
  ],
  pixStatusCandidates: (pedidoId, paymentId) => [
    `${API_URL}/api/balcao/${pedidoId}/pix/${paymentId}/status`,
    `${API_URL}/api/pedidos/${pedidoId}/pix/${paymentId}/status`,
    `${API_URL}/api/pedidos/${pedidoId}/pix/status/${paymentId}`,
    `${API_URL}/api/pedidos/pix/${paymentId}/status`,
  ],
  postPagamento: (pedidoId) => ENDPOINTS.pagamentoCandidates(pedidoId),
  postPix: (pedidoId) => ENDPOINTS.pixCandidates(pedidoId),
  getPixStatus: (pedidoId, paymentId) => ENDPOINTS.pixStatusCandidates(pedidoId, paymentId),
};

const DEFAULT_RESTAURANTE_LOGO =
  "https://w7.pngwing.com/pngs/325/728/png-transparent-emblem-label-logo-arrows-elements-outline-icon.png";

/* =========================
   helpers (copiados do Home)
========================= */
const getToken = () =>
  localStorage.getItem("_token") || localStorage.getItem("tokenRestaurante") || "";

const asBearer = (t) => {
  const token = String(t || "").trim();
  if (!token) return "";
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

function authHeaders() {
  const bearer = asBearer(getToken());
  return bearer ? { Authorization: bearer } : {};
}

async function requestWithFallback({ method, urls, data, config }) {
  const list = Array.isArray(urls) ? urls : [urls];
  let lastErr = null;

  for (const url of list) {
    try {
      const res = await axios({ method, url, data, ...(config || {}) });
      return res;
    } catch (e) {
      const st = e?.response?.status;
      e._debug = { urlTentada: url, method, payloadEnviado: data, status: st, resposta: e?.response?.data };
      if (st === 404) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  const msg =
    lastErr?.response?.data?.message ||
    "Nenhuma rota encontrada (todas retornaram 404). Verifique suas rotas do backend.";
  const err = new Error(msg);
  err.code = "ENDPOINT_NOT_FOUND";
  err._debug = lastErr?._debug;
  throw err;
}

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}
function normalizeStr(s) {
  return safeText(s).trim().toLowerCase();
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function maskPhoneBR(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function toClienteRoutePhone(raw) {
  let t = onlyDigits(raw);
  if (t.startsWith("55") && t.length >= 12) t = t.slice(2);
  return t.slice(0, 11);
}
function toNumberBR(v, fallback = 0) {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}
function maskBRLInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits) / 100;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pedidoCode(pedido) {
  const num = pedido?.numeroPedido || pedido?.numero;
  if (num != null) return String(num);
  const id = pedido?._id || pedido?.id || "";
  return id ? String(id).slice(-6) : "—";
}
function getItemTotal(it) {
  const qtd = Math.max(1, Number(it?.quantidade || 1));
  const unit = Number(it?.precoUnitario || 0);
  const total = Number(it?.precoTotal);
  if (Number.isFinite(total)) return total;
  return round2(unit * qtd);
}
function fmtAdd(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n === 0) return "";
  return `(+${formatBRL(n)})`;
}
function joinNomePreco(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => {
      const nome = safeText(x?.nome || x?.label || x?.title || x);
      const preco = Number(x?.preco || 0);
      if (!nome) return "";
      return `${nome} ${fmtAdd(preco)}`.trim();
    })
    .filter(Boolean)
    .join(", ");
}
function getResumoItemLinhas(item) {
  const linhas = [];

  if (Array.isArray(item?.saboresSelecionados) && item.saboresSelecionados.length) {
    linhas.push(`Sabores: ${item.saboresSelecionados.join(", ")}`);
  }
  if (item?.bordaSelecionada?.nome) {
    const nome = safeText(item.bordaSelecionada.nome);
    const preco = Number(item.bordaSelecionada.preco || 0);
    linhas.push(`Borda: ${nome} ${fmtAdd(preco)}`.trim());
  }
  if (item?.adicionalSelecionado?.nome) {
    const nome = safeText(item.adicionalSelecionado.nome);
    const preco = Number(item.adicionalSelecionado.preco || 0);
    linhas.push(`Adicional: ${nome} ${fmtAdd(preco)}`.trim());
  }
  if (Array.isArray(item?.complementosSelecionados) && item.complementosSelecionados.length) {
    const txt = joinNomePreco(item.complementosSelecionados);
    if (txt) linhas.push(`Complementos: ${txt}`);
  }
  const tipos = item?.tiposExtrasSelecionados;
  if (tipos && typeof tipos === "object") {
    Object.entries(tipos).forEach(([tipoNome, itens]) => {
      const txt = joinNomePreco(itens);
      if (txt) linhas.push(`${safeText(tipoNome)}: ${txt}`);
    });
  }
  if (safeText(item?.observacao)) linhas.push(`Obs: ${safeText(item.observacao)}`);

  return linhas;
}
function buildResumoTextItem(item) {
  const linhas = getResumoItemLinhas(item);
  const full = linhas.join(" • ");

  const shortParts = linhas.slice(0, 2);
  let short = shortParts.join(" • ");
  if (linhas.length > 2) short += " • ...";
  if (short.length > 110) short = short.slice(0, 110).trim() + "…";

  const personalizado = linhas.length > 0;
  return { short, full, personalizado };
}

function keyNorm(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function arrOrEmpty(v) {
  return Array.isArray(v) ? v : [];
}
function normalizeProdutoParaConfig(p) {
  if (!p) return null;

  const catNome = (p?.categoria?.nome || p?.categoriaNome || "").toString();
  const catTipo = (p?.categoriaType || p?.categoria?.tipo || p?.categoriaTipo || "").toString();

  const extrasObj = p?.extras && typeof p.extras === "object" ? p.extras : {};
  const extrasKeys = Object.keys(extrasObj || {});
  const extrasMapNorm = new Map();
  for (const k of extrasKeys) extrasMapNorm.set(keyNorm(k), k);

  const saboresDireto = arrOrEmpty(p.saboresDisponiveis).length ? arrOrEmpty(p.saboresDisponiveis) : arrOrEmpty(p.sabores);
  const saboresKeyReal = extrasMapNorm.get("sabores") || extrasMapNorm.get("sabor");

  const saboresFromExtras = saboresKeyReal
    ? arrOrEmpty(extrasObj[saboresKeyReal]).map((x) => ({
        nome: x?.nome ?? x?.label ?? x?.title ?? String(x),
        preco: x?.preco ?? 0,
      }))
    : [];

  const saboresDisponiveis = saboresDireto.length ? saboresDireto : saboresFromExtras;

  const isPizza =
    keyNorm(catTipo) === "pizza" ||
    keyNorm(catNome).includes("pizza") ||
    (saboresDisponiveis.length > 0 && Number(p?.maxSabores || 0) > 0);

  const bordasDisponiveis = arrOrEmpty(p.bordasDisponiveis).length ? arrOrEmpty(p.bordasDisponiveis) : arrOrEmpty(p.bordas);
  const adicionais = arrOrEmpty(p.adicionais).length ? arrOrEmpty(p.adicionais) : arrOrEmpty(p.adicional);
  const complementos = arrOrEmpty(p.complementos);

  const tiposExtrasBase = arrOrEmpty(p.tiposExtras).map((tipo) => {
    const nomeTipo = tipo?.nome || "";
    const chaveReal = extrasMapNorm.get(keyNorm(nomeTipo));
    const itensFromMap = chaveReal ? arrOrEmpty(extrasObj[chaveReal]) : [];
    const itensDireto = arrOrEmpty(tipo?.itens);
    const itens = itensDireto.length ? itensDireto : itensFromMap;
    return { ...tipo, itens };
  });

  const nomesTiposExistentes = new Set(tiposExtrasBase.map((t) => keyNorm(t?.nome)));
  const extrasIgnorar = new Set(["sabores", "sabor"]);

  const tiposExtrasAuto = extrasKeys
    .filter((k) => {
      const kn = keyNorm(k);
      if (extrasIgnorar.has(kn)) return false;
      if (nomesTiposExistentes.has(kn)) return false;
      return arrOrEmpty(extrasObj[k]).length > 0;
    })
    .map((k) => ({
      nome: k,
      obrigatorio: false,
      tipoSelecion: "multiplo",
      minimoSelecionados: 0,
      maximoSelecionados: undefined,
      itens: arrOrEmpty(extrasObj[k]),
    }));

  const tiposExtras = [...tiposExtrasBase, ...tiposExtrasAuto];

  return {
    ...p,
    categoriaType: isPizza ? "pizza" : catTipo || "",
    saboresDisponiveis,
    bordasDisponiveis,
    adicionais,
    complementos,
    tiposExtras,
  };
}

/* Produto helpers */
function getProdutoId(p) {
  return safeText(p?._id || p?.id);
}
function getProdutoNome(p) {
  return safeText(p?.nome) || "Produto";
}
function getProdutoDescricao(p) {
  return safeText(p?.descricao);
}
function getProdutoImagem(p) {
  return safeText(p?.imagem);
}
function getProdutoPrecoBase(p) {
  const n = Number(p?.precoBase);
  return Number.isFinite(n) ? n : 0;
}
function getProdutoCategoriaTexto(p) {
  const populado = safeText(p?.categoria?.nome);
  if (populado) return populado;
  const pronto = safeText(p?.categoriaNome || p?.categoriaLabel);
  if (pronto) return pronto;
  const oid = safeText(p?.categoria);
  if (oid && oid.length >= 8) return "Sem categoria";
  return "Sem categoria";
}

/* =========================
   UI helpers
========================= */
function SmartThumb({
  src,
  alt,
  size = 56,
  restauranteLogo = DEFAULT_RESTAURANTE_LOGO,
  rounded = 14,
  watermark = true,
  preferCircularOnFallback = true,
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const hasSrc = !!String(src || "").trim();
  const isFallback = errored || !hasSrc;
  const showSrc = isFallback ? restauranteLogo : src;

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src, restauranteLogo]);

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: "hidden",
        bgcolor: "rgba(2,6,23,0.06)",
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${restauranteLogo || DEFAULT_RESTAURANTE_LOGO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(14px)",
          transform: "scale(1.12)",
          opacity: loaded ? 0 : 1,
          transition: "opacity 180ms ease",
        }}
      />

      {!loaded && (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </Box>
      )}

      <Box
        component="img"
        src={showSrc || restauranteLogo || DEFAULT_RESTAURANTE_LOGO}
        alt={alt || ""}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: isFallback ? "contain" : "cover",
          p: isFallback && preferCircularOnFallback ? 1.1 : 0,
          opacity: loaded ? 1 : 0,
          transition: "opacity 220ms ease",
          borderRadius: isFallback && preferCircularOnFallback ? "999px" : 0,
          backgroundColor: isFallback ? "rgba(255,255,255,0.9)" : "transparent",
          boxShadow:
            isFallback && preferCircularOnFallback
              ? "inset 0 0 0 2px rgba(2,6,23,0.10)"
              : "none",
        }}
      />

      {watermark && (
        <Box
          sx={{
            position: "absolute",
            right: 6,
            bottom: 6,
            width: Math.max(18, Math.round(size * 0.3)),
            height: Math.max(18, Math.round(size * 0.3)),
            borderRadius: "999px",
            overflow: "hidden",
            bgcolor: "#fff",
            boxShadow: "0 4px 12px rgba(2,6,23,0.14)",
            border: "2px solid rgba(255,255,255,0.95)",
          }}
          title="Restaurante"
        >
          <Box
            component="img"
            src={restauranteLogo || DEFAULT_RESTAURANTE_LOGO}
            alt="Logo do restaurante"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_RESTAURANTE_LOGO;
            }}
            sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
          />
        </Box>
      )}
    </Box>
  );
}

function SaveIconShim() {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: 1.2,
        bgcolor: "rgba(2,6,23,0.10)",
        display: "grid",
        placeItems: "center",
        fontSize: 10,
        fontWeight: 900,
        color: "#0f172a",
      }}
    >
      S
    </Box>
  );
}

/* =========================
   Modal Config Produto (ajustado)
========================= */
function ModalConfigProdutoBalcao({ open, onClose, produto, onConfirm, restauranteLogo }) {
  const [saboresSelecionados, setSaboresSelecionados] = useState([]);
  const [bordaSelecionada, setBordaSelecionada] = useState("nenhum");
  const [complementosSelecionados, setComplementosSelecionados] = useState([]);
  const [adicionalSelecionado, setAdicionalSelecionado] = useState("nenhum");
  const [tiposExtrasSelecionados, setTiposExtrasSelecionados] = useState({});
  const [observacao, setObservacao] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [validationError, setValidationError] = useState("");

  const isPizza =
    produto?.categoriaType === "pizza" ||
    (produto?.saboresDisponiveis?.length > 0 && Number(produto?.maxSabores || 0) > 0);

  // ✅ FIX: maxSabores default coerente (não trava “adicionar”)
  const saboresLen = Array.isArray(produto?.saboresDisponiveis) ? produto.saboresDisponiveis.length : 0;
  const maxSabores =
    Number.isFinite(Number(produto?.maxSabores)) && Number(produto?.maxSabores) > 0
      ? Number(produto.maxSabores)
      : saboresLen <= 1
        ? 1
        : 2;

  useEffect(() => {
    if (!open || !produto) return;

    setSaboresSelecionados([]);
    setBordaSelecionada("nenhum");
    setComplementosSelecionados([]);
    setAdicionalSelecionado("nenhum");
    setTiposExtrasSelecionados({});
    setObservacao("");
    setQuantidade(1);
    setValidationError("");

    if (produto?.saboresDisponiveis?.length === 1) {
      setSaboresSelecionados([produto.saboresDisponiveis[0].nome]);
    }

    const autoSelectExtras = {};
    produto?.tiposExtras?.forEach((tipo) => {
      const itens = Array.isArray(tipo?.itens) ? tipo.itens : [];
      if (tipo.tipoSelecion === "unico" && itens.length === 1) {
        autoSelectExtras[tipo.nome] = [itens[0]];
      }
      if (tipo.tipoSelecion === "multiplo" && tipo.obrigatorio && tipo.minimoSelecionados > 0) {
        autoSelectExtras[tipo.nome] = itens.slice(0, tipo.minimoSelecionados) || [];
      }
    });
    setTiposExtrasSelecionados(autoSelectExtras);
  }, [open, produto]);

  const precoTotal = useMemo(() => {
    if (!produto) return 0;

    let total = Number(produto.precoBase || 0);

    if (isPizza && saboresSelecionados.length > 0) {
      const precos = saboresSelecionados.map((nome) => {
        const sabor = produto.saboresDisponiveis?.find((s) => s.nome === nome);
        return parseFloat(sabor?.preco || 0);
      });

      if (precos.length) {
        if (produto.calculoPrecoPor === "media") {
          const soma = precos.reduce((acc, v) => acc + v, 0);
          total = soma / precos.length;
        } else {
          total = Math.max(...precos);
        }
      }
    }

    if (bordaSelecionada !== "nenhum") {
      const borda = produto.bordasDisponiveis?.find((b) => b.nome === bordaSelecionada);
      total += parseFloat(borda?.preco || 0);
    }

    if (adicionalSelecionado !== "nenhum") {
      const adicional = produto.adicionais?.find((a) => a.nome === adicionalSelecionado);
      total += parseFloat(adicional?.preco || 0);
    }

    complementosSelecionados.forEach((nome) => {
      const comp = produto.complementos?.find((c) => c.nome === nome);
      total += parseFloat(comp?.preco || 0);
    });

    Object.entries(tiposExtrasSelecionados).forEach(([, itens]) => {
      if (Array.isArray(itens)) {
        for (const item of itens) total += Number(item?.preco || 0);
      }
    });

    total *= quantidade;
    return Number.isFinite(total) ? total : 0;
  }, [
    produto,
    isPizza,
    saboresSelecionados,
    bordaSelecionada,
    adicionalSelecionado,
    complementosSelecionados,
    tiposExtrasSelecionados,
    quantidade,
  ]);

  if (!produto) return null;

  const validate = () => {
    // ✅ FIX: “pelo menos 1” e “até maxSabores” (não “exatamente”)
    if (isPizza) {
      const len = Array.isArray(produto?.saboresDisponiveis) ? produto.saboresDisponiveis.length : 0;

      if (len > 0) {
        if (saboresSelecionados.length < 1) return "Selecione pelo menos 1 sabor.";
        if (maxSabores > 0 && saboresSelecionados.length > maxSabores) {
          return `Selecione no máximo ${maxSabores} sabor(es).`;
        }
      }
    }

    const tipos = produto.tiposExtras || [];
    for (const tipo of tipos) {
      const selecionados = tiposExtrasSelecionados[tipo.nome] || [];
      if (tipo.obrigatorio && selecionados.length === 0) return `Selecione pelo menos uma opção em "${tipo.nome}".`;
      if (tipo.minimoSelecionados && selecionados.length < tipo.minimoSelecionados)
        return `Selecione pelo menos ${tipo.minimoSelecionados} opção(ões) em "${tipo.nome}".`;
      if (tipo.maximoSelecionados && selecionados.length > tipo.maximoSelecionados)
        return `Você pode escolher no máximo ${tipo.maximoSelecionados} opção(ões) em "${tipo.nome}".`;
    }
    return "";
  };

  const handleConfirm = () => {
    const errorMessage = validate();
    if (errorMessage) {
      setValidationError(errorMessage);
      return;
    }

    let precoUnit = Number(produto.precoBase || 0);

    if (isPizza && saboresSelecionados.length > 0) {
      const precos = saboresSelecionados.map((nome) => {
        const sabor = produto.saboresDisponiveis?.find((s) => s.nome === nome);
        return parseFloat(sabor?.preco || 0);
      });
      if (precos.length) {
        if (produto.calculoPrecoPor === "media") precoUnit = precos.reduce((acc, v) => acc + v, 0) / precos.length;
        else precoUnit = Math.max(...precos);
      }
    }

    if (bordaSelecionada !== "nenhum") {
      const borda = produto.bordasDisponiveis?.find((b) => b.nome === bordaSelecionada);
      precoUnit += parseFloat(borda?.preco || 0);
    }
    if (adicionalSelecionado !== "nenhum") {
      const adicional = produto.adicionais?.find((a) => a.nome === adicionalSelecionado);
      precoUnit += parseFloat(adicional?.preco || 0);
    }
    complementosSelecionados.forEach((nome) => {
      const comp = produto.complementos?.find((c) => c.nome === nome);
      precoUnit += parseFloat(comp?.preco || 0);
    });
    Object.entries(tiposExtrasSelecionados).forEach(([, itens]) => {
      if (Array.isArray(itens)) for (const item of itens) precoUnit += Number(item?.preco || 0);
    });

    const item = {
      nome: produto.nome,
      produtoId: produto._id,
      imagem: produto.imagem || "",
      categoriaType: produto.categoriaType || "",
      saboresSelecionados,
      bordaSelecionada:
        bordaSelecionada === "nenhum"
          ? null
          : produto.bordasDisponiveis?.find((b) => b.nome === bordaSelecionada) || null,
      adicionalSelecionado:
        adicionalSelecionado === "nenhum"
          ? null
          : produto.adicionais?.find((a) => a.nome === adicionalSelecionado) || null,
      complementosSelecionados: produto.complementos?.filter((c) => complementosSelecionados.includes(c.nome)) || [],
      tiposExtrasSelecionados,
      observacao,
      quantidade,
      precoUnitario: round2(precoUnit),
      precoTotal: round2(precoUnit * quantidade),
    };

    onConfirm?.(item);
    onClose?.();
  };

  const isPizzaMultiSabor = isPizza && saboresLen > 1 && maxSabores > 1;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="subtitle1" fontWeight={900} sx={{ pr: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {produto.nome}
        </Typography>
        <IconButton edge="end" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 2, borderRadius: 2, overflow: "hidden", width: "100%", height: 190 }}>
          <SmartThumb
            src={produto.imagem}
            alt={produto.nome}
            size={190}
            rounded={16}
            restauranteLogo={restauranteLogo || DEFAULT_RESTAURANTE_LOGO}
            watermark
            preferCircularOnFallback
          />
        </Box>

        {produto.descricao ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {produto.descricao}
          </Typography>
        ) : null}

        {validationError && (
          <Alert severity="warning" onClose={() => setValidationError("")} sx={{ mb: 2 }}>
            {validationError}
          </Alert>
        )}

        {isPizza && produto.saboresDisponiveis?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1" fontWeight={900} gutterBottom>
              Sabores {isPizzaMultiSabor ? `(escolha até ${maxSabores})` : ""}
            </Typography>

            {produto.saboresDisponiveis.length === 1 || maxSabores === 1 ? (
              <RadioGroup value={saboresSelecionados[0] || ""} onChange={(e) => setSaboresSelecionados(e.target.value ? [e.target.value] : [])}>
                {produto.saboresDisponiveis.map((s, i) => (
                  <FormControlLabel
                    key={i}
                    value={s.nome}
                    control={<Radio />}
                    label={s.preco ? `${s.nome} (+R$ ${parseFloat(s.preco).toFixed(2)})` : s.nome}
                  />
                ))}
              </RadioGroup>
            ) : (
              <Box display="flex" flexDirection="column">
                {produto.saboresDisponiveis.map((s, i) => {
                  const checked = saboresSelecionados.includes(s.nome);
                  const desabilitado = !checked && maxSabores > 0 && saboresSelecionados.length >= maxSabores;

                  return (
                    <FormControlLabel
                      key={i}
                      control={
                        <Checkbox
                          checked={checked}
                          disabled={desabilitado}
                          onChange={() => {
                            if (checked) setSaboresSelecionados((prev) => prev.filter((n) => n !== s.nome));
                            else if (maxSabores <= 0 || saboresSelecionados.length < maxSabores) {
                              setSaboresSelecionados((prev) => [...prev, s.nome]);
                            }
                          }}
                        />
                      }
                      label={s.preco ? `${s.nome} (+R$ ${parseFloat(s.preco).toFixed(2)})` : s.nome}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {produto.bordasDisponiveis?.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight={900} gutterBottom>
              Borda
            </Typography>
            <RadioGroup value={bordaSelecionada} onChange={(e) => setBordaSelecionada(e.target.value)}>
              <FormControlLabel value="nenhum" control={<Radio />} label="Sem borda" />
              {produto.bordasDisponiveis.map((b, i) => (
                <FormControlLabel key={i} value={b.nome} control={<Radio />} label={`${b.nome} (+R$ ${parseFloat(b.preco || 0).toFixed(2)})`} />
              ))}
            </RadioGroup>
          </Box>
        )}

        {produto.adicionais?.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight={900} gutterBottom>
              Adicional
            </Typography>
            <RadioGroup value={adicionalSelecionado} onChange={(e) => setAdicionalSelecionado(e.target.value)}>
              <FormControlLabel value="nenhum" control={<Radio />} label="Sem adicional" />
              {produto.adicionais.map((a, i) => (
                <FormControlLabel key={i} value={a.nome} control={<Radio />} label={`${a.nome} (+R$ ${parseFloat(a.preco || 0).toFixed(2)})`} />
              ))}
            </RadioGroup>
          </Box>
        )}

        {produto.tiposExtras?.map((tipo, idx) => {
          if (!Array.isArray(tipo.itens) || tipo.itens.length === 0) return null;
          const selecionados = tipo?.nome && tipo?.nome in tiposExtrasSelecionados ? tiposExtrasSelecionados[tipo.nome] : [];

          return (
            <Box key={idx} sx={{ mt: 3 }}>
              <Typography fontWeight={900} gutterBottom>
                {tipo.nome} {tipo.obrigatorio && "*"}
                {tipo.tipoSelecion === "multiplo" && tipo.maximoSelecionados ? ` (até ${tipo.maximoSelecionados})` : ""}
              </Typography>

              {tipo.tipoSelecion === "unico" ? (
                <RadioGroup
                  value={selecionados?.[0]?.nome || ""}
                  onChange={(e) => {
                    const item = tipo.itens.find((i) => i.nome === e.target.value);
                    setTiposExtrasSelecionados((prev) => ({ ...prev, [tipo.nome]: item ? [item] : [] }));
                  }}
                >
                  {!tipo.obrigatorio && <FormControlLabel value="" control={<Radio />} label="Nenhum" />}
                  {tipo.itens.map((item, i) => (
                    <FormControlLabel
                      key={i}
                      value={item.nome}
                      control={<Radio />}
                      label={`${item.nome} (+R$ ${parseFloat(item.preco || 0).toFixed(2)})`}
                    />
                  ))}
                </RadioGroup>
              ) : (
                <Box display="flex" flexDirection="column" gap={1}>
                  {tipo.itens.map((item, i) => {
                    const isChecked = (selecionados || []).some((s) => s.nome === item.nome);
                    const disabled =
                      !isChecked &&
                      tipo.maximoSelecionados !== undefined &&
                      (selecionados || []).length >= tipo.maximoSelecionados;

                    return (
                      <FormControlLabel
                        key={i}
                        control={
                          <Checkbox
                            checked={isChecked}
                            disabled={disabled}
                            onChange={() => {
                              const novos = isChecked
                                ? selecionados.filter((s) => s.nome !== item.nome)
                                : [...(selecionados || []), item];
                              setTiposExtrasSelecionados((prev) => ({ ...prev, [tipo.nome]: novos }));
                            }}
                          />
                        }
                        label={`${item.nome} (+R$ ${parseFloat(item.preco || 0).toFixed(2)})`}
                      />
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}

        {produto.complementos?.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight={900} gutterBottom>
              Complementos
            </Typography>
            <Box display="flex" flexDirection="column">
              {produto.complementos.map((c, i) => {
                const checked = complementosSelecionados.includes(c.nome);
                return (
                  <FormControlLabel
                    key={i}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => setComplementosSelecionados((prev) => (checked ? prev.filter((n) => n !== c.nome) : [...prev, c.nome]))}
                      />
                    }
                    label={`${c.nome} (+R$ ${parseFloat(c.preco || 0).toFixed(2)})`}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        <TextField fullWidth multiline rows={2} label="Observações" value={observacao} onChange={(e) => setObservacao(e.target.value)} sx={{ mt: 3 }} />

        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={900}>
            Quantidade
          </Typography>
          <Box display="flex" alignItems="center" gap={1.5}>
            <IconButton size="small" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>
              <RemoveIcon />
            </IconButton>
            <Typography fontWeight={900}>{quantidade}</Typography>
            <IconButton size="small" onClick={() => setQuantidade((q) => q + 1)}>
              <AddIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: "column",
          alignItems: "stretch",
          px: 2,
          pb: 2,
          pt: 1,
          borderTop: "1px solid #eee",
          position: "sticky",
          bottom: 0,
          backgroundColor: "#fff",
          zIndex: 2,
        }}
      >
        <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h6" fontWeight={900} color="primary">
            R$ {Number(precoTotal || 0).toFixed(2)}
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button fullWidth onClick={onClose} variant="outlined" color="inherit">
            Cancelar
          </Button>
          <Button
            fullWidth
            onClick={handleConfirm}
            sx={{
              background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)",
              color: "#fff",
              fontWeight: 900,
              borderRadius: "12px",
              "&:hover": { opacity: 0.9, background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)" },
            }}
          >
            Adicionar no balcão
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

/* =========================
   Modal Pagamento (igual ao seu)
========================= */
function ModalPagamentoBalcao({
  open,
  onClose,
  pedido,
  onPedidoAtualizado,
  onNotify,
  onQuitadoEnviarProducao,
}) {
  const pedidoId = useMemo(() => pedido?._id || pedido?.id || pedido?.pedidoId || "", [pedido]);

  const [modo, setModo] = useState("dinheiro");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [desconto, setDesconto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erroLocal, setErroLocal] = useState(null);

  const [pixInfo, setPixInfo] = useState({
    paymentId: "",
    status: "",
    qrCode: "",
    qrCodeBase64: "",
    valor: 0,
  });
  const [polling, setPolling] = useState(false);

  const total = useMemo(() => round2(Number(pedido?.valorTotal || 0)), [pedido]);
  const pago = useMemo(() => round2(Number(pedido?.valorPago || 0)), [pedido]);
  const pendente = useMemo(() => round2(Number(pedido?.valorPendente || 0)), [pedido]);
  const descontoNumerico = useMemo(() => Math.min(Math.max(0, round2(toNumberBR(desconto, 0))), pendente), [desconto, pendente]);
  const pendenteComDesconto = useMemo(() => round2(Math.max(0, pendente - descontoNumerico)), [pendente, descontoNumerico]);

  const MIN_PIX_CARTAO = 1.0;
  const valorNumerico = useMemo(() => round2(toNumberBR(valor, 0)), [valor]);
  const troco = useMemo(() => modo === "dinheiro" ? round2(Math.max(0, valorNumerico - pendente)) : 0, [modo, valorNumerico, pendente]);

  useEffect(() => {
    if (!open) return;

    setModo("dinheiro");
    setValor("");
    setObs("");
    setDesconto("");
    setPixInfo({ paymentId: "", status: "", qrCode: "", qrCodeBase64: "", valor: 0 });
    setPolling(false);
    setErroLocal(null);

    const pagamentos = Array.isArray(pedido?.pagamentos) ? pedido.pagamentos : [];
    for (let i = pagamentos.length - 1; i >= 0; i--) {
      const p = pagamentos[i];
      if (String(p?.metodo || "").toLowerCase() === "pix" && String(p?.status || "") === "pendente") {
        setPixInfo((prev) => ({
          ...prev,
          paymentId: String(p?.mpPaymentId || prev.paymentId || ""),
          status: String(p?.mpStatus || prev.status || ""),
          qrCode: String(p?.pixQrCode || prev.qrCode || ""),
          qrCodeBase64: String(p?.pixQrCodeBase64 || prev.qrCodeBase64 || ""),
          valor: round2(Number(p?.valor || prev.valor || 0)),
        }));
        break;
      }
    }
  }, [open, pedido]);

  const extractPedidoFromResponse = (data) => {
    if (!data) return null;
    if (data.pedido && data.pedido._id) return data.pedido;
    if (data._id) return data;
    if (data.pedidoAtualizado && data.pedidoAtualizado._id) return data.pedidoAtualizado;
    return null;
  };

  const isQuitado = (respData, pedidoAtual) => {
    if (respData?.fechado === true) return true;
    if (respData?.paid === true) return true;
    const pend = Number(pedidoAtual?.valorPendente ?? respData?.pendente ?? respData?.pedido?.valorPendente ?? NaN);
    return Number.isFinite(pend) ? pend <= 0 : false;
  };

  const postPagamento = async () => {
    if (!pedidoId) return;

    const v = round2(toNumberBR(valor, NaN));
    if (!Number.isFinite(v) || v <= 0) {
      setErroLocal("Informe um valor válido.");
      return;
    }

    const metodo = modo === "cartao" ? "cartao" : "dinheiro";
    const basePendente = pendenteComDesconto;
    const valorParaRegistrar = metodo === "dinheiro" && v > basePendente ? basePendente : v;
    const obsFinal = [String(obs || "").trim(), descontoNumerico > 0 ? `Desconto aplicado: ${formatBRL(descontoNumerico)}` : "", metodo === "dinheiro" && v > basePendente ? `Pago em dinheiro: ${formatBRL(v)} • Troco: ${formatBRL(round2(v - basePendente))}` : ""].filter(Boolean).join(" | " );
    if (metodo === "cartao" && v < MIN_PIX_CARTAO) {
      setErroLocal("Para cartão, o valor mínimo é R$ 1,00.");
      return;
    }

    setBusy(true);
    setErroLocal(null);

    try {
      const res = await requestWithFallback({
        method: "post",
        urls: ENDPOINTS.postPagamento(pedidoId),
        data: { metodo, valor: valorParaRegistrar, obs: obsFinal, descontoValor: descontoNumerico, valorDesconto: descontoNumerico, desconto: descontoNumerico },
        config: { headers: authHeaders() },
      });

      const pedidoAtual = extractPedidoFromResponse(res.data) || pedido;
      if (pedidoAtual) onPedidoAtualizado?.(pedidoAtual);

      setValor("");
      setObs("");
      setDesconto("");
    setDesconto("");

      if (isQuitado(res.data, pedidoAtual)) {
        onNotify?.("✅ Pagamento registrado! Pedido quitado.");
        onQuitadoEnviarProducao?.(pedidoAtual);
      } else {
        onNotify?.("✅ Pagamento registrado!");
      }
    } catch (e) {
      console.log("DEBUG PAGAMENTO:", e?._debug || e);
      setErroLocal(
        e?.response?.data?.message ||
          e?._debug?.resposta?.message ||
          e?.message ||
          "Erro ao registrar pagamento."
      );
    } finally {
      setBusy(false);
    }
  };

  const gerarPix = async () => {
    if (!pedidoId) return;

    const v = round2(toNumberBR(valor, NaN));
    if (!Number.isFinite(v) || v <= 0) {
      setErroLocal("Informe um valor válido para gerar o PIX.");
      return;
    }
    if (v < MIN_PIX_CARTAO) {
      setErroLocal("Para PIX, o valor mínimo é R$ 1,00.");
      return;
    }

    setBusy(true);
    setErroLocal(null);

    try {
      const res = await requestWithFallback({
        method: "post",
        urls: ENDPOINTS.postPix(pedidoId),
        data: { valor: v, descontoValor: descontoNumerico, valorDesconto: descontoNumerico, desconto: descontoNumerico },
        config: { headers: authHeaders() },
      });

      setPixInfo({
        paymentId: String(res.data?.paymentId || res.data?.mpPaymentId || ""),
        status: String(res.data?.statusPagamento || res.data?.status || "pending"),
        qrCode: String(res.data?.qrCode || res.data?.pixQrCode || ""),
        qrCodeBase64: String(res.data?.qrCodeBase64 || res.data?.pixQrCodeBase64 || ""),
        valor: round2(Number(res.data?.valor || v)),
      });

      const pedidoAtual = extractPedidoFromResponse(res.data);
      if (pedidoAtual) onPedidoAtualizado?.(pedidoAtual);

      onNotify?.("📲 PIX gerado. Aguardando confirmação…");
    } catch (e) {
      console.log("DEBUG PIX:", e?._debug || e);
      setErroLocal(
        e?.response?.data?.message ||
          e?._debug?.resposta?.message ||
          e?.message ||
          "Erro ao gerar PIX."
      );
    } finally {
      setBusy(false);
    }
  };

  const consultarPix = async () => {
    if (!pedidoId) return;

    const pid = String(pixInfo?.paymentId || "").trim();
    if (!pid) {
      setErroLocal("paymentId do PIX não encontrado.");
      return;
    }

    setPolling(true);
    setErroLocal(null);

    try {
      const res = await requestWithFallback({
        method: "get",
        urls: ENDPOINTS.getPixStatus(pedidoId, pid),
        config: { headers: authHeaders() },
      });

      const st = String(res.data?.status || res.data?.statusPagamento || "").toLowerCase();
      setPixInfo((p) => ({
        ...p,
        status: st || p.status,
        qrCode: String(res.data?.qrCode || p.qrCode || ""),
        qrCodeBase64: String(res.data?.qrCodeBase64 || p.qrCodeBase64 || ""),
      }));

      const pedidoAtual = extractPedidoFromResponse(res.data) || pedido;
      if (pedidoAtual) onPedidoAtualizado?.(pedidoAtual);

      if (isQuitado(res.data, pedidoAtual)) {
        onNotify?.("✅ PIX confirmado!");
        onQuitadoEnviarProducao?.(pedidoAtual);
      } else {
        onNotify?.("⏳ PIX ainda pendente…");
      }
    } catch (e) {
      setErroLocal(e?.response?.data?.message || e?.message || "Erro ao consultar PIX.");
    } finally {
      setPolling(false);
    }
  };

  const copiarCopiaCola = async () => {
    const txt = String(pixInfo?.qrCode || "").trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      onNotify?.("📋 PIX Copia e Cola copiado!");
    } catch {
      setErroLocal("Não consegui copiar. Copie manualmente.");
    }
  };

  const valorPlaceholder = modo === "pix" ? "Valor do PIX" : "Valor pago";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 950, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack>
          <Typography fontWeight={950}>Pagamento — Pedido #{pedidoCode(pedido)}</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: {formatBRL(total)} • Pago: {formatBRL(pago)} • Pendente: {formatBRL(pendente)}{descontoNumerico > 0 ? ` • Com desconto: ${formatBRL(pendenteComDesconto)}` : ""}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {erroLocal && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErroLocal(null)}>
            {erroLocal}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Chip clickable color={modo === "dinheiro" ? "primary" : "default"} variant={modo === "dinheiro" ? "filled" : "outlined"} label="Dinheiro" onClick={() => setModo("dinheiro")} sx={{ fontWeight: 900 }} />
          <Chip clickable color={modo === "cartao" ? "primary" : "default"} variant={modo === "cartao" ? "filled" : "outlined"} label="Cartão" onClick={() => setModo("cartao")} sx={{ fontWeight: 900 }} />
          <Chip clickable color={modo === "pix" ? "primary" : "default"} variant={modo === "pix" ? "filled" : "outlined"} label="PIX" onClick={() => setModo("pix")} icon={<QrCode2Icon />} sx={{ fontWeight: 900 }} />
        </Box>

        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label={valorPlaceholder}
            value={valor}
            onChange={(e) => setValor(maskBRLInput(e.target.value))}
            disabled={busy}
            inputProps={{ inputMode: "decimal" }}
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            helperText={
              modo === "pix" || modo === "cartao"
                ? "⚠️ Valor mínimo para PIX/Cartão: R$ 1,00"
                : "Dinheiro pode ser qualquer valor acima de R$ 0,00"
            }
          />

          <TextField
            fullWidth
            label="Desconto no pedido (opcional)"
            value={desconto}
            onChange={(e) => setDesconto(maskBRLInput(e.target.value))}
            disabled={busy}
            inputProps={{ inputMode: "decimal" }}
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            helperText={descontoNumerico > 0 ? `Novo pendente: ${formatBRL(pendenteComDesconto)}` : "Deixe vazio ou 0,00 se não houver desconto"}
          />

          {modo === "dinheiro" && troco > 0 && (
            <Alert severity="info" sx={{ fontWeight: 800 }}>
              Troco a devolver: <b>{formatBRL(troco)}</b>
            </Alert>
          )}

          <TextField fullWidth label="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} disabled={busy} />

          {modo !== "pix" && (
            <Button
              onClick={postPagamento}
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} /> : <PaymentsIcon />}
              disabled={busy}
              sx={{ fontWeight: 950 }}
            >
              Confirmar pagamento ({modo === "cartao" ? "Cartão" : "Dinheiro"})
            </Button>
          )}

          {modo === "pix" && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={1.25}>
                <Typography fontWeight={950}>PIX (parcial)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Ao gerar, o pagamento fica <b>pendente</b> até a confirmação.
                </Typography>

                <Button
                  onClick={gerarPix}
                  variant="contained"
                  startIcon={busy ? <CircularProgress size={18} /> : <QrCode2Icon />}
                  disabled={busy}
                  sx={{ fontWeight: 950 }}
                >
                  Gerar PIX
                </Button>

                {!!pixInfo.paymentId && (
                  <>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={(pixInfo.status || "pending").toUpperCase()}
                        color={String(pixInfo.status || "").toLowerCase().includes("approved") ? "success" : "warning"}
                        variant="outlined"
                        sx={{ fontWeight: 900 }}
                      />
                    </Stack>

                    {pixInfo.qrCodeBase64 ? (
                      <Box sx={{ display: "grid", placeItems: "center", py: 1 }}>
                        <Box
                          component="img"
                          alt="QR Code PIX"
                          src={`data:image/png;base64,${pixInfo.qrCodeBase64}`}
                          sx={{ width: 240, height: 240, borderRadius: 2, border: "1px solid rgba(2,6,23,0.12)" }}
                        />
                      </Box>
                    ) : (
                      <Alert severity="info">QR Code ainda não disponível. Você pode consultar o status.</Alert>
                    )}

                    {!!pixInfo.qrCode && (
                      <TextField
                        label="PIX Copia e Cola"
                        value={pixInfo.qrCode}
                        fullWidth
                        multiline
                        minRows={2}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title="Copiar">
                                <IconButton onClick={copiarCopiaCola} size="small">
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        onClick={consultarPix}
                        variant="outlined"
                        disabled={polling || busy}
                        startIcon={polling ? <CircularProgress size={18} /> : <RefreshIcon />}
                        sx={{ fontWeight: 900, whiteSpace: "nowrap" }}
                        fullWidth
                      >
                        Consultar status
                      </Button>

                      <Button
                        onClick={copiarCopiaCola}
                        variant="outlined"
                        disabled={!pixInfo.qrCode}
                        startIcon={<ContentCopyIcon />}
                        sx={{ fontWeight: 900, whiteSpace: "nowrap" }}
                        fullWidth
                      >
                        Copiar
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>
          )}

          {pendente <= 0 && (
            <Alert severity="success">
              Pedido quitado ✅ Ao fechar este modal, o sistema enviará automaticamente para <b>produção</b>.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined">
          Voltar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */
export default function PedidoBalcaoModal({
  open,
  onClose,
  restauranteId,
  nomeRestaurante,
  logoUrl,
  onPedidoQuitado,
  onNotify,
}) {
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const notify = useCallback(
    (message, severity = "success") => {
      onNotify?.(message, severity);
      setSnackbar({ open: true, message, severity });
    },
    [onNotify]
  );

  const restauranteLogo = useMemo(() => String(logoUrl || "").trim() || DEFAULT_RESTAURANTE_LOGO, [logoUrl]);

  const DRAFT_KEY = useMemo(
    () => (restauranteId ? `movyo:balcaoDraft:${restauranteId}` : `movyo:balcaoDraft`),
    [restauranteId]
  );

  const blankItemBalcao = useCallback(
    () => ({
      nome: "",
      produtoId: "",
      imagem: "",
      quantidade: 1,
      precoUnitario: 0,
      precoTotal: 0,
      observacao: "",
      categoriaType: "",
      saboresSelecionados: [],
      bordaSelecionada: null,
      adicionalSelecionado: null,
      complementosSelecionados: [],
      tiposExtrasSelecionados: {},
    }),
    []
  );

  const [balcaoTab, setBalcaoTab] = useState(0);
  const [balcaoProdLoading, setBalcaoProdLoading] = useState(false);
  const [balcaoProdutos, setBalcaoProdutos] = useState([]);
  const [balcaoBusca, setBalcaoBusca] = useState("");
  const [balcaoCategoriaAtiva, setBalcaoCategoriaAtiva] = useState("Todas");
  const [balcaoBuscaComanda, setBalcaoBuscaComanda] = useState("");

  const [balcaoNomeCliente, setBalcaoNomeCliente] = useState("");
  const [balcaoTelefone, setBalcaoTelefone] = useState("");
  const [balcaoBuscandoCliente, setBalcaoBuscandoCliente] = useState(false);

  const [balcaoEndereco, setBalcaoEndereco] = useState("");
  const [balcaoNumero, setBalcaoNumero] = useState("");
  const [balcaoBairro, setBalcaoBairro] = useState("");
  const [balcaoReferencia, setBalcaoReferencia] = useState("");

  const [balcaoSaving, setBalcaoSaving] = useState(false);

  const [balcaoOpenConfig, setBalcaoOpenConfig] = useState(false);
  const [balcaoProdutoSelecionado, setBalcaoProdutoSelecionado] = useState(null);

  const [balcaoItens, setBalcaoItens] = useState([blankItemBalcao()]);
  const [balcaoPedidoServidor, setBalcaoPedidoServidor] = useState(null);

  const [balcaoPayOpen, setBalcaoPayOpen] = useState(false);

  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const draftPayloadRef = useRef(null);

  const comandaScrollRef = useRef(null);

  const scrollToTopComanda = useCallback(() => {
    requestAnimationFrame(() => {
      const el = comandaScrollRef.current;
      if (!el) return;
      el.scrollTo({ top: 0, behavior: "smooth" });
      const dialogContent = el.closest?.(".MuiDialogContent-root");
      if (dialogContent) dialogContent.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const totalBalcao = useMemo(
    () => (balcaoItens || []).reduce((acc, it) => acc + Number(it?.precoTotal || 0), 0),
    [balcaoItens]
  );

  const validarItens = useCallback(() => {
    const itensValidos = (balcaoItens || [])
      .map((it) => ({
        nome: safeText(it.nome).trim(),
        produtoId: safeText(it.produtoId),
        imagem: safeText(it.imagem),
        quantidade: Math.max(1, Number(it.quantidade || 1)),
        precoUnitario: Number(it.precoUnitario || 0),
        precoTotal: round2(Number(it.precoTotal || 0)),
        observacao: safeText(it.observacao || ""),
        categoriaType: safeText(it.categoriaType || ""),
        saboresSelecionados: Array.isArray(it.saboresSelecionados) ? it.saboresSelecionados : [],
        bordaSelecionada: it.bordaSelecionada || null,
        adicionalSelecionado: it.adicionalSelecionado || null,
        complementosSelecionados: Array.isArray(it.complementosSelecionados) ? it.complementosSelecionados : [],
        tiposExtrasSelecionados:
          it.tiposExtrasSelecionados && typeof it.tiposExtrasSelecionados === "object"
            ? it.tiposExtrasSelecionados
            : {},
      }))
      .filter(
        (it) =>
          it.nome &&
          Number.isFinite(it.precoUnitario) &&
          it.precoUnitario >= 0 &&
          Number.isFinite(it.precoTotal) &&
          it.precoTotal >= 0
      );

    return itensValidos;
  }, [balcaoItens]);

  const itensBalcaoFiltrados = useMemo(() => {
    const termo = normalizeStr(balcaoBuscaComanda);
    const itens = Array.isArray(balcaoItens) ? balcaoItens : [];
    const comIdx = itens.map((it, idxReal) => ({ it, idxReal })).filter(({ it }) => String(it?.nome || "").trim());
    if (!termo) return comIdx;
    return comIdx.filter(({ it }) => normalizeStr(it?.nome).includes(termo));
  }, [balcaoItens, balcaoBuscaComanda]);

  const balcaoCategorias = useMemo(() => {
    const set = new Set();
    for (const p of balcaoProdutos) {
      const cat = safeText(getProdutoCategoriaTexto(p)).trim();
      if (cat) set.add(cat);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [balcaoProdutos]);

  const produtosFiltradosBalcao = useMemo(() => {
    const termo = normalizeStr(balcaoBusca);
    const catAtiva = safeText(balcaoCategoriaAtiva).trim();

    return (balcaoProdutos || []).filter((p) => {
      const nome = normalizeStr(getProdutoNome(p));
      const desc = normalizeStr(getProdutoDescricao(p));
      const cat = safeText(getProdutoCategoriaTexto(p)).trim();

      const matchNome = !termo || nome.includes(termo) || desc.includes(termo);
      const matchCat = catAtiva === "Todas" ? true : cat === catAtiva;
      return matchNome && matchCat;
    });
  }, [balcaoProdutos, balcaoBusca, balcaoCategoriaAtiva]);

  const resetBalcao = useCallback(() => {
    setBalcaoNomeCliente("");
    setBalcaoTelefone("");
    setBalcaoEndereco("");
    setBalcaoNumero("");
    setBalcaoBairro("");
    setBalcaoReferencia("");

    setBalcaoSaving(false);
    setBalcaoTab(0);
    setBalcaoBusca("");
    setBalcaoCategoriaAtiva("Todas");
    setBalcaoProdutos([]);
    setBalcaoBuscaComanda("");

    setBalcaoOpenConfig(false);
    setBalcaoProdutoSelecionado(null);

    setBalcaoItens([blankItemBalcao()]);
    setBalcaoPedidoServidor(null);
    setBalcaoPayOpen(false);
  }, [blankItemBalcao]);

  const closeModal = useCallback(() => {
    onClose?.();
    setTimeout(() => resetBalcao(), 180);
  }, [onClose, resetBalcao]);

  const carregarProdutosBalcao = useCallback(async () => {
    if (!restauranteId) return;
    setBalcaoProdLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/produtos/${restauranteId}`, { headers: authHeaders() });
      const lista = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.produtos) ? res.data.produtos : [];
      const normalizados = lista
        .filter((p) => p?.ativo !== false)
        .map((p) => normalizeProdutoParaConfig(p))
        .filter(Boolean);
      setBalcaoProdutos(normalizados);
    } catch (e) {
      console.warn("Erro ao carregar produtos (balcão):", e?.response?.data || e?.message);
      notify("Erro ao carregar produtos do balcão.", "error");
    } finally {
      setBalcaoProdLoading(false);
    }
  }, [restauranteId, notify]);

  useEffect(() => {
    if (!open) return;
    carregarProdutosBalcao();
  }, [open, carregarProdutosBalcao]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.itens?.length) {
        draftPayloadRef.current = parsed;
        setDraftPromptOpen(true);
      }
    } catch {}
  }, [open, DRAFT_KEY]);

  const aplicarRascunho = useCallback(
    (draft) => {
      setBalcaoNomeCliente(draft?.nomeCliente || "");
      setBalcaoTelefone(draft?.telefoneCliente || "");
      setBalcaoEndereco(draft?.enderecoCliente || "");
      setBalcaoNumero(draft?.residenciaNumero || "");
      setBalcaoBairro(draft?.residenciaBairro || "");
      setBalcaoReferencia(draft?.residenciaReferencia || "");
      setBalcaoItens(Array.isArray(draft?.itens) && draft.itens.length ? draft.itens : [blankItemBalcao()]);
      setBalcaoPedidoServidor(draft?.pedidoServidor?._id ? { _id: draft.pedidoServidor._id } : null);
    },
    [blankItemBalcao]
  );

  const limparRascunho = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [DRAFT_KEY]);

  const aplicarDraftSeConfirmar = useCallback(
    (yes) => {
      if (yes) {
        const d = draftPayloadRef.current;
        if (d) aplicarRascunho(d);
        notify("Rascunho carregado ✅", "success");
      } else {
        limparRascunho();
        notify("Rascunho descartado.", "info");
      }
      draftPayloadRef.current = null;
      setDraftPromptOpen(false);
    },
    [aplicarRascunho, limparRascunho, notify]
  );

  // BUGFIX original: restauranteId precisa existir no payload
  const restaurante = restauranteId;

  const guardarRascunho = useCallback(() => {
    const payload = {
      ts: Date.now(),
      restaurante,
      nomeCliente: balcaoNomeCliente,
      telefoneCliente: balcaoTelefone,
      enderecoCliente: balcaoEndereco,
      residenciaNumero: balcaoNumero,
      residenciaBairro: balcaoBairro,
      residenciaReferencia: balcaoReferencia,
      itens: balcaoItens,
      pedidoServidor: balcaoPedidoServidor
        ? { _id: balcaoPedidoServidor?._id, numeroPedido: balcaoPedidoServidor?.numeroPedido }
        : null,
      valorTotal: round2(totalBalcao),
      formadePagamento: "pix",
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      notify("Rascunho guardado ✅", "success");
    } catch {
      notify("Não consegui guardar o rascunho.", "error");
    }
  }, [
    DRAFT_KEY,
    restaurante,
    balcaoNomeCliente,
    balcaoTelefone,
    balcaoEndereco,
    balcaoNumero,
    balcaoBairro,
    balcaoReferencia,
    balcaoItens,
    balcaoPedidoServidor,
    totalBalcao,
    notify,
  ]);

  const updItemBalcao = useCallback((idx, patch) => {
    setBalcaoItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        const qtd = Math.max(1, Number(next.quantidade || 1));
        const unit = Number(next.precoUnitario || 0);
        next.quantidade = qtd;
        next.precoUnitario = Number.isFinite(unit) ? unit : 0;
        if (patch?.precoTotal === undefined) next.precoTotal = round2(next.precoUnitario * next.quantidade);
        return next;
      })
    );
  }, []);

  const rmItemBalcao = useCallback(
    (idx) => {
      setBalcaoItens((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        return next.length ? next : [blankItemBalcao()];
      });
    },
    [blankItemBalcao]
  );

  const addItemManualBalcao = useCallback(
    () => setBalcaoItens((prev) => [...prev, blankItemBalcao()]),
    [blankItemBalcao]
  );

  const adicionarItemConfiguradoNoBalcao = useCallback(
    (item) => {
      setBalcaoItens((prev) => {
        const firstEmpty =
          prev.length === 1 &&
          !String(prev[0]?.nome || "").trim() &&
          Number(prev[0]?.precoUnitario || 0) === 0;

        if (firstEmpty) return [item];
        return [...prev, item];
      });

      notify("Item adicionado ✅", "success");
      scrollToTopComanda();
    },
    [scrollToTopComanda, notify]
  );

  const pickEnderecoFields = (end0) => {
    const e = end0 || {};
    const rua = safeText(e.rua) || safeText(e.endereco) || safeText(e.logradouro) || safeText(e.address);
    const numero = safeText(e.numero) || safeText(e.numeroCasa) || safeText(e.residenciaNumero);
    const bairro = safeText(e.bairro) || safeText(e.residenciaBairro);
    const referencia =
      safeText(e.referencia) ||
      safeText(e.complemento) ||
      safeText(e.pontoReferencia) ||
      safeText(e.residenciaReferencia);
    const enderecoCompleto = safeText(e.enderecoCompleto);
    return { endereco: enderecoCompleto || rua, numero, bairro, referencia };
  };

  const buscarCliente = useCallback(async () => {
    const t = toClienteRoutePhone(balcaoTelefone);

    if (!t || t.length < 10) {
      notify("Informe um telefone válido (com DDD).", "warning");
      return;
    }

    setBalcaoBuscandoCliente(true);

    try {
      const res = await axios.get(ENDPOINTS.buscarClientePorTelefone(t), { headers: authHeaders() });
      const data = res.data || null;

      if (!data) {
        notify("Cliente não encontrado. Você pode cadastrar manualmente.", "info");
        return;
      }

      setBalcaoNomeCliente(data.nome || data.nomeCliente || "");

      const ends = Array.isArray(data.enderecos) ? data.enderecos : [];
      if (ends.length > 0) {
        const f = pickEnderecoFields(ends[0]);
        setBalcaoEndereco(f.endereco || "");
        setBalcaoNumero(f.numero || "");
        setBalcaoBairro(f.bairro || "");
        setBalcaoReferencia(f.referencia || "");
        notify("Cliente encontrado ✅ Endereço preenchido.", "success");
      } else {
        notify("Cliente encontrado ✅ (sem endereço cadastrado).", "success");
      }
    } catch (e) {
      notify(e?.response?.data?.message || "Não encontrei este cliente.", "info");
    } finally {
      setBalcaoBuscandoCliente(false);
    }
  }, [balcaoTelefone, notify]);

  const criarOuAtualizarPedidoServidor = useCallback(async () => {
    if (!restauranteId) throw new Error("Restaurante não identificado.");

    const itensValidos = validarItens();
    if (!itensValidos.length) throw new Error("Adicione pelo menos 1 item válido.");

    const tel = toClienteRoutePhone(balcaoTelefone);
    if (!tel || tel.length < 10) throw new Error("Telefone do cliente é obrigatório (com DDD).");

    const payload = {
      restaurante: restauranteId,
      restauranteId: restauranteId,
      origem: "balcao",
      telefoneCliente: tel,
      nomeCliente: String(balcaoNomeCliente || "").trim() || "Balcão",
      enderecoCliente: String(balcaoEndereco || "").trim(),
      residenciaNumero: String(balcaoNumero || "").trim(),
      residenciaBairro: String(balcaoBairro || "").trim(),
      residenciaReferencia: String(balcaoReferencia || "").trim(),
      itens: itensValidos,
      pedidoId: balcaoPedidoServidor?._id || null,
      pedido: balcaoPedidoServidor?._id || null,
    };

    const res = await axios.post(ENDPOINTS.criarOuAtualizarPedidoBalcao, payload, { headers: authHeaders() });
    const pedidoCriadoOuAtualizado = res.data?.pedido || res.data;

    if (!pedidoCriadoOuAtualizado?._id) throw new Error("Backend não retornou pedido.");

    setBalcaoPedidoServidor(pedidoCriadoOuAtualizado);
    return pedidoCriadoOuAtualizado;
  }, [
    restauranteId,
    validarItens,
    balcaoTelefone,
    balcaoNomeCliente,
    balcaoEndereco,
    balcaoNumero,
    balcaoBairro,
    balcaoReferencia,
    balcaoPedidoServidor,
  ]);

  const abrirPagamento = useCallback(async () => {
    try {
      setBalcaoSaving(true);
      const pedido = await criarOuAtualizarPedidoServidor();
      setBalcaoPedidoServidor(pedido);
      setBalcaoPayOpen(true);
    } catch (e) {
      notify(e?.message || "Erro ao abrir pagamento.", "error");
    } finally {
      setBalcaoSaving(false);
    }
  }, [criarOuAtualizarPedidoServidor, notify]);

  const handleSalvarPedidoBalcao = useCallback(async () => {
    try {
      setBalcaoSaving(true);
      const pedido = await criarOuAtualizarPedidoServidor();
      setBalcaoPedidoServidor(pedido);
      guardarRascunho();
      notify(`Pedido balcão salvo ✅ (ID: ${pedidoCode(pedido)})`, "success");
    } catch (e) {
      notify(e?.message || "Erro ao salvar pedido balcão.", "error");
    } finally {
      setBalcaoSaving(false);
    }
  }, [criarOuAtualizarPedidoServidor, guardarRascunho, notify]);

  const handleLimparComanda = useCallback(() => {
    setBalcaoItens([blankItemBalcao()]);
    setBalcaoPedidoServidor(null);
    limparRascunho();
    notify("Comanda limpa.", "info");
  }, [blankItemBalcao, limparRascunho, notify]);

  const abrirConfigProduto = useCallback((produto) => {
    setBalcaoProdutoSelecionado(produto);
    setBalcaoOpenConfig(true);
  }, []);

  const imprimirBalcao = useCallback(() => {
    const itens = validarItens();
    if (!itens.length) {
      notify("Sem itens válidos para imprimir.", "warning");
      return;
    }

    const pedidoFake = {
      id: balcaoPedidoServidor?._id || "BALCAO",
      nome: `Balcão — ${balcaoNomeCliente || "Cliente"}`,
      status: "balcao",
      cliente: balcaoNomeCliente || "Cliente",
      telefone: balcaoTelefone || "",
      enderecoCliente: balcaoEndereco || "",
      residenciaNumero: balcaoNumero || "",
      residenciaBairro: balcaoBairro || "",
      residenciaReferencia: balcaoReferencia || "",
      itens,
      total: round2(totalBalcao),
    };

    enviarParaImpressao(pedidoFake, { restauranteId, nomeRestaurante, logoUrl });
    notify("Enviado para impressão ✅", "success");
  }, [
    validarItens,
    balcaoPedidoServidor,
    balcaoNomeCliente,
    balcaoTelefone,
    balcaoEndereco,
    balcaoNumero,
    balcaoBairro,
    balcaoReferencia,
    totalBalcao,
    restauranteId,
    nomeRestaurante,
    logoUrl,
    notify,
  ]);

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (balcaoSaving) return;
          if (reason === "backdropClick") return;
          closeModal();
        }}
        fullWidth
        maxWidth="xl"
      >
        <DialogTitle sx={{ fontWeight: 950, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Stack>
            <Typography fontWeight={950}>Pedido balcão (sem mesa)</Typography>
            <Typography variant="caption" color="text.secondary">
              Telefone puxa cliente/endereço • Pagamento parcial • Quitou =&gt; vai pra produção
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Imprimir comanda do balcão">
              <span>
                <IconButton onClick={imprimirBalcao} disabled={balcaoSaving}>
                  <PrintIcon />
                </IconButton>
              </span>
            </Tooltip>

            <IconButton onClick={closeModal} disabled={balcaoSaving}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 1.5 }}>
            <Tabs value={balcaoTab} onChange={(_, v) => setBalcaoTab(v)} sx={{ minHeight: 40 }}>
              <Tab icon={<RestaurantMenuIcon />} iconPosition="start" label="Catálogo" sx={{ minHeight: 40, fontWeight: 900, textTransform: "none" }} />
              <Tab icon={<ReceiptLongIcon />} iconPosition="start" label="Comanda" sx={{ minHeight: 40, fontWeight: 900, textTransform: "none" }} />
            </Tabs>
          </Box>

          <Divider />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.25fr 0.75fr" },
              gap: 0,
              minHeight: "78vh",
            }}
          >
            {/* LEFT */}
            <Box sx={{ p: 2, borderRight: { md: "1px solid rgba(148,163,184,0.35)" }, minWidth: 0 }}>
              {balcaoTab === 0 ? (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }} sx={{ mb: 1.4 }}>
                    <TextField
                      fullWidth
                      value={balcaoBusca}
                      onChange={(e) => setBalcaoBusca(e.target.value)}
                      placeholder="Buscar produto..."
                      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    />

                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={carregarProdutosBalcao}
                      disabled={balcaoProdLoading}
                      sx={{ whiteSpace: "nowrap", fontWeight: 900 }}
                    >
                      Atualizar
                    </Button>
                  </Stack>

                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.4 }}>
                    {balcaoCategorias.map((cat) => (
                      <Chip
                        key={cat}
                        clickable
                        label={cat}
                        onClick={() => setBalcaoCategoriaAtiva(cat)}
                        color={balcaoCategoriaAtiva === cat ? "primary" : "default"}
                        variant={balcaoCategoriaAtiva === cat ? "filled" : "outlined"}
                        sx={{ fontWeight: 900 }}
                      />
                    ))}
                  </Box>

                  {balcaoProdLoading ? (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.4 }}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Card key={i} sx={{ borderRadius: 3 }}>
                          <CardContent>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                            <Skeleton sx={{ mt: 1 }} />
                            <Skeleton width="60%" />
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.4 }}>
                      {produtosFiltradosBalcao.map((p) => (
                        <Card key={getProdutoId(p)} sx={{ borderRadius: 3, overflow: "hidden" }} variant="outlined">
                          <CardActionArea onClick={() => abrirConfigProduto(p)} sx={{ height: "100%" }}>
                            <Box sx={{ p: 1.2 }}>
                              <Box sx={{ borderRadius: 2.2, overflow: "hidden", height: 128, mb: 1 }}>
                                <SmartThumb src={getProdutoImagem(p)} alt={getProdutoNome(p)} size={128} rounded={18} restauranteLogo={restauranteLogo} watermark preferCircularOnFallback />
                              </Box>

                              <Typography fontWeight={950} sx={{ color: "#0f172a" }} noWrap title={getProdutoNome(p)}>
                                {getProdutoNome(p)}
                              </Typography>

                              <Typography variant="caption" sx={{ color: "#64748b", display: "block" }} noWrap title={getProdutoCategoriaTexto(p)}>
                                {getProdutoCategoriaTexto(p)}
                              </Typography>

                              {getProdutoDescricao(p) ? (
                                <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.4 }} noWrap title={getProdutoDescricao(p)}>
                                  {getProdutoDescricao(p)}
                                </Typography>
                              ) : (
                                <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.4 }}>
                                  —
                                </Typography>
                              )}

                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                                <Chip size="small" label={formatBRL(getProdutoPrecoBase(p))} sx={{ fontWeight: 950, borderRadius: 999, bgcolor: "rgba(2,6,23,0.06)" }} />
                                <Chip size="small" label="Adicionar" color="primary" sx={{ fontWeight: 950, borderRadius: 999 }} />
                              </Box>
                            </Box>
                          </CardActionArea>
                        </Card>
                      ))}

                      {!balcaoProdLoading && produtosFiltradosBalcao.length === 0 && (
                        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, gridColumn: "1/-1", bgcolor: "rgba(255,255,255,0.7)" }}>
                          <Typography fontWeight={900}>Nenhum produto encontrado.</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ajuste a busca ou selecione outra categoria.
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }} sx={{ mb: 1.4 }}>
                    <TextField
                      fullWidth
                      value={balcaoBuscaComanda}
                      onChange={(e) => setBalcaoBuscaComanda(e.target.value)}
                      placeholder="Buscar item na comanda..."
                      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    />

                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setBalcaoTab(0);
                        notify("Selecione um produto no catálogo.", "info");
                      }}
                      sx={{ whiteSpace: "nowrap", fontWeight: 900 }}
                    >
                      + Produto
                    </Button>
                  </Stack>

                  <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.4 }}>
                    <Typography fontWeight={950} sx={{ mb: 1 }}>
                      Itens ({(validarItens() || []).length})
                    </Typography>

                    <Box
                      ref={comandaScrollRef}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        maxHeight: "55vh",
                        overflowY: "auto",
                        pr: 0.5,
                        "&::-webkit-scrollbar": { width: 6 },
                        "&::-webkit-scrollbar-thumb": { background: "rgba(148,163,184,0.7)", borderRadius: 999 },
                      }}
                    >
                      {itensBalcaoFiltrados.map(({ it, idxReal }) => {
                        const resumo = buildResumoTextItem(it);
                        const idx = idxReal;

                        return (
                          <Paper key={`${it.nome}-${idx}`} variant="outlined" sx={{ borderRadius: 3, p: 1.2 }}>
                            <Box sx={{ display: "flex", gap: 1.2, alignItems: "flex-start" }}>
                              <SmartThumb src={it.imagem} alt={it.nome} size={54} rounded={14} restauranteLogo={restauranteLogo} watermark preferCircularOnFallback />

                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography fontWeight={950} sx={{ color: "#0f172a" }} noWrap title={it.nome}>
                                  {it.nome || "Item"}
                                </Typography>

                                {resumo.short ? (
                                  <Typography variant="caption" sx={{ color: "#64748b" }} title={resumo.full || resumo.short}>
                                    {resumo.short}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                                    —
                                  </Typography>
                                )}

                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
                                  <Chip size="small" label={`Unit: ${formatBRL(it.precoUnitario || 0)}`} sx={{ borderRadius: 999, fontWeight: 900, bgcolor: "rgba(2,6,23,0.06)" }} />
                                  <Chip size="small" label={`Total: ${formatBRL(it.precoTotal || 0)}`} sx={{ borderRadius: 999, fontWeight: 900, bgcolor: "rgba(2,6,23,0.06)" }} />
                                </Box>
                              </Box>

                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-end" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                                  <IconButton size="small" onClick={() => updItemBalcao(idx, { quantidade: Math.max(1, Number(it.quantidade || 1) - 1) })}>
                                    <RemoveIcon fontSize="small" />
                                  </IconButton>
                                  <Typography fontWeight={950}>{Math.max(1, Number(it.quantidade || 1))}</Typography>
                                  <IconButton size="small" onClick={() => updItemBalcao(idx, { quantidade: Number(it.quantidade || 1) + 1 })}>
                                    <AddIcon fontSize="small" />
                                  </IconButton>
                                </Box>

                                <IconButton size="small" color="error" onClick={() => rmItemBalcao(idx)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Paper>
                        );
                      })}
                    </Box>
                  </Paper>
                </>
              )}
            </Box>

            {/* RIGHT */}
            <Box sx={{ p: 2, minWidth: 0, bgcolor: "rgba(2,6,23,0.02)" }}>
              <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: 1.6, mb: 1.4, bgcolor: "rgba(255,255,255,0.85)" }}>
                <Typography fontWeight={950} sx={{ mb: 1 }}>
                  Cliente
                </Typography>

                <Stack spacing={1.2}>
                  <TextField label="Nome" value={balcaoNomeCliente} onChange={(e) => setBalcaoNomeCliente(e.target.value)} fullWidth />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      label="Telefone (com DDD)"
                      value={balcaoTelefone}
                      onChange={(e) => setBalcaoTelefone(maskPhoneBR(e.target.value))}
                      fullWidth
                      inputProps={{ inputMode: "numeric" }}
                      helperText="Ex.: (81) 99999-9999"
                    />

                    <Button
                      variant="outlined"
                      startIcon={balcaoBuscandoCliente ? <CircularProgress size={18} /> : <SearchIcon />}
                      onClick={buscarCliente}
                      disabled={balcaoBuscandoCliente}
                      sx={{ whiteSpace: "nowrap", fontWeight: 900 }}
                    >
                      Buscar
                    </Button>
                  </Stack>

                  <TextField label="Endereço" value={balcaoEndereco} onChange={(e) => setBalcaoEndereco(e.target.value)} fullWidth />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField label="Número" value={balcaoNumero} onChange={(e) => setBalcaoNumero(e.target.value)} fullWidth />
                    <TextField label="Bairro" value={balcaoBairro} onChange={(e) => setBalcaoBairro(e.target.value)} fullWidth />
                  </Stack>

                  <TextField label="Referência" value={balcaoReferencia} onChange={(e) => setBalcaoReferencia(e.target.value)} fullWidth />
                </Stack>
              </Paper>

              <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: 1.6, mb: 1.4, bgcolor: "rgba(255,255,255,0.85)" }}>
                <Typography fontWeight={950} sx={{ mb: 1 }}>
                  Resumo
                </Typography>

                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Itens válidos
                    </Typography>
                    <Chip size="small" label={(validarItens() || []).length} sx={{ borderRadius: 999, fontWeight: 950, bgcolor: "rgba(2,6,23,0.06)" }} />
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                    <Typography fontWeight={950} sx={{ color: "#0f172a" }}>
                      {formatBRL(totalBalcao)}
                    </Typography>
                  </Stack>

                  <Divider />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setBalcaoTab(0);
                        notify("Selecione um produto no catálogo.", "info");
                      }}
                      sx={{ fontWeight: 950 }}
                    >
                      Adicionar item
                    </Button>

                    <Button fullWidth variant="outlined" startIcon={<ReceiptLongIcon />} onClick={addItemManualBalcao} sx={{ fontWeight: 950 }}>
                      Item manual
                    </Button>
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<SaveIconShim />}
                      onClick={handleSalvarPedidoBalcao}
                      disabled={balcaoSaving}
                      sx={{ fontWeight: 950 }}
                    >
                      {balcaoSaving ? "Salvando..." : "Salvar"}
                    </Button>

                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={handleLimparComanda}
                      disabled={balcaoSaving}
                      sx={{ fontWeight: 950 }}
                    >
                      Limpar
                    </Button>
                  </Stack>

                  <Button
                    variant="contained"
                    startIcon={<PaymentsIcon />}
                    onClick={abrirPagamento}
                    disabled={balcaoSaving || (validarItens() || []).length === 0}
                    sx={{
                      fontWeight: 950,
                      borderRadius: 2.5,
                      background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)",
                      "&:hover": { opacity: 0.92, background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)" },
                    }}
                  >
                    Pagamento (parcial/total)
                  </Button>

                  {!!balcaoPedidoServidor?._id && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Pedido balcão no servidor: <b>#{pedidoCode(balcaoPedidoServidor)}</b>
                    </Alert>
                  )}
                </Stack>
              </Paper>

              <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: 1.6, bgcolor: "rgba(255,255,255,0.85)" }}>
                <Typography fontWeight={950} sx={{ mb: 1 }}>
                  Dicas rápidas
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.55 }}>
                  • Se o cliente já existe, use <b>Buscar</b> pelo telefone para preencher endereço.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.55 }}>
                  • Você pode fazer <b>pagamento parcial</b> (ex.: entrada) e depois finalizar.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.55 }}>
                  • Ao quitar, o pedido é enviado para <b>produção</b>.
                </Typography>
              </Paper>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, display: "flex", justifyContent: "space-between" }}>
          <Button variant="outlined" onClick={closeModal} disabled={balcaoSaving}>
            Fechar
          </Button>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={imprimirBalcao} disabled={balcaoSaving || (validarItens() || []).length === 0} sx={{ fontWeight: 950 }}>
              Imprimir
            </Button>

            <Button
              variant="contained"
              startIcon={<PaymentsIcon />}
              onClick={abrirPagamento}
              disabled={balcaoSaving || (validarItens() || []).length === 0}
              sx={{
                fontWeight: 950,
                borderRadius: 2.5,
                background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)",
                "&:hover": { opacity: 0.92, background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)" },
              }}
            >
              Pagamento
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* modal rascunho */}
      <Dialog open={draftPromptOpen} onClose={() => aplicarDraftSeConfirmar(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 950 }}>Rascunho encontrado</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Existe um pedido balcão salvo. Deseja carregar esse rascunho?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => aplicarDraftSeConfirmar(false)} sx={{ fontWeight: 950 }}>
            Descartar
          </Button>
          <Button variant="contained" onClick={() => aplicarDraftSeConfirmar(true)} sx={{ fontWeight: 950 }}>
            Carregar
          </Button>
        </DialogActions>
      </Dialog>

      {/* modal config produto */}
      <ModalConfigProdutoBalcao
        open={balcaoOpenConfig}
        onClose={() => {
          setBalcaoOpenConfig(false);
          setBalcaoProdutoSelecionado(null);
        }}
        produto={balcaoProdutoSelecionado}
        restauranteLogo={restauranteLogo}
        onConfirm={(item) => {
          adicionarItemConfiguradoNoBalcao(item);
          setBalcaoOpenConfig(false);
          setBalcaoProdutoSelecionado(null);
          setBalcaoTab(1);
          scrollToTopComanda();
        }}
      />

      {/* modal pagamento */}
      <ModalPagamentoBalcao
        open={balcaoPayOpen}
        onClose={() => setBalcaoPayOpen(false)}
        pedido={balcaoPedidoServidor}
        onPedidoAtualizado={(p) => setBalcaoPedidoServidor(p)}
        onNotify={(msg) => notify(msg, "success")}
        onQuitadoEnviarProducao={async (pedidoAtual) => {
          await onPedidoQuitado?.(pedidoAtual);
          setBalcaoPayOpen(false);
          closeModal();
        }}
      />

      {/* snackbar local */}
      <Snackbar open={snackbar.open} autoHideDuration={3200} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
