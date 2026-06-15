// src/components/FilaPedidosFloating.jsx
import * as React from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Badge,
  Drawer,
  IconButton,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Divider,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";

import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import CloseIcon from "@mui/icons-material/Close";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import SearchIcon from "@mui/icons-material/Search";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import BoltIcon from "@mui/icons-material/Bolt";
import { parseDateTimeMs } from "../utils/dateTime";

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
   helpers: tipo do pedido + labels
========================= */
function safeStr(v) {
  return String(v ?? "").trim();
}

function getNumeroPedidoFromFilaItem(i) {
  return safeStr(i?.numeroPedido || i?.pedido?.numeroPedido || i?.pedido?.numero || i?.numero);
}

function isBK(numeroPedido) {
  const n = safeStr(numeroPedido).toUpperCase();
  return n.startsWith("#BK");
}

function getOrigemFromFilaItem(i) {
  return safeStr(i?.origem || i?.pedido?.origem).toLowerCase();
}

function normalizeMesaLabelFromNomeCliente(nomeCliente) {
  const raw = safeStr(nomeCliente);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\bmesa\b\s*/gi, "Mesa ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.replace(/^Mesa\s+Mesa\s+/i, "Mesa ").trim();
}

function getMesaNumeroFromFilaItem(i) {
  const v =
    i?.mesaNumero ??
    i?.numeroMesa ??
    i?.mesa?.numero ??
    i?.mesa?.nome ??
    i?.mesa?.identificador ??
    i?.pedido?.mesaNumero ??
    i?.pedido?.numeroMesa ??
    i?.pedido?.mesa?.numero ??
    i?.pedido?.mesa?.nome ??
    i?.pedido?.mesa?.identificador;

  // ✅ quando origem for salão, pode vir em "nomeCliente" tipo "Mesa Mesa 1"
  const origem = getOrigemFromFilaItem(i);
  if (origem === "salao" || origem === "salão") {
    const fromNomeCliente =
      normalizeMesaLabelFromNomeCliente(i?.cliente || i?.pedido?.nomeCliente || i?.pedido?.cliente || "");
    // tenta extrair o número se possível
    const m = fromNomeCliente.match(/mesa\s*(.+)$/i);
    const extracted = m?.[1] ? safeStr(m[1]) : "";
    if (extracted) return extracted;
  }

  return safeStr(v);
}

function getActionLabel(i) {
  const numero = getNumeroPedidoFromFilaItem(i);
  const origem = getOrigemFromFilaItem(i);

  // 1) balcão por prefixo
  if (isBK(numero)) return "Pronto p/ Entrega Balcão";

  // 2) mesa = origem salao
  if (origem === "salao" || origem === "salão") {
    const mesaNum = getMesaNumeroFromFilaItem(i);
    return mesaNum ? `Pronto Mesa ${mesaNum}` : "Pronto Mesa";
  }

  // 3) vitrine
  if (origem === "vitrine") return "Enviar p/ Entrega";

  // 4) fallback
  return "Pronto";
}

function getTipoChip(i) {
  const numero = getNumeroPedidoFromFilaItem(i);
  const origem = getOrigemFromFilaItem(i);

  if (isBK(numero)) return { label: "BALCÃO", tone: "blue" };
  if (origem === "salao" || origem === "salão") return { label: "SALÃO", tone: "green" };
  if (origem === "vitrine") return { label: "VITRINE", tone: "amber" };
  return { label: origem ? origem.toUpperCase() : "—", tone: "gray" };
}

function chipSxByTone(tone) {
  if (tone === "blue") {
    return {
      borderRadius: 999,
      fontWeight: 950,
      bgcolor: "rgba(59,130,246,0.12)",
      color: "#1d4ed8",
    };
  }
  if (tone === "green") {
    return {
      borderRadius: 999,
      fontWeight: 950,
      bgcolor: "rgba(16,185,129,0.12)",
      color: "#047857",
    };
  }
  if (tone === "amber") {
    return {
      borderRadius: 999,
      fontWeight: 950,
      bgcolor: "rgba(245,158,11,0.14)",
      color: "#92400e",
    };
  }
  return {
    borderRadius: 999,
    fontWeight: 950,
    bgcolor: "rgba(2,6,23,0.06)",
    color: "#334155",
  };
}

function uniqKey(i) {
  const pid = i?.pedidoId || i?._id || i?.pedido?._id || "x";
  const idx = i?.itemIndex ?? i?.index ?? "x";
  return `${pid}-${idx}`;
}

function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function getFilaItemElapsedSeconds(item, nowMs = Date.now()) {
  const candidates = [
    item?.cozinha?.criadoEm,
    item?.criadoEm,
    item?.createdAt,
    item?.pedido?.createdAt,
  ];
  for (const c of candidates) {
    const ms = parseDateTimeMs(c);
    if (Number.isFinite(ms)) return Math.max(0, Math.floor((nowMs - ms) / 1000));
  }
  return Math.max(0, Math.floor(Number(item?.tempoSeg || item?.tempoMin * 60 || 0)));
}

export default function FilaPedidosFloating({
  enabled = true,
  restauranteId,
  apiUrl, // recebe do Home (API_URL)
  onOpenPedido,
}) {
  const [open, setOpen] = React.useState(false);
  const [fila, setFila] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  const [q, setQ] = React.useState("");
  const [pinPrioridade, setPinPrioridade] = React.useState(true);

  // ✅ UX: fixa “remover da lista imediatamente” após pronto (optimistic)
  const [busyKeys, setBusyKeys] = React.useState(() => new Set());

  // ✅ UX: snackbar de feedback
  const [snack, setSnack] = React.useState({ open: false, msg: "", severity: "success" });

  const base = String(apiUrl || "").trim();
  const canLoad = enabled && !!restauranteId && !!base;

  const inFlightRef = React.useRef(false);
  const lastOkAtRef = React.useRef(0);

  // relógio local: contador atualiza sem depender do polling da API
  React.useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ DEBUG opcional (mantido), mas só loga 1x por mudança
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[FilaCozinha] enabled:", enabled);
    // eslint-disable-next-line no-console
    console.log("[FilaCozinha] restauranteId:", restauranteId);
    // eslint-disable-next-line no-console
    console.log("[FilaCozinha] apiUrl(base):", base);
    // eslint-disable-next-line no-console
    console.log("[FilaCozinha] canLoad:", canLoad);
  }, [enabled, restauranteId, base, canLoad]);

  const loadFila = React.useCallback(async () => {
    if (!canLoad) return;
    if (inFlightRef.current) return; // evita spam de requests

    const url = `${base}/api/pedidos/${restauranteId}/fila-cozinha`;

    try {
      inFlightRef.current = true;
      setLoading(true);

      const res = await axios.get(url, { headers: authHeaders() });

      const data = res.data;
      const arr =
        Array.isArray(data?.fila) ? data.fila :
        Array.isArray(data) ? data :
        Array.isArray(data?.items) ? data.items :
        [];

      setFila(arr);
      lastOkAtRef.current = Date.now();
    } catch (e) {
      setFila([]);
      setSnack({
        open: true,
        severity: "error",
        msg: "Falha ao carregar fila da cozinha. Verifique token e rota /fila-cozinha.",
      });
      // eslint-disable-next-line no-console
      console.error("[FilaCozinha] ERRO loadFila:", {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        urls,
      });
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [canLoad, base, restauranteId]);

  // polling
  React.useEffect(() => {
    if (!canLoad) return;

    loadFila();
    const t = setInterval(loadFila, 4000);
    return () => clearInterval(t);
  }, [canLoad, loadFila]);

  // UX: ao abrir drawer, força refresh
  React.useEffect(() => {
    if (!open) return;
    if (!canLoad) return;
    loadFila();
  }, [open, canLoad, loadFila]);

  const filtered = React.useMemo(() => {
    let arr = [...(fila || [])];

    const n = String(q || "").trim().toLowerCase();
    if (n) {
      arr = arr.filter((i) => {
        const numero = getNumeroPedidoFromFilaItem(i);
        const nomeItem = safeStr(i?.item?.nome || i?.pedido?.itens?.[i?.itemIndex]?.nome || "");
        const cliente = safeStr(i?.cliente || i?.pedido?.nomeCliente || i?.pedido?.cliente || "");
        const mesa = getMesaNumeroFromFilaItem(i);

        return `${numero} ${nomeItem} ${cliente} ${mesa}`.toLowerCase().includes(n);
      });
    }

    arr.sort((a, b) => {
      if (pinPrioridade && a.prioridade !== b.prioridade) {
        return a.prioridade ? -1 : 1;
      }
      const ta = getFilaItemElapsedSeconds(a, nowTick);
      const tb = getFilaItemElapsedSeconds(b, nowTick);
      return tb - ta;
    });

    return arr;
  }, [fila, q, pinPrioridade, nowTick]);

  const countPrioridade = React.useMemo(() => filtered.filter((x) => !!x.prioridade).length, [filtered]);

  async function marcarPronto(item) {
    if (!item?.pedidoId && !item?._id) return;

    const pedidoId = item.pedidoId || item._id;
    const itemIndex = item.itemIndex;

    if (itemIndex === undefined || itemIndex === null) {
      setSnack({ open: true, severity: "warning", msg: "Item sem itemIndex (backend exige). Não foi possível marcar pronto." });
      // eslint-disable-next-line no-console
      console.warn("[FilaCozinha] item sem itemIndex:", item);
      return;
    }

    const urls = [
      `${base}/api/pedidos/${pedidoId}/itens/${itemIndex}/cozinha/pronto`,
      `${base}/api/pedidos/${pedidoId}/cozinha/pronto`,
    ];
    const key = uniqKey(item);

    // ✅ optimistic remove
    setBusyKeys((prev) => new Set(prev).add(key));
    setFila((prev) => (prev || []).filter((x) => uniqKey(x) !== key));

    try {
      const headers = authHeaders();
      let ultimoErro = null;
      for (const url of urls) {
        try {
          await axios.put(url, { itemIndex }, { headers });
          ultimoErro = null;
          break;
        } catch (err) {
          ultimoErro = err;
          const st = err?.response?.status;
          if (st && st !== 404 && st !== 405) throw err;
        }
      }
      if (ultimoErro) throw ultimoErro;
      setSnack({ open: true, severity: "success", msg: "✅ Item marcado como pronto." });
      loadFila();
    } catch (e) {
      // rollback
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      setSnack({
        open: true,
        severity: "error",
        msg: "Erro ao marcar pronto. Atualizei a fila para sincronizar.",
      });

      // refetch pra sincronizar real
      loadFila();

      // eslint-disable-next-line no-console
      console.error("[FilaCozinha] ERRO marcarPronto:", {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        urls,
      });
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const closeSnack = () => setSnack((p) => ({ ...p, open: false }));

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <Box sx={{ position: "fixed", right: 18, bottom: 18, zIndex: 1400 }}>
          <Paper
            onClick={() => setOpen(true)}
            sx={{
              cursor: "pointer",
              borderRadius: 999,
              px: 1.4,
              py: 1.1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.22)",
              userSelect: "none",
            }}
          >
            <Badge badgeContent={filtered.length} color="primary" sx={{ "& .MuiBadge-badge": { fontWeight: 900 } }}>
              <PlaylistPlayIcon />
            </Badge>

            <Typography sx={{ fontSize: 12, fontWeight: 950, color: "#0f172a" }}>Fila Cozinha</Typography>

            {countPrioridade > 0 && (
              <Chip
                size="small"
                icon={<BoltIcon sx={{ fontSize: 16 }} />}
                label={`${countPrioridade} prioridade`}
                sx={{
                  borderRadius: 999,
                  fontWeight: 950,
                  bgcolor: "rgba(239,68,68,0.12)",
                  color: "#b91c1c",
                  "& .MuiChip-icon": { color: "#b91c1c" },
                }}
              />
            )}

            {!canLoad && (
              <Chip
                size="small"
                icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
                label="sem config"
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                  bgcolor: "rgba(239,68,68,0.10)",
                  color: "#b91c1c",
                }}
              />
            )}
          </Paper>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 360, sm: 420 },
            maxWidth: "92vw",
            borderTopLeftRadius: 18,
            borderBottomLeftRadius: 18,
            overflow: "hidden",
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.6,
            borderBottom: "1px solid rgba(148,163,184,0.35)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,251,0.98))",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Typography sx={{ fontWeight: 950, color: "#0f172a", lineHeight: 1.1 }}>Pedidos na fila</Typography>

              <Tooltip title="Atualizar agora">
                <span>
                  <IconButton
                    onClick={loadFila}
                    size="small"
                    disabled={!canLoad || loading}
                    sx={{ border: "1px solid rgba(148,163,184,0.45)", borderRadius: 2, width: 38, height: 38 }}
                  >
                    {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Box sx={{ mt: 1.1, display: "flex", gap: 1 }}>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                size="small"
                placeholder="Buscar pedido, item, cliente ou mesa..."
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Tooltip title={pinPrioridade ? "Prioridade fixada no topo" : "Fixar prioridade no topo"}>
                <IconButton
                  onClick={() => setPinPrioridade((v) => !v)}
                  size="small"
                  sx={{
                    border: "1px solid rgba(148,163,184,0.45)",
                    borderRadius: 2,
                    width: 42,
                    height: 40,
                  }}
                >
                  {pinPrioridade ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ mt: 1.1, display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
              <Chip
                size="small"
                label={`${filtered.length} item(ns)`}
                sx={{ borderRadius: 999, fontWeight: 950, bgcolor: "rgba(2,6,23,0.06)" }}
              />
              {countPrioridade > 0 && (
                <Chip
                  size="small"
                  icon={<BoltIcon sx={{ fontSize: 16 }} />}
                  label={`${countPrioridade} prioridade`}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 950,
                    bgcolor: "rgba(239,68,68,0.12)",
                    color: "#b91c1c",
                    "& .MuiChip-icon": { color: "#b91c1c" },
                  }}
                />
              )}
              {!!lastOkAtRef.current && (
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 900 }}>
                  última sync: {new Date(lastOkAtRef.current).toLocaleTimeString("pt-BR")}
                </Typography>
              )}
            </Box>
          </Box>

          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ p: 1.6, height: "100%", overflowY: "auto", bgcolor: "rgba(2,6,23,0.02)" }}>
          <Divider sx={{ mb: 1.2 }} />

          {!canLoad ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={950}>Fila não carregou</Typography>
              <Typography variant="caption" color="text.secondary">
                Falta <b>restauranteId</b> ou <b>apiUrl</b>. Passe os dois no componente.
              </Typography>
            </Paper>
          ) : loading && filtered.length === 0 ? (
            <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={22} />
            </Box>
          ) : filtered.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={950}>Sem itens na fila 🎉</Typography>
              <Typography variant="caption" color="text.secondary">
                Se você acabou de criar um pedido, confirme se ele entra na rota <b>/fila-cozinha</b>.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.2}>
              {filtered.map((i) => {
                const key = uniqKey(i);

                const numeroPedido = getNumeroPedidoFromFilaItem(i);
                const origem = getOrigemFromFilaItem(i);
                const mesaNum = getMesaNumeroFromFilaItem(i);
                const labelAcao = getActionLabel(i);

                const tipo = getTipoChip(i);

                const itemNome = safeStr(i?.item?.nome || "Item");
                const qtd = Number(i?.item?.quantidade || 1);
                const obs = safeStr(i?.item?.observacao || "");
                const tempo = fmtDuration(getFilaItemElapsedSeconds(i, nowTick));

                const isBusy = busyKeys.has(key);

                return (
                  <Paper
                    key={key}
                    variant="outlined"
                    sx={{
                      p: 1.3,
                      borderRadius: 3,
                      bgcolor: "#fff",
                      border: i.prioridade ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(148,163,184,0.35)",
                      boxShadow: i.prioridade ? "0 10px 22px rgba(239,68,68,0.08)" : "none",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 950, color: "#0f172a" }} noWrap>
                          Pedido {numeroPedido || `#${String(i.pedidoId || i._id).slice(-6)}`}
                        </Typography>

                        <Box sx={{ mt: 0.6, display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                          <Chip size="small" label={tipo.label} sx={chipSxByTone(tipo.tone)} />

                          {(origem === "salao" || origem === "salão") && mesaNum ? (
                            <Chip size="small" label={`Mesa ${mesaNum}`} sx={chipSxByTone("green")} />
                          ) : null}

                          {i.prioridade ? (
                            <Chip
                              size="small"
                              icon={<BoltIcon sx={{ fontSize: 16 }} />}
                              label="PRIORIDADE"
                              sx={{
                                borderRadius: 999,
                                fontWeight: 950,
                                bgcolor: "rgba(239,68,68,0.12)",
                                color: "#b91c1c",
                                "& .MuiChip-icon": { color: "#b91c1c" },
                              }}
                            />
                          ) : null}
                        </Box>
                      </Box>

                      <Chip
                        size="small"
                        icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                        label={tempo}
                        sx={{
                          borderRadius: 999,
                          fontWeight: 950,
                          bgcolor: "rgba(2,6,23,0.06)",
                          alignSelf: "flex-start",
                        }}
                      />
                    </Box>

                    <Typography sx={{ mt: 0.9, fontWeight: 950, color: "#334155" }}>
                      {qtd}x {itemNome}
                    </Typography>

                    {!!obs && (
                      <Typography variant="caption" sx={{ color: "#b91c1c", fontWeight: 900, display: "block", mt: 0.4 }}>
                        Obs: {obs}
                      </Typography>
                    )}

                    <Stack spacing={0.8} sx={{ mt: 1.2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DoneAllIcon />}
                        onClick={() => marcarPronto(i)}
                        disabled={isBusy}
                        sx={{ fontWeight: 950, borderRadius: 2.2, textTransform: "none" }}
                      >
                        {labelAcao}
                      </Button>

                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestaurantIcon />}
                        onClick={() => onOpenPedido?.(i.pedidoId || i._id)}
                        sx={{ fontWeight: 900, textTransform: "none", borderRadius: 2 }}
                      >
                        Ver pedido
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          <Box sx={{ height: 90 }} />
        </Box>
      </Drawer>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeSnack} severity={snack.severity} variant="filled" sx={{ fontWeight: 900 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
