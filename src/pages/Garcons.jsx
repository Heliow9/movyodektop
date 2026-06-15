// pages/Garcons.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { attachAccessGuardInterceptor } from "../services/api";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Tooltip,
  Snackbar,
  Alert,
  Grid,
  Paper,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import GroupIcon from "@mui/icons-material/Group";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import BadgeIcon from "@mui/icons-material/Badge";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import LockResetIcon from "@mui/icons-material/LockReset";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";


const brand = {
  grad: "linear-gradient(180deg, #ff3b8a 0%, #ff9b2d 100%)",
  gradSoft:
    "linear-gradient(180deg, rgba(255,59,138,0.14) 0%, rgba(255,155,45,0.14) 100%)",
  bg: "#f3f6fb",
  text: "#0f172a",
  muted: "#64748b",
  border: "rgba(15,23,42,0.10)",
};

// ✅ lista oficial de permissões do painel (fonte única)
const DEFAULT_PERMS = {
  verPedidos: true,
  verMesas: true,
  abrirMesa: true,
  adicionarItem: true,
  fecharConta: false,
  cancelarPedido: false,
};

// ✅ garante que sempre exista todas as chaves (pra não quebrar UI / salvar)
const normalizePerms = (perms) => {
  const p = perms && typeof perms === "object" ? perms : {};
  return Object.fromEntries(
    Object.keys(DEFAULT_PERMS).map((k) => {
      if (p[k] === true || p[k] === "true") return [k, true];
      if (p[k] === false || p[k] === "false") return [k, false];
      return [k, DEFAULT_PERMS[k]];
    })
  );
};

const emptyForm = {
  nome: "",
  apelido: "",
  telefone: "",
  pin: "",
  permissoes: { ...DEFAULT_PERMS },
};

// ✅ pega token de qualquer chave que você use
const getToken = () =>
  localStorage.getItem("_token") ||
  localStorage.getItem("tokenRestaurante") ||
  "";

// ✅ normaliza sempre como Bearer
const asBearer = (t) => {
  const token = String(t || "").trim();
  if (!token) return "";
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

const api = axios.create({ baseURL: API_URL });

// encerra a sessão se a API informar bloqueio ou licença vencida
attachAccessGuardInterceptor(api);

// ✅ Interceptor único: anexa Authorization corretamente
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    const bearer = asBearer(token);
    if (bearer) config.headers = { ...(config.headers || {}), Authorization: bearer };
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- UI helpers ----------
const permDefs = [
  {
    key: "verPedidos",
    label: "Ver pedidos",
    desc: "Permite visualizar pedidos do salão e comandas.",
    icon: <VisibilityIcon />,
  },
  {
    key: "verMesas",
    label: "Ver mesas",
    desc: "Permite visualizar a lista de mesas do salão.",
    icon: <TableRestaurantIcon />,
  },
  {
    key: "abrirMesa",
    label: "Abrir mesa",
    desc: "Permite abrir mesa e iniciar comanda.",
    icon: <TableRestaurantIcon />,
  },
  {
    key: "adicionarItem",
    label: "Adicionar item",
    desc: "Permite adicionar produtos na comanda da mesa.",
    icon: <AddIcon />,
  },
  {
    key: "fecharConta",
    label: "Fechar conta",
    desc: "Permite finalizar comanda e fechar a mesa.",
    icon: <PointOfSaleIcon />,
  },
  {
    key: "cancelarPedido",
    label: "Cancelar pedido",
    desc: "Permite cancelar pedido/item (com auditoria).",
    icon: <CancelIcon />,
  },
];

const phoneToDigits = (v) => String(v || "").replace(/\D/g, "");
const prettyPhone = (v) => {
  const d = phoneToDigits(v);
  if (!d) return "—";
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
};

export default function Garcons() {
  const [loading, setLoading] = useState(false);
  const [garcons, setGarcons] = useState([]);
  const [busca, setBusca] = useState("");

  // modal criar/editar
  const [openModal, setOpenModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [garcomEditandoId, setGarcomEditandoId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // modal detalhes
  const [openDetalhes, setOpenDetalhes] = useState(false);
  const [garcomSelecionadoId, setGarcomSelecionadoId] = useState(null);

  const garcomSelecionado = useMemo(() => {
    if (!garcomSelecionadoId) return null;
    return garcons.find((g) => g._id === garcomSelecionadoId) || null;
  }, [garcomSelecionadoId, garcons]);

  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showToast = (severity, message) =>
    setToast({ open: true, severity, message });

  const ensureTokenOrWarn = () => {
    const token = getToken();
    if (!String(token || "").trim()) {
      showToast("warning", "Você não está logado. Token não encontrado no navegador.");
      return false;
    }
    return true;
  };

  const extractErrMessage = (err, fallback = "Erro.") => {
    const data = err?.response?.data;
    if (data?.message) return data.message;
    if (data?.mensagem) return data.mensagem;
    if (data?.error && typeof data.error === "string") return data.error;

    if (Array.isArray(data?.errors) && data.errors.length) {
      return data.errors.map((e) => e?.message || e?.mensagem || String(e)).join(" | ");
    }

    if (typeof data === "string") return data;
    try {
      if (data) return JSON.stringify(data);
    } catch { }
    return fallback;
  };

  const fetchGarcons = async () => {
    if (!ensureTokenOrWarn()) return;

    setLoading(true);
    try {
      const res = await api.get("/api/garcons");
      const lista = Array.isArray(res.data) ? res.data : [];

      // ✅ normaliza permissões de todos (se backend vier sem verMesas, UI não quebra)
      const normalized = lista.map((g) => ({
        ...g,
        permissoes: normalizePerms(g?.permissoes),
      }));

      setGarcons(normalized);
    } catch (err) {
      console.error("ERRO LISTAR GARÇONS:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      showToast("error", extractErrMessage(err, "Erro ao listar garçons."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarcons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const garconsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return garcons;
    return garcons.filter((g) => {
      const nome = (g.nome || "").toLowerCase();
      const apelido = (g.apelido || "").toLowerCase();
      const tel = phoneToDigits(g.telefone || "").toLowerCase();
      return nome.includes(q) || apelido.includes(q) || tel.includes(q);
    });
  }, [busca, garcons]);

  const totalAtivos = useMemo(
    () => garcons.filter((g) => g.ativo !== false).length,
    [garcons]
  );

  const abrirCriacao = () => {
    setModoEdicao(false);
    setGarcomEditandoId(null);
    setForm({ ...emptyForm, permissoes: { ...DEFAULT_PERMS } });
    setOpenModal(true);
  };

  const abrirEdicao = (g) => {
    setModoEdicao(true);
    setGarcomEditandoId(g._id);
    setForm({
      nome: g.nome || "",
      apelido: g.apelido || "",
      telefone: g.telefone || "",
      pin: "", // opcional na edição
      permissoes: normalizePerms(g?.permissoes),
    });
    setOpenModal(true);
  };

  const abrirDetalhes = (g) => {
    setGarcomSelecionadoId(g._id);
    setOpenDetalhes(true);
  };

  const fecharModal = () => setOpenModal(false);
  const fecharDetalhes = () => setOpenDetalhes(false);

  const setPermissao = (key, value) => {
    setForm((prev) => ({
      ...prev,
      permissoes: { ...normalizePerms(prev.permissoes), [key]: !!value },
    }));
  };

  const validar = () => {
    const nome = String(form.nome || "").trim();
    const telefone = String(form.telefone || "").trim();
    const pin = String(form.pin || "").trim();
    const telNorm = phoneToDigits(telefone);

    if (!nome) return "Nome é obrigatório.";
    if (!telNorm || telNorm.length < 8) return "Telefone é obrigatório.";

    if (!modoEdicao) {
      if (!pin) return "PIN é obrigatório.";
      if (pin.length < 4) return "PIN deve ter pelo menos 4 dígitos.";
    } else {
      if (pin && pin.length < 4) return "PIN deve ter pelo menos 4 dígitos.";
    }
    return null;
  };

  const salvar = async () => {
    if (!ensureTokenOrWarn()) return;

    const erro = validar();
    if (erro) return showToast("warning", erro);

    setLoading(true);
    try {
      const payload = {
        nome: String(form.nome || "").trim(),
        apelido: String(form.apelido || "").trim() || null,
        telefone: String(form.telefone || "").trim(),
        // ✅ garante que sempre manda as chaves completas
        permissoes: normalizePerms(form.permissoes),
      };

      const pin = String(form.pin || "").trim();
      if (!modoEdicao || pin) payload.pin = pin;

      if (modoEdicao && garcomEditandoId) {
        await api.put(`/api/garcons/${garcomEditandoId}`, payload);
        showToast("success", "Garçom atualizado!");
      } else {
        await api.post("/api/garcons", payload);
        showToast("success", "Garçom criado!");
      }

      fecharModal();
      await fetchGarcons();
    } catch (err) {
      console.error("ERRO CRIAR/EDITAR GARÇOM:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      showToast("error", extractErrMessage(err, "Erro ao salvar."));
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (garcomId) => {
    if (!ensureTokenOrWarn()) return;

    setLoading(true);
    try {
      await api.patch(`/api/garcons/${garcomId}/toggle`, {});
      await fetchGarcons();
      showToast("success", "Status atualizado!");
    } catch (err) {
      showToast("error", extractErrMessage(err, "Erro ao alterar status."));
    } finally {
      setLoading(false);
    }
  };

  const remover = async (garcomId) => {
    if (!ensureTokenOrWarn()) return;

    const ok = window.confirm("Deseja remover este garçom?");
    if (!ok) return;

    setLoading(true);
    try {
      await api.delete(`/api/garcons/${garcomId}`);
      await fetchGarcons();
      showToast("success", "Garçom removido!");
      if (garcomSelecionadoId === garcomId) fecharDetalhes();
    } catch (err) {
      showToast("error", extractErrMessage(err, "Erro ao remover."));
    } finally {
      setLoading(false);
    }
  };

  const chipStyle = {
    height: 28,
    fontWeight: 900,
    borderRadius: 999,
    border: `1px solid ${brand.border}`,
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(6px)",
  };

  const permChip = (enabled) => ({
    height: 26,
    borderRadius: 999,
    fontWeight: 900,
    border: `1px solid ${brand.border}`,
    background: enabled ? brand.gradSoft : "rgba(255,255,255,0.85)",
    color: enabled ? "#ff3b8a" : brand.muted,
  });

  const PermItemCard = ({ def }) => {
    const enabled = !!form?.permissoes?.[def.key];
    return (
      <Paper
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: 3,
          border: `1px solid ${brand.border}`,
          background: enabled ? brand.gradSoft : "rgba(255,255,255,0.92)",
          display: "flex",
          alignItems: "center",
          gap: 1.2,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            background: enabled ? "rgba(255,59,138,0.18)" : "rgba(15,23,42,0.06)",
            color: enabled ? "#ff3b8a" : brand.muted,
            border: `1px solid ${brand.border}`,
          }}
        >
          {def.icon}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, color: brand.text, fontSize: 13, lineHeight: 1.1 }}>
            {def.label}
          </Typography>
          <Typography sx={{ color: brand.muted, fontSize: 12, mt: 0.3, lineHeight: 1.2 }}>
            {def.desc}
          </Typography>
        </Box>

        <Switch checked={enabled} onChange={(e) => setPermissao(def.key, e.target.checked)} />
      </Paper>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", background: brand.bg, p: 2 }}>
      {/* HEADER */}
      <Box
        sx={{
          borderRadius: 4,
          background: brand.grad,
          p: 2.2,
          boxShadow: "0 18px 45px rgba(255,59,138,0.18)",
          position: "relative",
          overflow: "hidden",
          mb: 2,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            right: -60,
            top: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: -80,
            bottom: -80,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.10)",
          }}
        />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.6}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
          sx={{ position: "relative" }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.22)",
                color: "#fff",
              }}
            >
              <GroupIcon />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>
                Garçons
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.85)", mt: 0.2 }}>
                Cadastre garçons, permissões e status
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Total: ${garcons.length}`} sx={{ ...chipStyle, color: "#ff3b8a" }} />
              <Chip label={`Ativos: ${totalAtivos}`} sx={{ ...chipStyle, color: "#16a34a" }} />
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                onClick={fetchGarcons}
                disabled={loading}
                startIcon={<RefreshIcon />}
                sx={{
                  borderRadius: 2.5,
                  fontWeight: 900,
                  textTransform: "none",
                  px: 2,
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.12)",
                  "&:hover": { background: "rgba(255,255,255,0.18)" },
                }}
              >
                Atualizar
              </Button>

              <Button
                onClick={abrirCriacao}
                startIcon={<AddIcon />}
                disabled={loading}
                sx={{
                  borderRadius: 2.5,
                  fontWeight: 900,
                  textTransform: "none",
                  px: 2,
                  color: "#ff3b8a",
                  background: "#fff",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                  "&:hover": { background: "#fff", transform: "scale(1.02)" },
                  transition: "all 0.2s ease",
                }}
              >
                Novo garçom
              </Button>
            </Stack>
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <TextField
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, apelido ou telefone..."
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(15,23,42,0.55)" }} />
                </InputAdornment>
              ),
              endAdornment: busca ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setBusca("")}
                    sx={{ color: "rgba(15,23,42,0.55)" }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 3,
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
              },
            }}
          />

          {!!busca && (
            <Typography sx={{ mt: 0.8, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              Mostrando {garconsFiltrados.length} de {garcons.length}
            </Typography>
          )}
        </Box>
      </Box>

      {/* LISTA */}
      <Grid container spacing={2}>
        {loading && garcons.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} md={6} lg={4} key={`sk-${i}`}>
              <Card
                sx={{
                  borderRadius: 4,
                  border: `1px solid ${brand.border}`,
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Skeleton height={26} width="60%" />
                  <Skeleton height={18} width="50%" />
                  <Skeleton height={18} width="70%" />
                  <Divider sx={{ my: 1.5 }} />
                  <Skeleton height={18} width="30%" />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Skeleton height={26} width={92} />
                    <Skeleton height={26} width={92} />
                    <Skeleton height={26} width={92} />
                    <Skeleton height={26} width={120} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))
          : null}

        {!loading &&
          garconsFiltrados.map((g) => {
            const ativo = g.ativo !== false;

            return (
              <Grid item xs={12} md={6} lg={4} key={g._id}>
                <Card
                  onClick={() => abrirDetalhes(g)}
                  role="button"
                  tabIndex={0}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 4,
                    border: `1px solid ${brand.border}`,
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
                    transition: "transform .18s ease, box-shadow .18s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ pr: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 900, color: brand.text, fontSize: 16 }}>
                            {g.nome}
                          </Typography>

                          <Chip
                            size="small"
                            label={ativo ? "Ativo" : "Inativo"}
                            icon={ativo ? <CheckCircleRoundedIcon /> : <BlockRoundedIcon />}
                            sx={{
                              fontWeight: 900,
                              borderRadius: 999,
                              background: ativo
                                ? "rgba(34,197,94,0.12)"
                                : "rgba(239,68,68,0.12)",
                              color: ativo ? "#15803d" : "#b91c1c",
                              "& .MuiChip-icon": { color: "inherit" },
                            }}
                          />
                        </Stack>

                        <Typography sx={{ fontSize: 13, color: brand.muted, mt: 0.5 }}>
                          <b style={{ color: brand.text }}>{g.apelido || "—"}</b>
                        </Typography>

                        <Typography sx={{ fontSize: 13, color: brand.muted, mt: 0.2 }}>
                          <b style={{ color: brand.text }}>{prettyPhone(g.telefone)}</b>
                        </Typography>

                        <Typography sx={{ fontSize: 12, color: brand.muted, mt: 0.7 }}>
                          Atualizado:{" "}
                          <b style={{ color: brand.text }}>
                            {g.atualizadoEm ? dayjs(g.atualizadoEm).format("DD/MM/YYYY HH:mm") : "—"}
                          </b>
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.7} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title={ativo ? "Desativar" : "Ativar"}>
                          <IconButton
                            onClick={() => toggleAtivo(g._id)}
                            disabled={loading}
                            size="small"
                            sx={{
                              width: 36,
                              height: 36,
                              background: brand.gradSoft,
                              border: `1px solid ${brand.border}`,
                              "&:hover": { background: brand.gradSoft },
                            }}
                          >
                            <PowerSettingsNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Editar">
                          <IconButton
                            onClick={() => abrirEdicao(g)}
                            disabled={loading}
                            size="small"
                            sx={{
                              width: 36,
                              height: 36,
                              background: "rgba(255,255,255,0.95)",
                              border: `1px solid ${brand.border}`,
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Remover">
                          <IconButton
                            onClick={() => remover(g._id)}
                            disabled={loading}
                            size="small"
                            sx={{
                              width: 36,
                              height: 36,
                              background: "rgba(239,68,68,0.10)",
                              border: "1px solid rgba(239,68,68,0.18)",
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Typography sx={{ fontWeight: 900, color: brand.text, fontSize: 13, mb: 0.8 }}>
                      Permissões
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label="Ver pedidos" sx={permChip(!!g?.permissoes?.verPedidos)} />
                      <Chip size="small" label="Ver mesas" sx={permChip(!!g?.permissoes?.verMesas)} />
                      <Chip size="small" label="Abrir mesa" sx={permChip(!!g?.permissoes?.abrirMesa)} />
                      <Chip size="small" label="Fechar conta" sx={permChip(!!g?.permissoes?.fecharConta)} />
                      <Chip
                        size="small"
                        label="Cancelar pedido"
                        sx={permChip(!!g?.permissoes?.cancelarPedido)}
                      />
                    </Stack>

                    <Typography sx={{ mt: 1.2, fontSize: 12, color: brand.muted }}>
                      Clique no card para ver detalhes ✨
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}

        {!loading && garconsFiltrados.length === 0 ? (
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 4,
                border: `1px solid ${brand.border}`,
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
              }}
            >
              <Typography sx={{ fontWeight: 900, color: brand.text }}>Nenhum garçom encontrado</Typography>
              <Typography sx={{ color: brand.muted, mt: 0.5 }}>
                Clique em <b>Novo garçom</b> para cadastrar o primeiro.
              </Typography>
            </Paper>
          </Grid>
        ) : null}
      </Grid>

      {/* MODAL DETALHES */}
      <Dialog open={openDetalhes} onClose={fecharDetalhes} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{ fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span>Detalhes do garçom</span>
          <IconButton onClick={fecharDetalhes}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {!garcomSelecionado ? (
            <Typography sx={{ color: brand.muted }}>Selecione um garçom.</Typography>
          ) : (
            <>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  border: `1px solid ${brand.border}`,
                  background: "rgba(255,255,255,0.92)",
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Avatar sx={{ bgcolor: "rgba(255,59,138,0.16)", color: "#ff3b8a", fontWeight: 900 }}>
                    {(garcomSelecionado?.nome || "G").slice(0, 1).toUpperCase()}
                  </Avatar>

                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 900, color: brand.text, fontSize: 16, lineHeight: 1.1 }}>
                      {garcomSelecionado.nome}
                    </Typography>
                    <Typography sx={{ color: brand.muted, fontWeight: 800, fontSize: 13, mt: 0.3 }}>
                      {garcomSelecionado.apelido ? `“${garcomSelecionado.apelido}”` : "—"}
                    </Typography>
                  </Box>

                  <Chip
                    label={garcomSelecionado.ativo !== false ? "Ativo" : "Inativo"}
                    sx={{
                      fontWeight: 900,
                      borderRadius: 999,
                      background:
                        garcomSelecionado.ativo !== false ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: garcomSelecionado.ativo !== false ? "#15803d" : "#b91c1c",
                    }}
                  />
                </Stack>

                <Divider sx={{ my: 1.3 }} />

                <List dense sx={{ py: 0 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <BadgeIcon sx={{ color: "rgba(15,23,42,0.55)" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="ID"
                      secondary={garcomSelecionado._id}
                      primaryTypographyProps={{ fontWeight: 900, fontSize: 12 }}
                      secondaryTypographyProps={{ fontWeight: 800, fontSize: 12, color: brand.text }}
                    />
                  </ListItem>

                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <PhoneIphoneIcon sx={{ color: "rgba(15,23,42,0.55)" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Telefone"
                      secondary={prettyPhone(garcomSelecionado.telefone)}
                      primaryTypographyProps={{ fontWeight: 900, fontSize: 12 }}
                      secondaryTypographyProps={{ fontWeight: 800, fontSize: 12, color: brand.text }}
                    />
                  </ListItem>

                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <RefreshIcon sx={{ color: "rgba(15,23,42,0.55)" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Atualizado em"
                      secondary={
                        garcomSelecionado.atualizadoEm
                          ? dayjs(garcomSelecionado.atualizadoEm).format("DD/MM/YYYY HH:mm")
                          : "—"
                      }
                      primaryTypographyProps={{ fontWeight: 900, fontSize: 12 }}
                      secondaryTypographyProps={{ fontWeight: 800, fontSize: 12, color: brand.text }}
                    />
                  </ListItem>
                </List>
              </Paper>

              <Typography sx={{ mt: 2, fontWeight: 900, color: brand.text }}>
                Itens personalizados (permissões)
              </Typography>
              <Typography sx={{ mt: 0.4, color: brand.muted, fontWeight: 700, fontSize: 12 }}>
                Visualização clara do que esse garçom pode fazer no app.
              </Typography>

              <Grid container spacing={1.2} sx={{ mt: 1 }}>
                {permDefs.map((p) => {
                  const enabled = !!garcomSelecionado?.permissoes?.[p.key];
                  return (
                    <Grid item xs={12} key={`det-${p.key}`}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.25,
                          borderRadius: 3,
                          border: `1px solid ${brand.border}`,
                          background: enabled ? brand.gradSoft : "rgba(255,255,255,0.92)",
                          display: "flex",
                          alignItems: "center",
                          gap: 1.2,
                        }}
                      >
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: 2.5,
                            display: "grid",
                            placeItems: "center",
                            background: enabled ? "rgba(255,59,138,0.18)" : "rgba(15,23,42,0.06)",
                            color: enabled ? "#ff3b8a" : brand.muted,
                            border: `1px solid ${brand.border}`,
                          }}
                        >
                          {p.icon}
                        </Box>

                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 900, color: brand.text, fontSize: 13 }}>
                            {p.label}
                          </Typography>
                          <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700 }}>
                            {p.desc}
                          </Typography>
                        </Box>

                        <Chip
                          label={enabled ? "Liberado" : "Bloqueado"}
                          sx={{
                            fontWeight: 900,
                            borderRadius: 999,
                            background: enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                            color: enabled ? "#15803d" : "#b91c1c",
                          }}
                        />
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          {garcomSelecionado ? (
            <>
              <Button
                onClick={() => toggleAtivo(garcomSelecionado._id)}
                disabled={loading}
                startIcon={<PowerSettingsNewIcon />}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}
              >
                {garcomSelecionado.ativo !== false ? "Desativar" : "Ativar"}
              </Button>

              <Button
                onClick={() => abrirEdicao(garcomSelecionado)}
                disabled={loading}
                startIcon={<EditIcon />}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}
              >
                Editar
              </Button>

              <Button
                onClick={fecharDetalhes}
                variant="contained"
                sx={{
                  borderRadius: 2,
                  fontWeight: 900,
                  textTransform: "none",
                  background: brand.grad,
                  "&:hover": { opacity: 0.95, background: brand.grad },
                }}
              >
                Fechar
              </Button>
            </>
          ) : (
            <Button onClick={fecharDetalhes} variant="contained" sx={{ borderRadius: 2 }}>
              Fechar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* MODAL CRIAR/EDITAR */}
      <Dialog open={openModal} onClose={fecharModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{modoEdicao ? "Editar garçom" : "Novo garçom"}</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              fullWidth
            />

            <TextField
              label="Apelido (opcional)"
              value={form.apelido}
              onChange={(e) => setForm((p) => ({ ...p, apelido: e.target.value }))}
              fullWidth
            />

            <TextField
              label="Telefone"
              value={form.telefone}
              onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
              fullWidth
              helperText="Obrigatório e único (usado no login do app do garçom)."
            />

            <TextField
              label={modoEdicao ? "Novo PIN (opcional)" : "PIN"}
              value={form.pin}
              onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value }))}
              fullWidth
              helperText={
                modoEdicao
                  ? "Preencha somente se quiser redefinir o PIN (mín. 4 dígitos)."
                  : "Obrigatório (mín. 4 dígitos)."
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <LockResetIcon sx={{ color: "rgba(15,23,42,0.45)" }} />
                  </InputAdornment>
                ),
              }}
            />

            <Divider />

            <Typography sx={{ fontWeight: 900, color: brand.text }}>Permissões (itens personalizados)</Typography>
            <Typography sx={{ color: brand.muted, fontWeight: 700, fontSize: 12 }}>
              Visual mais claro (ícone + descrição). Perfeito pra o dono entender rápido.
            </Typography>

            <Grid container spacing={1.2}>
              {permDefs.map((def) => (
                <Grid item xs={12} key={`perm-${def.key}`}>
                  <PermItemCard def={def} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={fecharModal} sx={{ borderRadius: 2, textTransform: "none" }}>
            Cancelar
          </Button>

          <Button
            onClick={salvar}
            variant="contained"
            disabled={loading}
            sx={{
              borderRadius: 2,
              fontWeight: 900,
              textTransform: "none",
              background: brand.grad,
              "&:hover": { opacity: 0.95, background: brand.grad },
            }}
          >
            {modoEdicao ? "Salvar alterações" : "Criar garçom"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          sx={{ fontWeight: 800 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
