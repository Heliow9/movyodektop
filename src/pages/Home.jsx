// src/pages/Home.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Chip,
  Tooltip,
  IconButton,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
  Paper,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  Fade,
} from "@mui/material";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PrintIcon from "@mui/icons-material/Print";
import LogoutIcon from "@mui/icons-material/Logout";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import SettingsIcon from "@mui/icons-material/Settings";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import PaidIcon from "@mui/icons-material/Paid";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useDrop, useDrag } from "react-dnd";
import { Howl } from "howler";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import QRCode from "react-qr-code";

import { usePedidos } from "../contexts/PedidosContext";
import { enviarParaImpressao, enviarParaImpressaoCozinha } from "../utils/enviarImpressao";
import useHorarioFuncionamento from "../hooks/useHorarioFuncionamento";
import { fetchMe, fetchPedidos, fetchCaixaAtual } from "../services/api";
import { createSocket } from "../services/sockets";
import { verificarStatusBot, ligarBot, desligarBot, obterQrBot } from "../services/bot";
import { resolveLogoUrl } from "../utils/resolveAssetUrl";
import { getPedidoCreatedMs, getPedidoTimerStartMs } from "../utils/dateTime";

// ✅ NOVO: modal do balcão separado
import PedidoBalcaoModal from "../components/PedidoBalcaoModal";
import LicenseStatusCard from "../components/LicenseStatusCard";
import { getLicenseInfo, normalizeRestaurantData } from "../utils/licenseInfo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";
const ITEM_TYPE = "PEDIDO";

/* =========================================================
   HELPERS (mantidos só do painel)
========================================================= */

const fmtMMSS = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function getPedidoEtaInfo(pedido, tempoMedioEntregaMin, nowMs) {
  const timerStartMs = getPedidoTimerStartMs(pedido);
  const tMin = Math.max(1, Math.round(Number(tempoMedioEntregaMin || 45)));
  const slaMs = tMin * 60 * 1000;

  if (!Number.isFinite(timerStartMs)) {
    return {
      hasEta: false,
      createdMs: NaN,
      timerStartMs: NaN,
      etaMs: NaN,
      elapsedSec: 0,
      remainingSec: 0,
      progress: 0,
      level: "ok",
    };
  }

  const currentMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const elapsedMs = Math.max(0, currentMs - timerStartMs);
  const etaMs = timerStartMs + slaMs;
  const remainingMs = etaMs - currentMs;

  const progressRaw = elapsedMs / slaMs;
  const progress = clamp01(progressRaw);
  const level = progressRaw >= 1 ? "late" : progressRaw >= 0.5 ? "warn" : "ok";

  return {
    hasEta: true,
    createdMs: getPedidoCreatedMs(pedido),
    timerStartMs,
    etaMs,
    elapsedSec: Math.floor(elapsedMs / 1000),
    remainingSec: Math.floor(remainingMs / 1000),
    progress,
    level,
    progressRaw,
  };
}

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  if (typeof v === "object")
    return String(v.nome || v.title || v.label || v.descricao || "");
  return "";
}
function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
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
    str = last.length === 3 && parts.length > 1 ? parts.join("") : str;
  }

  const n = Number(str);
  return Number.isFinite(n) ? round2(n) : 0;
}
function normKey(v) {
  return safeText(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function normalizarStatusOperacao(p) {
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
function getPedidoTimestamp(p) {
  const ms = getPedidoCreatedMs(p);
  return Number.isFinite(ms) ? ms : 0;
}

function numeroPedidoRank(p) {
  const raw = safeText(p?.numeroPedido || p?.numero || p?.codigo || p?.code);
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
function formatBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatHoraBR(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDateKeyLocal(v = new Date()) {
  const d = v instanceof Date ? v : new Date(v);
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getPedidoCaixaId(p) {
  const cx = p?.caixaSessaoId || p?.caixa_sessao_id || p?.caixaId || p?.caixa?.id || p?.caixa?._id || "";
  return typeof cx === "object" ? String(cx?._id || cx?.id || "") : String(cx || "");
}
function getPedidoDataOperacional(p) {
  return String(p?.dataOperacional || p?.data_operacional || p?.caixa?.dataOperacional || "").slice(0, 10);
}
function getCaixaId(cx) {
  return String(cx?._id || cx?.id || "");
}
function isStatusCancelado(p) {
  return ["cancelado", "cancelada", "canceled"].includes(String(p?.status || "").toLowerCase());
}
function isVendaConfirmada(p) {
  const status = String(p?.status || "").toLowerCase();
  const statusPagamento = String(p?.statusPagamento || p?.pagamento?.status || "").toLowerCase();
  if (isStatusCancelado(p)) return false;
  return (
    statusPagamento === "pago" ||
    ["pago", "em_producao", "em_entrega", "entregue", "concluido", "finalizado"].includes(status)
  );
}
function getItemTotal(it) {
  const qtd = Math.max(1, toNumberBRL(it?.quantidade ?? it?.qtd ?? it?.quantity ?? 1));
  const unit = toNumberBRL(it?.precoUnitario ?? it?.preco ?? it?.valorUnitario ?? it?.valor ?? it?.price ?? 0);
  const total = toNumberBRL(it?.precoTotal ?? it?.total ?? it?.valorTotal ?? it?.subtotal);
  if (total > 0) return round2(total);
  return round2(unit * qtd);
}

function getItemUnit(it) {
  const qtd = Math.max(1, toNumberBRL(it?.quantidade ?? it?.qtd ?? it?.quantity ?? 1));
  const unit = toNumberBRL(it?.precoUnitario ?? it?.preco ?? it?.valorUnitario ?? it?.valor ?? it?.price);
  if (unit > 0) return round2(unit);
  return round2(getItemTotal(it) / qtd);
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
  return round2(itens.reduce((acc, it) => acc + getItemTotal(it), 0));
}

function isItemCozinhaHome(it) {
  const explicit = it?.imprimeNaCozinha ?? it?.imprimir;
  if (explicit === true || explicit === 1 || explicit === "1" || String(explicit).toLowerCase() === "true") return true;

  const cozinhaStatus = it?.cozinha?.status;
  if (cozinhaStatus && !["entregue_mesa", "entregue_cliente", "cancelado"].includes(String(cozinhaStatus).toLowerCase())) return true;

  const cat = String(it?.categoriaType || it?.categoriaTipo || it?.categoria?.tipo || "").toLowerCase();
  if (cat === "cozinha") return true;

  const naoCozinha = ["bebida", "bebidas", "drink", "drinks", "refrigerante", "refri", "agua", "água", "suco", "sobremesa_pronta"];
  const nome = String(it?.nome || "").toLowerCase();
  if (naoCozinha.some((k) => cat.includes(k) || nome.includes(k))) return false;

  return false;
}

function pedidoTemItensCozinha(pedido) {
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return itens.some(isItemCozinhaHome);
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function pedidoCode(pedido) {
  const num = pedido?.numeroPedido || pedido?.numero;
  if (num != null) return String(num);
  const id = pedido?._id || pedido?.id || "";
  return id ? String(id).slice(-6) : "—";
}
function getPedidoOrigem(pedido) {
  return String(pedido?.origem || pedido?.tipo || "").trim().toLowerCase();
}

function isPedidoVitrine(pedido) {
  const origem = getPedidoOrigem(pedido);
  return ["vitrine", "delivery", "site", "web"].includes(origem);
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
  return (
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

function authHeaders() {
  const token =
    localStorage.getItem("_token") || localStorage.getItem("tokenRestaurante") || "";
  const t = String(token || "").trim();
  if (!t) return {};
  const bearer = t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  return { Authorization: bearer };
}

function formatPedidoServidor(p) {
  // ✅ IMPORTANTE: origem/numeroPedido/mesaNumero agora entram no frontend
  const numeroPedido = p?.numeroPedido || p?.numero || "";
  const mesaNumero =
    p?.mesaNumero || p?.numeroMesa || p?.mesa?.numero || p?.mesa?.nome || "";
  const statusNormalizado = normalizarStatusOperacao(p);
  const valorTotalNormalizado = getPedidoTotal(p);

  return {
    ...p,
    id: p._id || p.id,
    origem: p?.origem || "",
    numeroPedido,
    mesaNumero,

    nome: `Pedido #${numeroPedido || p?._id?.slice?.(-4) || p?.id?.slice?.(-4) || ""}`,
    status: statusNormalizado,
    statusPagamento: p.statusPagamento || "",
    caixaSessaoId: p.caixaSessaoId || p.caixa_sessao_id || p.caixaId || p.caixa?.id || p.caixa?._id || "",
    dataOperacional: p.dataOperacional || p.data_operacional || p.caixa?.dataOperacional || "",
    cliente: p.nomeCliente || "Cliente",
    telefone: p.telefoneCliente || "",
    formaPagamento: p.formaPagamento || p.metodoPagamento || p?.pagamento?.forma || "",
    vendedorNome:
      p.vendedorNome ||
      p.nomeVendedor ||
      p.garcomNome ||
      p.nomeGarcom ||
      p.usuarioNome ||
      p.criadoPorNome ||
      p?.vendedor?.nome ||
      p?.garcom?.nome ||
      p?.usuario?.nome ||
      "",
    enderecoCliente: p.enderecoCliente || "",
    residenciaNumero: p.residenciaNumero || "",
    residenciaBairro: p.residenciaBairro || "",
    residenciaReferencia: p.residenciaReferencia || "",
    itens: (p.itens || []).map((i) => ({
      nome: i.nome || i.titulo || i.title || i.descricao || "Item",
      quantidade: Number(i.quantidade ?? i.qtd ?? i.quantity ?? 1) || 1,
      precoUnitario: getItemUnit(i),
      precoTotal: getItemTotal(i),
      saboresSelecionados: i.saboresSelecionados || [],
      bordaSelecionada: i.bordaSelecionada || null,
      adicionalSelecionado: i.adicionalSelecionado || null,
      complementosSelecionados: i.complementosSelecionados || [],
      tiposExtrasSelecionados: i.tiposExtrasSelecionados || {},
      observacao: i.observacao || "",
      imagem: i.imagem || "",
      produtoId: i.produtoId || i.produto || i._id || "",
      categoriaType: i.categoriaType || i.categoriaTipo || "",
      imprimeNaCozinha: i.imprimeNaCozinha ?? i.imprimir ?? false,
      cozinha: i.cozinha || null,
    })),
    total: valorTotalNormalizado,
    valorTotal: valorTotalNormalizado,
    criadoEm: p?.criadoEm || p?.createdAt || p?.created_at || p?.dataCriacao,
    updatedAt: p?.updatedAt || p?.updated_at,
  };
}

/* -----------------------------------------------------------
KPI CARD
----------------------------------------------------------- */
const KpiCard = ({ title, value, subtitle = "Atualizado agora", accent = "#ff3b8a", icon = null, onClick }) => (
  <Paper
    elevation={3}
    sx={{
      position: "relative",
      borderRadius: 2.75,
      px: { xs: 1.35, sm: 1.55 },
      py: { xs: 1.15, sm: 1.25 },
      overflow: "hidden",
      background: "rgba(255,255,255,0.96)",
      border: "1px solid rgba(148,163,184,0.35)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      cursor: onClick ? "pointer" : "default",
      transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
      "&:hover": onClick ? {
        transform: "translateY(-2px)",
        boxShadow: "0 14px 34px rgba(15,23,42,0.14)",
        borderColor: `${accent}55`,
      } : undefined,
      gap: 0.35,
      minHeight: { xs: 82, sm: 88 },
      width: "100%",
      minWidth: 0,
      maxWidth: "100%",
      boxSizing: "border-box",
    }}
    onClick={onClick}
  >
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: 2,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
      }}
    />
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: "clamp(0.58rem, 0.72vw, 0.68rem)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "#6b7280",
          fontWeight: 700,
        }}
      >
        {title}
      </Typography>
      {icon && <Box sx={{ color: accent, display: "flex", opacity: .92 }}>{icon}</Box>}
    </Box>
    <Typography
      sx={{
        fontSize: "clamp(1.08rem, 1.8vw, 1.42rem)",
        fontWeight: 900,
        color: "#0f172a",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={String(value ?? "")}
    >
      {value}
    </Typography>
    <Typography
      variant="caption"
      sx={{
        color: "#9ca3af",
        mt: 0.05,
        fontSize: "clamp(0.64rem, 0.82vw, 0.74rem)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}
      title={String(subtitle || "")}
    >
      {subtitle}
    </Typography>
  </Paper>
);

/* -----------------------------------------------------------
Pedido Card / Colunas
----------------------------------------------------------- */
const PedidoCard = ({
  pedido,
  status,
  onAvancar,
  finalizarEntrega,
  onImprimir,
  onImprimirCozinha,
  onOpenDetails,
  onEscolherAvanco,
  tempoMedioEntregaMin = 45,
  nowMs,
}) => {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: ITEM_TYPE,
      item: { id: pedido.id, fromStatus: status },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [pedido, status]
  );

  const statusLabelMap = {
    pago: "Recebido",
    em_producao: "Em produção",
    em_entrega: "Em entrega",
  };

  const eta = useMemo(
    () => getPedidoEtaInfo(pedido, tempoMedioEntregaMin, nowMs),
    [pedido, tempoMedioEntregaMin, nowMs]
  );

  const etaUi = useMemo(() => {
    if (!eta?.hasEta) {
      return {
        border: "1px solid rgba(148,163,184,0.35)",
        chipBg: "rgba(2,6,23,0.06)",
        chipColor: "#0f172a",
        label: "—",
      };
    }

    const elapsed = fmtDuration(eta.elapsedSec);

    if (eta.level === "late") {
      return {
        border: "1px solid rgba(239,68,68,0.55)",
        chipBg: "rgba(239,68,68,0.18)",
        chipColor: "#991b1b",
        label: `${elapsed}`,
      };
    }

    if (eta.level === "warn") {
      return {
        border: "1px solid rgba(245,158,11,0.55)",
        chipBg: "rgba(245,158,11,0.20)",
        chipColor: "#92400e",
        label: `${elapsed}`,
      };
    }

    return {
      border: "1px solid rgba(148,163,184,0.35)",
      chipBg: "rgba(2,6,23,0.06)",
      chipColor: "#0f172a",
      label: `${elapsed}`,
    };
  }, [eta]);

  const statusColorMap = {
    pago: "#0f766e",
    em_producao: "#2563eb",
    em_entrega: "#ea580c",
  };

  const handleOpen = () => onOpenDetails?.(pedido);

  const podeEnviarEntrega = isPedidoVitrine(pedido);

  const labelAvancar = useMemo(() => {
    if (status === "pago") return "Produção";
    if (status === "em_producao") return podeEnviarEntrega ? "Entrega" : "Avançar";
    return "Avançar";
  }, [status, podeEnviarEntrega]);

  return (
    <Paper
      ref={dragRef}
      elevation={2}
      onClick={handleOpen}
      sx={{
        mb: 1.4,
        borderRadius: 2.5,
        p: 1.35,
        backgroundColor: "#ffffff",
        boxShadow: isDragging
          ? "0 0 0 2px rgba(59,130,246,0.6)"
          : "0 5px 16px rgba(15,23,42,0.08)",
        opacity: isDragging ? 0.7 : 1,
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
        },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#0f172a" }} noWrap>
            {pedido.nome}
          </Typography>
          <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 600 }} noWrap>
            {pedido.cliente}
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 700, display: "block" }} noWrap>
            {getFormaPagamentoLabel(pedido)}{getVendedorNome(pedido) ? ` • ${getVendedorNome(pedido)}` : ""}
          </Typography>
        </Box>

        <Box
          textAlign="right"
          sx={{
            pl: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0.6,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#111827" }}>
            {formatBRL(pedido.total || 0)}
          </Typography>

          <Chip
            size="small"
            icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
            label={etaUi.label}
            onClick={(e) => e.stopPropagation()}
            sx={{
              height: 20,
              fontSize: "0.7rem",
              borderRadius: 999,
              bgcolor: etaUi.chipBg,
              color: etaUi.chipColor,
              fontWeight: 900,
              border: etaUi.border,
            }}
          />

          <Chip
            size="small"
            label={statusLabelMap[pedido.status] || pedido.status}
            onClick={(e) => e.stopPropagation()}
            sx={{
              height: 20,
              fontSize: "0.7rem",
              borderRadius: 999,
              bgcolor: `${statusColorMap[pedido.status] || "#6b7280"}15`,
              color: statusColorMap[pedido.status] || "#374151",
              fontWeight: 700,
            }}
          />
        </Box>
      </Box>

      {pedido.enderecoCliente && (
        <Typography
          variant="caption"
          sx={{ color: "#6b7280", display: "block", mb: 0.6 }}
          noWrap
          title={pedido.enderecoCliente}
        >
          {pedido.enderecoCliente}
        </Typography>
      )}

      {(pedido.itens || []).length > 0 && (
        <Box sx={{ mt: 0.6, display: "flex", flexDirection: "column", gap: 0.35 }}>
          {pedido.itens.slice(0, 4).map((i, idx) => {
            const lineTotal = getItemTotal(i);
            return (
              <Box key={idx} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "#6b7280", fontWeight: 700 }}
                  noWrap
                  title={i.nome}
                >
                  {Math.max(1, Number(i.quantidade || 1))}x {i.nome}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#111827", fontWeight: 800, whiteSpace: "nowrap" }}
                >
                  {formatBRL(lineTotal)}
                </Typography>
              </Box>
            );
          })}

          {pedido.itens.length > 4 && (
            <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 700 }}>
              + {pedido.itens.length - 4} item(ns)…
            </Typography>
          )}
        </Box>
      )}

      <Box mt={1.1} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" gap={1} sx={{ flexWrap: "wrap" }}>
          {onImprimir && (
            <Chip
              size="small"
              label="Imprimir"
              onClick={(e) => {
                e.stopPropagation();
                onImprimir(pedido);
              }}
              sx={{
                borderRadius: 999,
                fontSize: "0.7rem",
                bgcolor: "rgba(15,23,42,0.04)",
                fontWeight: 700,
              }}
            />
          )}

          {status === "em_producao" && onImprimirCozinha && (
            <Chip
              size="small"
              label="Cozinha"
              onClick={(e) => {
                e.stopPropagation();
                onImprimirCozinha(pedido);
              }}
              sx={{
                borderRadius: 999,
                fontSize: "0.7rem",
                bgcolor: "#fff7ed",
                color: "#9a3412",
                fontWeight: 800,
              }}
            />
          )}

          {onAvancar && (
            <Chip
              size="small"
              label={labelAvancar}
              onClick={(e) => {
                e.stopPropagation();
                if (status === "em_producao" && !isPedidoVitrine(pedido) && onEscolherAvanco) {
                  onEscolherAvanco(pedido);
                } else {
                  onAvancar(pedido);
                }
              }}
              sx={{
                borderRadius: 999,
                fontSize: "0.7rem",
                bgcolor: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 800,
              }}
            />
          )}
        </Box>

        {finalizarEntrega && status === "em_entrega" && (
          <Chip
            size="small"
            label="Finalizar"
            color="success"
            onClick={(e) => {
              e.stopPropagation();
              finalizarEntrega(pedido);
            }}
            sx={{ borderRadius: 999, fontSize: "0.7rem", fontWeight: 800 }}
          />
        )}
      </Box>
    </Paper>
  );
};

const ColunaPedidos = ({
  title,
  status,
  pedidos,
  onDrop,
  onAvancar,
  finalizarEntrega,
  color,
  disableDrop,
  loading,
  onImprimir,
  onImprimirCozinha,
  onOpenDetails,
  onEscolherAvanco,
  tempoMedioEntregaMin,
  nowMs,
}) => {
  const [{ isOver, canDrop }, dropRef] = useDrop(
    () => ({
      accept: ITEM_TYPE,
      canDrop: (item) => !disableDrop && item.fromStatus !== status,
      drop: (item) => {
        if (!disableDrop && item?.id) onDrop(item.id, status);
      },
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    }),
    [status, disableDrop, onDrop]
  );

  const highlight = isOver && canDrop;

  return (
    <Paper
      ref={dropRef}
      elevation={highlight ? 8 : 3}
      sx={{
        flex: 1,
        borderRadius: 3,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.15s ease",
        border: highlight
          ? "1px solid rgba(59,130,246,0.8)"
          : "1px solid rgba(148,163,184,0.35)",
        backgroundColor: "#f9fafb",
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.15,
          background: `linear-gradient(135deg, ${color}, #ffffff)`,
          borderBottom: "1px solid rgba(148,163,184,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#0f172a" }}>
          {title}
        </Typography>

        <Chip
          size="small"
          label={`${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""}`}
          sx={{
            borderRadius: 999,
            fontSize: "0.7rem",
            bgcolor: "rgba(15,23,42,0.05)",
            fontWeight: 800,
          }}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          p: 1.35,
          overflowY: "auto",
          maxHeight: "calc(100vh - 320px)",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { background: "rgba(148,163,184,0.7)", borderRadius: 999 },
        }}
      >
        {loading && (
          <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={22} />
          </Box>
        )}

        {!loading && pedidos.length === 0 && (
          <Typography variant="caption" sx={{ color: "#9ca3af", fontStyle: "italic" }}>
            Nenhum pedido aqui ainda.
          </Typography>
        )}

        {!loading &&
          pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              status={status}
              onAvancar={onAvancar}
              finalizarEntrega={finalizarEntrega}
              onImprimir={onImprimir}
              onImprimirCozinha={onImprimirCozinha}
              onOpenDetails={onOpenDetails}
              onEscolherAvanco={onEscolherAvanco}
              tempoMedioEntregaMin={tempoMedioEntregaMin}
              nowMs={nowMs}
            />
          ))}
      </Box>
    </Paper>
  );
};

/* -----------------------------------------------------------
Modal detalhes (mantido do seu código)
----------------------------------------------------------- */
function ModalDetalhesPedido({
  open,
  onClose,
  pedido,
  onImprimir,
  onImprimirCozinha,
  onAvancar,
  onFinalizar,
  tempoMedioEntregaMin = 45,
  nowMs,
}) {
  if (!pedido) return null;

  const statusLabelMap = {
    pago: "Recebido",
    em_producao: "Em produção",
    em_entrega: "Em entrega",
    entregue: "Entregue",
  };

  const statusColorMap = {
    pago: "#0f766e",
    em_producao: "#2563eb",
    em_entrega: "#ea580c",
    entregue: "#16a34a",
  };

  const total = Number(pedido?.total || 0);

  const eta = useMemo(
    () => getPedidoEtaInfo(pedido, tempoMedioEntregaMin, nowMs),
    [pedido, tempoMedioEntregaMin, nowMs]
  );

  const etaUi = useMemo(() => {
    if (!eta?.hasEta) {
      return {
        border: "1px solid rgba(148,163,184,0.35)",
        chipBg: "rgba(2,6,23,0.06)",
        chipColor: "#0f172a",
        label: "—",
        sub: "",
      };
    }

    const elapsed = fmtDuration(eta.elapsedSec);
    const absRem = fmtMMSS(Math.abs(eta.remainingSec));
    const sub = eta.remainingSec >= 0 ? `resta ${absRem}` : `atraso ${absRem}`;

    if (eta.level === "late") {
      return {
        border: "1px solid rgba(239,68,68,0.55)",
        chipBg: "rgba(239,68,68,0.18)",
        chipColor: "#991b1b",
        label: `${elapsed}`,
        sub,
      };
    }

    if (eta.level === "warn") {
      return {
        border: "1px solid rgba(245,158,11,0.55)",
        chipBg: "rgba(245,158,11,0.20)",
        chipColor: "#92400e",
        label: `${elapsed}`,
        sub,
      };
    }

    return {
      border: "1px solid rgba(148,163,184,0.35)",
      chipBg: "rgba(2,6,23,0.06)",
      chipColor: "#0f172a",
      label: `${elapsed}`,
      sub,
    };
  }, [eta]);

  const btnIconFixSx = {
    fontWeight: 950,
    borderRadius: 2.2,
    textTransform: "none",
    px: 1.4,
    minHeight: 40,
    "& .MuiButton-startIcon": { mr: 0.9, ml: -0.2 },
    "& .MuiSvgIcon-root": { fontSize: 18 },
  };

  const closeIfBackdropOk = (_, reason) => {
    if (reason === "backdropClick") return;
    onClose?.();
  };

  const podeEnviarEntrega = isPedidoVitrine(pedido);

  const labelAvancar = useMemo(() => {
    if (pedido?.status === "pago") return "Enviar p/ produção";
    if (pedido?.status === "em_producao") return podeEnviarEntrega ? "Enviar p/ entrega" : "Escolher saída";
    return "Avançar";
  }, [pedido?.status, podeEnviarEntrega]);

  return (
    <Dialog
      open={open}
      onClose={closeIfBackdropOk}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      PaperProps={{
        sx: { borderRadius: 3, overflow: "hidden", maxHeight: "78vh" },
      }}
    >
      <DialogTitle
        sx={{
          py: 1.4,
          px: 1.8,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          bgcolor: "rgba(255,255,255,0.98)",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={950} sx={{ lineHeight: 1.1 }} noWrap>
            {pedido?.nome || `Pedido #${pedidoCode(pedido)}`}
          </Typography>

          <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mt: 0.9, alignItems: "center" }}>
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={etaUi.label}
              onClick={(e) => e.stopPropagation()}
              sx={{
                height: 20,
                fontSize: "0.7rem",
                borderRadius: 999,
                bgcolor: etaUi.chipBg,
                color: etaUi.chipColor,
                fontWeight: 900,
                border: etaUi.border,
              }}
            />

            {eta?.hasEta && etaUi.sub ? (
              <Typography
                variant="caption"
                sx={{ color: etaUi.chipColor, fontWeight: 900, whiteSpace: "nowrap" }}
              >
                {etaUi.sub}
              </Typography>
            ) : null}

            <Chip
              size="small"
              label={`Total: ${formatBRL(total)}`}
              sx={{
                borderRadius: 999,
                fontWeight: 900,
                bgcolor: "rgba(2,6,23,0.06)",
                height: 24,
              }}
            />

            <Chip
              size="small"
              label={`Pagamento: ${getFormaPagamentoLabel(pedido)}`}
              sx={{
                borderRadius: 999,
                fontWeight: 900,
                bgcolor: "rgba(34,197,94,0.12)",
                color: "#166534",
                height: 24,
              }}
            />

            {getVendedorNome(pedido) ? (
              <Chip
                size="small"
                label={`Vendedor: ${getVendedorNome(pedido)}`}
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                  bgcolor: "rgba(59,130,246,0.10)",
                  color: "#1d4ed8",
                  height: 24,
                }}
              />
            ) : null}

            <Chip
              size="small"
              label={statusLabelMap[pedido?.status] || String(pedido?.status || "—")}
              sx={{
                borderRadius: 999,
                height: 24,
                fontWeight: 900,
                bgcolor: `${statusColorMap[pedido?.status] || "#6b7280"}15`,
                color: statusColorMap[pedido?.status] || "#374151",
              }}
            />

            {!!pedido?.telefone && (
              <Chip
                size="small"
                label={onlyDigits(pedido.telefone)}
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                  bgcolor: "rgba(2,6,23,0.06)",
                  height: 24,
                }}
              />
            )}
          </Box>
        </Box>

        <IconButton onClick={onClose} size="small" sx={{ mt: -0.2 }}>
          ✕
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent
        dividers
        sx={{
          px: 1.6,
          py: 1.5,
          bgcolor: "rgba(2,6,23,0.02)",
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3,
            p: 1.4,
            mb: 1.2,
            bgcolor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <Typography fontWeight={950} sx={{ mb: 0.6 }}>
            Cliente
          </Typography>

          <Typography fontWeight={900} sx={{ color: "#0f172a", lineHeight: 1.15 }}>
            {pedido?.cliente || "—"}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: "#64748b",
              mt: 0.35,
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              lineHeight: 1.35,
            }}
          >
            {[
              pedido?.enderecoCliente,
              pedido?.residenciaNumero ? `Nº ${pedido?.residenciaNumero}` : "",
              pedido?.residenciaBairro ? `Bairro ${pedido?.residenciaBairro}` : "",
              pedido?.residenciaReferencia ? `Ref: ${pedido?.residenciaReferencia}` : "",
            ]
              .filter(Boolean)
              .join(" • ") || "—"}
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3,
            p: 1.4,
            bgcolor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography fontWeight={950}>Itens</Typography>
            <Chip
              size="small"
              label={pedido?.itens?.length || 0}
              sx={{ borderRadius: 999, fontWeight: 950, bgcolor: "rgba(2,6,23,0.06)" }}
            />
          </Box>

          <Stack spacing={1}>
            {(pedido?.itens || []).map((it, idx) => {
              const qtd = Math.max(1, Number(it?.quantidade || 1));
              const lineTotal = getItemTotal(it);

              return (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.6,
                    p: 1.2,
                    border: "1px solid rgba(148,163,184,0.35)",
                    bgcolor: "#fff",
                  }}
                >
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1.2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={950} sx={{ lineHeight: 1.15, whiteSpace: "normal" }}>
                        {qtd}x {it?.nome || "Item"}
                      </Typography>

                      {!!safeText(it?.observacao) && (
                        <Box
                          sx={{
                            mt: 0.55,
                            px: 1,
                            py: 0.7,
                            borderRadius: 2,
                            bgcolor: "#fff7ed",
                            border: "1px solid #fed7aa",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#7c2d12",
                              fontWeight: 900,
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            Obs: {safeText(it.observacao)}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Typography fontWeight={950} sx={{ whiteSpace: "nowrap", color: "#0f172a" }}>
                      {formatBRL(lineTotal)}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      </DialogContent>

      <DialogActions
        sx={{
          px: 1.6,
          py: 1.3,
          bgcolor: "rgba(255,255,255,0.98)",
          borderTop: "1px solid rgba(148,163,184,0.35)",
          gap: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Button onClick={onClose} variant="outlined" sx={{ ...btnIconFixSx, px: 1.2 }}>
          Fechar
        </Button>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: "stretch", width: { xs: "100%", sm: "auto" } }}
        >
          {!!onImprimirCozinha && (
            <Button
              onClick={() => onImprimirCozinha(pedido)}
              variant="outlined"
              startIcon={<PrintIcon />}
              sx={btnIconFixSx}
              fullWidth
            >
              Imprimir cozinha
            </Button>
          )}

          {!!onImprimir && (
            <Button
              onClick={() => onImprimir(pedido)}
              variant="outlined"
              startIcon={<PrintIcon />}
              sx={btnIconFixSx}
              fullWidth
            >
              Imprimir balcão
            </Button>
          )}

          {!!onAvancar && pedido?.status !== "entregue" && (
            <Button
              onClick={() => onAvancar(pedido)}
              variant="contained"
              sx={{
                ...btnIconFixSx,
                background: "#2563eb",
                "&:hover": { background: "#1d4ed8" },
              }}
              fullWidth
            >
              {labelAvancar}
            </Button>
          )}

          {!!onFinalizar && pedido?.status === "em_entrega" && (
            <Button
              onClick={() => onFinalizar(pedido)}
              variant="contained"
              color="success"
              sx={{ ...btnIconFixSx }}
              fullWidth
            >
              Finalizar
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { pedidos, setPedidos } = usePedidos();

  const [stats, setStats] = useState([
    { title: "Pedidos Hoje", value: 0, accent: "#ff3b8a" },
    { title: "Motoqueiros Online", value: 0, accent: "#6366f1" },
    { title: "Concluídos Hoje", value: 0, accent: "#22c55e" },
    { title: "Total de Ontem", value: 0, accent: "#f97316" },
  ]);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [botAtivado, setBotAtivado] = useState(false);
  const [botConectado, setBotConectado] = useState(false);
  const [botQrOpen, setBotQrOpen] = useState(false);
  const [botQr, setBotQr] = useState("");
  const [botQrLoading, setBotQrLoading] = useState(false);

  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [restauranteId, setRestauranteId] = useState("");
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [caixaAtual, setCaixaAtual] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [restauranteDados, setRestauranteDados] = useState({});

  const [autoImprimir, setAutoImprimir] = useState(() => localStorage.getItem("autoImprimir") === "true");
  const [pedidoDetalheOpen, setPedidoDetalheOpen] = useState(false);
  const [pedidoDetalhe, setPedidoDetalhe] = useState(null);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [tempoMedioEntregaMin, setTempoMedioEntregaMin] = useState(45);

  // ✅ agora só controlamos open/close aqui (o resto está no componente separado)
  const [modalBalcaoOpen, setModalBalcaoOpen] = useState(false);
  const [avancoDialogOpen, setAvancoDialogOpen] = useState(false);
  const [pedidoAvanco, setPedidoAvanco] = useState(null);

  const licenseInfo = useMemo(
    () => getLicenseInfo(restauranteDados, new Date(nowTick)),
    [restauranteDados, nowTick]
  );

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleImprimirCozinha = useCallback(
    (pedido) =>
      enviarParaImpressaoCozinha(pedido, {
        restauranteId,
        nomeRestaurante,
        logoUrl,
      }),
    [restauranteId, nomeRestaurante, logoUrl]
  );

  const abrirDetalhesPedido = useCallback((p) => {
    setPedidoDetalhe(p);
    setPedidoDetalheOpen(true);
  }, []);

  const fecharDetalhesPedido = useCallback(() => {
    setPedidoDetalheOpen(false);
    setTimeout(() => setPedidoDetalhe(null), 150);
  }, []);

  const autoImprimirRef = useRef(autoImprimir);
  const autoPrintPedidosRef = useRef(new Set());
  useEffect(() => {
    autoImprimirRef.current = autoImprimir;
  }, [autoImprimir]);

  const deveAutoImprimirPedido = useCallback((pedido) => {
    if (!autoImprimirRef.current || !pedido?.id) return false;
    if (autoPrintPedidosRef.current.has(pedido.id)) return false;

    const origem = String(pedido.origem || "").toLowerCase();
    const status = String(pedido.status || "").toLowerCase();
    const statusPagamento = String(pedido.statusPagamento || "").toLowerCase();

    // Balcão/garçom normalmente chega quitado como em_producao + statusPagamento=pago.
    const pago = statusPagamento === "pago" || status === "pago" || status === "em_producao";
    return origem === "balcao" && pago;
  }, []);

  const executarAutoPrintBalcao = useCallback((pedido) => {
    if (window.__MOVYO_GLOBAL_AUTO_PRINT__) return;
    if (!deveAutoImprimirPedido(pedido)) return;
    autoPrintPedidosRef.current.add(pedido.id);
    enviarParaImpressao(pedido, {
      restauranteId,
      nomeRestaurante,
      logoUrl,
      tipoImpressao: "balcao",
    });
  }, [deveAutoImprimirPedido, restauranteId, nomeRestaurante, logoUrl]);

  const pedidosRef = useRef(pedidos);
  useEffect(() => {
    pedidosRef.current = pedidos;
  }, [pedidos]);

  // Mantém o KPI "Concluídos Hoje" responsivo quando um pedido recebe baixa.
  // O pedido entregue sai das colunas, então incrementamos o KPI localmente e
  // evitamos contar duas vezes caso o socket/API confirme o mesmo status depois.
  const concluidosHojeContadosRef = useRef(new Set());
  const incrementarConcluidoHoje = useCallback((pedidoOuId) => {
    const id = typeof pedidoOuId === "string" ? pedidoOuId : (pedidoOuId?.id || pedidoOuId?._id);
    if (!id || concluidosHojeContadosRef.current.has(id)) return;
    concluidosHojeContadosRef.current.add(id);
    setStats((prev) => prev.map((item) =>
      item.title === "Concluídos Hoje"
        ? { ...item, value: Number(item.value || 0) + 1 }
        : item
    ));
  }, []);

  const restauranteIdRef = useRef(restauranteId);
  useEffect(() => {
    restauranteIdRef.current = restauranteId;
  }, [restauranteId]);

  useEffect(() => {
    let alive = true;
    const carregarCaixa = async () => {
      if (!restauranteId) { setCaixaAberto(false); setCaixaAtual(null); return; }
      try {
        const res = await fetchCaixaAtual(restauranteId);
        const caixa = res.data?.caixa || null;
        const aberto = !!res.data?.aberto || caixa?.status === "aberto";
        if (alive) {
          setCaixaAberto(aberto);
          setCaixaAtual(aberto ? caixa : null);
        }
      } catch {
        if (alive) { setCaixaAberto(false); setCaixaAtual(null); }
      }
    };
    carregarCaixa();
    const t = setInterval(carregarCaixa, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [restauranteId]);

  const notifySound = useRef(null);
  useEffect(() => {
    notifySound.current = new Howl({ src: ["/sons/notificacao.mp3"], volume: 1.0 });
    return () => notifySound.current?.unload();
  }, []);

  const horarioFuncionamento = useHorarioFuncionamento(async () => {
    try {
      const token = localStorage.getItem("_token");
      const response = await fetchMe(token);
      const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
      const hoje = new Date();
      const diaAtual = dias[hoje.getDay()];
      return response.data?.horariosFuncionamento?.[diaAtual];
    } catch (e) {
      console.warn("Erro ao buscar horário:", e);
      return null;
    }
  });

  const pedidosRecebidos = useMemo(() => pedidos.filter((p) => normalizarStatusOperacao(p) === "pago"), [pedidos]);
  const pedidosProducao = useMemo(() => pedidos.filter((p) => normalizarStatusOperacao(p) === "em_producao"), [pedidos]);
  const pedidosEntrega = useMemo(() => pedidos.filter((p) => normalizarStatusOperacao(p) === "em_entrega"), [pedidos]);

  const moverPedido = useCallback(
    async (id, novoStatus) => {
      setLoading(true);

      setPedidos((prev) => {
        if (novoStatus === "entregue") return prev.filter((p) => p.id !== id);
        return prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p));
      });

      try {
        const { data } = await axios.put(
          `${API_URL}/api/pedidos/status/${id}`,
          { novoStatus },
          { headers: authHeaders() }
        );

        const pedidoAtualizado = data?.pedido;
        if (pedidoAtualizado) {
          const formatado = formatPedidoServidor(pedidoAtualizado);
          setPedidos((prev) => {
            const existe = prev.some((p) => p.id === pedidoAtualizado._id);
            if (pedidoAtualizado.status === "entregue")
              return prev.filter((p) => p.id !== pedidoAtualizado._id);
            if (existe) return sortPedidosNewest(prev.map((p) => (p.id === pedidoAtualizado._id ? formatado : p)));
            return sortPedidosNewest([formatado, ...prev]);
          });
        }

        if (novoStatus === "entregue" || pedidoAtualizado?.status === "entregue") {
          incrementarConcluidoHoje(pedidoAtualizado || id);
        }

        setSnackbar({ open: true, message: "Status atualizado com sucesso!", severity: "success" });
      } catch (err) {
        console.error("Erro ao atualizar status:", err?.response?.status, err?.response?.data || err.message);
        setSnackbar({ open: true, message: "Erro ao atualizar status. Tente novamente.", severity: "error" });
      } finally {
        setLoading(false);
      }
    },
    [setPedidos, incrementarConcluidoHoje]
  );

  const enviarPedidoQuitadoParaProducao = useCallback(
    async (pedidoFromServer) => {
      const p = pedidoFromServer;
      if (!p?._id) return;

      await moverPedido(p._id, "em_producao");

      const ja = pedidosRef.current.some((x) => x.id === p._id);
      if (!ja) {
        const formatado = formatPedidoServidor({ ...p, status: "em_producao" });
        setPedidos((prev) => [formatado, ...prev]);
      }

      setSnackbar({
        open: true,
        message: `✅ Pedido #${pedidoCode(p)} quitado e enviado para produção!`,
        severity: "success",
      });
    },
    [moverPedido, setPedidos]
  );

  const atualizarEstatisticas = useCallback((todosPedidos) => {
    const lista = Array.isArray(todosPedidos) ? todosPedidos : [];

    const recebidos = lista.filter((p) => normalizarStatusOperacao(p) === "pago").length;
    const producao = lista.filter((p) => normalizarStatusOperacao(p) === "em_producao").length;
    const entrega = lista.filter((p) => normalizarStatusOperacao(p) === "em_entrega").length;

    const caixaId = getCaixaId(caixaAtual);
    const dataOperacional = String(caixaAtual?.dataOperacional || "").slice(0, 10);
    const hojeKey = formatDateKeyLocal();
    const dataKpi = dataOperacional || hojeKey;

    const pertenceAoDiaOperacional = (p) => {
      if (!p || isStatusCancelado(p)) return false;
      const pedidoCaixaId = getPedidoCaixaId(p);
      if (caixaId && pedidoCaixaId && pedidoCaixaId === caixaId) return true;
      const pedidoDataOp = getPedidoDataOperacional(p);
      if (dataOperacional && pedidoDataOp && pedidoDataOp === dataOperacional) return true;
      const criado = p.criadoEm || p.createdAt || p.created_at;
      return formatDateKeyLocal(criado) === dataKpi;
    };

    const pedidosHojeLista = lista.filter(pertenceAoDiaOperacional);
    const pedidosCaixa = Number(caixaAtual?.totalPedidos ?? caixaAtual?.pedidos ?? caixaAtual?.resumo?.pedidos ?? NaN);
    const pedidosHoje = Number.isFinite(pedidosCaixa) ? Math.max(pedidosCaixa, pedidosHojeLista.length) : pedidosHojeLista.length;
    const faturamentoCalculado = pedidosHojeLista
      .filter(isVendaConfirmada)
      .reduce((acc, p) => acc + getPedidoTotal(p), 0);
    const faturamentoCaixa = Number(caixaAtual?.totalVendas ?? caixaAtual?.resumo?.totalVendas ?? NaN);
    const faturamentoHoje = Number.isFinite(faturamentoCaixa)
      ? Math.max(faturamentoCaixa, faturamentoCalculado)
      : faturamentoCalculado;

    const operadorNome = caixaAtual?.operadorNome || caixaAtual?.operador?.nome || caixaAtual?.operador?.apelido || "Sem operador";
    const horaAbertura = formatHoraBR(caixaAtual?.abertoEm || caixaAtual?.createdAt || caixaAtual?.aberturaEm);

    setStats([
      {
        title: "Caixa Atual",
        value: caixaAtual ? "Aberto" : "Fechado",
        subtitle: caixaAtual ? `${operadorNome} • ${horaAbertura}` : "Abra o caixa para vender",
        accent: caixaAtual ? "#22c55e" : "#ef4444",
        icon: <PointOfSaleIcon fontSize="small" />,
        onClick: () => navigate("/caixa"),
      },
      { title: "Faturamento Hoje", value: formatBRL(faturamentoHoje), subtitle: caixaAtual ? "Turno atual" : "Hoje", accent: "#16a34a", icon: <PaidIcon fontSize="small" /> },
      { title: "Pedidos Hoje", value: pedidosHoje, subtitle: caixaAtual ? "Turno atual" : "Hoje", accent: "#7c3aed", icon: <ReceiptLongIcon fontSize="small" /> },
      { title: "Recebidos", value: recebidos, subtitle: "Aguardando", accent: "#ff3b8a" },
      { title: "Produção", value: producao, subtitle: "Em preparo", accent: "#2563eb" },
      { title: "Entrega", value: entrega, subtitle: "Em rota", accent: "#f97316" },
    ]);
  }, [caixaAtual, navigate]);
  // Mantém KPIs da Home sincronizados com o estado real das colunas,
  // inclusive quando pedidos chegam pelo socket.io ou por atualização de balcão do app garçom.
  useEffect(() => {
    atualizarEstatisticas(pedidos);
  }, [pedidos, atualizarEstatisticas]);


  const abrirEscolhaAvanco = useCallback((pedido) => {
    setPedidoAvanco(pedido);
    setAvancoDialogOpen(true);
  }, []);

  const fecharEscolhaAvanco = useCallback(() => {
    setAvancoDialogOpen(false);
    setTimeout(() => setPedidoAvanco(null), 150);
  }, []);

  const confirmarSaidaPedido = useCallback((destino) => {
    const pedido = pedidoAvanco;
    setAvancoDialogOpen(false);
    setPedidoAvanco(null);
    setPedidoDetalheOpen(false);
    setTimeout(() => setPedidoDetalhe(null), 150);

    if (pedido?.id && (destino === "em_entrega" || destino === "entregue")) {
      moverPedido(pedido.id, destino);
    }
  }, [pedidoAvanco, moverPedido]);

  const avancarPedido = useCallback(
    (pedido, destinoManual = null) => {
      if (pedido.status === "pago") {
        moverPedido(pedido.id, "em_producao");
        return;
      }

      if (pedido.status === "em_producao") {
        if (destinoManual === "em_entrega" || destinoManual === "entregue") {
          moverPedido(pedido.id, destinoManual);
          return;
        }

        if (isPedidoVitrine(pedido)) {
          moverPedido(pedido.id, "em_entrega");
          return;
        }

        abrirEscolhaAvanco(pedido);
        return;
      }
    },
    [moverPedido, abrirEscolhaAvanco]
  );

  const finalizarEntrega = useCallback(
    (pedido) => {
      moverPedido(pedido.id, "entregue");
      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
    },
    [moverPedido, setPedidos]
  );

  const handleImprimir = useCallback(
    (pedido) =>
      enviarParaImpressao(pedido, {
        restauranteId,
        nomeRestaurante,
        logoUrl,
      }),
    [restauranteId, nomeRestaurante, logoUrl]
  );

  useEffect(() => {
    (async () => {
      const session = (await window.electron?.obterSessao?.()) ?? null;
      if (!session?.restauranteId) return;

      setRestauranteId(session.restauranteId);
      setNomeRestaurante(session.nome);

      try {
        const token = localStorage.getItem("_token");
        const me = await fetchMe(token);
        const restauranteMe = normalizeRestaurantData(me?.data);

        setRestauranteDados(restauranteMe);
        setNomeRestaurante(restauranteMe?.nome || restauranteMe?.nomeFantasia || session.nome || "");

        const url = resolveLogoUrl(me?.data, session.logoUrl || session.logoSlug || "");
        setLogoUrl(url);

        const t = Number(restauranteMe?.tempoMedioEntregaMin);
        setTempoMedioEntregaMin(Number.isFinite(t) ? Math.max(1, Math.round(t)) : 45);
      } catch (e) {
        console.warn("Não consegui carregar me/logo/config:", e?.message);
      }

      const st = await verificarStatusBot(session.restauranteId);
      if (typeof st.ligado === "boolean") setBotAtivado(st.ligado);
      if (typeof st.conectado === "boolean") setBotConectado(st.conectado);

      try {
        const res = await fetchPedidos(session.restauranteId);

        const raw = res?.data ?? res;

        const lista = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.pedidos)
            ? raw.pedidos
            : Array.isArray(raw?.data)
              ? raw.data
              : Array.isArray(raw?.result)
                ? raw.result
                : [];

        window.electron?.log?.({ type: "fetchPedidos.raw", raw });

        const pedidosFormatados = lista.map(formatPedidoServidor);
        setPedidos(sortPedidosNewest(pedidosFormatados));
        atualizarEstatisticas(lista);
      } catch (e) {
        console.error("Erro ao buscar pedidos:", e);
      }
    })();
  }, [navigate, setPedidos, atualizarEstatisticas]);

  useEffect(() => {
    if (!restauranteId) return;
    const s = createSocket();
    let refreshTimer = null;
    let pollTimer = null;

    const recarregarPedidosServidor = async () => {
      try {
        const res = await fetchPedidos(restauranteId);
        const raw = res?.data ?? res;
        const lista = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.pedidos)
            ? raw.pedidos
            : Array.isArray(raw?.data)
              ? raw.data
              : Array.isArray(raw?.result)
                ? raw.result
                : [];
        setPedidos(sortPedidosNewest(lista.map(formatPedidoServidor)));
      } catch (e) {
        console.warn("Falha ao recarregar pedidos após socket:", e?.message || e);
      }
    };

    const recarregarCaixaAtual = async () => {
      try {
        const res = await fetchCaixaAtual(restauranteId);
        const caixa = res.data?.caixa || null;
        const aberto = !!res.data?.aberto || caixa?.status === "aberto";
        setCaixaAberto(aberto);
        setCaixaAtual(aberto ? caixa : null);
      } catch (e) {
        console.warn("Falha ao recarregar caixa após socket:", e?.message || e);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        recarregarPedidosServidor();
        recarregarCaixaAtual();
      }, 350);
    };

    const upsertPedidoSocket = (payload, tocar = false) => {
      const pedidoPayload = payload?.pedido || payload;
      const id = pedidoPayload?._id || pedidoPayload?.id || pedidoPayload?.pedidoId;
      if (!id) {
        scheduleRefresh();
        return;
      }

      const formatado = formatPedidoServidor({ ...pedidoPayload, _id: id });
      executarAutoPrintBalcao(formatado);

      setPedidos((prev) => {
        const statusNormalizadoSocket = normalizarStatusOperacao(pedidoPayload);
        if (["entregue", "cancelado"].includes(statusNormalizadoSocket)) {
          if (statusNormalizadoSocket === "entregue") incrementarConcluidoHoje(pedidoPayload);
          return prev.filter((p) => p.id !== id);
        }
        const existe = prev.some((p) => p.id === id);
        return sortPedidosNewest(existe ? prev.map((p) => (p.id === id ? formatado : p)) : [formatado, ...prev]);
      });

      if (tocar) {
        notifySound.current?.play();
        window.electron?.notificarPedido?.({
          pedidoId: id,
          cliente: pedidoPayload.nomeCliente || pedidoPayload.cliente || "Cliente",
        });
      }

      // Garante consistência caso o evento venha parcial do app garçom/API.
      scheduleRefresh();
    };

    s.on("connect", () => {
      s.emit("joinRestaurante", { restauranteId });
      recarregarPedidosServidor();
    });

    s.on("novoPedido", (pedidoNovo) => upsertPedidoSocket(pedidoNovo, true));
    s.on("pedidoAtualizado", (pedidoAtualizado) => upsertPedidoSocket(pedidoAtualizado, false));

    // Eventos usados por mesa/balcão/garçom em versões diferentes da API.
    [
      "pedidoCriado",
      "pedidoPago",
      "balcaoPedidoCriado",
      "balcaoPedidoAtualizado",
      "mesaPedidoAtualizado",
      "comandaAtualizada",
      "caixaAtualizado",
    ].forEach((ev) => s.on(ev, scheduleRefresh));

    // Fallback leve: se o socket do pedido do garçom não chegar, a Home ainda atualiza sozinha.
    pollTimer = setInterval(recarregarPedidosServidor, 7000);

    s.on("connect_error", (err) => console.error("❌ Erro na conexão do socket:", err.message));

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (pollTimer) clearInterval(pollTimer);
      s.disconnect();
    };
  }, [restauranteId, setPedidos, executarAutoPrintBalcao, incrementarConcluidoHoje]);

  const refreshStatus = useCallback(async () => {
    if (!restauranteIdRef.current) return;
    const st = await verificarStatusBot(restauranteIdRef.current);
    if (typeof st.ligado === "boolean") setBotAtivado(st.ligado);
    if (typeof st.conectado === "boolean") setBotConectado(st.conectado);
  }, []);

  const handleToggleBot = useCallback(
    async (event) => {
      const ligar = event.target.checked;
      setBotAtivado(ligar);

      try {
        if (ligar) {
          await ligarBot(restauranteIdRef.current);
          setSnackbar({ open: true, message: "Bot ativado com sucesso!", severity: "success" });
        } else {
          await desligarBot(restauranteIdRef.current);
          setSnackbar({ open: true, message: "Bot desativado.", severity: "info" });
        }

        setTimeout(() => refreshStatus(), 1500);
      } catch (err) {
        console.error("Erro ao alternar o bot:", err);
        setSnackbar({ open: true, message: "Erro ao alternar o bot. Tente novamente.", severity: "error" });
        setBotAtivado(!ligar);
      }
    },
    [refreshStatus]
  );

  const abrirQrBot = useCallback(async () => {
    const id = restauranteIdRef.current;
    if (!id) return;
    setBotQrOpen(true);
    setBotQrLoading(true);
    try {
      await ligarBot(id);
      setBotAtivado(true);
      const data = await obterQrBot(id);
      setBotQr(data?.qr || data?.qrCode || data?.qrCodeBase64 || "");
      setTimeout(() => refreshStatus(), 1500);
    } catch (err) {
      console.error("Erro ao abrir QR do bot:", err);
      setSnackbar({ open: true, message: "Não foi possível abrir o QR do bot.", severity: "error" });
    } finally {
      setBotQrLoading(false);
    }
  }, [refreshStatus]);

  const handleToggleAutoImprimir = useCallback(() => {
    setAutoImprimir((prev) => {
      const v = !prev;
      localStorage.setItem("autoImprimir", String(v));
      autoImprimirRef.current = v;
      window.dispatchEvent(new Event("movyo:auto-print-changed"));
      return v;
    });
  }, []);

  useEffect(() => {
    if (!restauranteId) return;
    if (botConectado) return;
    const interval = setInterval(() => refreshStatus(), 5000);
    return () => clearInterval(interval);
  }, [restauranteId, botConectado, refreshStatus]);

  /* CALBACK BALCÃO *******************/
  const handleBalcaoNotify = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message: String(message || ""), severity });
  }, []);

  /* =========================
  RENDER
  ========================= */
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        py: 2.5,
        px: 2,
        backgroundColor: "#050816",
        backgroundImage: `
          radial-gradient(circle at top left, rgba(255,59,138,0.35), transparent 60%),
          radial-gradient(circle at bottom right, rgba(255,155,45,0.30), transparent 60%)
        `,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Fade in={logoutLoading} timeout={250} unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2,
            background: "rgba(5, 8, 22, 0.76)",
            backdropFilter: "blur(12px)",
            color: "#fff",
          }}
        >
          <CircularProgress size={44} sx={{ color: "#ff9b2d" }} />
          <Typography sx={{ fontWeight: 950, fontSize: 18 }}>Saindo do painel...</Typography>
          <Typography sx={{ opacity: .82, fontSize: 13 }}>Limpando a sessão e voltando para o login.</Typography>
        </Box>
      </Fade>

      <Box sx={{ width: "100%", maxWidth: 1220, display: "flex", flexDirection: "column", gap: 1.45, minWidth: 0 }}>
        {/* HEADER */}
        <Paper
          elevation={10}
          sx={{
            p: 1.8,
            borderRadius: 3,
            background: "linear-gradient(120deg, rgba(255,255,255,0.98), rgba(249,250,251,0.98))",
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(320px, 1fr) auto" },
              gap: { xs: 1.4, md: 2 },
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1.4 }}>
              <Tooltip title="Abrir configurações">
                <Avatar
                  src={logoUrl || ""}
                  alt={nomeRestaurante || "Restaurante"}
                  onClick={() => navigate("/configuracoes")}
                  sx={{
                    width: 46,
                    height: 46,
                    cursor: "pointer",
                    border: "1px solid rgba(148,163,184,0.45)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    bgcolor: "#fff",
                    flexShrink: 0,
                  }}
                  imgProps={{ onError: () => setLogoUrl(""), style: { objectFit: "cover" } }}
                >
                  {(nomeRestaurante || "R").slice(0, 1).toUpperCase()}
                </Avatar>
              </Tooltip>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 950,
                    color: "#0A2A4A",
                    letterSpacing: 0.2,
                    lineHeight: 1.1,
                    whiteSpace: "normal",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Movyo Food — Painel de pedidos
                </Typography>

                {nomeRestaurante && (
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.75,
                      mt: 0.35,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={nomeRestaurante}
                  >
                    Restaurante: <strong>{nomeRestaurante}</strong>
                  </Typography>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: { xs: "flex-start", md: "flex-end" },
                gap: 1.2,
                flexWrap: "wrap",
                maxWidth: { md: 720 },
              }}
            >
              <FormControlLabel
                control={<Switch checked={botAtivado} onChange={handleToggleBot} />}
                label="Bot"
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Switch checked={autoImprimir} onChange={handleToggleAutoImprimir} />}
                label="Auto Print"
                sx={{ m: 0 }}
              />

              <Button
                variant="contained"
                disabled={!caixaAberto}
                title={!caixaAberto ? "Abra o caixa para lançar pedido balcão" : ""}
                onClick={() => setModalBalcaoOpen(true)}
                sx={{
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 950,
                  px: 1.8,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                }}
              >
                + Pedido balcão
              </Button>

              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                sx={{
                  px: 0.6,
                  py: 0.35,
                  borderRadius: 999,
                  bgcolor: "rgba(2,6,23,0.045)",
                  border: "1px solid rgba(148,163,184,0.28)",
                }}
              >
                <Chip
                  size="small"
                  icon={<AccessTimeIcon />}
                  label={horarioFuncionamento || "—"}
                  sx={{
                    borderRadius: 20,
                    bgcolor: String(horarioFuncionamento || "").toLowerCase().includes("aberto") ? "#22c55e" : "#e5e7eb",
                    color: String(horarioFuncionamento || "").toLowerCase().includes("aberto") ? "white" : "#111827",
                    fontWeight: 900,
                  }}
                />

                <Chip
                  size="small"
                  icon={<WhatsAppIcon />}
                  label={botAtivado ? (botConectado ? "Bot ativo" : "Bot aguardando QR") : "Bot desligado"}
                  color={botConectado ? "success" : botAtivado ? "warning" : "default"}
                  onClick={() => !botConectado && abrirQrBot()}
                  clickable={!botConectado}
                  sx={{ borderRadius: 20, fontWeight: 900 }}
                />

                {!botConectado && botAtivado ? (
                  <Tooltip title="Abrir QR Code do WhatsApp">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<QrCode2Icon />}
                      onClick={abrirQrBot}
                      sx={{
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 950,
                        minHeight: 28,
                        px: 1.2,
                      }}
                    >
                      QR
                    </Button>
                  </Tooltip>
                ) : null}
              </Stack>

              <Tooltip title="Configurações">
                <IconButton onClick={() => navigate("/configuracoes")}>
                  <SettingsIcon fontSize="medium" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Impressão">
                <IconButton onClick={() => navigate("/configuracoes", { state: { tab: 4 } })}>
                  <PrintIcon fontSize="medium" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Sair">
                <IconButton disabled={logoutLoading} onClick={async () => {
                    setLogoutLoading(true);
                    try {
                      await window.electron?.limparSessao?.();
                    } catch (err) {
                      console.warn("Falha ao limpar sessão do Electron:", err?.message || err);
                    }

                    [
                      "_token",
                      "_id",
                      "tokenRestaurante",
                      "token",
                      "restauranteToken",
                      "restauranteId",
                      "idRestaurante",
                      "usuario",
                      "restaurante",
                    ].forEach((key) => localStorage.removeItem(key));

                    sessionStorage.clear();
                    sessionStorage.setItem("movyoTransitionMessage", "Encerrando sessão com segurança...");
                    window.location.hash = "#/login";
                    window.location.reload();
                  }}>
                  <LogoutIcon fontSize="medium" color="error" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        <LicenseStatusCard info={licenseInfo} />

        {/* KPIs */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "repeat(auto-fit, minmax(170px, 1fr))",
            },
            gap: { xs: 1.15, md: 1.35 },
            alignItems: "stretch",
            width: "100%",
            maxWidth: "100%",
            overflow: "visible",
          }}
        >
          {stats.map((s, i) => (
            <KpiCard key={i} title={s.title} value={s.value} subtitle={s.subtitle} accent={s.accent} icon={s.icon} onClick={s.onClick} />
          ))}
        </Box>

        {/* CONTEÚDO */}
        {/* CONTEÚDO */}
        <DndProvider backend={HTML5Backend}>
          <Box display="flex" gap={1.8} minWidth={0}>
            <ColunaPedidos
              title="📥 Recebidos"
              status="pago"
              pedidos={pedidosRecebidos}
              onDrop={moverPedido}
              onAvancar={avancarPedido}
              color="#fef3c7"
              disableDrop
              loading={loading}
              onImprimir={handleImprimir}
              onImprimirCozinha={handleImprimirCozinha}
              onOpenDetails={abrirDetalhesPedido}
              onEscolherAvanco={abrirEscolhaAvanco}
              tempoMedioEntregaMin={tempoMedioEntregaMin}
              nowMs={nowTick}
            />

            <ColunaPedidos
              title="⏱ Produção"
              status="em_producao"
              pedidos={pedidosProducao}
              onDrop={moverPedido}
              onAvancar={avancarPedido}
              color="#dbeafe"
              disableDrop={false}
              loading={loading}
              onImprimir={handleImprimir}
              onImprimirCozinha={handleImprimirCozinha}
              onOpenDetails={abrirDetalhesPedido}
              onEscolherAvanco={abrirEscolhaAvanco}
              tempoMedioEntregaMin={tempoMedioEntregaMin}
              nowMs={nowTick}
            />

            <ColunaPedidos
              title="🚚 Entrega"
              status="em_entrega"
              pedidos={pedidosEntrega}
              onDrop={moverPedido}
              onAvancar={avancarPedido}
              finalizarEntrega={finalizarEntrega}
              color="#dcfce7"
              disableDrop
              loading={loading}
              onImprimir={handleImprimir}
              onImprimirCozinha={handleImprimirCozinha}
              onOpenDetails={abrirDetalhesPedido}
              onEscolherAvanco={abrirEscolhaAvanco}
              tempoMedioEntregaMin={tempoMedioEntregaMin}
              nowMs={nowTick}
            />
          </Box>
        </DndProvider>
      </Box>

      {/* ✅ MODAL BALCÃO (separado) */}
      <PedidoBalcaoModal
        open={modalBalcaoOpen}
        onClose={() => setModalBalcaoOpen(false)}
        restauranteId={restauranteId}
        nomeRestaurante={nomeRestaurante}
        logoUrl={logoUrl}
        onPedidoQuitado={enviarPedidoQuitadoParaProducao}
        onNotify={handleBalcaoNotify}
      />




      <Dialog open={botQrOpen} onClose={() => setBotQrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>Conectar WhatsApp do bot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
            {botQrLoading ? (
              <CircularProgress />
            ) : botQr ? (
              String(botQr).startsWith("data:image") ? (
                <Box component="img" src={botQr} alt="QR Code WhatsApp" sx={{ width: 240, height: 240, objectFit: "contain" }} />
              ) : (
                <Box sx={{ bgcolor: "#fff", p: 2, borderRadius: 2 }}>
                  <QRCode value={botQr} size={220} />
                </Box>
              )
            ) : (
              <Typography variant="body2" sx={{ color: "#64748b", textAlign: "center" }}>
                O bot está iniciando. Aguarde alguns segundos e clique em atualizar QR.
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: "#64748b", textAlign: "center" }}>
              Escaneie pelo WhatsApp do restaurante. Depois de conectado, o status ficará verde automaticamente.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBotQrOpen(false)}>Fechar</Button>
          <Button variant="contained" onClick={abrirQrBot} disabled={botQrLoading}>Atualizar QR</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={avancoDialogOpen} onClose={fecharEscolhaAvanco} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>Para onde enviar o pedido?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: "#475569", mb: 1.5 }}>
            Pedido {pedidoAvanco?.nome || pedidoAvanco?.numeroPedido || ""}. Escolha conforme o fluxo real do cliente.
          </Typography>
          <Stack spacing={1}>
            <Button
              variant="contained"
              onClick={() => confirmarSaidaPedido("em_entrega")}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 950 }}
            >
              Enviar para entrega
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => confirmarSaidaPedido("entregue")}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 950 }}
            >
              Cliente recebeu no balcão
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={fecharEscolhaAvanco}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ModalDetalhesPedido
        open={pedidoDetalheOpen}
        onClose={fecharDetalhesPedido}
        pedido={pedidoDetalhe}
        onImprimir={handleImprimir}
        onImprimirCozinha={handleImprimirCozinha}
        onAvancar={avancarPedido}
        onFinalizar={finalizarEntrega}
        tempoMedioEntregaMin={tempoMedioEntregaMin}
        nowMs={nowTick}
      />
    </Box>
  );
}
