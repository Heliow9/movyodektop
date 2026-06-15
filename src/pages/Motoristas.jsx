import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  atualizarEntregador,
  criarEntregador,
  excluirEntregador,
  fetchEntregadores,
} from "../services/api";

function getRestauranteId() {
  return (
    localStorage.getItem("_id") ||
    localStorage.getItem("restauranteId") ||
    localStorage.getItem("idRestaurante") ||
    ""
  );
}

const emptyForm = { nome: "", email: "", cpf: "", senha: "" };

export default function Motoristas() {
  const [restauranteId, setRestauranteId] = useState(getRestauranteId());
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [snackbar, setSnackbar] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sessao = await window.electron?.obterSessao?.();
        if (alive && sessao?.restauranteId) setRestauranteId(sessao.restauranteId);
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, []);

  const carregar = async () => {
    if (!restauranteId) return;
    try {
      setLoading(true);
      const { data } = await fetchEntregadores(restauranteId);
      setMotoristas(Array.isArray(data) ? data : data?.entregadores || []);
    } catch (err) {
      console.error("Erro ao carregar motoristas:", err);
      setSnackbar({ open: true, severity: "error", message: "Erro ao carregar motoristas." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [restauranteId]);

  const abrirNovo = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const abrirEditar = (m) => {
    setEditing(m);
    setForm({ nome: m.nome || "", email: m.email || "", cpf: m.cpf || "", senha: "" });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.email.trim() || !form.cpf.trim()) {
      setSnackbar({ open: true, severity: "warning", message: "Nome, e-mail e CPF são obrigatórios." });
      return;
    }
    if (!editing && !form.senha.trim()) {
      setSnackbar({ open: true, severity: "warning", message: "Informe uma senha inicial para o motorista." });
      return;
    }

    try {
      setSaving(true);
      if (editing?._id) {
        const payload = { nome: form.nome, email: form.email, cpf: form.cpf };
        if (form.senha.trim()) payload.senha = form.senha.trim();
        await atualizarEntregador(editing._id, payload);
      } else {
        await criarEntregador({ ...form, restauranteId });
      }
      setOpen(false);
      await carregar();
      setSnackbar({ open: true, severity: "success", message: editing ? "Motorista atualizado." : "Motorista cadastrado." });
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Erro ao salvar motorista.";
      setSnackbar({ open: true, severity: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const alternarBloqueio = async (m) => {
    const bloqueado = String(m.statusConta || "ativo").toLowerCase() === "bloqueado" || m.status === false;
    try {
      await atualizarEntregador(m._id, { statusConta: bloqueado ? "ativo" : "bloqueado" });
      await carregar();
      setSnackbar({ open: true, severity: "success", message: bloqueado ? "Motorista reativado." : "Motorista bloqueado." });
    } catch (err) {
      setSnackbar({ open: true, severity: "error", message: "Erro ao alterar acesso do motorista." });
    }
  };

  const remover = async (m) => {
    if (!window.confirm(`Excluir motorista ${m.nome}?`)) return;
    try {
      await excluirEntregador(m._id);
      await carregar();
      setSnackbar({ open: true, severity: "success", message: "Motorista excluído." });
    } catch (err) {
      setSnackbar({ open: true, severity: "error", message: "Erro ao excluir motorista." });
    }
  };

  const ativos = useMemo(() => motoristas.filter((m) => String(m.statusConta || "ativo").toLowerCase() !== "bloqueado" && m.status !== false).length, [motoristas]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: "100vh", background: "linear-gradient(180deg, #fff8fc 0%, #f4f7fb 100%)" }}>
      <Paper sx={{ p: 2.5, borderRadius: 4, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0A2A4A" }}>Motoristas</Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>Cadastre, edite e bloqueie o acesso dos entregadores.</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip icon={<LocalShippingIcon />} label={`${ativos} ativos`} color="success" sx={{ fontWeight: 800 }} />
          <Tooltip title="Atualizar"><IconButton onClick={carregar}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovo} sx={{ borderRadius: 3, fontWeight: 900 }}>Novo motorista</Button>
        </Stack>
      </Paper>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : motoristas.length === 0 ? (
        <Paper sx={{ p: 5, borderRadius: 4, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 900 }}>Nenhum motorista cadastrado ainda.</Typography>
          <Button sx={{ mt: 2 }} variant="contained" onClick={abrirNovo}>Cadastrar primeiro motorista</Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {motoristas.map((m) => {
            const bloqueado = String(m.statusConta || "ativo").toLowerCase() === "bloqueado" || m.status === false;
            return (
              <Grid item xs={12} md={6} lg={4} key={m._id}>
                <Paper sx={{ p: 2.2, borderRadius: 4, border: "1px solid rgba(148,163,184,.25)" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 950, fontSize: 18 }}>{m.nome}</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", wordBreak: "break-all" }}>{m.email}</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b" }}>CPF: {m.cpf || "—"}</Typography>
                    </Box>
                    <Chip size="small" color={bloqueado ? "default" : "success"} label={bloqueado ? "Bloqueado" : "Ativo"} sx={{ fontWeight: 800 }} />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => abrirEditar(m)}>Editar</Button>
                    <Button size="small" color={bloqueado ? "success" : "warning"} startIcon={bloqueado ? <CheckCircleIcon /> : <BlockIcon />} onClick={() => alternarBloqueio(m)}>
                      {bloqueado ? "Ativar" : "Bloquear"}
                    </Button>
                    <IconButton size="small" color="error" onClick={() => remover(m)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>{editing ? "Editar motorista" : "Novo motorista"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} fullWidth />
            <TextField label="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} fullWidth />
            <TextField label={editing ? "Nova senha (opcional)" : "Senha inicial"} type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
