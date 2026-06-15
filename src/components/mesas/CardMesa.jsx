import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Stack,
  Divider,
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CancelIcon from "@mui/icons-material/Cancel";

import axios from "axios";
import { parseDateTimeMs } from "../../utils/dateTime";

// Impressão
import { renderToStaticMarkup } from "react-dom/server";
import PrintableQRCode from "./PrintableQRCode.jsx";

const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://seusite.com");

/* -----------------------
   Auth helpers (token)
-------------------------*/
const getToken = () =>
  localStorage.getItem("_token") ||
  localStorage.getItem("tokenRestaurante") ||
  "";

const asBearer = (t) => {
  const token = String(t || "").trim();
  if (!token) return "";
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

/* -----------------------
   tempo helpers
-------------------------*/
function formatDuracaoSeg(seg = 0) {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function calcSegundosDesde(dateValue) {
  const ms = parseDateTimeMs(dateValue);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function getTempoColor(seg) {
  if (seg >= 60 * 60) return "error";
  if (seg >= 30 * 60) return "warning";
  return "success";
}

const StatusChip = ({ status }) => {
  const normalizedStatus = status || "livre";
  const statusInfo = {
    livre: { label: "Livre", color: "success" },
    ocupada: { label: "Ocupada", color: "warning" },
    aguardando_pagamento: { label: "Pagamento", color: "info" },
  };
  const info =
    statusInfo[normalizedStatus] || { label: normalizedStatus, color: "default" };

  return (
    <Chip label={info.label} color={info.color} size="small" sx={{ fontWeight: 800 }} />
  );
};

export default function CardMesa({
  mesa,
  onDelete,
  restauranteSlug: slugProp,
  apiUrl,
  onAbrirMesa,
  onAbrirComanda,
  onPedidoCancelado, // ✅ opcional: callback pra você dar refresh nas mesas/pedidos
}) {
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [printMenuAnchorEl, setPrintMenuAnchorEl] = useState(null);
  const [restauranteSlug, setRestauranteSlug] = useState(slugProp || null);

  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const isOcupada = mesa?.status === "ocupada";
  const isAguardandoPagamento = mesa?.status === "aguardando_pagamento";
  const isAtiva = isOcupada || isAguardandoPagamento || !!mesa?.pedidoAtualId;

  useEffect(() => {
    if (!isAtiva) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isAtiva]);

  // slug fallback
  useEffect(() => {
    if (slugProp) return;
    try {
      const stored = localStorage.getItem("restauranteSelecionado");
      if (stored) {
        const parsed = JSON.parse(stored);
        const slug =
          parsed.slugIdentificador || parsed.slug || parsed.restauranteSlug || null;
        if (slug) setRestauranteSlug(slug);
      }
    } catch {}
  }, [slugProp]);

  const qrCodeUrl = restauranteSlug
    ? `${PUBLIC_BASE_URL}/pedido/${restauranteSlug}?mesa=${mesa.qrCodeIdentifier}`
    : `${PUBLIC_BASE_URL}/pedido/SLUG_NAO_DEFINIDO?mesa=${mesa.qrCodeIdentifier}`;

  const comandaNumero = mesa?.comandaNumero || mesa?.pedidoAtualNumero || mesa?.pedidoAtualId;

  /* tempo */
  const segundosAtuais = useMemo(() => {
    if (!isAtiva) return 0;
    void tick;
    return calcSegundosDesde(mesa?.ocupadaDesde);
  }, [mesa?.ocupadaDesde, isAtiva, tick]);

  const tempoLabel = useMemo(() => {
    if (isAtiva) return formatDuracaoSeg(segundosAtuais);
    const last = Number(mesa?.ultimaPermanenciaSegundos || 0);
    return last > 0 ? formatDuracaoSeg(last) : null;
  }, [isAtiva, segundosAtuais, mesa?.ultimaPermanenciaSegundos]);

  const tempoColor = useMemo(() => {
    if (!isAtiva) return "default";
    return getTempoColor(segundosAtuais);
  }, [isAtiva, segundosAtuais]);

  const handleMenuClick = (event) => setMenuAnchorEl(event.currentTarget);
  const handleMenuClose = () => setMenuAnchorEl(null);

  const handlePrintMenuOpen = (event) => setPrintMenuAnchorEl(event.currentTarget);
  const handlePrintMenuClose = () => setPrintMenuAnchorEl(null);

  const handleDelete = () => {
    onDelete?.(mesa._id);
    handleMenuClose();
  };

  const handleAbrirMesa = async () => {
    if (!apiUrl) {
      alert("apiUrl não informado no CardMesa.");
      return;
    }

    setBusy(true);
    try {
      // ✅ ROTA CERTA: POST /api/mesas/:mesaId/abrir
      const res = await axios.post(
        `${apiUrl}/api/mesas/${mesa._id}/abrir`,
        { nomeCliente: `Mesa ${mesa.numero}` },
        { headers: { Authorization: asBearer(getToken()) } }
      );

      const mesaAtualizada = res.data?.mesa || null;
      onAbrirMesa?.(mesaAtualizada);

      // abre a comanda logo após abrir
      onAbrirComanda?.(mesaAtualizada || mesa);

      handleMenuClose();
    } catch (e) {
      console.error("Erro abrir mesa:", e?.response?.data || e.message);
      alert(e?.response?.data?.message || "Erro ao abrir mesa.");
    } finally {
      setBusy(false);
    }
  };

  const handleAbrirComanda = () => {
    onAbrirComanda?.(mesa);
    handleMenuClose();
  };

  const handlePrint = (size) => {
    const printableComponent = (
      <PrintableQRCode mesa={mesa} url={qrCodeUrl} size={size} />
    );
    const staticHtml = renderToStaticMarkup(printableComponent);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charSet="UTF-8" />
<title>Imprimir Mesa ${mesa.numero}</title>
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>${staticHtml}</body>
</html>`;

    if (window.electron?.printContent) window.electron.printContent(fullHtml);
    else alert("Funcionalidade de impressão não disponível.");

    handlePrintMenuClose();
    handleMenuClose();
  };

  // ✅ Cancelar pedido inteiro (rota do garçom)
  const handleCancelarPedido = async () => {
    if (!apiUrl) return alert("apiUrl não informado no CardMesa.");
    if (!mesa?.pedidoAtualId) return alert("Essa mesa não tem pedido ativo.");

    const ok = window.confirm(
      `Cancelar o pedido desta mesa?\n\nMesa: ${mesa.numero}\nPedido: ${String(
        mesa.pedidoAtualId
      ).slice(-6)}`
    );
    if (!ok) return;

    const motivo = window.prompt("Motivo do cancelamento (opcional):") || "";

    setBusy(true);
    try {
      await axios.post(
        `${apiUrl}/api/garcons/app/pedido/${mesa.pedidoAtualId}/cancelar`,
        { motivo },
        { headers: { Authorization: asBearer(getToken()) } }
      );

      onPedidoCancelado?.({
        pedidoId: mesa.pedidoAtualId,
        mesaId: mesa._id,
        motivo,
      });

      alert("Pedido cancelado com sucesso!");
      handleMenuClose();
    } catch (e) {
      console.error("Erro cancelar pedido:", e?.response?.data || e.message);
      alert(e?.response?.data?.message || "Erro ao cancelar pedido.");
    } finally {
      setBusy(false);
    }
  };

  const mesaVisual = isAtiva
    ? {
        bg: "rgba(34, 197, 94, 0.10)",
        border: "1px solid rgba(34, 197, 94, 0.7)",
        iconColor: "#16a34a",
      }
    : {
        bg: "rgba(148, 163, 184, 0.10)",
        border: "1px solid rgba(148, 163, 184, 0.7)",
        iconColor: "#6b7280",
      };

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 3,
        boxShadow: isAtiva ? 5 : 3,
        border: isAtiva
          ? "1px solid rgba(34, 197, 94, 0.4)"
          : "1px solid rgba(0,0,0,0.05)",
        background: isAtiva
          ? "linear-gradient(135deg, rgba(34,197,94,0.14), #fff)"
          : "linear-gradient(135deg, rgba(148,163,184,0.10), #fff)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: isAtiva ? 6 : 4 },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Mesa
            </Typography>
            <Typography variant="h5" component="h2" fontWeight="bold">
              {mesa.numero}
            </Typography>
          </Box>

          <IconButton size="small" onClick={handleMenuClick} disabled={busy}>
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={1.5}
          spacing={1}
        >
          <StatusChip status={mesa.status} />

          <Stack direction="row" spacing={1} alignItems="center">
            {tempoLabel && (
              <Tooltip title={isAtiva ? "Tempo desde a abertura" : "Última permanência"}>
                <Chip
                  icon={<AccessTimeIcon />}
                  label={tempoLabel}
                  color={tempoColor}
                  size="small"
                  sx={{ fontWeight: 900 }}
                />
              </Tooltip>
            )}

            {isAtiva && (
              <Typography variant="caption" color="text.secondary">
                {isAguardandoPagamento ? "Aguardando pagamento" : "Comanda em andamento"}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          my={2}
          py={2}
          sx={{
            backgroundColor: "white",
            borderRadius: 2,
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: 150,
              height: 90,
              borderRadius: 2,
              backgroundColor: mesaVisual.bg,
              border: mesaVisual.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(15,23,42,0.25)",
            }}
          >
            {isAtiva && comandaNumero && (
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  px: 0.8,
                  py: 0.2,
                  borderRadius: 999,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  bgcolor: "rgba(15,23,42,0.92)",
                  color: "#f9fafb",
                  letterSpacing: 0.4,
                }}
              >
                CMD #{String(comandaNumero).slice(-4)}
              </Box>
            )}

            <TableRestaurantIcon sx={{ fontSize: 44, color: mesaVisual.iconColor }} />
          </Box>

          <Typography variant="caption" color="text.secondary" mt={1.5}>
            Use o menu ⋮ para ações da mesa
          </Typography>
        </Box>
      </CardContent>

      <Box sx={{ px: 2, pb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            wordBreak: "break-all",
            color: "text.secondary",
          }}
        >
          {qrCodeUrl}
        </Typography>
      </Box>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        {!isAtiva ? (
          <MenuItem onClick={handleAbrirMesa} disabled={busy}>
            <ListItemIcon>
              <PlayCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Abrir mesa</ListItemText>
          </MenuItem>
        ) : (
          <>
            <MenuItem onClick={handleAbrirComanda} disabled={busy}>
              <ListItemIcon>
                <ReceiptLongIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ver comanda</ListItemText>
            </MenuItem>

            {/* ✅ Cancelar pedido (inteiro) */}
            {!!mesa?.pedidoAtualId && (
              <MenuItem
                onClick={handleCancelarPedido}
                disabled={busy}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon>
                  <CancelIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Cancelar pedido</ListItemText>
              </MenuItem>
            )}
          </>
        )}

        <Divider />

        <MenuItem onClick={handlePrintMenuOpen} disabled={busy}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Imprimir QR Code</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }} disabled={busy}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Excluir Mesa</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={printMenuAnchorEl}
        open={Boolean(printMenuAnchorEl)}
        onClose={handlePrintMenuClose}
      >
        <MenuItem onClick={() => handlePrint("grande")}>Grande (Padrão)</MenuItem>
        <MenuItem onClick={() => handlePrint("medio")}>Médio</MenuItem>
        <MenuItem onClick={() => handlePrint("pequeno")}>Pequeno</MenuItem>
        <MenuItem onClick={() => handlePrint("mini")}>Mini</MenuItem>
        <MenuItem onClick={() => handlePrint("micro")}>Micro</MenuItem>
      </Menu>
    </Card>
  );
}
