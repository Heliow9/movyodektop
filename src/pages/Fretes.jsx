// pages/Frete.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Stack,
  Chip,
  Divider,
  Skeleton,
  Fade,
  Tooltip,
} from "@mui/material";
import { motion } from "framer-motion";

import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RadarIcon from "@mui/icons-material/Radar";
import MapIcon from "@mui/icons-material/Map";

import FretePorRaio from "../components/FreteporRaio";
import FretePorArea from "../components/FreteporArea";

const Frete = () => {
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";
  const restauranteId = localStorage.getItem("_id");

  const [tipoFrete, setTipoFrete] = useState("raio");
  const [faixasRaio, setFaixasRaio] = useState([{ ate: 2, valor: 5 }]);
  const [mockAreas, setMockAreas] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [loading, setLoading] = useState(true);
  const [erroLoad, setErroLoad] = useState(null);

  // 👉 vira função independente pra poder ser reutilizada pelo filho
  const carregarFrete = useCallback(async () => {
    if (!restauranteId) {
      setLoading(false);
      setErroLoad("Restaurante não identificado. Faça login novamente.");
      return;
    }

    setLoading(true);
    setErroLoad(null);

    try {
      const res = await fetch(`${API_URL}/api/frete/dados/${restauranteId}`);

      if (!res.ok) {
        console.warn("Nenhuma configuração de frete encontrada ainda.");
        setTipoFrete("raio");
        setFaixasRaio([{ ate: 2, valor: 5 }]);
        setMockAreas([]);
        return;
      }

      const data = await res.json();

      console.log("💡 Dados do frete recebidos:", data);

      if (data && data.success === false) {
        setTipoFrete("raio");
        setFaixasRaio([{ ate: 2, valor: 5 }]);
        setMockAreas([]);
        return;
      }

      if (data) {
        if (Array.isArray(data.areas)) setMockAreas(data.areas);
        if (Array.isArray(data.faixasRaio)) {
          console.log("✅ Setando faixas de raio:", data.faixasRaio);
          setFaixasRaio(data.faixasRaio);
        }
        if (data.tipo === "raio" || data.tipo === "area") {
          setTipoFrete(data.tipo);
        }
      }
    } catch (err) {
      console.error("❌ Erro ao buscar frete:", err);
      setErroLoad("Não foi possível carregar as configurações de frete.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, restauranteId]);

  useEffect(() => {
    carregarFrete();
  }, [carregarFrete]);

  // Salva APENAS o frete por raio, sem mexer nas áreas
  const handleSalvarRaio = async () => {
    try {
      await fetch(`${API_URL}/api/frete/area/${restauranteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faixasRaio,
          tipo: "raio",
        }),
      });
      setSnackbar({
        open: true,
        message: "Frete por raio salvo com sucesso!",
        severity: "success",
      });
      // se quiser, poderia chamar carregarFrete() aqui também
    } catch (err) {
      console.error("Erro ao salvar frete por raio:", err);
      setSnackbar({
        open: true,
        message: "Erro ao salvar frete por raio.",
        severity: "error",
      });
    }
  };

  const handleSnackbarClose = () =>
    setSnackbar((prev) => ({ ...prev, open: false }));

  const descricaoAtual =
    tipoFrete === "raio"
      ? "Defina o valor do frete conforme a distância em km a partir do seu restaurante. Ideal para quem entrega em volta do ponto fixo."
      : "Desenhe áreas diretamente no mapa e configure valores específicos por região. Ideal para cidades grandes ou zonas de entrega bem definidas.";

  const chipAtual =
    tipoFrete === "raio"
      ? {
          label: "Mais simples e rápido de configurar",
          icon: <RadarIcon fontSize="small" />,
        }
      : {
          label: "Mais avançado e flexível",
          icon: <MapIcon fontSize="small" />,
        };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        maxWidth: 1100,
        mx: "auto",
      }}
    >
      {/* Cabeçalho */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        mb={3}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocalShippingIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">
              Configurações de Frete
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 600 }}
          >
            Controle como o frete será calculado para os seus clientes e deixe
            o valor de entrega transparente no app.
          </Typography>
        </Box>
      </Stack>

      {/* Card principal com tabs e descrição */}
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {/* Tabs */}
        <Box sx={{ px: 2, pt: 2 }}>
          <Tabs
            value={tipoFrete}
            onChange={(e, val) => setTipoFrete(val)}
            textColor="primary"
            indicatorColor="primary"
            variant="fullWidth"
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: 14,
              },
            }}
          >
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <RadarIcon fontSize="small" />
                  <span>Frete por Raio</span>
                </Stack>
              }
              value="raio"
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <MapIcon fontSize="small" />
                  <span>Frete por Área no Mapa</span>
                </Stack>
              }
              value="area"
            />
          </Tabs>
        </Box>

        <Divider sx={{ mt: 1 }} />

        {/* Descrição do modo selecionado */}
        <Box sx={{ px: 3, pt: 2, pb: 1.5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              {descricaoAtual}
            </Typography>

            <Tooltip
              title={
                tipoFrete === "raio"
                  ? "Use quando você entrega em volta do restaurante e quer algo prático."
                  : "Use quando você precisa segmentar bem a cidade em regiões."
              }
              arrow
            >
              <Chip
                size="small"
                icon={chipAtual.icon}
                label={chipAtual.label}
                color="primary"
                variant="outlined"
                sx={{ fontSize: 11, fontWeight: 500 }}
              />
            </Tooltip>
          </Stack>
        </Box>

        <Divider />

        {/* Conteúdo: loading, erro ou formulário */}
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={32} />
              <Skeleton variant="rounded" height={32} />
              <Skeleton variant="rounded" height={80} />
            </Stack>
          ) : erroLoad ? (
            <Alert severity="error" variant="outlined">
              {erroLoad}
            </Alert>
          ) : (
            <Fade in timeout={250}>
              <Box>
                {tipoFrete === "raio" && (
                  <FretePorRaio
                    faixasRaio={faixasRaio}
                    setFaixasRaio={setFaixasRaio}
                    onSalvar={handleSalvarRaio}
                  />
                )}

                {tipoFrete === "area" && (
                  <FretePorArea
                    mockAreas={mockAreas}
                    setMockAreas={setMockAreas}
                    restauranteId={restauranteId}
                    API_URL={API_URL}
                    setSnackbar={setSnackbar}
                    // 👉 callback pra recarregar tudo (áreas + raio) após salvar
                    onAfterSave={carregarFrete}
                  />
                )}
              </Box>
            </Fade>
          )}
        </Box>
      </Paper>

      {/* Snackbar global */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={handleSnackbarClose}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Frete;
