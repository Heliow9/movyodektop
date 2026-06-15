// pages/Pedidos.jsx
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Typography,
  Box,
  Card,
  CardContent,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Button,
  Paper,
  Chip,
  CircularProgress,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  InputAdornment,
  useMediaQuery,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PaidIcon from "@mui/icons-material/Paid";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import DeliveryDiningIcon from "@mui/icons-material/DeliveryDining";
import TimerIcon from "@mui/icons-material/Timer";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TuneIcon from "@mui/icons-material/Tune";
import { getPedidoCreatedMs } from "../utils/dateTime";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import axios from "axios";
import * as XLSX from "xlsx";
import { usePedidos } from "../contexts/PedidosContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

/* -----------------------
   Movyo theme (local)
-------------------------*/
const movyo = {
  primary: "#083358",
  bg: "#f3f6fb",
  card: "#ffffff",
  muted: "#64748b",
  text: "#0f172a",
  border: "rgba(15, 23, 42, 0.10)",
};

/* -----------------------
   Utils
-------------------------*/
function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}
function norm(s) {
  return safeText(s).trim().toLowerCase();
}
function normKey(s) {
  return safeText(s)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function normalizarStatusPedido(p) {
  const origem = normKey(p?.origem || p?.tipo || p?.tipoPedido);
  const status = normKey(p?.status || p?.situacao);
  const statusPagamento = normKey(p?.statusPagamento || p?.pagamento?.status || p?.paymentStatus);

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
function normalizarPedidoRelatorio(p) {
  const valorTotal = getPedidoTotal(p);
  return {
    ...p,
    id: p?.id || p?._id || p?.pedidoId,
    statusOriginal: p?.status,
    status: normalizarStatusPedido(p),
    valorTotal,
    total: valorTotal,
  };
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

  // BR: 1.234,56 | US/API: 1234.56 | inteiro: 1234
  if (hasComma) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = str.split(".");
    const last = parts[parts.length - 1];
    str = last.length === 3 && parts.length > 1 ? parts.join("") : str;
  }

  const n = Number(str);
  return Number.isFinite(n) ? round2(n) : 0;
}
function brl(v) {
  const n = round2(toNumberBRL(v));
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function qtdLabel(v) {
  const n = Number(v || 1);
  if (!Number.isFinite(n)) return "1";
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function getItemUnitario(item) {
  return toNumberBRL(item?.precoUnitario ?? item?.preco ?? item?.valorUnitario ?? 0);
}
function getItemTotal(item) {
  const qtd = Number(item?.quantidade || 1);
  const unit = getItemUnitario(item);
  const total = toNumberBRL(item?.precoTotal ?? item?.total ?? item?.valorTotal);
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
function mergePedidos(base, incoming) {
  const map = new Map();
  [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((p) => {
    const id = p?._id || p?.id || p?.pedidoId || p?.numeroPedido || Math.random().toString(36);
    map.set(String(id), { ...(map.get(String(id)) || {}), ...p });
  });
  return sortPedidosNewest(Array.from(map.values()));
}
function getCreatedDate(p) {
  return p?.criadoEm || p?.createdAt || p?.updatedAt || null;
}
function getFinancialDate(p) {
  return p?.pagoEm || p?.paymentApprovedAt || p?.pagamento?.aprovadoEm || getCreatedDate(p);
}
function isVendaConfirmada(p) {
  const status = normKey(p?.status || p?.situacao);
  const pagamento = normKey(p?.statusPagamento || p?.pagamento?.status || p?.paymentStatus);

  const invalidos = [
    "cancelado", "cancelada", "canceled", "cancelled", "expirado", "expirada",
    "refunded", "reembolsado", "reembolsada", "estornado", "estornada"
  ];
  if (invalidos.includes(status) || invalidos.includes(pagamento)) return false;

  if (p?.pagoEm || p?.paymentApprovedAt || p?.pagamento?.aprovadoEm) return true;
  if (["pago", "paid", "approved", "aprovado"].includes(pagamento)) return true;

  return [
    "pago", "paid", "approved", "aprovado", "em_producao", "em producao",
    "em_producao", "em produção", "producao", "produção", "preparo", "em_preparo",
    "em preparo", "preparando", "cozinha", "em_entrega", "em entrega", "em_rota",
    "em rota", "rota", "saiu_entrega", "saiu para entrega", "entregue", "delivered",
    "concluido", "concluida", "finalizado", "finalizada"
  ].includes(status);
}
function getUpdatedDate(p) {
  return p?.updatedAt || p?.criadoEm || p?.createdAt || null;
}
function statusUI(status) {
  const map = {
    aguardando_pagamento: { label: "Aguard. pag.", color: "info" },
    pago: { label: "Pago", color: "success" },
    em_producao: { label: "Em produção", color: "warning" },
    em_entrega: { label: "Em entrega", color: "warning" },
    em_rota: { label: "Em rota", color: "warning" },
    entregue: { label: "Entregue", color: "success" },
    cancelado: { label: "Cancelado", color: "error" },
    aguardando_resposta: { label: "Aguard. resp.", color: "default" },
  };
  return map[status] || { label: safeText(status || "—"), color: "default" };
}
function origemUI(origem) {
  const map = {
    vitrine: { label: "Vitrine", icon: <StorefrontIcon fontSize="small" /> },
    balcao: { label: "Balcão", icon: <PointOfSaleIcon fontSize="small" /> },
    salao: { label: "Salão", icon: <TableRestaurantIcon fontSize="small" /> },
    ifood: { label: "iFood", icon: <DeliveryDiningIcon fontSize="small" /> },
  };
  return map[origem] || { label: safeText(origem || "—"), icon: <ReceiptLongIcon fontSize="small" /> };
}
function getFormaPagamento(p) {
  return safeText(
    p?.formadePagamento ??
      p?.formaPagamento ??
      p?.metodoPagamento ??
      p?.tipoPagamento ??
      p?.pagamento ??
      p?.paymentMethod ??
      ""
  );
}
function normalizarPagamento(raw) {
  const original = safeText(raw).trim();
  const s = original
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (!s) return { key: "nao_informado", label: "Não informado" };
  if (s.includes("pix")) return { key: "pix", label: "PIX" };
  if (s.includes("dinheiro") || s.includes("cash")) return { key: "dinheiro", label: "Dinheiro" };
  if (s.includes("credito") || s.includes("c.credito") || s.includes("credit")) return { key: "credito", label: "Cartão de crédito" };
  if (s.includes("debito") || s.includes("c.debito") || s.includes("debit")) return { key: "debito", label: "Cartão de débito" };
  if (s.includes("cartao") || s.includes("cartão")) return { key: "cartao", label: "Cartão" };

  return { key: original || "outros", label: original || "Outros" };
}
const pagamentosOrdem = ["dinheiro", "pix", "credito", "debito", "cartao", "nao_informado"];
function pctDelta(current, prev) {
  const c = Number(current || 0);
  const p = Number(prev || 0);
  if (p === 0 && c === 0) return 0;
  if (p === 0 && c > 0) return 100;
  return ((c - p) / p) * 100;
}
function formatPct(v) {
  const n = Number(v || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
function mins(ms) {
  const m = Math.round((Number(ms || 0) / 60000) * 10) / 10;
  return Number.isFinite(m) ? m : 0;
}

/* -----------------------
   UI blocks
-------------------------*/
function SectionCard({ title, subtitle, right, children }) {
  return (
    <Card sx={{ borderRadius: 3, border: `1px solid ${movyo.border}`, boxShadow: "none", overflow: "hidden" }}>
      <CardContent sx={{ p: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 950, color: movyo.text }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" sx={{ color: movyo.muted }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {right}
        </Stack>

        {children}
      </CardContent>
    </Card>
  );
}

function KpiCard({ title, value, icon, subtitle, right }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: movyo.card,
        border: `1px solid ${movyo.border}`,
        minHeight: 112,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 900, letterSpacing: 0.2 }}>
            {title}
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 950, color: movyo.text, mt: 0.5, lineHeight: 1.15 }}>
            {value}
          </Typography>

          {subtitle ? (
            <Typography variant="caption" sx={{ color: movyo.muted, display: "block", mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {right}
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(8,51,88,0.08)",
              color: movyo.primary,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}

function DeltaChip({ value }) {
  const n = Number(value || 0);
  const positive = n >= 0;
  return (
    <Chip
      icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={formatPct(n)}
      size="small"
      color={positive ? "success" : "error"}
      sx={{ fontWeight: 900 }}
    />
  );
}

/* -----------------------
   Heatmap (0..23)
-------------------------*/
function HeatmapHoras({ bins }) {
  const max = Math.max(1, ...bins.map((b) => b.pedidos));
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(6, minmax(0, 1fr))", sm: "repeat(12, minmax(0, 1fr))" },
        gap: 1,
      }}
    >
      {bins.map((b) => {
        const intensity = b.pedidos / max;
        return (
          <Tooltip
            key={b.hour}
            title={`${String(b.hour).padStart(2, "0")}:00 — ${b.pedidos} pedidos • ${brl(b.valor)}`}
          >
            <Box
              sx={{
                borderRadius: 2,
                border: `1px solid ${movyo.border}`,
                p: 1,
                bgcolor: `rgba(8,51,88,${0.06 + intensity * 0.42})`,
                color: movyo.text,
                cursor: "default",
                minHeight: 52,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                transition: "transform 120ms ease",
                "&:hover": { transform: "translateY(-1px)" },
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 950 }}>
                {String(b.hour).padStart(2, "0")}h
              </Typography>
              <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 800 }}>
                {b.pedidos}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/* -----------------------
   Layout helpers
-------------------------*/
function Responsive2Col({ left, right }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>{left}</Box>
      <Box sx={{ minWidth: 0 }}>{right}</Box>
    </Box>
  );
}
function ResponsiveKpis({ children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

export default function Pedidos() {
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const { pedidos: pedidosGlobais } = usePedidos();

  const [restauranteId, setRestauranteId] = useState(null);

  const [pedidos, setPedidos] = useState([]);
  const [entregadores, setEntregadores] = useState([]);

  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroEntregador, setFiltroEntregador] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mensal");

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [busca, setBusca] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  /* ---------------------------
     Sessão
  ----------------------------*/
  useEffect(() => {
    const buscarSessao = async () => {
      const sessao = await window.electron?.obterSessao?.();
      if (sessao?.restauranteId) setRestauranteId(sessao.restauranteId);
    };
    buscarSessao();
  }, []);

  const fetchTudo = useCallback(async () => {
    if (!restauranteId) return;

    try {
      setCarregando(true);

      const [pedidosRes, entregadoresRes] = await Promise.all([
        axios.get(`${API_URL}/api/pedidos/${restauranteId}`),
        axios.get(`${API_URL}/api/entregadores/byRestaurante/${restauranteId}`),
      ]);

      const listaPedidos = Array.isArray(pedidosRes.data)
        ? pedidosRes.data
        : Array.isArray(pedidosRes.data?.pedidos)
        ? pedidosRes.data.pedidos
        : [];

      const listaEntregadores = Array.isArray(entregadoresRes.data)
        ? entregadoresRes.data
        : Array.isArray(entregadoresRes.data?.entregadores)
        ? entregadoresRes.data.entregadores
        : [];

      setPedidos(sortPedidosNewest(listaPedidos.map(normalizarPedidoRelatorio)));
      setEntregadores(listaEntregadores);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error("Erro ao buscar dados", error);
      setPedidos([]);
      setEntregadores([]);
    } finally {
      setCarregando(false);
    }
  }, [restauranteId]);

  useEffect(() => {
    if (!restauranteId) return;
    fetchTudo();
  }, [restauranteId, fetchTudo]);

  useEffect(() => {
    if (!Array.isArray(pedidosGlobais) || pedidosGlobais.length === 0) return;
    setPedidos((prev) => mergePedidos(prev, pedidosGlobais.map(normalizarPedidoRelatorio)));
    setLastUpdatedAt(new Date());
  }, [pedidosGlobais]);

  useEffect(() => {
    const onChanged = (ev) => {
      const lista = ev?.detail?.pedidos;
      if (!Array.isArray(lista)) return;
      setPedidos((prev) => mergePedidos(prev, lista.map(normalizarPedidoRelatorio)));
      setLastUpdatedAt(new Date());
    };
    window.addEventListener("movyo:pedidos:changed", onChanged);
    return () => window.removeEventListener("movyo:pedidos:changed", onChanged);
  }, []);

  useEffect(() => {
    // melhora UX: em desktop já inicia com filtros recolhíveis, mas abertos.
    setFiltrosAbertos(true);
  }, [isDesktop]);

  /* ---------------------------
     Presets de datas
  ----------------------------*/
  const aplicarPreset = (preset) => {
    const hoje = dayjs();
    if (preset === "hoje") {
      setDataInicio(hoje.format("YYYY-MM-DD"));
      setDataFim(hoje.format("YYYY-MM-DD"));
      return;
    }
    if (preset === "7d") {
      setDataInicio(hoje.subtract(6, "day").format("YYYY-MM-DD"));
      setDataFim(hoje.format("YYYY-MM-DD"));
      return;
    }
    if (preset === "30d") {
      setDataInicio(hoje.subtract(29, "day").format("YYYY-MM-DD"));
      setDataFim(hoje.format("YYYY-MM-DD"));
      return;
    }
    if (preset === "mes_atual") {
      setDataInicio(hoje.startOf("month").format("YYYY-MM-DD"));
      setDataFim(hoje.endOf("month").format("YYYY-MM-DD"));
      return;
    }
  };

  /* ---------------------------
     Filtro principal
  ----------------------------*/
  const pedidosFiltrados = useMemo(() => {
    const termo = norm(busca);

    return (Array.isArray(pedidos) ? pedidos : [])
      .filter((p) => {
        const statusOK = filtroStatus ? normalizarStatusPedido(p) === filtroStatus : true;
        const entregadorOK = filtroEntregador ? p.entregador?._id === filtroEntregador : true;

        const dataReferencia = dayjs(getFinancialDate(p));
        const inicioOK = !dataInicio || dataReferencia.isSameOrAfter(dayjs(dataInicio).startOf("day"));
        const fimOK = !dataFim || dataReferencia.isSameOrBefore(dayjs(dataFim).endOf("day"));

        const texto = norm(
          `${p.numeroPedido || ""} ${p.nomeCliente || ""} ${p.telefoneCliente || ""} ${
            p.enderecoCliente || ""
          } ${p.residenciaBairro || ""} ${p.residenciaCep || ""} ${p.origem || ""} ${p.status || ""}`
        );

        const buscaOK = !termo || texto.includes(termo);

        return statusOK && entregadorOK && inicioOK && fimOK && buscaOK;
      })
      .sort((a, b) => {
        const tb = getPedidoTimestamp(b);
        const ta = getPedidoTimestamp(a);
        if (tb !== ta) return tb - ta;
        return numeroPedidoRank(b) - numeroPedidoRank(a);
      });
  }, [pedidos, filtroStatus, filtroEntregador, dataInicio, dataFim, busca]);

  /* ---------------------------
     KPIs (do filtro atual)
  ----------------------------*/
  const kpis = useMemo(() => {
    const vendas = pedidosFiltrados.filter(isVendaConfirmada);
    const totalPedidos = vendas.length;
    const totalValor = vendas.reduce((acc, p) => acc + getPedidoTotal(p), 0);
    const entregues = pedidosFiltrados.filter((p) => normalizarStatusPedido(p) === "entregue").length;
    const cancelados = pedidosFiltrados.filter((p) => normalizarStatusPedido(p) === "cancelado").length;
    const ticketMedio = totalPedidos > 0 ? totalValor / totalPedidos : 0;

    return { totalPedidos, totalValor, ticketMedio, entregues, cancelados, registros: pedidosFiltrados.length };
  }, [pedidosFiltrados]);

  /* ---------------------------
     Comparativos
  ----------------------------*/
  const comparativos = useMemo(() => {
    const all = Array.isArray(pedidos) ? pedidos : [];
    const hoje = dayjs();

    const range = (start, end) =>
      all.filter((p) => {
        if (!isVendaConfirmada(p)) return false;
        const d = dayjs(getFinancialDate(p));
        return d.isSameOrAfter(start) && d.isSameOrBefore(end);
      });

    const sumValor = (arr) => arr.reduce((acc, p) => acc + getPedidoTotal(p), 0);

    const hojeList = range(hoje.startOf("day"), hoje.endOf("day"));
    const ontem = hoje.subtract(1, "day");
    const ontemList = range(ontem.startOf("day"), ontem.endOf("day"));

    const w0s = hoje.startOf("week");
    const w0e = hoje.endOf("week");
    const w1s = hoje.subtract(1, "week").startOf("week");
    const w1e = hoje.subtract(1, "week").endOf("week");

    const w0 = range(w0s, w0e);
    const w1 = range(w1s, w1e);

    const m0s = hoje.startOf("month");
    const m0e = hoje.endOf("month");
    const m1s = hoje.subtract(1, "month").startOf("month");
    const m1e = hoje.subtract(1, "month").endOf("month");

    const m0 = range(m0s, m0e);
    const m1 = range(m1s, m1e);

    const pack = (cur, prev) => {
      const curPedidos = cur.length;
      const prevPedidos = prev.length;
      const curValor = sumValor(cur);
      const prevValor = sumValor(prev);

      const curTicket = curPedidos > 0 ? curValor / curPedidos : 0;
      const prevTicket = prevPedidos > 0 ? prevValor / prevPedidos : 0;

      return {
        curPedidos,
        prevPedidos,
        curValor,
        prevValor,
        curTicket,
        prevTicket,
        dPedidos: pctDelta(curPedidos, prevPedidos),
        dValor: pctDelta(curValor, prevValor),
        dTicket: pctDelta(curTicket, prevTicket),
      };
    };

    return { hoje: pack(hojeList, ontemList), semana: pack(w0, w1), mes: pack(m0, m1) };
  }, [pedidos]);

  /* ---------------------------
     Chart por período (filtro atual)
  ----------------------------*/
  const dadosChart = useMemo(() => {
    const mapa = {};
    pedidosFiltrados.filter(isVendaConfirmada).forEach((pedido) => {
      const d = new Date(getFinancialDate(pedido) || Date.now());
      let chave = "";

      if (filtroPeriodo === "diario") chave = d.toLocaleDateString("pt-BR");
      else if (filtroPeriodo === "semanal") {
        const inicioSemana = new Date(d);
        inicioSemana.setDate(d.getDate() - d.getDay());
        chave = `Semana ${inicioSemana.toLocaleDateString("pt-BR")}`;
      } else {
        chave = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      }

      if (!mapa[chave]) mapa[chave] = { name: chave, pedidos: 0, valor: 0 };
      mapa[chave].pedidos += 1;
      mapa[chave].valor += getPedidoTotal(pedido);
    });

    return Object.values(mapa);
  }, [pedidosFiltrados, filtroPeriodo]);

  /* ---------------------------
     Origem (filtro atual)
  ----------------------------*/
  const origemData = useMemo(() => {
    const map = {};
    for (const p of pedidosFiltrados.filter(isVendaConfirmada)) {
      const o = safeText(p.origem || "—") || "—";
      if (!map[o]) map[o] = { name: origemUI(o).label, key: o, pedidos: 0, valor: 0 };
      map[o].pedidos += 1;
      map[o].valor += getPedidoTotal(p);
    }
    return Object.values(map).sort((a, b) => b.pedidos - a.pedidos);
  }, [pedidosFiltrados]);

  const pieColors = ["#083358", "#0f4c7d", "#1f6aa5", "#5aa0d8", "#94c7f2", "#cbd5e1"];

  /* ---------------------------
     Pagamentos (filtro atual)
  ----------------------------*/
  const pagamentosData = useMemo(() => {
    const base = {
      dinheiro: { key: "dinheiro", label: "Dinheiro", pedidos: 0, valor: 0 },
      pix: { key: "pix", label: "PIX", pedidos: 0, valor: 0 },
      credito: { key: "credito", label: "Cartão de crédito", pedidos: 0, valor: 0 },
      debito: { key: "debito", label: "Cartão de débito", pedidos: 0, valor: 0 },
    };

    for (const p of pedidosFiltrados) {
      if (!isVendaConfirmada(p)) continue;
      const pg = normalizarPagamento(getFormaPagamento(p));
      if (!base[pg.key]) base[pg.key] = { key: pg.key, label: pg.label, pedidos: 0, valor: 0 };
      base[pg.key].pedidos += 1;
      base[pg.key].valor += getPedidoTotal(p);
    }

    return Object.values(base).sort((a, b) => {
      const ia = pagamentosOrdem.indexOf(a.key);
      const ib = pagamentosOrdem.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [pedidosFiltrados]);

  const totalPagamentos = useMemo(
    () => pagamentosData.reduce((acc, p) => acc + toNumberBRL(p.valor), 0),
    [pagamentosData]
  );

  /* ---------------------------
     Top Produtos (filtro atual)
  ----------------------------*/
  const topProdutos = useMemo(() => {
    const map = new Map();

    for (const p of pedidosFiltrados.filter(isVendaConfirmada)) {
      for (const item of p.itens || []) {
        const nome = safeText(item.nome || "Item");
        const qtd = Number(item.quantidade || 1);
        const valor = getItemTotal(item);

        const prev = map.get(nome) || { name: nome, qtd: 0, valor: 0 };
        prev.qtd += Number.isFinite(qtd) ? qtd : 1;
        prev.valor += round2(valor);
        map.set(nome, prev);
      }
    }

    const arr = Array.from(map.values());
    const topQtd = [...arr].sort((a, b) => b.qtd - a.qtd).slice(0, 10);
    const topValor = [...arr].sort((a, b) => b.valor - a.valor).slice(0, 10);

    return { topQtd, topValor };
  }, [pedidosFiltrados]);

  const itemMaisPedido = useMemo(() => {
    const first = topProdutos.topQtd?.[0];
    if (!first) return null;
    return {
      nome: first.name,
      qtd: Number(first.qtd || 0),
      valor: Number(first.valor || 0),
    };
  }, [topProdutos]);

  /* ---------------------------
     Horários de pico
  ----------------------------*/
  const heatmapHoras = useMemo(() => {
    const bins = Array.from({ length: 24 }).map((_, h) => ({ hour: h, pedidos: 0, valor: 0 }));
    for (const p of pedidosFiltrados.filter(isVendaConfirmada)) {
      const d = new Date(getFinancialDate(p) || Date.now());
      const h = d.getHours();
      bins[h].pedidos += 1;
      bins[h].valor += getPedidoTotal(p);
    }
    const topHoras = [...bins].sort((a, b) => b.pedidos - a.pedidos).slice(0, 5);
    return { bins, topHoras };
  }, [pedidosFiltrados]);

  /* ---------------------------
     SLA por entregador (aprox)
  ----------------------------*/
  const slaEntregadores = useMemo(() => {
    const map = new Map();
    const entregues = pedidosFiltrados.filter((p) => normalizarStatusPedido(p) === "entregue");

    for (const p of entregues) {
      const id = p.entregador?._id || "sem_entregador";
      const nome = p.entregador?.nome || "Não atribuído";

      const start = new Date(getCreatedDate(p) || Date.now()).getTime();
      const end = new Date(getUpdatedDate(p) || Date.now()).getTime();
      const diff = Math.max(0, end - start);

      const prev = map.get(id) || { name: nome, pedidos: 0, ms: 0 };
      prev.pedidos += 1;
      prev.ms += diff;
      map.set(id, prev);
    }

    const arr = Array.from(map.values()).map((x) => ({
      ...x,
      mediaMin: x.pedidos > 0 ? mins(x.ms / x.pedidos) : 0,
    }));

    return arr.sort((a, b) => b.pedidos - a.pedidos).slice(0, 12);
  }, [pedidosFiltrados]);

  /* ---------------------------
     Exportação XLSX
  ----------------------------*/
  const exportarXLSX = () => {
    const dados = pedidosFiltrados.map((p) => ({
      NumeroPedido: p.numeroPedido || "",
      Origem: p.origem || "",
      Status: normalizarStatusPedido(p) || "",
      StatusPagamento: p.statusPagamento || "",
      MpPaymentId: p.mpPaymentId || "",
      ValorTotal: round2(getPedidoTotal(p)),
      Pagamento: getFormaPagamento(p),
      Cliente: p.nomeCliente || "",
      Telefone: p.telefoneCliente || "",
      Endereco: p.enderecoCliente || "",
      Bairro: p.residenciaBairro || "",
      CEP: p.residenciaCep || "",
      MesaId: p.mesaId || "",
      Entregador: p.entregador?.nome || "",
      VendaConfirmada: isVendaConfirmada(p) ? "Sim" : "Não",
      DataFinanceira: dayjs(getFinancialDate(p)).format("DD/MM/YYYY HH:mm"),
      CriadoEm: dayjs(getCreatedDate(p)).format("DD/MM/YYYY HH:mm"),
      AtualizadoEm: dayjs(getUpdatedDate(p)).format("DD/MM/YYYY HH:mm"),
      Itens: (p.itens || []).map((i) => `${safeText(i.nome)} x${qtdLabel(i.quantidade)} = ${brl(getItemTotal(i))}`).join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

    const resumoPagamentos = pagamentosData.map((p) => ({
      FormaPagamento: p.label,
      Pedidos: p.pedidos,
      ValorVendido: round2(toNumberBRL(p.valor)),
      Percentual: totalPagamentos > 0 ? `${((toNumberBRL(p.valor) / totalPagamentos) * 100).toFixed(1)}%` : "0.0%",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPagamentos), "Resumo pagamentos");

    const nomeArquivo = `movyo_relatorio_pedidos_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  const limpar = () => {
    setFiltroStatus("");
    setFiltroEntregador("");
    setFiltroPeriodo("mensal");
    setDataInicio("");
    setDataFim("");
    setBusca("");
  };

  const chipsAtivos = useMemo(() => {
    const chips = [];

    if (busca) chips.push({ key: "busca", label: `Busca: "${busca}"` });
    if (filtroStatus) chips.push({ key: "status", label: `Status: ${statusUI(filtroStatus).label}` });
    if (filtroEntregador) {
      const nome = entregadores.find((e) => e._id === filtroEntregador)?.nome || "Entregador";
      chips.push({ key: "entregador", label: `Entregador: ${nome}` });
    }
    if (dataInicio || dataFim) {
      const di = dataInicio ? dayjs(dataInicio).format("DD/MM/YYYY") : "—";
      const df = dataFim ? dayjs(dataFim).format("DD/MM/YYYY") : "—";
      chips.push({ key: "datas", label: `Período: ${di} → ${df}` });
    }
    if (filtroPeriodo) chips.push({ key: "agrupamento", label: `Agrupar: ${filtroPeriodo}` });

    return chips;
  }, [busca, filtroStatus, filtroEntregador, dataInicio, dataFim, filtroPeriodo, entregadores]);

  const removerChip = (key) => {
    if (key === "busca") setBusca("");
    if (key === "status") setFiltroStatus("");
    if (key === "entregador") setFiltroEntregador("");
    if (key === "datas") {
      setDataInicio("");
      setDataFim("");
    }
    if (key === "agrupamento") setFiltroPeriodo("mensal");
  };

  if (carregando) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: movyo.bg, display: "grid", placeItems: "center", p: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            bgcolor: movyo.card,
            border: `1px solid ${movyo.border}`,
            textAlign: "center",
            width: "min(520px, 100%)",
          }}
        >
          <CircularProgress />
          <Typography mt={2} sx={{ fontWeight: 900, color: movyo.text }}>
            Carregando relatório…
          </Typography>
          <Typography variant="body2" sx={{ color: movyo.muted }}>
            Buscando pedidos e entregadores
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: movyo.bg, minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1250, mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
        {/* HEADER */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            bgcolor: movyo.card,
            border: `1px solid ${movyo.border}`,
            mb: 2,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950, color: movyo.primary, lineHeight: 1.1 }}>
                Relatório de Pedidos
              </Typography>
              <Typography variant="body2" sx={{ color: movyo.muted, mt: 0.5 }}>
                Valores financeiros consideram somente vendas confirmadas; cancelados e pendentes ficam fora do faturamento.
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<ReceiptLongIcon />}
                  label={`${kpis.totalPedidos} vendas confirmadas`}
                  color="primary"
                  sx={{ fontWeight: 900 }}
                />
                <Chip icon={<PaidIcon />} label={`Faturamento: ${brl(kpis.totalValor)}`} sx={{ fontWeight: 900 }} />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Entregues: ${kpis.entregues}`}
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 900 }}
                />
                <Chip
                  icon={<CancelIcon />}
                  label={`Cancelados: ${kpis.cancelados}`}
                  color="error"
                  variant="outlined"
                  sx={{ fontWeight: 900 }}
                />
                {(dataInicio || dataFim) && (
                  <Chip
                    icon={<CalendarMonthIcon />}
                    label={`${dataInicio ? dayjs(dataInicio).format("DD/MM") : "—"} → ${
                      dataFim ? dayjs(dataFim).format("DD/MM") : "—"
                    }`}
                    variant="outlined"
                    sx={{ fontWeight: 900 }}
                  />
                )}
              </Stack>

              {lastUpdatedAt ? (
                <Typography variant="caption" sx={{ color: movyo.muted, display: "block", mt: 1 }}>
                  Última atualização: {dayjs(lastUpdatedAt).format("DD/MM/YYYY HH:mm")}
                </Typography>
              ) : null}
            </Box>

            <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", md: "flex-end" }} flexWrap="wrap">
              <Tooltip title="Atualizar dados">
                <span>
                  <IconButton
                    onClick={fetchTudo}
                    sx={{
                      border: `1px solid ${movyo.border}`,
                      bgcolor: "rgba(8,51,88,0.03)",
                      "&:hover": { bgcolor: "rgba(8,51,88,0.07)" },
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>

              <Button
                variant="contained"
                onClick={exportarXLSX}
                startIcon={<DownloadIcon />}
                sx={{
                  bgcolor: movyo.primary,
                  fontWeight: 900,
                  px: 2.25,
                  borderRadius: 2.5,
                  "&:hover": { bgcolor: movyo.primary },
                }}
              >
                Exportar XLSX
              </Button>
            </Stack>
          </Box>
        </Paper>

        {/* KPIs + Comparativos + Item mais pedido */}
        <ResponsiveKpis>
          <KpiCard
            title="Pedidos (filtro)"
            value={String(kpis.totalPedidos)}
            subtitle={`Ticket médio: ${brl(kpis.ticketMedio)}`}
            icon={<ReceiptLongIcon />}
          />

          <KpiCard
            title="Hoje vs Ontem (Pedidos)"
            value={`${comparativos.hoje.curPedidos} vs ${comparativos.hoje.prevPedidos}`}
            subtitle="Volume de pedidos"
            icon={<TrendingUpIcon />}
            right={<DeltaChip value={comparativos.hoje.dPedidos} />}
          />

          <KpiCard
            title="Hoje vs Ontem (Faturamento)"
            value={`${brl(comparativos.hoje.curValor)} vs ${brl(comparativos.hoje.prevValor)}`}
            subtitle="Receita"
            icon={<PaidIcon />}
            right={<DeltaChip value={comparativos.hoje.dValor} />}
          />

          <KpiCard
            title="Semana vs Anterior (Pedidos)"
            value={`${comparativos.semana.curPedidos} vs ${comparativos.semana.prevPedidos}`}
            subtitle="Comparativo semanal"
            icon={<TrendingUpIcon />}
            right={<DeltaChip value={comparativos.semana.dPedidos} />}
          />

          <KpiCard
            title="Item mais pedido"
            value={itemMaisPedido ? itemMaisPedido.nome : "—"}
            subtitle={itemMaisPedido ? `${itemMaisPedido.qtd} un • ${brl(itemMaisPedido.valor)}` : "Sem itens no filtro"}
            icon={<WhatshotIcon />}
          />
        </ResponsiveKpis>

        <Box sx={{ height: 14 }} />

        {/* FILTROS (melhor UX: recolhível + chips removíveis) */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            bgcolor: movyo.card,
            border: `1px solid ${movyo.border}`,
            mb: 2,
            overflow: "hidden",
          }}
        >
          <Accordion
            elevation={0}
            disableGutters
            expanded={filtrosAbertos}
            onChange={() => setFiltrosAbertos((s) => !s)}
            sx={{ "&:before": { display: "none" } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }} gap={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TuneIcon sx={{ color: movyo.primary }} />
                  <Typography sx={{ fontWeight: 950, color: movyo.text }}>Filtros</Typography>
                  <Chip
                    size="small"
                    label={`${pedidosFiltrados.length} resultado(s)`}
                    sx={{ fontWeight: 900, bgcolor: "rgba(8,51,88,0.06)", color: movyo.primary }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip label="Hoje" onClick={() => aplicarPreset("hoje")} clickable variant="outlined" sx={{ fontWeight: 900 }} />
                  <Chip label="7 dias" onClick={() => aplicarPreset("7d")} clickable variant="outlined" sx={{ fontWeight: 900 }} />
                  <Chip label="30 dias" onClick={() => aplicarPreset("30d")} clickable variant="outlined" sx={{ fontWeight: 900 }} />
                  <Chip label="Mês atual" onClick={() => aplicarPreset("mes_atual")} clickable variant="outlined" sx={{ fontWeight: 900 }} />
                </Stack>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              <Divider sx={{ mb: 2 }} />

              {chipsAtivos.length > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                  {chipsAtivos.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      onDelete={() => removerChip(c.key)}
                      variant="outlined"
                      sx={{ fontWeight: 900 }}
                    />
                  ))}
                </Stack>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "1fr 1fr",
                    md: "2fr 1fr 1fr 1fr 1fr 1fr",
                  },
                  gap: 2,
                }}
              >
                <TextField
                  fullWidth
                  label="Buscar (cliente, número, telefone, endereço, bairro, CEP)"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel id="status-label">Status</InputLabel>
                  <Select
                    labelId="status-label"
                    value={filtroStatus}
                    label="Status"
                    onChange={(e) => setFiltroStatus(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="aguardando_pagamento">Aguardando pagamento</MenuItem>
                    <MenuItem value="pago">Pago</MenuItem>
                    <MenuItem value="em_producao">Em produção</MenuItem>
                    <MenuItem value="em_entrega">Em entrega</MenuItem>
                    <MenuItem value="em_rota">Em rota</MenuItem>
                    <MenuItem value="entregue">Entregue</MenuItem>
                    <MenuItem value="cancelado">Cancelado</MenuItem>
                    <MenuItem value="aguardando_resposta">Aguardando resposta</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="entregador-label">Entregador</InputLabel>
                  <Select
                    labelId="entregador-label"
                    value={filtroEntregador}
                    label="Entregador"
                    onChange={(e) => setFiltroEntregador(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {entregadores.map((e) => (
                      <MenuItem key={e._id} value={e._id}>
                        {e.nome}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Data início"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  fullWidth
                  label="Data fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />

                <FormControl fullWidth>
                  <InputLabel id="periodo-label">Agrupar</InputLabel>
                  <Select
                    labelId="periodo-label"
                    value={filtroPeriodo}
                    label="Agrupar"
                    onChange={(e) => setFiltroPeriodo(e.target.value)}
                  >
                    <MenuItem value="diario">Diário</MenuItem>
                    <MenuItem value="semanal">Semanal</MenuItem>
                    <MenuItem value="mensal">Mensal</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }} alignItems="stretch">
                <Button
                  variant="outlined"
                  onClick={limpar}
                  startIcon={<FilterAltOffIcon />}
                  sx={{ fontWeight: 900, borderRadius: 2.5 }}
                  fullWidth
                >
                  Limpar filtros
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setFiltrosAbertos(false)}
                  sx={{ fontWeight: 900, borderRadius: 2.5, bgcolor: movyo.primary, "&:hover": { bgcolor: movyo.primary } }}
                  fullWidth
                >
                  Ver gráficos
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Charts principais */}
        <Responsive2Col
          left={
            <SectionCard
              title="Pedidos por período"
              subtitle={`Agrupado por ${filtroPeriodo}.`}
              right={<Chip size="small" label="Pedidos" sx={{ fontWeight: 900 }} />}
            >
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <ReTooltip />
                    <Bar dataKey="pedidos" fill={movyo.primary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </SectionCard>
          }
          right={
            <SectionCard
              title="Faturamento por período"
              subtitle="Soma do valor real do pedido (valorTotal/total/itens)."
              right={<Chip size="small" label="Receita" sx={{ fontWeight: 900 }} />}
            >
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <ReTooltip formatter={(value) => brl(value)} />
                    <Bar dataKey="valor" fill="rgba(8, 51, 88, 0.55)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </SectionCard>
          }
        />

        <Box sx={{ height: 16 }} />

        <Responsive2Col
          left={
            <SectionCard
              title="Origem dos pedidos"
              subtitle="Distribuição por canal (vitrine/balcão/salão/ifood)."
              right={<Chip icon={<StorefrontIcon />} label="Canais" sx={{ fontWeight: 900 }} />}
            >
              <Divider sx={{ my: 2 }} />

              {origemData.length === 0 ? (
                <Typography variant="body2" sx={{ color: movyo.muted }}>
                  Sem dados para os filtros atuais.
                </Typography>
              ) : (
                <Box sx={{ position: "relative" }}>
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={origemData}
                          dataKey="pedidos"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          label={origemData.length > 1}
                        >
                          {origemData.map((_, idx) => (
                            <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <ReTooltip formatter={(v, n, x) => [`${v} pedidos`, x?.payload?.name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* center hint (melhor leitura quando tem 1 canal dominante) */}
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <Box sx={{ textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 950, color: movyo.text, lineHeight: 1.1 }}>
                        {origemData.reduce((a, b) => a + (b.pedidos || 0), 0)} pedidos
                      </Typography>
                      <Typography variant="caption" sx={{ color: movyo.muted }}>
                        no filtro atual
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, mt: 1.5 }}>
                {origemData.slice(0, 6).map((o) => {
                  const ui = origemUI(o.key);
                  return (
                    <Paper
                      key={o.key}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: `1px solid ${movyo.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: movyo.primary }}>{ui.icon}</Box>
                        <Typography sx={{ fontWeight: 900 }}>{ui.label}</Typography>
                      </Stack>
                      <Stack alignItems="flex-end">
                        <Typography sx={{ fontWeight: 950 }}>{o.pedidos}</Typography>
                        <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 800 }}>
                          {brl(o.valor)}
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            </SectionCard>
          }
          right={
            <SectionCard
              title="Horários de pico"
              subtitle="Heatmap por hora (0–23) com intensidade por volume."
              right={<Chip icon={<LocalFireDepartmentIcon />} label="Pico" sx={{ fontWeight: 900 }} />}
            >
              <Divider sx={{ my: 2 }} />

              <HeatmapHoras bins={heatmapHoras.bins} />

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {heatmapHoras.topHoras.map((h) => (
                  <Chip
                    key={h.hour}
                    icon={<LocalFireDepartmentIcon />}
                    label={`${String(h.hour).padStart(2, "0")}h • ${h.pedidos} pedidos`}
                    sx={{ fontWeight: 900 }}
                  />
                ))}
              </Stack>
            </SectionCard>
          }
        />

        <Box sx={{ height: 16 }} />

        <SectionCard
          title="Vendas por forma de pagamento"
          subtitle="Resumo do período filtrado, separado por dinheiro, PIX, cartão de crédito e cartão de débito. Pedidos cancelados não entram nessa soma."
          right={<Chip icon={<PaidIcon />} label={brl(totalPagamentos)} sx={{ fontWeight: 900 }} />}
        >
          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1.5,
            }}
          >
            {pagamentosData.map((pg) => {
              const percentual = totalPagamentos > 0 ? (toNumberBRL(pg.valor) / totalPagamentos) * 100 : 0;
              return (
                <Paper
                  key={pg.key}
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    border: `1px solid ${movyo.border}`,
                    bgcolor: "rgba(8,51,88,0.025)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 900 }}>
                        {pg.label}
                      </Typography>
                      <Typography sx={{ fontWeight: 950, color: movyo.text, fontSize: 20, lineHeight: 1.2 }}>
                        {brl(pg.valor)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 800 }}>
                        {pg.pedidos} pedido(s) • {percentual.toFixed(1)}% do total
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "rgba(8,51,88,0.08)",
                        color: movyo.primary,
                        flexShrink: 0,
                      }}
                    >
                      <PaidIcon fontSize="small" />
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </SectionCard>

        <Box sx={{ height: 16 }} />

        <Responsive2Col
          left={
            <SectionCard
              title="Top 10 produtos (quantidade)"
              subtitle="Soma de quantidades nos itens."
              right={<Chip size="small" label="Qtd" sx={{ fontWeight: 900 }} />}
            >
              <Box sx={{ height: 330, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProdutos.topQtd} layout="vertical" margin={{ left: 30, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Bar dataKey="qtd" fill={movyo.primary} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </SectionCard>
          }
          right={
            <SectionCard
              title="Top 10 produtos (faturamento)"
              subtitle="Soma de precoTotal (ou qtd*precoUnitario)."
              right={<Chip size="small" label="R$" sx={{ fontWeight: 900 }} />}
            >
              <Box sx={{ height: 330, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProdutos.topValor} layout="vertical" margin={{ left: 30, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <ReTooltip formatter={(v) => brl(v)} />
                    <Bar dataKey="valor" fill="rgba(8, 51, 88, 0.55)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </SectionCard>
          }
        />

        <Box sx={{ height: 16 }} />

        {/* SLA entregadores */}
        <SectionCard
          title="SLA (tempo médio até “entregue”) por entregador"
          subtitle="Aproximação: updatedAt - criadoEm nos pedidos entregues."
          right={<Chip icon={<TimerIcon />} label="SLA" sx={{ fontWeight: 900 }} />}
        >
          <Divider sx={{ my: 2 }} />

          {slaEntregadores.length === 0 ? (
            <Typography variant="body2" sx={{ color: movyo.muted }}>
              Não há pedidos “entregues” nos filtros atuais.
            </Typography>
          ) : (
            <Box sx={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaEntregadores} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <ReTooltip formatter={(v) => `${Number(v).toFixed(1)} min`} />
                  <Bar dataKey="mediaMin" fill={movyo.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </SectionCard>

        <Box sx={{ height: 16 }} />

        {/* DETALHES */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: movyo.card,
            border: `1px solid ${movyo.border}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} gap={2} flexWrap="wrap">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 950, color: movyo.text }}>
                Detalhes dos pedidos
              </Typography>
              <Typography variant="caption" sx={{ color: movyo.muted }}>
                {pedidosFiltrados.length} encontrado(s) no filtro atual
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={filtrosAbertos ? "Filtros abertos" : "Filtros recolhidos"}
                variant="outlined"
                sx={{ fontWeight: 900 }}
              />
            </Stack>
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {pedidosFiltrados.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <Typography sx={{ fontWeight: 950, color: movyo.text }}>Nenhum pedido encontrado</Typography>
              <Typography variant="body2" sx={{ color: movyo.muted, mt: 0.5 }}>
                Tente remover filtros ou ajustar o período.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<FilterAltOffIcon />}
                sx={{ mt: 2, fontWeight: 900, borderRadius: 2.5 }}
                onClick={limpar}
              >
                Limpar filtros
              </Button>
            </Box>
          ) : (
            pedidosFiltrados.map((pedido, index) => {
              const s = statusUI(normalizarStatusPedido(pedido));
              const o = origemUI(pedido.origem);
              const valor = getPedidoTotal(pedido);

              return (
                <Accordion
                  key={pedido._id || index}
                  disableGutters
                  elevation={0}
                  sx={{
                    border: `1px solid ${movyo.border}`,
                    borderRadius: 2,
                    mb: 1.25,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ width: "100%" }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        sx={{ width: "100%" }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip label={`#${safeText(pedido.numeroPedido || "—")}`} sx={{ fontWeight: 900 }} />

                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ color: movyo.primary }}>{o.icon}</Box>
                            <Typography sx={{ fontWeight: 950, color: movyo.text }}>
                              {pedido.nomeCliente || "Cliente"}
                            </Typography>
                          </Stack>

                          <Chip label={s.label} color={s.color} size="small" sx={{ fontWeight: 900 }} />

                          {pedido.statusPagamento ? (
                            <Chip
                              label={`Pag: ${safeText(pedido.statusPagamento)}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 900 }}
                            />
                          ) : null}
                        </Stack>

                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Typography sx={{ fontWeight: 950, color: movyo.primary }}>{brl(valor)}</Typography>
                          <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 800 }}>
                            {dayjs(getCreatedDate(pedido)).format("DD/MM/YYYY HH:mm")}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ bgcolor: "rgba(8,51,88,0.02)" }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2">
                          <strong>Endereço:</strong> {pedido.enderecoCliente || "Não informado"}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Telefone:</strong> {pedido.telefoneCliente || "—"}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Pagamento:</strong> {getFormaPagamento(pedido) || "—"}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Origem:</strong> {o.label}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Entregador:</strong> {pedido.entregador?.nome || "Não atribuído"}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Mesa:</strong> {pedido.mesaId ? safeText(pedido.mesaId) : "—"}
                        </Typography>
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1 }}>
                          Itens
                        </Typography>

                        <Box component="ul" sx={{ pl: 2, m: 0 }}>
                          {(pedido.itens || []).map((item, idx) => {
                            const qtd = Number(item.quantidade || 1);
                            const unit = getItemUnitario(item);
                            const totalItem = getItemTotal(item);

                            return (
                              <Paper
                                component="li"
                                key={idx}
                                elevation={0}
                                sx={{
                                  listStyle: "none",
                                  mb: 1,
                                  p: 1.25,
                                  borderRadius: 2,
                                  border: `1px solid ${movyo.border}`,
                                  bgcolor: "#fff",
                                }}
                              >
                                <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 950, color: movyo.text }}>
                                      {safeText(item.nome || "Item")}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: movyo.muted, fontWeight: 800 }}>
                                      {qtdLabel(qtd)}x {brl(unit)}
                                    </Typography>
                                  </Box>

                                  <Chip
                                    size="small"
                                    label={brl(totalItem)}
                                    sx={{ fontWeight: 950, bgcolor: "rgba(8,51,88,0.06)", color: movyo.primary }}
                                  />
                                </Stack>

                                {item.categoriaType || item.observacao ? (
                                  <Typography variant="caption" sx={{ color: movyo.muted, display: "block", mt: 0.5 }}>
                                    {item.categoriaType ? `Categoria: ${safeText(item.categoriaType)}` : ""}
                                    {item.observacao ? ` • Obs: ${safeText(item.observacao)}` : ""}
                                  </Typography>
                                ) : null}
                              </Paper>
                            );
                          })}
                        </Box>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </Paper>
      </Box>
    </Box>
  );
}
