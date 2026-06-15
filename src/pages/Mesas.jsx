import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Stack,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  InputAdornment,
  Snackbar,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";

import axios from "axios";

import CardMesa from "../components/mesas/CardMesa";
import ModalCriarMesa from "../components/mesas/ModalCriarMesa";
import ModalCriarLote from "../components/mesas/ModalCriarLote";
import ModalComandaMesa from "../components/ModalComandaMesa";

// Impressão
import { renderToStaticMarkup } from "react-dom/server";
import PrintableGridQRCodes from "../components/mesas/PrintableGridQRCodes";

// ✅ Socket (mesmo padrão do seu painel Home)
import { createSocket } from "../services/sockets";

// ✅ para buscar a logo do restaurante do jeito CERTO (igual Home)
import { fetchMe } from "../services/api";
import { resolveLogoUrl } from "../utils/resolveAssetUrl";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

const normalizarNumeroMesa = (valor) => String(valor ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const sortMesasPorNumero = (arr) =>
  [...arr].sort((a, b) =>
    String(a.numero || "").localeCompare(String(b.numero || ""), undefined, { numeric: true })
  );

const dedupeMesas = (arr) => {
  const porId = new Map();
  const porNumero = new Map();

  for (const mesa of Array.isArray(arr) ? arr : []) {
    if (!mesa) continue;
    const id = String(mesa._id || mesa.id || "");
    const numeroKey = `${String(mesa.restauranteId || "")}:${normalizarNumeroMesa(mesa.numero)}`;

    if (id && porId.has(id)) {
      const anterior = porId.get(id);
      const merged = { ...anterior, ...mesa };
      porId.set(id, merged);
      if (numeroKey) porNumero.set(numeroKey, merged);
      continue;
    }

    if (numeroKey && porNumero.has(numeroKey)) {
      // Mesmo restaurante + mesmo número: mantém uma única mesa no estado visual.
      // Preferimos a mais recente quando há campos atualizados, mas não duplicamos card.
      const anterior = porNumero.get(numeroKey);
      const merged = { ...anterior, ...mesa, _id: anterior._id || mesa._id, id: anterior.id || mesa.id };
      porNumero.set(numeroKey, merged);
      if (anterior._id || anterior.id) porId.set(String(anterior._id || anterior.id), merged);
      continue;
    }

    if (id) porId.set(id, mesa);
    if (numeroKey) porNumero.set(numeroKey, mesa);
  }

  const saida = Array.from(porNumero.values());
  return sortMesasPorNumero(saida);
};

export default function Mesas() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restauranteId, setRestauranteId] = useState(null);
  const [restauranteSlug, setRestauranteSlug] = useState(null);

  // ✅ logo igual Home (me.data.logoUrl)
  const [logoUrl, setLogoUrl] = useState("");

  // Modais de criação
  const [modalUnicoOpen, setModalUnicoOpen] = useState(false);
  const [modalLoteOpen, setModalLoteOpen] = useState(false);

  // Modal de impressão em massa
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printSize, setPrintSize] = useState("pequeno");

  // Busca / filtro
  const [buscaNumero, setBuscaNumero] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas"); // todas | livres | ocupadas

  // ✅ Modal de comanda
  const [comandaOpen, setComandaOpen] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState(null);

  // ✅ Snackbar global (notificação)
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  // refs pra evitar stale state nos sockets
  const mesaSelecionadaRef = useRef(null);
  useEffect(() => {
    mesaSelecionadaRef.current = mesaSelecionada;
  }, [mesaSelecionada]);

  const restauranteIdRef = useRef(null);
  useEffect(() => {
    restauranteIdRef.current = restauranteId;
  }, [restauranteId]);

  // ref com mesas (pra descobrir numero da mesa quando chegar pedidoAtualizado)
  const mesasRef = useRef([]);
  useEffect(() => {
    mesasRef.current = mesas;
  }, [mesas]);

  // ✅ detectar item novo: guarda contagem anterior de itens por pedidoId
  const itensCountPorPedidoRef = useRef(new Map());

  /* ---------------------------
     Sessão
  ----------------------------*/
  useEffect(() => {
    const obterSessao = async () => {
      try {
        let id = null;
        let slug = null;

        // Electron
        if (window.electron?.obterSessao) {
          const sessao = await window.electron.obterSessao();
          if (sessao?.restauranteId) {
            id = sessao.restauranteId;
            slug =
              sessao.restauranteSlug ||
              sessao.slugIdentificador ||
              sessao.slug ||
              null;
          }
        }

        // localStorage fallback
        if (!id || !slug) {
          const stored = localStorage.getItem("restauranteSelecionado");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (!id && parsed._id) id = parsed._id;

              if (!slug) {
                slug =
                  parsed.slugIdentificador ||
                  parsed.slug ||
                  parsed.restauranteSlug ||
                  null;
              }
            } catch (e) {}
          }
        }

        if (!id) {
          setError("Não foi possível identificar o restaurante.");
          setLoading(false);
          return;
        }

        setRestauranteId(id);
        setRestauranteSlug(slug || null);
        setLoading(false);
      } catch (err) {
        setError("Erro ao obter dados da sessão.");
        setLoading(false);
      }
    };

    obterSessao();
  }, []);

  /* ---------------------------
     ✅ Buscar LOGO DO JEITO CERTO (igual Home)
     - usa fetchMe(token) e pega me.data.logoUrl
  ----------------------------*/
  useEffect(() => {
    const buscarLogo = async () => {
      if (!restauranteId) return;

      try {
        const token =
          localStorage.getItem("_token") ||
          localStorage.getItem("tokenRestaurante") ||
          localStorage.getItem("token") ||
          localStorage.getItem("restauranteToken") ||
          null;

        if (!token) return;

        const me = await fetchMe(token);
        const url = resolveLogoUrl(me?.data);
        setLogoUrl(url);
      } catch (e) {
        console.warn("Não consegui carregar logoUrl (Mesas):", e?.message);
        setLogoUrl("");
      }
    };

    buscarLogo();
  }, [restauranteId]);

  /* ---------------------------
     Buscar slug (/me) só se tiver token
  ----------------------------*/
  useEffect(() => {
    const buscarSlugNoBackend = async () => {
      if (!restauranteId || restauranteSlug) return;

      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("restauranteToken") ||
          localStorage.getItem("_token") ||
          localStorage.getItem("tokenRestaurante") ||
          null;
        if (!token) return;

        const res = await axios.get(`${API_URL}/api/restaurantes/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const slug =
          res.data?.slugIdentificador ||
          res.data?.slug ||
          res.data?.restauranteSlug ||
          null;

        if (slug) setRestauranteSlug(slug);
      } catch (err) {
        // silencioso
      }
    };

    buscarSlugNoBackend();
  }, [restauranteId, restauranteSlug]);

  /* ---------------------------
     Fetch mesas (ROTA CERTA)
     GET /api/mesas/restaurante/:restauranteId
  ----------------------------*/
  const fetchMesas = useCallback(async () => {
    if (!restauranteIdRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${API_URL}/api/mesas/restaurante/${restauranteIdRef.current}`
      );

      const lista = Array.isArray(response.data) ? response.data : [];

      const mesasOrdenadas = dedupeMesas(lista);

      setMesas(mesasOrdenadas);

      // se modal de comanda aberto, mantém a mesa selecionada sincronizada
      const selecionada = mesaSelecionadaRef.current;
      if (selecionada?._id) {
        const atualizada = mesasOrdenadas.find((m) => m._id === selecionada._id);
        if (atualizada) setMesaSelecionada(atualizada);
      }
    } catch (err) {
      setError("Falha ao carregar as mesas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (restauranteId) fetchMesas();
  }, [restauranteId, fetchMesas]);

  /* ---------------------------
     SOCKET: ouvir atualizações em tempo real
  ----------------------------*/
  useEffect(() => {
    if (!restauranteId) return;

    const s = createSocket();

    const onConnect = () => {
      s.emit("joinRestaurante", { restauranteId });
    };

    const sortMesas = dedupeMesas;

    const onMesaCriada = (mesaNova) => {
      if (!mesaNova?._id) return;
      setMesas((prev) => {
        const jaTem = prev.some((m) => m._id === mesaNova._id);
        const next = jaTem ? prev : [...prev, mesaNova];
        return sortMesas(next);
      });
    };

    const onMesasCriadasEmLote = (mesasCriadas) => {
      const arr = Array.isArray(mesasCriadas) ? mesasCriadas : [];
      if (arr.length === 0) return;

      setMesas((prev) => {
        const map = new Map(prev.map((m) => [m._id, m]));
        arr.forEach((m) => {
          if (m?._id) map.set(m._id, m);
        });
        const next = Array.from(map.values());
        return sortMesas(next);
      });
    };

    const onMesaExcluida = (payload) => {
      const id = payload?.id || payload?._id || payload;
      if (!id) return;

      setMesas((prev) => prev.filter((m) => m._id !== id));

      // se estava com comanda aberta nessa mesa, fecha modal
      const selecionada = mesaSelecionadaRef.current;
      if (selecionada?._id === id) {
        setComandaOpen(false);
        setMesaSelecionada(null);
      }
    };

    // ✅ mesa atualizada
    const onMesaAtualizada = (mesaAtualizada) => {
      const id =
        mesaAtualizada?._id ||
        mesaAtualizada?.id ||
        mesaAtualizada?.mesaId ||
        null;

      // se veio só {mesaId, pedido} sem mesa completa, força sync
      const temMesaCompleta = !!mesaAtualizada?._id && !!mesaAtualizada?.numero;
      if (!temMesaCompleta && id) {
        fetchMesas();
        return;
      }

      if (!mesaAtualizada?._id) return;

      setMesas((prev) => {
        const existe = prev.some((m) => m._id === mesaAtualizada._id);
        const next = existe
          ? prev.map((m) => (m._id === mesaAtualizada._id ? mesaAtualizada : m))
          : [...prev, mesaAtualizada];

        return sortMesas(next);
      });

      // mantém a mesa do modal sincronizada
      const selecionada = mesaSelecionadaRef.current;
      if (selecionada?._id === mesaAtualizada._id) {
        setMesaSelecionada(mesaAtualizada);
      }
    };

    // ✅ pedido atualizado: aqui a gente NOTIFICA item novo
    const onPedidoAtualizado = (pedidoAtualizado) => {
      if (!pedidoAtualizado?._id) return;

      const pedidoId = String(pedidoAtualizado._id);
      const qtdNova = Array.isArray(pedidoAtualizado.itens)
        ? pedidoAtualizado.itens.length
        : 0;

      // mesaId do pedido (o seu model usa mesaId)
      const mesaId = pedidoAtualizado?.mesaId || pedidoAtualizado?.mesa;
      const mesaInfo = mesaId
        ? mesasRef.current.find((m) => String(m._id) === String(mesaId))
        : null;
      const mesaNumero = mesaInfo?.numero || "-";

      const qtdAnterior =
        itensCountPorPedidoRef.current.get(pedidoId) ?? qtdNova;

      // atualiza cache
      itensCountPorPedidoRef.current.set(pedidoId, qtdNova);

      // se aumentou, teve item novo
      if (qtdNova > qtdAnterior) {
        const ultimo = pedidoAtualizado.itens?.[qtdNova - 1];
        const nome = ultimo?.nome || "Item";
        const qtd = Number(ultimo?.quantidade || 1);

        setSnack({
          open: true,
          severity: "success",
          msg: `🧾 Mesa ${mesaNumero}: novo item ${qtd}x ${nome}`,
        });
      }
    };

    const onConnectError = (err) => {
      console.error("❌ Socket connect_error (Mesas):", err?.message || err);
    };

    s.on("connect", onConnect);
    s.on("mesaCriada", onMesaCriada);
    s.on("mesasCriadasEmLote", onMesasCriadasEmLote);
    s.on("mesaExcluida", onMesaExcluida);
    s.on("mesaAtualizada", onMesaAtualizada);
    s.on("pedidoAtualizado", onPedidoAtualizado);
    s.on("connect_error", onConnectError);

    return () => {
      s.off("connect", onConnect);
      s.off("mesaCriada", onMesaCriada);
      s.off("mesasCriadasEmLote", onMesasCriadasEmLote);
      s.off("mesaExcluida", onMesaExcluida);
      s.off("mesaAtualizada", onMesaAtualizada);
      s.off("pedidoAtualizado", onPedidoAtualizado);
      s.off("connect_error", onConnectError);
      s.disconnect();
    };
  }, [restauranteId, fetchMesas]);

  /* ---------------------------
     Filtros
  ----------------------------*/
  const mesasFiltradas = useMemo(() => {
    const termo = buscaNumero.trim().toLowerCase();

    return mesas.filter((m) => {
      const numeroMatch = String(m.numero || "").toLowerCase().includes(termo);

      let statusMatch = true;
      if (filtroStatus === "livres")
        statusMatch = !m.status || m.status === "livre";
      else if (filtroStatus === "ocupadas")
        statusMatch = m.status === "ocupada";

      return numeroMatch && statusMatch;
    });
  }, [mesas, buscaNumero, filtroStatus]);

  /* ---------------------------
     Handlers criação / delete
  ----------------------------*/
  const handleMesaCriada = (novaMesa) => {
    setMesas((prev) => dedupeMesas([...prev, novaMesa]));
  };

  const handleLoteCriado = (novasMesas) => {
    setMesas((prev) => dedupeMesas([...prev, ...(Array.isArray(novasMesas) ? novasMesas : [])]));
  };

  const handleDeleteMesa = async (mesaId) => {
    if (!window.confirm("Tem certeza que deseja excluir esta mesa?")) return;
    try {
      await axios.delete(`${API_URL}/api/mesas/${mesaId}`);
      setMesas((prev) => prev.filter((m) => m._id !== mesaId));
    } catch (err) {
      alert("Erro ao excluir a mesa.");
    }
  };

  /* ---------------------------
     Impressão em massa
  ----------------------------*/
  const handleOpenPrintModal = () => setPrintModalOpen(true);
  const handleClosePrintModal = () => setPrintModalOpen(false);

  const handlePrintAll = () => {
    const printableComponent = (
      <PrintableGridQRCodes
        mesas={mesasFiltradas}
        size={printSize}
        restauranteSlug={restauranteSlug}
      />
    );
    const staticHtml = renderToStaticMarkup(printableComponent);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Imprimir Todas as Mesas</title>
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>${staticHtml}</body>
</html>`;

    if (window.electron?.printContent) window.electron.printContent(fullHtml);
    else alert("Funcionalidade de impressão não disponível.");

    handleClosePrintModal();
  };

  /* ---------------------------
     Comanda
  ----------------------------*/
  const abrirComandaDaMesa = (mesa) => {
    setMesaSelecionada(mesa);
    setComandaOpen(true);
  };

  const fecharComanda = () => {
    setComandaOpen(false);
    setMesaSelecionada(null);
  };

  const handleMesaAtualizada = (mesaAtualizada) => {
    if (!mesaAtualizada?._id) return;

    setMesas((prev) =>
      prev.map((m) => (m._id === mesaAtualizada._id ? mesaAtualizada : m))
    );

    if (mesaSelecionadaRef.current?._id === mesaAtualizada._id) {
      setMesaSelecionada(mesaAtualizada);
    }
  };

  const totalMesas = mesas.length;
  const totalFiltradas = mesasFiltradas.length;

  return (
    <Box sx={{ p: 3 }}>
      {/* HEADER / TOOLBAR */}
      <Paper
        elevation={3}
        sx={{
          mb: 3,
          p: 3,
          borderRadius: 3,
          background:
            "linear-gradient(135deg, rgba(118,75,231,0.12), rgba(255,255,255,0.9))",
        }}
      >
        <Box
          display="flex"
          flexWrap="wrap"
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={2}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "radial-gradient(circle at 30% 30%, #FFB74D, #7C4DFF)",
                color: "#fff",
              }}
            >
              <TableRestaurantIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Gerenciamento de Mesas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crie, organize, imprima QRCodes e controle comandas no painel.
              </Typography>

              {restauranteSlug ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Slug ativo: <strong>{restauranteSlug}</strong>
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: "error.main" }}>
                  Slug ainda não carregado. Links usarão{" "}
                  <strong>/pedido/SLUG_NAO_DEFINIDO</strong>.
                </Typography>
              )}
            </Box>
          </Box>

          {/* Ações principais */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Tooltip title="Recarregar lista">
              <span>
                <IconButton
                  onClick={fetchMesas}
                  disabled={!restauranteId || loading}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>

            <ButtonGroup variant="contained">
              <Button
                startIcon={<AddIcon />}
                onClick={() => setModalUnicoOpen(true)}
                disabled={!restauranteId}
              >
                Única
              </Button>
              <Button
                startIcon={<PlaylistAddIcon />}
                onClick={() => setModalLoteOpen(true)}
                disabled={!restauranteId}
              >
                Lote
              </Button>
            </ButtonGroup>

            <Tooltip title="Imprimir QRCodes de todas as mesas visíveis">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handleOpenPrintModal}
                  disabled={mesasFiltradas.length === 0 || !restauranteSlug}
                >
                  Imprimir
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Linha de busca / filtros / contadores */}
        <Box
          mt={3}
          display="flex"
          flexWrap="wrap"
          gap={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              size="small"
              label="Buscar por número da mesa"
              placeholder="Ex: 01, 10, 21..."
              value={buscaNumero}
              onChange={(e) => setBuscaNumero(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", sm: 260 }, maxWidth: 340 }}
            />

            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={filtroStatus === "todas" ? "contained" : "outlined"}
                onClick={() => setFiltroStatus("todas")}
              >
                Todas
              </Button>
              <Button
                variant={filtroStatus === "livres" ? "contained" : "outlined"}
                onClick={() => setFiltroStatus("livres")}
              >
                Livres
              </Button>
              <Button
                variant={filtroStatus === "ocupadas" ? "contained" : "outlined"}
                onClick={() => setFiltroStatus("ocupadas")}
              >
                Ocupadas
              </Button>
            </ButtonGroup>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total de mesas
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                {totalMesas}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Exibindo
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                {totalFiltradas} mesa(s)
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>

      {/* LOADING */}
      {loading && (
        <Box display="flex" justifyContent="center" my={6}>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Carregando mesas...
            </Typography>
          </Stack>
        </Box>
      )}

      {/* ERRO */}
      {!loading && error && (
        <Box mb={3}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={fetchMesas}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      )}

      {/* VAZIO */}
      {!loading && !error && mesas.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px dashed",
            borderColor: "divider",
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              mx: "auto",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 30%, rgba(124,77,255,0.18), rgba(124,77,255,0.02))",
            }}
          >
            <TableRestaurantIcon color="primary" fontSize="large" />
          </Box>
          <Typography variant="h6" gutterBottom>
            Nenhuma mesa cadastrada ainda
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Comece criando as mesas do salão ou gerando um lote automático.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setModalUnicoOpen(true)}
              disabled={!restauranteId}
            >
              Criar primeira mesa
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlaylistAddIcon />}
              onClick={() => setModalLoteOpen(true)}
              disabled={!restauranteId}
            >
              Criar em lote
            </Button>
          </Stack>
        </Paper>
      )}

      {/* FILTRO SEM RESULTADO */}
      {!loading && !error && mesas.length > 0 && mesasFiltradas.length === 0 && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          Nenhuma mesa encontrada para o filtro aplicado.
        </Typography>
      )}

      {/* GRID */}
      {!loading && !error && mesasFiltradas.length > 0 && (
        <Grid container spacing={3}>
          {mesasFiltradas.map((mesa) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={mesa._id}>
              <CardMesa
                mesa={mesa}
                onDelete={handleDeleteMesa}
                restauranteSlug={restauranteSlug}
                apiUrl={API_URL}
                onAbrirMesa={(mesaAtualizada) => handleMesaAtualizada(mesaAtualizada)}
                onAbrirComanda={(m) => abrirComandaDaMesa(m)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Modais de Criação */}
      <ModalCriarMesa
        open={modalUnicoOpen}
        onClose={() => setModalUnicoOpen(false)}
        onMesaCriada={handleMesaCriada}
        restauranteId={restauranteId}
      />

      <ModalCriarLote
        open={modalLoteOpen}
        onClose={() => setModalLoteOpen(false)}
        onLoteCriado={handleLoteCriado}
        restauranteId={restauranteId}
      />

      {/* Modal de Opções de Impressão */}
      <Dialog open={printModalOpen} onClose={handleClosePrintModal}>
        <DialogTitle>Opções de impressão em massa</DialogTitle>
        <DialogContent>
          <FormControl>
            <RadioGroup
              value={printSize}
              onChange={(e) => setPrintSize(e.target.value)}
            >
              <FormControlLabel value="medio" control={<Radio />} label="Médio" />
              <FormControlLabel
                value="pequeno"
                control={<Radio />}
                label="Pequeno (recomendado)"
              />
              <FormControlLabel value="mini" control={<Radio />} label="Mini" />
              <FormControlLabel
                value="micro"
                control={<Radio />}
                label="Micro (etiqueta)"
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePrintModal}>Cancelar</Button>
          <Button
            onClick={handlePrintAll}
            variant="contained"
            disabled={!restauranteSlug}
          >
            Imprimir todas
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Modal de Comanda */}
      <ModalComandaMesa
        open={comandaOpen}
        onClose={fecharComanda}
        mesa={mesaSelecionada}
        apiUrl={API_URL}
        onMesaAtualizada={handleMesaAtualizada}
        restauranteId={restauranteId}
        restauranteLogoUrl={logoUrl} // ✅ PASSA A LOGO CERTA (igual Home)
      />

      {/* ✅ Snackbar global de notificação */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          sx={{ fontWeight: 900 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
