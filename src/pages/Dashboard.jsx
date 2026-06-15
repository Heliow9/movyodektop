// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import QRCode from "react-qr-code";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

const Dashboard = () => {
  const [qrCode, setQrCode] = useState(null);
  const [nomeLoja, setNomeLoja] = useState("");
  const [restauranteId, setRestauranteId] = useState("");
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false);
  const [atualizacaoPronta, setAtualizacaoPronta] = useState(false);

  const iniciarBot = async (id) => {
    try {
      await axios.post(`${API_URL}/api/bot/start`, { restauranteId: id });
      console.log("🚀 Bot iniciado");
    } catch (error) {
      console.error("❌ Erro ao iniciar bot:", error);
    }
  };

  const checarStatus = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/bot/status/${id}`);
      setConectado(data.conectado);

      if (!data.conectado) {
        const qrResponse = await axios.get(`${API_URL}/api/bot/qr/${id}`);
        if (qrResponse.data.qrCodeBase64) {
          setQrCode(qrResponse.data.qrCodeBase64);
        }
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error("❌ Erro ao checar status:", error);
    } finally {
      setCarregando(false);
    }
  };

  const resetarSessao = async () => {
    try {
      await axios.post(`${API_URL}/api/bot/reset/${restauranteId}`);
      setConectado(false);
      setQrCode(null);
      iniciarBot(restauranteId);
      setTimeout(() => checarStatus(restauranteId), 3000);
    } catch (error) {
      console.error("❌ Erro ao resetar sessão:", error);
    }
  };

  const pararBot = async () => {
    try {
      await axios.post(`${API_URL}/api/bot/stop`, { restauranteId });
      setConectado(false);
      setQrCode(null);
    } catch (error) {
      console.error("❌ Erro ao parar bot:", error);
    }
  };

  useEffect(() => {
    const iniciar = async () => {
      try {
        const session = await window.electron.obterSessao();
        if (!session?.restauranteId) {
          setCarregando(false);
          return;
        }

        setNomeLoja(session.nome || "");
        setRestauranteId(session.restauranteId);

        await iniciarBot(session.restauranteId);
        await checarStatus(session.restauranteId);
      } catch (err) {
        console.error("Erro ao iniciar dashboard:", err);
        setCarregando(false);
      }
    };

    iniciar();

    // Eventos de atualização via preload
    window.electron?.onAtualizacaoDisponivel?.(() => {
      setAtualizacaoDisponivel(true);
    });

    window.electron?.onAtualizacaoPronta?.(() => {
      setAtualizacaoDisponivel(false);
      setAtualizacaoPronta(true);
    });
  }, []);

  const wrapperStyles = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    px: 0,
    py: 0,
    backgroundColor: "#050816",
    backgroundImage: `
      radial-gradient(circle at top left, rgba(255,59,138,0.35), transparent 55%),
      radial-gradient(circle at bottom right, rgba(255,155,45,0.30), transparent 55%)
    `,
  };

  if (carregando) {
    return (
      <Box sx={wrapperStyles}>
        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 4,
            minWidth: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at top, rgba(255,59,138,0.10), transparent 60%), #ffffff",
          }}
        >
          <CircularProgress />
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <Box sx={wrapperStyles}>
        <Paper
          elevation={10}
          sx={{
            width: "100%",
            maxWidth: 900,
            borderRadius: 5,
            p: { xs: 3, md: 4 },
            background:
              "radial-gradient(circle at top, rgba(255,59,138,0.10), transparent 60%), #ffffff",
            backdropFilter: "blur(10px)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.45)",
          }}
        >
          {/* Cabeçalho */}
          <Box
            sx={{
              mb: 3,
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: "#083358",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                Movyo Bot — Conexão WhatsApp
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                Bem-vindo,{" "}
                <strong>{nomeLoja || "restaurante parceiro"}</strong>. Gerencie
                aqui a conexão do seu robô de pedidos.
              </Typography>
            </Box>

            <Chip
              label={conectado ? "Conectado" : "Desconectado"}
              color={conectado ? "success" : "default"}
              variant={conectado ? "filled" : "outlined"}
              sx={{
                fontWeight: 600,
                borderRadius: 999,
                px: 1,
              }}
            />
          </Box>

          <Divider sx={{ mb: 3, borderColor: "rgba(148,163,184,0.4)" }} />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems="stretch"
          >
            {/* Bloco da esquerda: status + QR */}
            <Box
              sx={{
                flex: 1.2,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: conectado ? "success.main" : "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {conectado ? "✅ Bot conectado com sucesso" : "📲 Conecte o bot ao seu WhatsApp"}
              </Typography>

              <Typography
                variant="body2"
                sx={{ color: "text.secondary", maxWidth: 420 }}
              >
                {conectado
                  ? "Seu robô está recebendo pedidos normalmente. Você pode parar ou resetar a sessão se trocar de celular ou conta."
                  : qrCode
                  ? "Abra o WhatsApp no seu celular, vá em 'Aparelhos conectados' e escaneie o QR Code abaixo para ativar o Movyo Bot."
                  : "Estamos aguardando a geração do QR Code. Assim que estiver disponível, ele aparece aqui automaticamente."}
              </Typography>

              <Box
                sx={{
                  mt: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 1.5,
                }}
              >
                {!conectado && qrCode && (
                  <Box
                    sx={{
                      bgcolor: "#ffffff",
                      p: 2,
                      borderRadius: 3,
                      boxShadow: "0 18px 35px rgba(15,23,42,0.25)",
                      border: "1px solid rgba(148,163,184,0.5)",
                    }}
                  >
                    <QRCode value={qrCode} size={220} />
                  </Box>
                )}

                {!conectado && !qrCode && (
                  <Box
                    sx={{
                      borderRadius: 3,
                      border: "1px dashed rgba(148,163,184,0.7)",
                      p: 2,
                      minHeight: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    Aguardando leitura ou geração do QR Code…
                  </Box>
                )}
              </Box>
            </Box>

            {/* Bloco da direita: ações / dicas */}
            <Box
              sx={{
                flex: 0.9,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  borderColor: "rgba(148,163,184,0.5)",
                  bgcolor: "rgba(248,250,252,0.9)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}
                >
                  Ações rápidas
                </Typography>

                <Stack spacing={1.5}>
                  {!conectado && (
                    <Button
                      variant="contained"
                      onClick={resetarSessao}
                      fullWidth
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 999,
                        backgroundImage:
                          "linear-gradient(135deg, #ff3b8a 0%, #ff9b2d 100%)",
                        boxShadow:
                          "0 12px 26px rgba(255,59,138,0.35), 0 4px 12px rgba(15,23,42,0.35)",
                        "&:hover": {
                          filter: "brightness(1.05)",
                          boxShadow:
                            "0 14px 32px rgba(255,59,138,0.45), 0 5px 16px rgba(15,23,42,0.45)",
                        },
                      }}
                    >
                      Resetar sessão e gerar novo QR Code
                    </Button>
                  )}

                  {conectado && (
                    <Button
                      variant="contained"
                      color="error"
                      onClick={pararBot}
                      fullWidth
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 999,
                      }}
                    >
                      Parar bot agora
                    </Button>
                  )}
                </Stack>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  borderColor: "rgba(148,163,184,0.35)",
                  bgcolor: "rgba(255,255,255,0.9)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}
                >
                  Dicas rápidas
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 0.5 }}
                >
                  • Sempre que trocar de aparelho ou número de WhatsApp, use{" "}
                  <strong>“Resetar sessão”</strong>.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 0.5 }}
                >
                  • Se o bot parar de responder, verifique a conexão do celular
                  e tente resetar a sessão.
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  • O Movyo Bot precisa que o WhatsApp esteja conectado em um
                  aparelho com internet estável.
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Snackbar de atualização em andamento */}
      <Snackbar open={atualizacaoDisponivel}>
        <Alert severity="info" sx={{ width: "100%" }}>
          Baixando nova versão do Movyo Desktop…
        </Alert>
      </Snackbar>

      {/* Snackbar de atualização pronta */}
      <Snackbar
        open={atualizacaoPronta}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.electron.aplicarAtualizacao()}
            >
              Reiniciar agora
            </Button>
          }
          sx={{ width: "100%" }}
        >
          Nova versão do Movyo Desktop pronta para instalar!
        </Alert>
      </Snackbar>
    </>
  );
};

export default Dashboard;
