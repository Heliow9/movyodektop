// CategoriasTab.jsx — Movyo UI (Pizza 2 Sabores + LISTAGEM + TiposExtras min/max)

import React, { useEffect, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Divider,
  FormControlLabel,
  Switch,
  IconButton,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Chip,
  MenuItem,
  Tooltip,
  Alert,
} from "@mui/material";
import axios from "axios";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

const TIPO_CATEGORIA = {
  SIMPLES: "simples",
  PIZZA: "pizza",
  PIZZA_DUAS: "pizza_duas",
};

export default function CategoriasTab({ handleSnackbar }) {
  const restauranteId = localStorage.getItem("_id");

  const [categorias, setCategorias] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [categoriaEditada, setCategoriaEditada] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    categoriaId: null,
  });

  const [novaCategoria, setNovaCategoria] = useState({
    nome: "",
    tipoCategoria: TIPO_CATEGORIA.SIMPLES,
    permiteSabores: false,
    permiteBordas: false,
    permiteAdicionais: false,
    tiposExtras: [],
    pizzaMultisabor: false,
    calculoPrecoPor: "maior",
  });

  const [novoTipoExtra, setNovoTipoExtra] = useState({
    nome: "",
    obrigatorio: false,
    tipoSelecion: "unico",
    maximoSelecionados: 1,
    minimoSelecionados: 0,
    itens: [],
  });

  // ======================
  // FETCH
  // ======================
  const fetchCategorias = async () => {
    if (!restauranteId) {
      handleSnackbar(
        "Restaurante não identificado (sem _id no localStorage).",
        "error"
      );
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/api/categorias/${restauranteId}`);
      setCategorias(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
      handleSnackbar("Erro ao carregar categorias", "error");
    }
  };

  useEffect(() => {
    fetchCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================
  // REGRAS AUTOMÁTICAS
  // ======================
  useEffect(() => {
    if (novaCategoria.tipoCategoria === TIPO_CATEGORIA.PIZZA_DUAS) {
      setNovaCategoria((prev) => ({
        ...prev,
        pizzaMultisabor: true,
        permiteSabores: true,
        tiposExtras: (prev.tiposExtras || []).filter(
          (t) => String(t?.nome || "").trim().toLowerCase() !== "sabores"
        ),
      }));
      return;
    }

    if (novaCategoria.tipoCategoria === TIPO_CATEGORIA.PIZZA) {
      setNovaCategoria((prev) => ({
        ...prev,
        pizzaMultisabor: false,
        permiteSabores: true,
      }));
      return;
    }

    // SIMPLES
    setNovaCategoria((prev) => ({
      ...prev,
      pizzaMultisabor: false,
      permiteSabores: false,
      calculoPrecoPor: "maior",
    }));
  }, [novaCategoria.tipoCategoria]);

  // ======================
  // CRIAR CATEGORIA
  // ======================
  const adicionarCategoria = async () => {
    if (!novaCategoria.nome.trim()) {
      handleSnackbar("O nome da categoria é obrigatório", "error");
      return;
    }

    if (!restauranteId) {
      handleSnackbar(
        "Restaurante não identificado (sem _id no localStorage).",
        "error"
      );
      return;
    }

    try {
      await axios.post(`${API_URL}/api/categorias`, {
        ...novaCategoria,
        restaurante: restauranteId,
      });

      setNovaCategoria({
        nome: "",
        tipoCategoria: TIPO_CATEGORIA.SIMPLES,
        permiteSabores: false,
        permiteBordas: false,
        permiteAdicionais: false,
        tiposExtras: [],
        pizzaMultisabor: false,
        calculoPrecoPor: "maior",
      });

      setNovoTipoExtra({
        nome: "",
        obrigatorio: false,
        tipoSelecion: "unico",
        maximoSelecionados: 1,
        minimoSelecionados: 0,
        itens: [],
      });

      fetchCategorias();
      handleSnackbar("Categoria adicionada!");
    } catch (err) {
      console.error("Erro ao adicionar categoria:", err);
      handleSnackbar("Erro ao adicionar categoria", "error");
    }
  };

  // ======================
  // TIPOS EXTRAS (VALIDADOS + min/max)
  // ======================
  const normalizarMinMax = (tipo) => {
    const out = { ...tipo };
    const min = Number(out.minimoSelecionados ?? 0);
    const max = Number(out.maximoSelecionados ?? 1);

    // sane defaults
    out.minimoSelecionados = Number.isFinite(min) ? min : 0;
    out.maximoSelecionados = Number.isFinite(max) ? max : 1;

    if (out.maximoSelecionados < 1) out.maximoSelecionados = 1;
    if (out.minimoSelecionados < 0) out.minimoSelecionados = 0;

    // garante min <= max
    if (out.minimoSelecionados > out.maximoSelecionados) {
      out.maximoSelecionados = out.minimoSelecionados;
    }

    return out;
  };

  const adicionarTipoExtra = () => {
    if (!novoTipoExtra.nome.trim()) {
      handleSnackbar("O nome do tipo personalizado é obrigatório", "error");
      return;
    }

    if (
      novaCategoria.tipoCategoria === TIPO_CATEGORIA.PIZZA_DUAS &&
      String(novoTipoExtra.nome).trim().toLowerCase() === "sabores"
    ) {
      handleSnackbar(
        "Sabores devem ser cadastrados no produto, não como tipo extra.",
        "warning"
      );
      return;
    }

    const nomeLower = String(novoTipoExtra.nome).trim().toLowerCase();
    const jaExiste = (novaCategoria.tiposExtras || []).some(
      (t) => String(t?.nome || "").trim().toLowerCase() === nomeLower
    );
    if (jaExiste) {
      handleSnackbar("Já existe um tipo extra com esse nome.", "warning");
      return;
    }

    let payload = { ...novoTipoExtra };

    // se for unico, força min/max padrão
    if (payload.tipoSelecion === "unico") {
      payload.minimoSelecionados = 0;
      payload.maximoSelecionados = 1;
    } else {
      payload = normalizarMinMax(payload);
    }

    // valida obrigatoriedade + min
    if (payload.tipoSelecion === "multiplo" && payload.obrigatorio) {
      if ((payload.minimoSelecionados || 0) < 1) payload.minimoSelecionados = 1;
      if ((payload.maximoSelecionados || 1) < payload.minimoSelecionados) {
        payload.maximoSelecionados = payload.minimoSelecionados;
      }
    }

    setNovaCategoria((prev) => ({
      ...prev,
      tiposExtras: [...(prev.tiposExtras || []), payload],
    }));

    setNovoTipoExtra({
      nome: "",
      obrigatorio: false,
      tipoSelecion: "unico",
      maximoSelecionados: 1,
      minimoSelecionados: 0,
      itens: [],
    });
  };

  const removerTipoExtra = (index) => {
    setNovaCategoria((prev) => ({
      ...prev,
      tiposExtras: (prev.tiposExtras || []).filter((_, i) => i !== index),
    }));
  };

  const labelTipoExtraChip = (t) => {
    const nome = t?.nome || "Tipo";
    const obrig = t?.obrigatorio ? " (obrigatório)" : "";
    const tipoSel = t?.tipoSelecion === "multiplo" ? "múltiplo" : "único";

    if (t?.tipoSelecion === "multiplo") {
      const min = Number(t?.minimoSelecionados ?? 0);
      const max = Number(t?.maximoSelecionados ?? 1);
      return `${nome}${obrig} • ${tipoSel} • min ${min} / max ${max}`;
    }

    return `${nome}${obrig} • ${tipoSel}`;
  };

  // ======================
  // LISTAGEM: AÇÕES BACKEND
  // ======================
  const moverCategoria = async (index, direcao) => {
    const novaOrdem = [...categorias];
    const destino = index + direcao;
    if (destino < 0 || destino >= novaOrdem.length) return;

    [novaOrdem[index], novaOrdem[destino]] = [
      novaOrdem[destino],
      novaOrdem[index],
    ];
    setCategorias(novaOrdem);

    const categoriasAtualizadas = novaOrdem.map((cat, idx) => ({
      _id: cat._id,
      ordem: idx,
    }));

    try {
      await axios.put(`${API_URL}/api/categorias/ordem/reordenar`, {
        categorias: categoriasAtualizadas,
      });
      handleSnackbar("Ordem salva com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar ordem:", err);
      handleSnackbar("Erro ao salvar ordem", "error");
      fetchCategorias();
    }
  };

  const duplicarCategoria = async (id) => {
    try {
      await axios.post(`${API_URL}/api/categorias/duplicar/${id}`);
      fetchCategorias();
      handleSnackbar("Categoria duplicada!");
    } catch (err) {
      console.error("Erro ao duplicar categoria:", err);
      handleSnackbar("Erro ao duplicar categoria", "error");
    }
  };

  const toggleCategoriaAtiva = async (id, estadoAtual) => {
    try {
      await axios.put(
        `${API_URL}/api/categorias/${id}/${
          estadoAtual ? "desativar" : "ativar"
        }`
      );
      fetchCategorias();
    } catch (err) {
      console.error("Erro ao alterar status da categoria:", err);
      handleSnackbar("Erro ao alterar status da categoria", "error");
    }
  };

  const iniciarEdicao = (cat) => {
    setEditandoId(cat._id);
    setCategoriaEditada({ ...cat });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setCategoriaEditada({});
  };

  const salvarEdicaoCategoria = async (id) => {
    try {
      if (!categoriaEditada?.nome?.trim()) {
        handleSnackbar("O nome da categoria é obrigatório", "error");
        return;
      }

      const payload = { ...categoriaEditada };
      await axios.put(`${API_URL}/api/categorias/${id}`, payload);

      setEditandoId(null);
      setCategoriaEditada({});
      fetchCategorias();
      handleSnackbar("Categoria atualizada!");
    } catch (err) {
      console.error("Erro ao editar categoria:", err);
      handleSnackbar("Erro ao editar categoria", "error");
    }
  };

  const excluirCategoria = async () => {
    try {
      await axios.delete(
        `${API_URL}/api/categorias/${confirmDialog.categoriaId}`
      );
      fetchCategorias();
      handleSnackbar("Categoria excluída!");
      setConfirmDialog({ open: false, categoriaId: null });
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
      handleSnackbar("Erro ao excluir categoria", "error");
    }
  };

  // ======================
  // UI
  // ======================
  const categoriasAtivas = categorias.filter((c) => c.ativa !== false).length;
  const categoriasInativas = categorias.filter((c) => c.ativa === false).length;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        background: "linear-gradient(180deg, rgba(248,250,252,0.98), #ffffff)",
        border: "1px solid rgba(148,163,184,0.22)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            Categorias
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organize o cardápio, extras e regras de pizza em um só lugar.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={`${categorias.length} cadastrada(s)`} sx={{ fontWeight: 900 }} />
          <Chip label={`${categoriasAtivas} ativa(s)`} color="success" variant="outlined" sx={{ fontWeight: 900 }} />
          {!!categoriasInativas && <Chip label={`${categoriasInativas} inativa(s)`} color="default" variant="outlined" sx={{ fontWeight: 900 }} />}
        </Box>
      </Box>

      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 3,
          background: "#f8fafc",
          border: "1px solid rgba(148,163,184,0.24)",
        }}
      >
        <Typography fontWeight={900} mb={1.5}>Criar nova categoria</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nome da categoria"
              fullWidth
              value={novaCategoria.nome}
              onChange={(e) =>
                setNovaCategoria({ ...novaCategoria, nome: e.target.value })
              }
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Tipo da categoria"
              select
              fullWidth
              value={novaCategoria.tipoCategoria}
              onChange={(e) =>
                setNovaCategoria({
                  ...novaCategoria,
                  tipoCategoria: e.target.value,
                })
              }
            >
              <MenuItem value={TIPO_CATEGORIA.SIMPLES}>Produto simples</MenuItem>
              <MenuItem value={TIPO_CATEGORIA.PIZZA}>Pizza tradicional</MenuItem>
              <MenuItem value={TIPO_CATEGORIA.PIZZA_DUAS}>Pizza 2 sabores</MenuItem>
            </TextField>
          </Grid>

          {novaCategoria.tipoCategoria === TIPO_CATEGORIA.PIZZA_DUAS && (
            <Grid item xs={12}>
              <Alert severity="info">
                🍕 Pizza de 2 sabores:
                <br />• Os sabores devem ser cadastrados no PRODUTO
                <br />• O cliente escolhe exatamente 2 sabores
                <br />• O preço será calculado pelo maior ou média dos sabores
              </Alert>
            </Grid>
          )}

          {novaCategoria.tipoCategoria !== TIPO_CATEGORIA.SIMPLES && (
            <>
              <Grid item xs={6}>
                <FormControlLabel
                  label="Permite bordas"
                  control={
                    <Switch
                      checked={novaCategoria.permiteBordas}
                      onChange={(e) =>
                        setNovaCategoria({
                          ...novaCategoria,
                          permiteBordas: e.target.checked,
                        })
                      }
                    />
                  }
                />
              </Grid>

              <Grid item xs={6}>
                <FormControlLabel
                  label="Permite adicionais"
                  control={
                    <Switch
                      checked={novaCategoria.permiteAdicionais}
                      onChange={(e) =>
                        setNovaCategoria({
                          ...novaCategoria,
                          permiteAdicionais: e.target.checked,
                        })
                      }
                    />
                  }
                />
              </Grid>
            </>
          )}

          {novaCategoria.tipoCategoria === TIPO_CATEGORIA.PIZZA_DUAS && (
            <Grid item xs={12}>
              <TextField
                label="Cálculo do preço"
                select
                fullWidth
                value={novaCategoria.calculoPrecoPor}
                onChange={(e) =>
                  setNovaCategoria({
                    ...novaCategoria,
                    calculoPrecoPor: e.target.value,
                  })
                }
              >
                <MenuItem value="maior">Maior valor</MenuItem>
                <MenuItem value="media">Média</MenuItem>
              </TextField>
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography fontWeight={700} mb={1}>
          Tipos Extras (opcional)
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Nome"
              fullWidth
              value={novoTipoExtra.nome}
              onChange={(e) =>
                setNovoTipoExtra({ ...novoTipoExtra, nome: e.target.value })
              }
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <FormControlLabel
              label="Obrigatório"
              control={
                <Switch
                  checked={novoTipoExtra.obrigatorio}
                  onChange={(e) =>
                    setNovoTipoExtra({
                      ...novoTipoExtra,
                      obrigatorio: e.target.checked,
                      // se virou obrigatório e é múltiplo, garante min >= 1
                      minimoSelecionados:
                        novoTipoExtra.tipoSelecion === "multiplo" && e.target.checked
                          ? Math.max(1, Number(novoTipoExtra.minimoSelecionados || 0))
                          : Number(novoTipoExtra.minimoSelecionados || 0),
                    })
                  }
                />
              }
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField
              label="Tipo"
              select
              fullWidth
              value={novoTipoExtra.tipoSelecion}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unico") {
                  setNovoTipoExtra((prev) => ({
                    ...prev,
                    tipoSelecion: "unico",
                    minimoSelecionados: 0,
                    maximoSelecionados: 1,
                  }));
                } else {
                  setNovoTipoExtra((prev) =>
                    normalizarMinMax({
                      ...prev,
                      tipoSelecion: "multiplo",
                      minimoSelecionados: prev.obrigatorio ? Math.max(1, Number(prev.minimoSelecionados || 1)) : Number(prev.minimoSelecionados || 0),
                      maximoSelecionados: Number(prev.maximoSelecionados || 1),
                    })
                  );
                }
              }}
            >
              <MenuItem value="unico">Único</MenuItem>
              <MenuItem value="multiplo">Múltiplo</MenuItem>
            </TextField>
          </Grid>

          {/* ✅ MIN/MAX só quando múltiplo */}
          {novoTipoExtra.tipoSelecion === "multiplo" && (
            <>
              <Grid item xs={6} sm={1.5}>
                <TextField
                  label="Mín."
                  type="number"
                  fullWidth
                  value={novoTipoExtra.minimoSelecionados}
                  onChange={(e) =>
                    setNovoTipoExtra((prev) =>
                      normalizarMinMax({
                        ...prev,
                        minimoSelecionados: parseInt(e.target.value, 10) || 0,
                      })
                    )
                  }
                  inputProps={{ min: 0 }}
                />
              </Grid>

              <Grid item xs={6} sm={1.5}>
                <TextField
                  label="Máx."
                  type="number"
                  fullWidth
                  value={novoTipoExtra.maximoSelecionados}
                  onChange={(e) =>
                    setNovoTipoExtra((prev) =>
                      normalizarMinMax({
                        ...prev,
                        maximoSelecionados: parseInt(e.target.value, 10) || 1,
                      })
                    )
                  }
                  inputProps={{ min: 1 }}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12} sm={2}>
            <Button fullWidth variant="outlined" onClick={adicionarTipoExtra}>
              Adicionar
            </Button>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {(novaCategoria.tiposExtras || []).map((t, i) => (
            <Chip
              key={i}
              label={labelTipoExtraChip(t)}
              onDelete={() => removerTipoExtra(i)}
            />
          ))}
        </Box>

        <Button
          sx={{ mt: 3, borderRadius: 2, fontWeight: 900, textTransform: "none", px: 3 }}
          variant="contained"
          onClick={adicionarCategoria}
        >
          Adicionar categoria
        </Button>
      </Box>

      {/* ====================== */}
      {/* LISTA DE CATEGORIAS     */}
      {/* ====================== */}
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" fontWeight={900}>
          Categorias cadastradas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Arraste pela ordem usando as setas e mantenha apenas categorias úteis ativas.
        </Typography>
      </Box>

      {categorias.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma categoria cadastrada ainda.
        </Typography>
      ) : (
        categorias.map((cat, index) => (
          <Paper
            key={cat._id}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: 3,
              background: cat.ativa === false ? "#f1f5f9" : "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 30px rgba(15,23,42,0.04)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              "&:hover": { transform: "translateY(-1px)", boxShadow: "0 18px 45px rgba(15,23,42,0.08)" },
            }}
          >
            {editandoId === cat._id ? (
              <>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={categoriaEditada.nome || ""}
                      onChange={(e) =>
                        setCategoriaEditada({
                          ...categoriaEditada,
                          nome: e.target.value,
                        })
                      }
                    />
                  </Grid>

                  {["permiteSabores", "permiteBordas", "permiteAdicionais"].map(
                    (key) => (
                      <Grid item xs={6} sm={2} key={key}>
                        <FormControlLabel
                          label={key.replace("permite", "")}
                          control={
                            <Switch
                              checked={Boolean(categoriaEditada[key])}
                              onChange={(e) =>
                                setCategoriaEditada({
                                  ...categoriaEditada,
                                  [key]: e.target.checked,
                                })
                              }
                            />
                          }
                        />
                      </Grid>
                    )
                  )}

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Cálculo do preço"
                      select
                      fullWidth
                      value={categoriaEditada.calculoPrecoPor || "maior"}
                      onChange={(e) =>
                        setCategoriaEditada({
                          ...categoriaEditada,
                          calculoPrecoPor: e.target.value,
                        })
                      }
                      helperText={
                        Boolean(categoriaEditada.pizzaMultisabor)
                          ? "Usado para pizza multisabor"
                          : " "
                      }
                    >
                      <MenuItem value="maior">Maior valor</MenuItem>
                      <MenuItem value="media">Média</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  <Button
                    startIcon={<SaveIcon />}
                    onClick={() => salvarEdicaoCategoria(cat._id)}
                  >
                    Salvar
                  </Button>
                  <Button color="inherit" onClick={cancelarEdicao}>
                    Cancelar
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Typography sx={{ fontWeight: 900 }}>{cat.nome}</Typography>

                  <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                    <Tooltip title="Mover para cima">
                      <IconButton
                        onClick={() => moverCategoria(index, -1)}
                        size="small"
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Mover para baixo">
                      <IconButton
                        onClick={() => moverCategoria(index, 1)}
                        size="small"
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Editar">
                      <IconButton onClick={() => iniciarEdicao(cat)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Duplicar categoria">
                      <IconButton
                        onClick={() => duplicarCategoria(cat._id)}
                        size="small"
                        color="primary"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Excluir categoria">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setConfirmDialog({ open: true, categoriaId: cat._id })
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={cat.ativa !== false}
                          onChange={() =>
                            toggleCategoriaAtiva(cat._id, cat.ativa !== false)
                          }
                        />
                      }
                      label={cat.ativa === false ? "Inativa" : "Ativa"}
                      sx={{ ml: 0.5 }}
                    />
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                  {[
                    (cat.pizzaMultisabor || cat.permiteSabores) && "Pizza",
                    cat.pizzaMultisabor && `Multisabor (${cat.maxSabores || 2})`,
                    cat.permiteBordas && "Bordas",
                    cat.permiteAdicionais && "Adicionais",
                    ...(cat.tiposExtras?.map((t) => {
                      if (t.tipoSelecion === "multiplo") {
                        return `${t.nome} (min ${t.minimoSelecionados || 0} / max ${t.maximoSelecionados || 1})`;
                      }
                      return t.nome;
                    }) || []),
                  ]
                    .filter(Boolean)
                    .join(", ") || "Sem adicionais ou tipos personalizados"}
                </Typography>
              </>
            )}
          </Paper>
        ))
      )}

      {/* CONFIRMAÇÃO EXCLUSÃO */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, categoriaId: null })}
      >
        <DialogTitle>Excluir categoria?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você tem certeza? Todos os produtos vinculados também serão apagados.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, categoriaId: null })}
          >
            Cancelar
          </Button>
          <Button color="error" onClick={excluirCategoria}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
