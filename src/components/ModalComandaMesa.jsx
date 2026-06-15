
// ModalComandaMesa.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Stack,
  Typography,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Chip,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActionArea,
  Skeleton,
  Box,
  Alert,
  Snackbar,
  RadioGroup,
  Radio,
  Checkbox,
  FormControlLabel,
  DialogActions,
  CircularProgress,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CancelIcon from "@mui/icons-material/Cancel";
import PaymentsIcon from "@mui/icons-material/Payments";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PrintIcon from "@mui/icons-material/Print";

import axios from "axios";
import { io } from "socket.io-client";

const PRINT_SERVICE_URL = "http://localhost:9100";

// ✅ socket do backend (mesas/pedidos) — igual seu Home (Electron)
import { createSocket } from "../services/sockets";
import { enviarParaImpressao } from "../utils/enviarImpressao";

/* =========================
AUTH HELPERS (token)
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

/* =========================
PRINT HELPERS (localStorage)
========================= */
const PRINT_SETTINGS_KEY = "printSettings";

const defaultPrintSettingsByBrand = (brand) => {
  const b = String(brand || "").toLowerCase();
  const isPos58 = b === "pos-58" || b === "pos58";
  return {
    printerName: "",
    brand: brand || "",
    layout: "entregaA",
    columns: isPos58 ? 32 : 48,
    feedLines: 3,
    cutMode: "full", // full | partial | none
    encoding: "win1252", // win1252 | cp860 | utf8
    copies: 1,
  };
};

function readPrintSettings() {
  const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  // legado
  const printerName = localStorage.getItem("impressoraSelecionada") || "";
  const brand = localStorage.getItem("modeloImpressora") || "";
  const layout = localStorage.getItem("layoutSelecionado") || "entregaA";

  if (printerName || brand) {
    const d = defaultPrintSettingsByBrand(brand);
    const ps = {
      printerName,
      brand,
      layout,
      columns: d.columns,
      feedLines: d.feedLines,
      cutMode: d.cutMode,
      encoding: d.encoding,
      copies: d.copies,
    };
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(ps));
    return ps;
  }

  return null;
}

function writePrintSettings(ps) {
  localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(ps || {}));
  // espelho legado (se algum lugar ainda lê)
  localStorage.setItem("impressoraSelecionada", ps?.printerName || "");
  localStorage.setItem("modeloImpressora", ps?.brand || "");
  localStorage.setItem("layoutSelecionado", ps?.layout || "entregaA");
}

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/* =========================
HELPERS
========================= */
function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}

function normalizeStr(s) {
  return safeText(s).trim().toLowerCase();
}

function formatBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

/** ✅ máscara BRL para input (sem "R$" — já tem adornment) */
function maskBRLInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits) / 100;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ✅ máscara telefone BR (aceita digitação com/sem 55; exibe (DD) 9XXXX-XXXX / (DD) XXXX-XXXX) */
function maskPhoneBRInput(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length > 11) d = d.slice(2); // tira DDI pra exibir

  // limita (sem DDI): 11
  d = d.slice(0, 11);

  // (DD) ...
  const dd = d.slice(0, 2);
  const rest = d.slice(2);

  if (!dd) return "";
  if (d.length <= 2) return `(${dd}`;

  // 11 dígitos -> 9XXXX-XXXX
  if (d.length >= 11) {
    const p1 = rest.slice(0, 5);
    const p2 = rest.slice(5, 9);
    return `(${dd}) ${p1}${p2 ? `-${p2}` : ""}`.trim();
  }

  // 10 dígitos -> XXXX-XXXX
  if (d.length === 10) {
    const p1 = rest.slice(0, 4);
    const p2 = rest.slice(4, 8);
    return `(${dd}) ${p1}${p2 ? `-${p2}` : ""}`.trim();
  }

  // parcial
  if (rest.length <= 4) return `(${dd}) ${rest}`.trim();
  return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`.trim();
}

/* ✅ helpers de preço para resumo */
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

/* ✅ resumo completo do item na comanda (inclui tiposExtrasSelecionados + preços) */
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

  if (safeText(item?.observacao)) {
    linhas.push(`Obs: ${safeText(item.observacao)}`);
  }

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

/* Produto */
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
  // Compat MySQL/Mongo: no MySQL o campo físico é `preco`, enquanto o legado usa `precoBase`.
  const candidates = [p?.precoBase, p?.preco, p?.valor, p?.price];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const n0 = Number(p?.precoBase ?? p?.preco ?? 0);
  return Number.isFinite(n0) ? n0 : 0;
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

/* Item */
function getItemNome(i) {
  return safeText(i?.nome) || "Item";
}
function getItemImagem(i) {
  return safeText(i?.imagem);
}

/* =========================
✅ IMAGENS: blur placeholder + watermark + fallback logo circular
========================= */
const DEFAULT_RESTAURANTE_LOGO = "https://cdn-icons-png.flaticon.com/512/3075/3075977.png";

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
            width: Math.max(18, Math.round(size * 0.30)),
            height: Math.max(18, Math.round(size * 0.30)),
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
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "999px",
            }}
          />
        </Box>
      )}

      {isFallback && !(restauranteLogo || DEFAULT_RESTAURANTE_LOGO) && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(2,6,23,0.45)",
          }}
        >
          <ImageNotSupportedIcon fontSize="small" />
        </Box>
      )}
    </Box>
  );
}

/* =========================
✅ NORMALIZADOR (robusto pro catálogo)
========================= */
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

  const saboresDireto = arrOrEmpty(p.saboresDisponiveis).length
    ? arrOrEmpty(p.saboresDisponiveis)
    : arrOrEmpty(p.sabores);

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

  const bordasDisponiveis = arrOrEmpty(p.bordasDisponiveis).length
    ? arrOrEmpty(p.bordasDisponiveis)
    : arrOrEmpty(p.bordas);

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

/* =========================
MODAL CONFIG (comanda)
========================= */
function ModalConfigProdutoComanda({ open, onClose, produto, onConfirm, restauranteLogo }) {
  const [saboresSelecionados, setSaboresSelecionados] = useState([]);
  const [bordaSelecionada, setBordaSelecionada] = useState("nenhum");
  const [complementosSelecionados, setComplementosSelecionados] = useState([]);
  const [adicionalSelecionado, setAdicionalSelecionado] = useState("nenhum");
  const [tiposExtrasSelecionados, setTiposExtrasSelecionados] = useState({});
  const [observacao, setObservacao] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [validationError, setValidationError] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);

  const isPizza =
    produto?.categoriaType === "pizza" ||
    (produto?.saboresDisponiveis?.length > 0 && Number(produto?.maxSabores || 0) > 0);

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
        for (const item of itens) {
          const preco = typeof item?.preco === "number" ? item.preco : parseFloat(item?.preco || 0);
          total += preco;
        }
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
    if (isPizza) {
      const requiredCount = produto.maxSabores || 2;

      if (produto.saboresDisponiveis?.length > 1) {
        if (saboresSelecionados.length !== requiredCount) {
          return `Selecione exatamente ${requiredCount} sabor(es).`;
        }
      } else if (produto.saboresDisponiveis?.length === 1 && saboresSelecionados.length !== 1) {
        return "Selecione o sabor da pizza.";
      }
    }

    const tipos = produto.tiposExtras || [];
    for (const tipo of tipos) {
      const selecionados = tiposExtrasSelecionados[tipo.nome] || [];
      if (tipo.obrigatorio && selecionados.length === 0) {
        return `Selecione pelo menos uma opção em "${tipo.nome}".`;
      }
      if (tipo.minimoSelecionados && selecionados.length < tipo.minimoSelecionados) {
        return `Selecione pelo menos ${tipo.minimoSelecionados} opção(ões) em "${tipo.nome}".`;
      }
      if (tipo.maximoSelecionados && selecionados.length > tipo.maximoSelecionados) {
        return `Você pode escolher no máximo ${tipo.maximoSelecionados} opção(ões) em "${tipo.nome}".`;
      }
    }

    return "";
  };

  const handleConfirm = () => {
    const errorMessage = validate();
    if (errorMessage) {
      setValidationError(errorMessage);
      return;
    }

    const valorBase = Number(produto.precoBase || 0);

    const item = {
      nome: produto.nome,
      produtoId: produto._id,
      imagem: produto.imagem,
      categoriaType: produto.categoriaType,

      saboresSelecionados,
      bordaSelecionada:
        bordaSelecionada === "nenhum"
          ? null
          : produto.bordasDisponiveis?.find((b) => b.nome === bordaSelecionada),

      adicionalSelecionado:
        adicionalSelecionado === "nenhum"
          ? null
          : produto.adicionais?.find((a) => a.nome === adicionalSelecionado),

      complementosSelecionados:
        produto.complementos?.filter((c) => complementosSelecionados.includes(c.nome)) || [],

      tiposExtrasSelecionados,
      
      observacao,
      quantidade,
      precoUnitario: valorBase,
      precoTotal: precoTotal,
    };

    onConfirm?.(item);

    setShowSnackbar(true);
    onClose?.();
  };

  const maxSabores = produto.maxSabores || 2;
  const isPizzaMultiSabor = isPizza && produto.saboresDisponiveis?.length > 1 && maxSabores > 1;

  const mostrarPrecoBasePizza = isPizza && produto.saboresDisponiveis?.length > 1;

  const precoPizzaAPartir = mostrarPrecoBasePizza
    ? (() => {
        const min = produto.saboresDisponiveis.reduce(
          (menor, s) => Math.min(menor, parseFloat(s.preco || Number.POSITIVE_INFINITY)),
          Number.POSITIVE_INFINITY
        );
        // eslint-disable-next-line no-restricted-globals
        if (!isFinite(min)) return produto.precoBase || 0;
        return min;
      })()
    : produto.precoBase || 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: { xs: "18px 18px 0 0", sm: 3 },
            position: { xs: "fixed", sm: "relative" },
            bottom: { xs: 0, sm: "auto" },
            m: { xs: 0, sm: 2 },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={900}
            sx={{
              pr: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {produto.nome}
          </Typography>
          <IconButton edge="end" onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ borderRadius: 2, overflow: "hidden", width: "100%", height: 190 }}>
              <SmartThumb
                src={produto.imagem}
                alt={produto.nome}
                size={190}
                rounded={16}
                restauranteLogo={restauranteLogo}
                watermark
                preferCircularOnFallback
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            {produto.descricao ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 0.75,
                  whiteSpace: "normal",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {produto.descricao}
              </Typography>
            ) : null}

            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography variant="h6" fontWeight={900} color="primary">
                {mostrarPrecoBasePizza ? "a partir de " : ""}
                R$ {Number(precoPizzaAPartir || 0).toFixed(2)}
              </Typography>
            </Stack>
          </Box>

          {validationError && (
            <Alert severity="warning" onClose={() => setValidationError("")} sx={{ mb: 2 }}>
              {validationError}
            </Alert>
          )}

          {/* SABORES */}
          {isPizza && produto.saboresDisponiveis?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={900} gutterBottom>
                Sabores {isPizzaMultiSabor ? `(escolha exatamente ${maxSabores})` : ""}
              </Typography>

              {produto.saboresDisponiveis.length === 1 || maxSabores === 1 ? (
                <RadioGroup
                  value={saboresSelecionados[0] || ""}
                  onChange={(e) => setSaboresSelecionados(e.target.value ? [e.target.value] : [])}
                >
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
                    const desabilitado =
                      !checked && saboresSelecionados.length >= maxSabores && maxSabores > 0;

                    return (
                      <FormControlLabel
                        key={i}
                        control={
                          <Checkbox
                            checked={checked}
                            disabled={desabilitado}
                            onChange={() => {
                              if (checked) {
                                setSaboresSelecionados((prev) => prev.filter((n) => n !== s.nome));
                              } else if (saboresSelecionados.length < maxSabores) {
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

          {/* BORDA */}
          {produto.bordasDisponiveis?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography fontWeight={900} gutterBottom>
                Borda
              </Typography>
              <RadioGroup value={bordaSelecionada} onChange={(e) => setBordaSelecionada(e.target.value)}>
                <FormControlLabel value="nenhum" control={<Radio />} label="Sem borda" />
                {produto.bordasDisponiveis.map((b, i) => (
                  <FormControlLabel
                    key={i}
                    value={b.nome}
                    control={<Radio />}
                    label={`${b.nome} (+R$ ${parseFloat(b.preco || 0).toFixed(2)})`}
                  />
                ))}
              </RadioGroup>
            </Box>
          )}

          {/* ADICIONAIS */}
          {produto.adicionais?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography fontWeight={900} gutterBottom>
                Adicional
              </Typography>
              <RadioGroup value={adicionalSelecionado} onChange={(e) => setAdicionalSelecionado(e.target.value)}>
                <FormControlLabel value="nenhum" control={<Radio />} label="Sem adicional" />
                {produto.adicionais.map((a, i) => (
                  <FormControlLabel
                    key={i}
                    value={a.nome}
                    control={<Radio />}
                    label={`${a.nome} (+R$ ${parseFloat(a.preco || 0).toFixed(2)})`}
                  />
                ))}
              </RadioGroup>
            </Box>
          )}

          {/* TIPOS EXTRAS */}
          {produto.tiposExtras?.map((tipo, idx) => {
            if (!Array.isArray(tipo.itens) || tipo.itens.length === 0) return null;

            const selecionados = tiposExtrasSelecionados[tipo.nome] || [];

            return (
              <Box key={idx} sx={{ mt: 3 }}>
                <Typography fontWeight={900} gutterBottom>
                  {tipo.nome} {tipo.obrigatorio && "*"}
                  {tipo.tipoSelecion === "multiplo" && tipo.maximoSelecionados
                    ? ` (até ${tipo.maximoSelecionados})`
                    : ""}
                </Typography>

                {tipo.tipoSelecion === "unico" ? (
                  <RadioGroup
                    value={selecionados[0]?.nome || ""}
                    onChange={(e) => {
                      const item = tipo.itens.find((i) => i.nome === e.target.value);
                      setTiposExtrasSelecionados((prev) => ({
                        ...prev,
                        [tipo.nome]: item ? [item] : [],
                      }));
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
                      const isChecked = selecionados.some((s) => s.nome === item.nome);
                      const disabled =
                        !isChecked &&
                        tipo.maximoSelecionados !== undefined &&
                        selecionados.length >= tipo.maximoSelecionados;

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
                                  : [...selecionados, item];

                                setTiposExtrasSelecionados((prev) => ({
                                  ...prev,
                                  [tipo.nome]: novos,
                                }));
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

          {/* COMPLEMENTOS */}
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
                          onChange={() => {
                            setComplementosSelecionados((prev) =>
                              checked ? prev.filter((n) => n !== c.nome) : [...prev, c.nome]
                            );
                          }}
                        />
                      }
                      label={`${c.nome} (+R$ ${parseFloat(c.preco || 0).toFixed(2)})`}
                    />
                  );
                })}
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Observações"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            sx={{ mt: 3 }}
          />

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
              R$ {precoTotal.toFixed(2)}
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
                "&:hover": {
                  opacity: 0.9,
                  background: "linear-gradient(90deg,#ff4b8b,#ff7a3d)",
                },
              }}
            >
              Adicionar na comanda
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={1500}
        onClose={() => setShowSnackbar(false)}
        message="Item adicionado!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}

/* =========================
MODAL PAGAMENTO (Painel)
========================= */
function ModalPagamentoMesa({
  open,
  onClose,
  apiUrl,
  mesa,
  pedido,
  loadingGlobal,
  setErroGlobal,
  onMesaAtualizada,
  onPedidoAtualizado,
  recarregarComanda,
  onNotify,
  onMesaFechada,
}) {
  const mesaId = mesa?._id;

  const [modo, setModo] = useState("dinheiro"); // dinheiro | cartao | pix
  const [valor, setValor] = useState(""); // ✅ mascarado (pt-BR)
  const [obs, setObs] = useState("");
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

  const [telefoneWhats, setTelefoneWhats] = useState(""); // ✅ mascarado
  const [sendingWhats, setSendingWhats] = useState(false);
  const [whatsStatus, setWhatsStatus] = useState("idle"); // idle | sent | failed
  const [whatsLastError, setWhatsLastError] = useState("");

  const total = useMemo(() => round2(Number(pedido?.valorTotal ?? pedido?.total ?? 0)), [pedido]);
  const pago = useMemo(() => round2(Number(pedido?.valorPago || 0)), [pedido]);
  const pendente = useMemo(() => { const vt = Number(pedido?.valorTotal ?? pedido?.total ?? 0); const vp = Number(pedido?.valorPago ?? 0); const pend = pedido?.valorPendente; return round2(pend === undefined || pend === null ? Math.max(0, vt - vp) : Number(pend || 0)); }, [pedido]);

  const podePagar = !!(pedido?._id || mesa?.pedidoAtualId);

  const MIN_PIX_CARTAO = 1.0;
  const valorNumerico = useMemo(() => round2(toNumberBR(valor, 0)), [valor]);
  const troco = useMemo(() => modo === "dinheiro" ? round2(Math.max(0, valorNumerico - pendente)) : 0, [modo, valorNumerico, pendente]);

  useEffect(() => {
    if (!open) return;
    setModo("dinheiro");
    setValor("");
    setObs("");
    setPixInfo({ paymentId: "", status: "", qrCode: "", qrCodeBase64: "", valor: 0 });
    setPolling(false);
    setTelefoneWhats("");
    setSendingWhats(false);
    setWhatsStatus("idle");
    setWhatsLastError("");
    setErroLocal(null);
    setErroGlobal?.(null);
  }, [open, setErroGlobal]);

  useEffect(() => {
    if (!open) return;
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

  useEffect(() => {
    // mexeu no telefone => reseta status
    if (!open) return;
    setWhatsStatus("idle");
    setWhatsLastError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefoneWhats]);

  const normalizePhoneBR = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const enviarPixNoWhatsApp = async () => {
    if (!mesaId) return;

    const pid = String(pixInfo?.paymentId || "").trim();
    if (!pid) {
      setErroLocal("Gere o PIX primeiro (paymentId não encontrado).");
      setWhatsStatus("failed");
      setWhatsLastError("paymentId não encontrado");
      return;
    }

    const phone = normalizePhoneBR(telefoneWhats);
    if (!phone || phone.length < 12) {
      setErroLocal("Informe um número de WhatsApp válido (com DDD).");
      setWhatsStatus("failed");
      setWhatsLastError("telefone inválido");
      return;
    }

    setSendingWhats(true);
    setErroLocal(null);
    setWhatsStatus("idle");
    setWhatsLastError("");

    try {
      const res = await axios.post(
        `${apiUrl}/api/mesas/${mesaId}/pix/enviar-whatsapp`,
        { numero: phone, paymentId: pid },
        { headers: authHeaders() }
      );

      setWhatsStatus("sent");
      onNotify?.(res.data?.message || "✅ PIX enviado no WhatsApp pelo bot.");
    } catch (e) {
      const msg = e?.response?.data?.message || "Erro ao enviar PIX no WhatsApp.";
      setErroLocal(msg);
      setWhatsStatus("failed");
      setWhatsLastError(msg);
      onNotify?.(`❌ Falhou ao enviar PIX no WhatsApp: ${msg}`);
    } finally {
      setSendingWhats(false);
    }
  };

  const postPagamento = async () => {
    if (!mesaId) return;
    if (!podePagar) return;

    const v = round2(toNumberBR(valor, NaN));
    if (!Number.isFinite(v) || v <= 0) {
      setErroLocal("Informe um valor válido.");
      return;
    }

    const metodo = modo === "cartao" ? "cartao" : "dinheiro";
    const valorParaRegistrar = metodo === "dinheiro" && v > pendente ? pendente : v;
    const obsFinal = [String(obs || "").trim(), metodo === "dinheiro" && v > pendente ? `Pago em dinheiro: ${formatBRL(v)} • Troco: ${formatBRL(round2(v - pendente))}` : ""].filter(Boolean).join(" | " );

    if (metodo === "cartao" && v < MIN_PIX_CARTAO) {
      setErroLocal("Para cartão, o valor mínimo é R$ 1,00.");
      return;
    }

    setBusy(true);
    setErroLocal(null);

    try {
      const res = await axios.post(
        `${apiUrl}/api/mesas/${mesaId}/pagamento`,
        { metodo, valor: valorParaRegistrar, obs: obsFinal },
        { headers: authHeaders() }
      );

      if (res.data?.mesa) onMesaAtualizada?.(res.data.mesa);
      if (res.data?.pedido) onPedidoAtualizado?.(res.data.pedido);
      else await recarregarComanda?.();

      setValor("");
      setObs("");

      if (res.data?.fechado) {
        onNotify?.("✅ Pagamento concluído. Mesa encerrada!");
        onMesaFechada?.();
        return;
      }

      onNotify?.("✅ Pagamento registrado!");
    } catch (e) {
      setErroLocal(e?.response?.data?.message || "Erro ao registrar pagamento.");
    } finally {
      setBusy(false);
    }
  };

  const gerarPix = async () => {
    if (!mesaId) return;
    if (!podePagar) return;

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
    setWhatsStatus("idle");
    setWhatsLastError("");

    try {
      const res = await axios.post(
        `${apiUrl}/api/mesas/${mesaId}/pix`,
        { valor: v },
        { headers: authHeaders() }
      );

      setPixInfo({
        paymentId: String(res.data?.paymentId || ""),
        status: String(res.data?.statusPagamento || res.data?.status || "pending"),
        qrCode: String(res.data?.qrCode || ""),
        qrCodeBase64: String(res.data?.qrCodeBase64 || ""),
        valor: round2(Number(res.data?.valor || v)),
      });

      if (res.data?.pedido) onPedidoAtualizado?.(res.data.pedido);
      else await recarregarComanda?.();

      onNotify?.("📲 PIX gerado. Aguardando confirmação…");
    } catch (e) {
      setErroLocal(e?.response?.data?.message || "Erro ao gerar PIX.");
    } finally {
      setBusy(false);
    }
  };

  const consultarPix = async () => {
    if (!mesaId) return;
    const pid = String(pixInfo?.paymentId || "").trim();
    if (!pid) {
      setErroLocal("paymentId do PIX não encontrado.");
      return;
    }

    setPolling(true);
    setErroLocal(null);

    try {
      const res = await axios.get(`${apiUrl}/api/mesas/${mesaId}/pix/${pid}/status`, {
        headers: authHeaders(),
      });

      const st = String(res.data?.status || res.data?.statusPagamento || "").toLowerCase();
      setPixInfo((p) => ({
        ...p,
        status: st || p.status,
        qrCode: String(res.data?.qrCode || p.qrCode || ""),
        qrCodeBase64: String(res.data?.qrCodeBase64 || p.qrCodeBase64 || ""),
      }));

      if (res.data?.mesa) onMesaAtualizada?.(res.data.mesa);
      if (res.data?.pedido) onPedidoAtualizado?.(res.data.pedido);
      else await recarregarComanda?.();

      if (res.data?.fechado || res.data?.paid === true) {
        onNotify?.("✅ PIX confirmado!");
        if (res.data?.fechado) {
          onMesaFechada?.();
          return;
        }
      } else {
        onNotify?.("⏳ PIX ainda pendente…");
      }
    } catch (e) {
      setErroLocal(e?.response?.data?.message || "Erro ao consultar PIX.");
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

  const fecharMesa = async () => {
    if (!mesaId) return;
    if (!podePagar) return;

    setBusy(true);
    setErroLocal(null);

    try {
      const res = await axios.post(`${apiUrl}/api/mesas/${mesaId}/fechar`, {}, { headers: authHeaders() });

      if (res.data?.mesa) onMesaAtualizada?.(res.data.mesa);
      if (res.data?.pedido) onPedidoAtualizado?.(res.data.pedido);

      onNotify?.("✅ Mesa encerrada com sucesso!");
      onMesaFechada?.();
    } catch (e) {
      setErroLocal(e?.response?.data?.message || "Erro ao encerrar mesa.");
    } finally {
      setBusy(false);
    }
  };

  const valorPlaceholder = modo === "pix" ? "Valor do PIX" : "Valor pago";

  const sendBtnLabel =
    sendingWhats ? "Enviando..." : whatsStatus === "sent" ? "Enviado" : whatsStatus === "failed" ? "Falhou" : "Enviar";

  const sendBtnColor = whatsStatus === "sent" ? "success" : whatsStatus === "failed" ? "error" : "primary";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 950, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack>
          <Typography fontWeight={950}>Pagamento — Mesa {mesa?.numero || "-"}</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: {formatBRL(total)} • Pago: {formatBRL(pago)} • Pendente: {formatBRL(pendente)}
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

        {whatsStatus === "failed" && !!whatsLastError && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWhatsLastError("")}>
            ⚠️ WhatsApp: falhou ao enviar — {whatsLastError}
          </Alert>
        )}

        {!podePagar && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Esta mesa ainda não tem comanda aberta. Adicione um item primeiro.
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Chip
            clickable
            color={modo === "dinheiro" ? "primary" : "default"}
            variant={modo === "dinheiro" ? "filled" : "outlined"}
            label="Dinheiro"
            onClick={() => setModo("dinheiro")}
            sx={{ fontWeight: 900 }}
          />
          <Chip
            clickable
            color={modo === "cartao" ? "primary" : "default"}
            variant={modo === "cartao" ? "filled" : "outlined"}
            label="Cartão"
            onClick={() => setModo("cartao")}
            sx={{ fontWeight: 900 }}
          />
          <Chip
            clickable
            color={modo === "pix" ? "primary" : "default"}
            variant={modo === "pix" ? "filled" : "outlined"}
            label="PIX"
            onClick={() => setModo("pix")}
            icon={<QrCode2Icon />}
            sx={{ fontWeight: 900 }}
          />
        </Box>

        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label={valorPlaceholder}
            value={valor}
            onChange={(e) => setValor(maskBRLInput(e.target.value))}
            disabled={!podePagar || busy || loadingGlobal}
            inputProps={{ inputMode: "decimal" }}
            InputProps={{
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            }}
            helperText={
              modo === "pix" || modo === "cartao"
                ? "⚠️ Valor mínimo para PIX/Cartão: R$ 1,00"
                : "Dinheiro pode ser qualquer valor acima de R$ 0,00"
            }
          />

          {modo === "dinheiro" && troco > 0 && (
            <Alert severity="info" sx={{ fontWeight: 800 }}>
              Troco a devolver: <b>{formatBRL(troco)}</b>
            </Alert>
          )}

          <TextField
            fullWidth
            label="Observação (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            disabled={!podePagar || busy || loadingGlobal}
          />

          {modo !== "pix" && (
            <Button
              onClick={postPagamento}
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} /> : <PaymentsIcon />}
              disabled={!podePagar || busy || loadingGlobal}
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
                  Ao gerar, o pagamento fica <b>pendente</b> até a confirmação do Mercado Pago.
                </Typography>

                <Button
                  onClick={gerarPix}
                  variant="contained"
                  startIcon={busy ? <CircularProgress size={18} /> : <QrCode2Icon />}
                  disabled={!podePagar || busy || loadingGlobal}
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
                        disabled={!podePagar || polling || busy || loadingGlobal}
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

                    <Divider />

                    <Typography fontWeight={950} sx={{ mt: 0.5 }}>
                      Enviar PIX no WhatsApp (via BOT)
                    </Typography>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="WhatsApp (DDD + número)"
                        value={telefoneWhats}
                        onChange={(e) => setTelefoneWhats(maskPhoneBRInput(e.target.value))}
                        fullWidth
                        disabled={sendingWhats || busy || loadingGlobal}
                        inputProps={{ inputMode: "tel" }}
                        helperText="Ex.: (11) 91234-5678"
                      />

                      <Button
                        onClick={enviarPixNoWhatsApp}
                        variant="contained"
                        color={sendBtnColor}
                        disabled={!pixInfo.qrCode || sendingWhats || busy || loadingGlobal}
                        startIcon={sendingWhats ? <CircularProgress size={18} /> : <WhatsAppIcon />}
                        sx={{ fontWeight: 950, whiteSpace: "nowrap" }}
                      >
                        {sendBtnLabel}
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>
          )}

          <Divider />

          <Button
            onClick={fecharMesa}
            variant="contained"
            color="success"
            disabled={!podePagar || busy || loadingGlobal || pendente > 0}
            sx={{ fontWeight: 950 }}
          >
            Encerrar mesa (pendente deve ser 0)
          </Button>

          {pendente > 0 && (
            <Alert severity="warning">
              Ainda falta pagar <b>{formatBRL(pendente)}</b> para encerrar a mesa.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy || loadingGlobal} variant="outlined">
          Voltar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* =========================
MODAL COMANDA MESA
========================= */
export default function ModalComandaMesa({
  open,
  onClose,
  mesa,
  apiUrl,
  onMesaAtualizada,
  restauranteId,
  restauranteLogoUrl,
}) {
  const [loading, setLoading] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState(null);

  const [abaCatalogo, setAbaCatalogo] = useState(0);

  const [prodLoading, setProdLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  const [buscaComanda, setBuscaComanda] = useState("");

  const [nomeItem, setNomeItem] = useState("");
  const [qtd, setQtd] = useState(1);
  const [precoUnit, setPrecoUnit] = useState("");

  const [openConfig, setOpenConfig] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  // ✅ modal cancelar
  const [cancelDlg, setCancelDlg] = useState({
    open: false,
    type: null, // "item" | "pedido"
    itemIndex: null,
    motivo: "",
  });

  // ✅ modal pagamento
  const [payOpen, setPayOpen] = useState(false);
  const payOpenRef = useRef(false);
  useEffect(() => {
    payOpenRef.current = payOpen;
  }, [payOpen]);

  const mesaId = mesa?._id;

  // ✅ logo do restaurante
  const restauranteLogo =
    String(restauranteLogoUrl || "").trim() ||
    mesa?.restaurante?.logoUrl ||
    mesa?.restaurante?.logo ||
    mesa?.restauranteLogo ||
    mesa?.logoRestaurante ||
    DEFAULT_RESTAURANTE_LOGO;

  const mesaIdRef = useRef(mesaId);
  const openRef = useRef(open);
  useEffect(() => {
    mesaIdRef.current = mesaId;
  }, [mesaId]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const itensCountRef = useRef(0);
  const totalPedidoRef = useRef(0);
  useEffect(() => {
    itensCountRef.current = pedido?.itens?.length || 0;
    totalPedidoRef.current = Number(pedido?.valorTotal ?? pedido?.total ?? 0);
  }, [pedido]);

  const lastLocalAddTsRef = useRef(0);

  const fetchedComandaRef = useRef(false);
  const fetchedProdutosRef = useRef(false);

  const total = useMemo(() => Number(pedido?.valorTotal ?? pedido?.total ?? 0), [pedido]);
  const pago = useMemo(() => Number(pedido?.valorPago || 0), [pedido]);
  const pendente = useMemo(() => { const vt = Number(pedido?.valorTotal ?? pedido?.total ?? 0); const vp = Number(pedido?.valorPago ?? 0); const pend = pedido?.valorPendente; return Number(pend === undefined || pend === null ? Math.max(0, vt - vp) : pend || 0); }, [pedido]);

  const statusChipColor = useMemo(() => {
    if (mesa?.status === "ocupada") return "warning";
    if (mesa?.status === "aguardando_pagamento") return "info";
    return "success";
  }, [mesa?.status]);

  /* =========================
  ✅ IMPRESSÃO (serviço local 9100)
  ========================= */
  const printerSocket = useMemo(
    () =>
      io(PRINT_SERVICE_URL, {
        transports: ["websocket"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        timeout: 3000,
      }),
    []
  );

  const [printServiceOnline, setPrintServiceOnline] = useState(false);
  const [printServiceMsg, setPrintServiceMsg] = useState("");
  const [printers, setPrinters] = useState([]);

  const [printerName, setPrinterName] = useState("");
  const [printerBrand, setPrinterBrand] = useState("");
  const [printLayout, setPrintLayout] = useState("entregaA");
  const [printColumns, setPrintColumns] = useState(48);
  const [printFeedLines, setPrintFeedLines] = useState(3);
  const [printCutMode, setPrintCutMode] = useState("full");
  const [printEncoding, setPrintEncoding] = useState("win1252");

  const [printing, setPrinting] = useState(false);

  const loadPrintSettingsIntoState = () => {
    const ps = readPrintSettings();
    if (!ps) return;

    setPrinterName(ps?.printerName || "");
    setPrinterBrand(ps?.brand || "");
    setPrintLayout(ps?.layout || "entregaA");
    setPrintColumns(clampInt(ps?.columns, 20, 64, 48));
    setPrintFeedLines(clampInt(ps?.feedLines, 0, 10, 3));
    setPrintCutMode(ps?.cutMode || "full");
    setPrintEncoding(ps?.encoding || "win1252");
  };

  const persistPrintSettingsFromState = (override = {}) => {
    const ps = {
      printerName,
      brand: printerBrand,
      layout: printLayout,
      columns: clampInt(printColumns, 20, 64, 48),
      feedLines: clampInt(printFeedLines, 0, 10, 3),
      cutMode: printCutMode,
      encoding: printEncoding,
      copies: clampInt(readPrintSettings()?.copies, 1, 10, 1),
      ...override,
    };
    writePrintSettings(ps);
  };

  useEffect(() => {
    if (!open) return;

    // carrega settings do localStorage ao abrir o modal
    loadPrintSettingsIntoState();

    // conecta no serviço de impressão
    try {
      if (!printerSocket.connected) printerSocket.connect();
    } catch {
      // ignore
    }
  }, [open, printerSocket]);

  useEffect(() => {
    const onConnect = () => {
      setPrintServiceOnline(true);
      setPrintServiceMsg("Serviço conectado (localhost:9100).");
      printerSocket.emit("listar-impressoras");
    };

    const onDisconnect = () => {
      setPrintServiceOnline(false);
      setPrintServiceMsg("Serviço offline. Verifique se o MovyoPrinterService está rodando.");
    };

    const onConnectError = () => {
      setPrintServiceOnline(false);
      setPrintServiceMsg("Não consegui conectar no serviço (localhost:9100).");
    };

    const onLista = (lista) => {
      if (!Array.isArray(lista)) return;
      setPrinters(lista);

      // ✅ se não tiver impressora salva, tenta setar a primeira encontrada (sem UI)
      const nomes = lista.map((x) => x?.name || x).filter(Boolean);
      const current = printerName || readPrintSettings()?.printerName || "";
      if (current && nomes.includes(current)) {
        if (!printerName) setPrinterName(current);
        return;
      }
      if (!printerName && nomes[0]) {
        setPrinterName(nomes[0]);
        persistPrintSettingsFromState({ printerName: nomes[0] });
      }
    };

    const onPrintOk = (p) => {
      setPrinting(false);
      setNotifyMsg(`🖨️ Impresso ✅ (${p?.printer || printerName || "—"})`);
      setNotifyOpen(true);
    };

    const onPrintErr = (p) => {
      setPrinting(false);
      setErro(p?.message || "Erro ao imprimir.");
      setNotifyMsg(`❌ Impressão falhou: ${p?.message || "erro"}`);
      setNotifyOpen(true);
    };

    printerSocket.on("connect", onConnect);
    printerSocket.on("disconnect", onDisconnect);
    printerSocket.on("connect_error", onConnectError);

    printerSocket.on("lista-impressoras", onLista);
    printerSocket.on("impressao-sucesso", onPrintOk);
    printerSocket.on("impressao-erro", onPrintErr);

    return () => {
      printerSocket.off("connect", onConnect);
      printerSocket.off("disconnect", onDisconnect);
      printerSocket.off("connect_error", onConnectError);

      printerSocket.off("lista-impressoras", onLista);
      printerSocket.off("impressao-sucesso", onPrintOk);
      printerSocket.off("impressao-erro", onPrintErr);

      try {
        printerSocket.disconnect();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printerSocket, printerName]);

  const imprimirComanda = async () => {
    setErro(null);

    if (!pedido || (pedido?.itens?.length || 0) === 0) {
      setErro("Não há itens na comanda para imprimir.");
      setNotifyMsg("❌ Não há itens na comanda para imprimir.");
      setNotifyOpen(true);
      return;
    }
    // Não bloqueia pelo estado local do socket deste modal: o utilitário abaixo conecta no serviço 9100
    // no momento da impressão, igual ao teste da tela de Configurações.

    // ✅ tudo vem do localStorage (Configurações > Impressão)
    const ps = readPrintSettings();
    const pName = ps?.printerName || printerName;
    const pBrand = ps?.brand || printerBrand;
    const pLayout = ps?.layout || printLayout;

    if (!pName) {
      setErro("Nenhuma impressora definida em Configurações > Impressão.");
      setNotifyMsg("❌ Defina a impressora em Configurações > Impressão.");
      setNotifyOpen(true);
      return;
    }
    if (!pBrand) {
      setErro("Marca/modelo não definido em Configurações > Impressão.");
      setNotifyMsg("❌ Defina marca/modelo em Configurações > Impressão.");
      setNotifyOpen(true);
      return;
    }
    if (!pLayout) {
      setErro("Layout de impressão não definido em Configurações > Impressão.");
      setNotifyMsg("❌ Defina o layout em Configurações > Impressão.");
      setNotifyOpen(true);
      return;
    }

    // salva (se pegou fallback do estado)
    persistPrintSettingsFromState({ printerName: pName, brand: pBrand, layout: pLayout });

    const itens = (Array.isArray(pedido?.itens) ? pedido.itens : []).map((i) => {
      const resumoLinhas = getResumoItemLinhas(i);
      return {
        nome: getItemNome(i),
        qtd: Number(i?.quantidade || 1),
        unit: Number(i?.precoUnitario || 0),
        total: Number(i?.precoTotal || 0),
        resumo: resumoLinhas.join(" | "),
        obs: safeText(i?.observacao),
      };
    });

    const dadosComanda = {
      tipo: "comanda_mesa",
      mesaNumero: safeText(mesa?.numero || ""),
      mesaId: safeText(mesa?._id || ""),
      pedidoId: safeText(pedido?._id || mesa?.pedidoAtualId || ""),
      data: new Date().toLocaleString("pt-BR"),
      itens,
      total: round2(Number(pedido?.valorTotal ?? pedido?.total ?? 0)),
      pago: round2(Number(pedido?.valorPago || 0)),
      pendente: round2(Number(pedido?.valorPendente ?? Math.max(0, Number(pedido?.valorTotal ?? pedido?.total ?? 0) - Number(pedido?.valorPago ?? 0)))),
    };

    const printSettings = {
      columns: clampInt(ps?.columns ?? printColumns, 20, 64, 48),
      feedLines: clampInt(ps?.feedLines ?? printFeedLines, 0, 10, 3),
      cutMode: ps?.cutMode || printCutMode,
      encoding: ps?.encoding || printEncoding,
      brand: pBrand,
      copies: clampInt(ps?.copies, 1, 10, 1),
    };

    setPrinting(true);

    try {
      // Usa o mesmo utilitário do restante do desktop, que é o fluxo que já funciona no teste/configurações.
      await enviarParaImpressao(
        {
          ...dadosComanda,
          _id: dadosComanda.pedidoId,
          numeroPedido: dadosComanda.pedidoId ? `MESA-${dadosComanda.mesaNumero || ""}` : "COMANDA",
          cliente: `Mesa ${dadosComanda.mesaNumero || ""}`.trim(),
          nomeCliente: `Mesa ${dadosComanda.mesaNumero || ""}`.trim(),
          itens: dadosComanda.itens.map((it) => ({
            nome: it.nome,
            quantidade: it.qtd,
            qtd: it.qtd,
            precoUnitario: it.unit,
            preco: it.unit,
            precoTotal: it.total,
            observacao: [it.resumo, it.obs].filter(Boolean).join(" | "),
          })),
          total: dadosComanda.total,
          valorTotal: dadosComanda.total,
          origem: "salao",
        },
        {
          restauranteId: safeText(localStorage.getItem("restauranteId") || ""),
          tipoImpressao: "comanda_mesa",
          layout: pLayout,
          printerName: pName,
          brand: pBrand,
        }
      );

      setNotifyMsg(`🖨️ Comanda enviada para impressão ✅ (${pName || "—"})`);
      setNotifyOpen(true);
      setPrinting(false);
    } catch (e) {
      setPrinting(false);
      setErro(e?.message || "Erro ao enviar impressão.");
      setNotifyMsg(`❌ Erro ao imprimir: ${e?.message || "erro"}`);
      setNotifyOpen(true);
    }
  };

  /* =========================
  REST
  ========================= */
  const carregarComanda = async () => {
    if (!mesaId) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await axios.get(`${apiUrl}/api/mesas/${mesaId}/comanda`, {
        headers: authHeaders(),
      });
      setPedido(res.data?.pedido || null);
      fetchedComandaRef.current = true;
    } catch (e) {
      setErro(e?.response?.data?.message || `Erro ao carregar comanda (HTTP ${e?.response?.status || "?"})`);
    } finally {
      setLoading(false);
    }
  };

  const carregarProdutos = async () => {
    if (!restauranteId) return;
    setProdLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/api/produtos/${restauranteId}`, {
        headers: authHeaders(),
      });

      const lista = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.produtos)
        ? res.data.produtos
        : [];

      const normalizados = lista
        .filter((p) => p?.ativo !== false)
        .map((p) => normalizeProdutoParaConfig(p));

      setProdutos(normalizados);
      fetchedProdutosRef.current = true;
    } catch (e) {
      console.warn("Erro produtos:", e?.response?.data || e.message);
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    fetchedComandaRef.current = false;
    fetchedProdutosRef.current = false;

    setErro(null);
    setPedido(null);

    setAbaCatalogo(0);
    setBuscaProduto("");
    setCategoriaAtiva("Todas");
    setBuscaComanda("");

    setNomeItem("");
    setQtd(1);
    setPrecoUnit("");

    setOpenConfig(false);
    setProdutoSelecionado(null);

    setNotifyOpen(false);
    setNotifyMsg("");

    setCancelDlg({ open: false, type: null, itemIndex: null, motivo: "" });

    setPayOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !mesaId) return;
    if (fetchedComandaRef.current) return;
    carregarComanda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mesaId]);

  useEffect(() => {
    if (!open || !restauranteId) return;
    if (fetchedProdutosRef.current) return;
    carregarProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, restauranteId]);

  const fecharPagamentoPorMudancaComanda = useCallback((mensagem = "Comanda atualizada. Reabra o pagamento para ver o novo valor.") => {
    if (!payOpenRef.current) return;
    setPayOpen(false);
    setNotifyMsg(`⚠️ ${mensagem}`);
    setNotifyOpen(true);
  }, []);

  useEffect(() => {
    if (!restauranteId) return;
    const s = createSocket();

    const onConnect = () => {
      s.emit("joinRestaurante", { restauranteId });
      if (mesaIdRef.current) s.emit("joinMesa", { mesaId: mesaIdRef.current });
    };

    const onMesaAtualizadaSocket = (mesaAtualizada) => {
      if (!mesaAtualizada) return;
      const id = mesaAtualizada?._id || mesaAtualizada?.mesaId || mesaAtualizada?.id || null;
      if (!id) return;
      if (String(id) !== String(mesaIdRef.current)) return;
      if (mesaAtualizada?._id) onMesaAtualizada?.(mesaAtualizada);

      if (String(mesaAtualizada?.status || "").toLowerCase() === "livre" && openRef.current) {
        setPayOpen(false);
        onClose?.();
      }
    };

    const onPedidoAtualizado = (pedidoAtualizado) => {
      if (!pedidoAtualizado) return;
      if (!openRef.current) return;

      const mid = pedidoAtualizado?.mesaId || pedidoAtualizado?.mesa;
      if (mid && String(mid) !== String(mesaIdRef.current)) return;

      const qtdAnterior = itensCountRef.current;
      const qtdNova = pedidoAtualizado?.itens?.length || 0;

      const agora = Date.now();
      const veioDeMimRecentemente = agora - lastLocalAddTsRef.current < 1200;

      const totalAnterior = Number(totalPedidoRef.current || 0);
      const totalNovo = Number(pedidoAtualizado?.valorTotal ?? pedidoAtualizado?.total ?? 0);
      const comandaMudouEnquantoPagamentoAberto = payOpenRef.current && (qtdNova !== qtdAnterior || Math.abs(totalNovo - totalAnterior) >= 0.01);

      if (comandaMudouEnquantoPagamentoAberto) {
        fecharPagamentoPorMudancaComanda("Um item foi lançado/alterado. Reabra o pagamento para recalcular o valor.");
      } else if (qtdNova > qtdAnterior && !veioDeMimRecentemente) {
        const ultimo = pedidoAtualizado.itens[qtdNova - 1];
        const nome = safeText(ultimo?.nome || "Item");
        const qtdItem = Number(ultimo?.quantidade || 1);

        setNotifyMsg(`🧾 Novo item: ${qtdItem}x ${nome}`);
        setNotifyOpen(true);
      }

      setPedido(pedidoAtualizado);
    };

    s.on("connect", onConnect);
    s.on("mesaAtualizada", onMesaAtualizadaSocket);
    s.on("pedidoAtualizado", onPedidoAtualizado);

    s.on("connect_error", (err) => console.error("❌ Socket error ModalComandaMesa:", err?.message));

    return () => {
      s.off("connect", onConnect);
      s.off("mesaAtualizada", onMesaAtualizadaSocket);
      s.off("pedidoAtualizado", onPedidoAtualizado);
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId]);

  const abrirMesaSePrecisar = async () => {
    if (!mesaId) return false;
    if (mesa?.pedidoAtualId) return true;

    setLoading(true);
    setErro(null);
    try {
      const res = await axios.post(`${apiUrl}/api/mesas/${mesaId}/abrir`, {}, { headers: authHeaders() });
      const mesaAtualizada = res.data?.mesa || null;
      const pedidoCriado = res.data?.pedido || null;

      if (mesaAtualizada) onMesaAtualizada?.(mesaAtualizada);
      if (pedidoCriado) setPedido(pedidoCriado);

      return true;
    } catch (e) {
      setErro(e?.response?.data?.message || "Erro ao abrir mesa.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const adicionarItens = async (itens) => {
    if (!mesaId) return;
    const ok = await abrirMesaSePrecisar();
    if (!ok) return;
    if (!Array.isArray(itens) || itens.length === 0) return;

    lastLocalAddTsRef.current = Date.now();

    setLoading(true);
    setErro(null);
    try {
      const res = await axios.post(
        `${apiUrl}/api/mesas/${mesaId}/itens`,
        { itens },
        { headers: authHeaders() }
      );
      if (res.data?.mesa) onMesaAtualizada?.(res.data.mesa);
      if (res.data?.pedido) setPedido(res.data.pedido);
      fecharPagamentoPorMudancaComanda("Item adicionado. Reabra o pagamento para confirmar o novo valor.");
    } catch (e) {
      setErro(e?.response?.data?.message || "Erro ao adicionar item.");
    } finally {
      setLoading(false);
    }
  };

  const abrirConfigProduto = (produto) => {
    setProdutoSelecionado(produto);
    setOpenConfig(true);
  };

  const adicionarItemManual = async () => {
    const nome = nomeItem.trim();
    const quantidade = Number(qtd);
    const unit = toNumberBR(precoUnit, NaN);

    if (!nome) return setErro("Informe o nome do item.");
    if (!Number.isFinite(quantidade) || quantidade < 1) return setErro("Quantidade inválida.");
    if (!Number.isFinite(unit) || unit < 0) return setErro("Preço inválido.");

    const item = {
      nome,
      produtoId: "",
      imagem: "",
      quantidade,
      precoUnitario: unit,
      precoTotal: round2(quantidade * unit),
      observacao: "",
      categoriaType: "",
      saboresSelecionados: [],
      bordaSelecionada: null,
      adicionalSelecionado: null,
      complementosSelecionados: [],
      tiposExtrasSelecionados: {},
    };

    await adicionarItens([item]);

    setNomeItem("");
    setQtd(1);
    setPrecoUnit("");
  };

  const podeAbrirPagamento = !!(pedido?._id || mesa?.pedidoAtualId);

  const podeEncerrarAgora = useMemo(() => {
    if (!podeAbrirPagamento) return false;
    return Number(pendente || 0) <= 0;
  }, [podeAbrirPagamento, pendente]);

  const encerrarMesa = async () => {
    if (!mesaId) return;
    if (!podeAbrirPagamento) return;

    setLoading(true);
    setErro(null);
    try {
      const res = await axios.post(`${apiUrl}/api/mesas/${mesaId}/fechar`, {}, { headers: authHeaders() });

      if (res.data?.mesa) onMesaAtualizada?.(res.data.mesa);

      setPayOpen(false);
      onClose?.();
    } catch (e) {
      setErro(e?.response?.data?.message || "Erro ao encerrar mesa.");
    } finally {
      setLoading(false);
    }
  };

  const categorias = useMemo(() => {
    const set = new Set();
    for (const p of produtos) {
      const cat = safeText(getProdutoCategoriaTexto(p)).trim();
      if (cat) set.add(cat);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    const termo = normalizeStr(buscaProduto);
    const catAtiva = safeText(categoriaAtiva).trim();

    return produtos.filter((p) => {
      const nome = normalizeStr(getProdutoNome(p));
      const desc = normalizeStr(getProdutoDescricao(p));
      const cat = safeText(getProdutoCategoriaTexto(p)).trim();

      const matchNome = !termo || nome.includes(termo) || desc.includes(termo);
      const matchCat = catAtiva === "Todas" ? true : cat === catAtiva;

      return matchNome && matchCat;
    });
  }, [produtos, buscaProduto, categoriaAtiva]);

  const itensComandaFiltrados = useMemo(() => {
    const termo = normalizeStr(buscaComanda);
    const itens = pedido?.itens || [];
    if (!termo) return itens;
    return itens.filter((i) => normalizeStr(i?.nome).includes(termo));
  }, [pedido, buscaComanda]);

  /* =========================
✅ CANCELAR AÇÕES
========================= */
  const openCancelarItem = (idx) => {
    setCancelDlg({ open: true, type: "item", itemIndex: idx, motivo: "" });
  };

  const openCancelarPedido = () => {
    setCancelDlg({ open: true, type: "pedido", itemIndex: null, motivo: "" });
  };

  const closeCancelDlg = () => {
    setCancelDlg({ open: false, type: null, itemIndex: null, motivo: "" });
  };

  const confirmarCancelamento = async () => {
    const pedidoId = pedido?._id || mesa?.pedidoAtualId;
    if (!pedidoId) {
      setErro("Pedido não encontrado para cancelamento.");
      closeCancelDlg();
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      if (cancelDlg.type === "pedido") {
        const res = await axios.post(
          `${apiUrl}/api/garcons/app/pedido/${pedidoId}/cancelar`,
          { motivo: cancelDlg.motivo || "" },
          { headers: authHeaders() }
        );

        if (res.data?.pedido) setPedido(res.data.pedido);
        else await carregarComanda();

        setNotifyMsg("✅ Pedido cancelado!");
        setNotifyOpen(true);
      }

      if (cancelDlg.type === "item") {
        const idx = Number(cancelDlg.itemIndex);
        if (!Number.isFinite(idx) || idx < 0) throw new Error("Índice inválido.");

        const res = await axios.post(
          `${apiUrl}/api/garcons/app/pedido/${pedidoId}/item/${idx}/cancelar`,
          { motivo: cancelDlg.motivo || "" },
          { headers: authHeaders() }
        );

        if (res.data?.pedido) setPedido(res.data.pedido);
        else await carregarComanda();

        setNotifyMsg("✅ Item cancelado!");
        setNotifyOpen(true);
      }

      closeCancelDlg();
    } catch (e) {
      console.error("Erro ao cancelar:", e?.response?.data || e.message);
      setErro(e?.response?.data?.message || "Erro ao cancelar.");
    } finally {
      setLoading(false);
    }
  };

  const canPrint = !!pedido && (pedido?.itens?.length || 0) > 0;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Stack>
              <Typography variant="h6" fontWeight={900}>
                Mesa {mesa?.numero || "-"} — Comanda
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Clique no produto para configurar (pizza, sabores, extras…)
              </Typography>

              {pedido && (
                <Typography variant="caption" color="text.secondary">
                  Total: <b>{formatBRL(total)}</b> • Pago: <b>{formatBRL(pago)}</b> • Pendente:{" "}
                  <b>{formatBRL(pendente)}</b>
                </Typography>
              )}

              {/* ✅ status do serviço de impressão */}
              <Typography variant="caption" color={printServiceOnline ? "success.main" : "text.secondary"}>
                {printServiceOnline ? "🖨️ Impressão: ONLINE" : `🖨️ Impressão: OFFLINE — ${printServiceMsg || ""}`}
              </Typography>
            </Stack>

            <Chip label={mesa?.status || "livre"} color={statusChipColor} sx={{ fontWeight: 800 }} />
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2, height: "78vh" }}>
          {/* ✅ não mostra erro "global" atrás quando o pagamento está aberto */}
          {erro && !payOpen && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                borderColor: "error.main",
                bgcolor: "rgba(244,67,54,0.04)",
              }}
            >
              <Typography variant="body2" color="error.main">
                {erro}
              </Typography>
            </Paper>
          )}

          <Box sx={{ display: "flex", gap: 2, height: "100%", flexDirection: { xs: "column", md: "row" } }}>
            {/* ESQUERDA */}
            <Box sx={{ flex: { md: "1 1 65%" }, height: "100%", minWidth: 0 }}>
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: "rgba(2,6,23,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RestaurantMenuIcon fontSize="small" />
                    <Typography fontWeight={900}>Catálogo</Typography>
                    <Chip size="small" label={`${produtos.length} produtos`} />
                  </Stack>

                  <TextField
                    size="small"
                    placeholder="Buscar produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ width: { xs: "100%", md: 360 } }}
                  />
                </Box>

                <Tabs
                  value={abaCatalogo}
                  onChange={(_, v) => setAbaCatalogo(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ px: 1 }}
                >
                  <Tab label="Produtos" />
                  <Tab label="Manual" />
                </Tabs>

                <Divider />

                <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
                  {abaCatalogo === 0 && (
                    <>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                        {categorias.map((c) => (
                          <Chip
                            key={c}
                            label={c}
                            clickable
                            color={c === categoriaAtiva ? "primary" : "default"}
                            variant={c === categoriaAtiva ? "filled" : "outlined"}
                            onClick={() => setCategoriaAtiva(c)}
                            sx={{ fontWeight: 800 }}
                          />
                        ))}
                      </Stack>

                      {prodLoading && (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: 2,
                          }}
                        >
                          {Array.from({ length: 8 }).map((_, i) => (
                            <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Skeleton variant="rounded" width={72} height={72} />
                                <Stack sx={{ width: "100%" }}>
                                  <Skeleton width="70%" />
                                  <Skeleton width="90%" />
                                  <Skeleton width="55%" />
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Box>
                      )}

                      {!prodLoading && produtosFiltrados.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Você ainda não tem nenhum produto cadastrado. Navegue até <b>Produtos</b> e cadastre-os.
                        </Typography>
                      )}

                      {!prodLoading && produtosFiltrados.length > 0 && (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 2,
                          }}
                        >
                          {produtosFiltrados.map((p) => {
                            const id = getProdutoId(p);
                            const nome = getProdutoNome(p);
                            const cat = getProdutoCategoriaTexto(p);
                            const preco = getProdutoPrecoBase(p);
                            const img = getProdutoImagem(p);
                            const desc = getProdutoDescricao(p);

                            return (
                              <Card key={id || `${nome}-${preco}`} variant="outlined" sx={{ borderRadius: 2 }}>
                                <CardActionArea onClick={() => abrirConfigProduto(p)} disabled={loading} sx={{ p: 1.5 }}>
                                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    <SmartThumb
                                      src={img}
                                      alt={nome}
                                      size={72}
                                      rounded={16}
                                      restauranteLogo={restauranteLogo}
                                      watermark
                                      preferCircularOnFallback
                                    />

                                    <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
                                      <Typography
                                        fontWeight={950}
                                        sx={{
                                          fontSize: 14,
                                          lineHeight: 1.2,
                                          whiteSpace: "normal",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {nome}
                                      </Typography>

                                      {desc ? (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            mt: 0.35,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            whiteSpace: "normal",
                                            lineHeight: 1.25,
                                          }}
                                        >
                                          {desc}
                                        </Typography>
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ mt: 0.35, display: "block" }}
                                        >
                                          &nbsp;
                                        </Typography>
                                      )}

                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        mt={0.75}
                                        sx={{ gap: 1 }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                          title={cat}
                                        >
                                          {cat}
                                        </Typography>

                                        <Typography variant="body2" fontWeight={950} sx={{ whiteSpace: "nowrap" }}>
                                          {formatBRL(preco)}
                                        </Typography>
                                      </Stack>

                                      <Stack direction="row" justifyContent="flex-end" mt={1}>
                                        <Chip size="small" icon={<AddIcon />} label="Configurar" color="primary" sx={{ fontWeight: 900 }} />
                                      </Stack>
                                    </CardContent>
                                  </Stack>
                                </CardActionArea>
                              </Card>
                            );
                          })}
                        </Box>
                      )}
                    </>
                  )}

                  {abaCatalogo === 1 && (
                    <>
                      <Typography variant="subtitle2" fontWeight={900} mb={1}>
                        Lançamento manual
                      </Typography>

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <TextField fullWidth label="Nome do item" value={nomeItem} onChange={(e) => setNomeItem(e.target.value)} />
                        <TextField
                          label="Qtd"
                          value={qtd}
                          onChange={(e) => setQtd(e.target.value)}
                          sx={{ width: { xs: "100%", sm: 120 } }}
                          inputProps={{ inputMode: "numeric" }}
                        />
                        <TextField
                          label="Preço unit."
                          value={precoUnit}
                          onChange={(e) => setPrecoUnit(maskBRLInput(e.target.value))}
                          sx={{ width: { xs: "100%", sm: 180 } }}
                          inputProps={{ inputMode: "decimal" }}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                          }}
                        />
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={adicionarItemManual}
                          disabled={loading}
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          Adicionar
                        </Button>
                      </Stack>
                    </>
                  )}
                </Box>
              </Paper>
            </Box>

            {/* DIREITA */}
            <Box sx={{ flex: { md: "0 0 410px" }, height: "100%", minWidth: 0 }}>
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: "rgba(2,6,23,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReceiptLongIcon fontSize="small" />
                    <Typography fontWeight={900}>Comanda</Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {/* ✅ ícone de impressão no RESUMO (sem configurar impressora aqui) */}
                    <Tooltip title={!canPrint ? "Sem itens para imprimir" : "Imprimir comanda"}>
                      <span>
                        <IconButton
                          onClick={imprimirComanda}
                          disabled={loading || printing || !canPrint}
                          size="small"
                        >
                          {printing ? <CircularProgress size={18} /> : <PrintIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Cancelar pedido (inteiro)">
                      <span>
                        <IconButton
                          onClick={openCancelarPedido}
                          disabled={loading || !(pedido?._id || mesa?.pedidoAtualId)}
                          size="small"
                          sx={{ color: "error.main" }}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Recarregar comanda">
                      <span>
                        <IconButton
                          onClick={() => {
                            fetchedComandaRef.current = false;
                            carregarComanda();
                          }}
                          disabled={loading}
                          size="small"
                        >
                          <RefreshIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>

                <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "white",
                      border: "1px dashed rgba(2,6,23,0.25)",
                    }}
                  >
                    <Stack spacing={0.5} alignItems="center">
                      <Typography fontWeight={900} sx={{ letterSpacing: 1 }}>
                        COMANDA
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Mesa {mesa?.numero || "-"} • {new Date().toLocaleString("pt-BR")}
                      </Typography>
                    </Stack>

                    <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Total
                      </Typography>
                      <Typography variant="h6" fontWeight={900}>
                        {formatBRL(total)}
                      </Typography>
                    </Stack>

                    {pedido && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          Pago / Pendente
                        </Typography>
                        <Typography variant="body2" fontWeight={950}>
                          {formatBRL(pago)} • {formatBRL(pendente)}
                        </Typography>
                      </Stack>
                    )}

                    <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

                    <TextField
                      size="small"
                      placeholder="Buscar item..."
                      value={buscaComanda}
                      onChange={(e) => setBuscaComanda(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      fullWidth
                      sx={{ mb: 1.5 }}
                    />

                    {!pedido && (
                      <Typography variant="body2" color="text.secondary">
                        Sem comanda ainda. Ao adicionar o primeiro item, ela abre automaticamente.
                      </Typography>
                    )}

                    {pedido && (pedido.itens?.length || 0) === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Comanda aberta, mas sem itens.
                      </Typography>
                    )}

                    {pedido && (pedido.itens?.length || 0) > 0 && (
                      <List dense disablePadding>
                        {itensComandaFiltrados.map((item, idx) => {
                          const resumo = buildResumoTextItem(item);

                          return (
                            <ListItem
                              key={`${getItemNome(item)}-${idx}`}
                              disableGutters
                              sx={{
                                py: 1.1,
                                px: 0,
                                borderBottom: "1px dashed rgba(2,6,23,0.18)",
                                alignItems: "flex-start",
                              }}
                              secondaryAction={
                                <Tooltip title="Cancelar item">
                                  <span>
                                    <IconButton
                                      edge="end"
                                      size="small"
                                      onClick={() => openCancelarItem(idx)}
                                      disabled={loading}
                                      sx={{ color: "error.main", mt: 0.2 }}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              }
                            >
                              <SmartThumb
                                src={getItemImagem(item)}
                                alt={getItemNome(item)}
                                size={44}
                                rounded={12}
                                restauranteLogo={restauranteLogo}
                                watermark
                                preferCircularOnFallback
                              />

                              <ListItemText
                                sx={{ ml: 1.25 }}
                                primary={
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: 1,
                                      minWidth: 0,
                                      pr: 4.5,
                                    }}
                                  >
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                      <Stack direction="row" spacing={0.8} alignItems="baseline" sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13, fontWeight: 950, whiteSpace: "nowrap" }}>
                                          {Number(item.quantidade || 0)}x
                                        </Typography>
                                        <Typography
                                          sx={{
                                            fontSize: 13,
                                            fontWeight: 950,
                                            minWidth: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                          title={getItemNome(item)}
                                        >
                                          {getItemNome(item)}
                                        </Typography>
                                      </Stack>

                                      {resumo.personalizado ? (
                                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.45, minWidth: 0 }}>
                                          <Chip
                                            size="small"
                                            label="Personalizado"
                                            variant="outlined"
                                            color="warning"
                                            sx={{ height: 18, fontWeight: 900, flexShrink: 0 }}
                                          />

                                          {resumo.short ? (
                                            <Tooltip
                                              title={
                                                <Box sx={{ fontSize: 12, p: 0.5, maxWidth: 320, whiteSpace: "normal" }}>
                                                  {resumo.full}
                                                </Box>
                                              }
                                              placement="top"
                                              arrow
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{
                                                  minWidth: 0,
                                                  flex: 1,
                                                  overflow: "hidden",
                                                  textOverflow: "ellipsis",
                                                  whiteSpace: "nowrap",
                                                  lineHeight: 1.2,
                                                }}
                                              >
                                                {resumo.short}
                                              </Typography>
                                            </Tooltip>
                                          ) : null}
                                        </Stack>
                                      ) : null}
                                    </Box>

                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ fontWeight: 950, whiteSpace: "nowrap", flexShrink: 0 }}
                                    >
                                      {formatBRL(item.precoTotal || 0)}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}

                    <Divider sx={{ mt: 2, borderStyle: "dashed" }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      “Obrigado! Volte sempre.”
                    </Typography>
                  </Paper>
                </Box>

                <Divider />

                <Box sx={{ p: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button onClick={onClose} disabled={loading} fullWidth variant="outlined">
                    Fechar
                  </Button>

                  <Button
                    onClick={() => {
                      setErro(null);
                      setPayOpen(true);
                    }}
                    variant="contained"
                    disabled={loading || !podeAbrirPagamento}
                    fullWidth
                    startIcon={<PaymentsIcon />}
                    sx={{ fontWeight: 950 }}
                  >
                    Pagamento
                  </Button>

                  <Button
                    onClick={encerrarMesa}
                    variant="contained"
                    color="success"
                    disabled={loading || !podeEncerrarAgora}
                    fullWidth
                    sx={{ fontWeight: 950 }}
                  >
                    Encerrar
                  </Button>
                </Box>

                {!podeEncerrarAgora && podeAbrirPagamento && (
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Alert severity="info">
                      Para encerrar, o pendente precisa ser 0. Use <b>Pagamento</b> para pagar parcial/total.
                    </Alert>
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ✅ MODAL DE CANCELAMENTO */}
      <Dialog open={cancelDlg.open} onClose={closeCancelDlg} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {cancelDlg.type === "pedido" ? "Cancelar pedido" : "Cancelar item"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {cancelDlg.type === "pedido"
              ? "Isso vai cancelar o pedido inteiro desta mesa."
              : "Isso vai remover esse item da comanda e recalcular o total."}
          </Typography>

          <TextField
            label="Motivo (opcional)"
            value={cancelDlg.motivo}
            onChange={(e) => setCancelDlg((p) => ({ ...p, motivo: e.target.value }))}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeCancelDlg} disabled={loading} variant="outlined">
            Voltar
          </Button>
          <Button
            onClick={confirmarCancelamento}
            disabled={loading}
            variant="contained"
            color="error"
            sx={{ fontWeight: 900 }}
          >
            Confirmar cancelamento
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE CONFIG DO PRODUTO */}
      <ModalConfigProdutoComanda
        open={openConfig}
        onClose={() => {
          setOpenConfig(false);
          setProdutoSelecionado(null);
        }}
        produto={produtoSelecionado}
        restauranteLogo={restauranteLogo}
        onConfirm={async (item) => {
          await adicionarItens([item]);
        }}
      />

      {/* ✅ MODAL PAGAMENTO */}
      <ModalPagamentoMesa
        open={payOpen}
        onClose={() => setPayOpen(false)}
        apiUrl={apiUrl}
        mesa={mesa}
        pedido={pedido}
        loadingGlobal={loading}
        setErroGlobal={setErro}
        onMesaAtualizada={(m) => onMesaAtualizada?.(m)}
        onPedidoAtualizado={(p) => setPedido(p)}
        recarregarComanda={carregarComanda}
        onNotify={(msg) => {
          setNotifyMsg(msg);
          setNotifyOpen(true);
        }}
        onMesaFechada={() => {
          setPayOpen(false);
          onClose?.();
        }}
      />

      {/* ✅ NOTIFICAÇÃO */}
      <Snackbar
        open={notifyOpen}
        autoHideDuration={2500}
        onClose={() => setNotifyOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={String(notifyMsg || "").startsWith("❌") ? "error" : "success"}
          variant="filled"
          sx={{ fontWeight: 900 }}
          onClose={() => setNotifyOpen(false)}
        >
          {notifyMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
