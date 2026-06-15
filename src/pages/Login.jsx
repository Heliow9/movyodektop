// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  InputAdornment,
  Fade,
  Snackbar,
  Alert,
  Stack,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import axios from "axios";
import { API_URL } from "../services/api";
import {
  getAuthBlockMessageFromError,
  getRestauranteAccessBlockMessage,
  pickRestauranteFromPayload,
} from "../utils/licenseGuard";
// use a logo que você quiser aqui (pode trocar o arquivo depois)
import Logo from "../assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const navigate = useNavigate();

  // Mensagem trazida pelo bloqueio global antes do retorno ao login.
  useEffect(() => {
    const accessMessage = sessionStorage.getItem("movyoAccessBlockMessage");
    if (accessMessage) {
      setErro(accessMessage);
      sessionStorage.removeItem("movyoAccessBlockMessage");
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !senha) {
      setErro("Preencha email e senha para continuar.");
      return;
    }

    setErro("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/restaurantes/login`, {
        email: email.trim(),
        senha,
      });

      const token = res?.data?.token;
      const restaurante = pickRestauranteFromPayload(res?.data) || res?.data?.restaurante;
      const restauranteId = restaurante?._id || restaurante?.id || res?.data?.restauranteId;

      if (!token || !restauranteId) {
        throw new Error("A API não retornou os dados completos da sessão.");
      }

      const blockMessage = getRestauranteAccessBlockMessage(restaurante);
      if (blockMessage) {
        localStorage.removeItem("_id");
        localStorage.removeItem("_token");
        await window.electron?.limparSessao?.();
        setErro(blockMessage);
        return;
      }

      const sessionData = {
        token,
        restauranteId,
        nome: restaurante?.nome || restaurante?.nomeFantasia || "",
      };

      localStorage.setItem("_id", restauranteId);
      localStorage.setItem("_token", token);
      window.dispatchEvent(new Event("movyo:auth-changed"));

      if (window.electron?.salvarSessao) {
        await window.electron.salvarSessao(sessionData);

        const checkSession = await window.electron.obterSessao();
        if (checkSession?.token && checkSession?.restauranteId) {
          sessionStorage.setItem("movyoTransitionMessage", "Abrindo sua central de pedidos...");
          window.location.reload();
        } else {
          localStorage.removeItem("_id");
          localStorage.removeItem("_token");
          window.dispatchEvent(new Event("movyo:auth-changed"));
          setErro("Erro ao salvar sessão.");
        }
      } else {
        sessionStorage.setItem("movyoTransitionMessage", "Abrindo sua central de pedidos...");
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Erro no login:", err);

      const blockMessage = getAuthBlockMessageFromError(err);
      if (blockMessage) {
        localStorage.removeItem("_id");
        localStorage.removeItem("_token");
        await window.electron?.limparSessao?.();
        window.dispatchEvent(new Event("movyo:auth-changed"));
        setErro(blockMessage);
      } else if (err?.response) {
        setErro(
          err?.response?.data?.message ||
            err?.response?.data?.mensagem ||
            "Login inválido. Verifique suas credenciais."
        );
      } else {
        setErro("Servidor fora do ar. Tente novamente mais tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  const textFieldStyles = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 3,
      backgroundColor: "#ffffff",
      "& fieldset": {
        borderColor: "#0b3055",
      },
      "&:hover fieldset": {
        borderColor: "#0d447a",
      },
      "&.Mui-focused fieldset": {
        borderWidth: 2,
        borderColor: "#0b3055",
      },
    },
    "& .MuiInputLabel-root": {
      color: "#6b7280",
      fontSize: "0.85rem",
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: "#0b3055",
    },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        backgroundColor: "#050816",
        backgroundImage: `
          radial-gradient(circle at top left, rgba(255,59,138,0.35), transparent 55%),
          radial-gradient(circle at bottom right, rgba(255,155,45,0.30), transparent 55%)
        `,
      }}
    >
      <Fade in={loading} timeout={250} unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2,
            background: "rgba(5, 8, 22, 0.72)",
            backdropFilter: "blur(10px)",
            color: "#fff",
          }}
        >
          <Box sx={{ width: 92, height: 92, borderRadius: "50%", bgcolor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 22px 60px rgba(0,0,0,.35)" }}>
            <img src={Logo} alt="Movyo" style={{ width: 58, height: 58, objectFit: "contain" }} />
          </Box>
          <CircularProgress size={42} sx={{ color: "#ff9b2d" }} />
          <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Entrando no painel...</Typography>
          <Typography sx={{ opacity: .82, fontSize: 13 }}>Carregando pedidos, configurações e fila.</Typography>
        </Box>
      </Fade>

      <Fade in timeout={600}>
        <Paper
          elevation={10}
          sx={{
            width: "100%",
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            borderRadius: 6,
            background:
              "radial-gradient(circle at top, rgba(255,59,138,0.10), transparent 60%), #ffffff",
            backdropFilter: "blur(8px)",
          }}
        >
          <Stack spacing={3} alignItems="center">
            {/* LOGO EM ANEL DEGRADÊ */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              {/* anel */}
              <Box
                sx={{
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #ff3b8a 0%, #ff9b2d 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1,
                  boxShadow:
                    "0 10px 25px rgba(255,59,138,0.28), 0 6px 16px rgba(0,0,0,0.22)",
                  p: 0.5,
                }}
              >
                {/* círculo interno branco */}
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={Logo}
                    alt="Movyo Food"
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "contain",
                    }}
                  />
                </Box>
              </Box>

              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: "#083358",
                }}
              >
                Movyo Food
              </Typography>

              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontWeight: 500 }}
              >
                Painel do restaurante parceiro
              </Typography>
            </Box>

            {/* FORM */}
            <Box sx={{ width: "100%" }}>
              <TextField
                label="Email"
                placeholder="exemplo@email.com"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyPress}
                sx={textFieldStyles}
                type="email"
              />

              <TextField
                label="Senha"
                fullWidth
                margin="normal"
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={handleKeyPress}
                sx={textFieldStyles}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowSenha((prev) => !prev)}
                      >
                        {showSenha ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* BOTÃO */}
            <Button
              fullWidth
              onClick={handleLogin}
              disabled={loading || !email || !senha}
              sx={{
                mt: 1,
                py: 1.4,
                fontWeight: 700,
                fontSize: "0.95rem",
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #ff3b8a 0%, #ff9b2d 100%)",
                color: "#fff",
                boxShadow:
                  "0 12px 30px rgba(255,59,138,0.35), 0 6px 15px rgba(0,0,0,0.18)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #ff4b92 0%, #ffae4a 100%)",
                  boxShadow:
                    "0 14px 34px rgba(255,59,138,0.45), 0 6px 18px rgba(0,0,0,0.22)",
                  transform: "translateY(-1px)",
                },
                "&:active": {
                  transform: "translateY(1px)",
                  boxShadow:
                    "0 8px 18px rgba(255,59,138,0.3), 0 4px 10px rgba(0,0,0,0.2)",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={22} sx={{ color: "#fff" }} />
              ) : (
                "Entrar no painel"
              )}
            </Button>

            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mt: 1,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              Acesso exclusivo para restaurantes cadastrados na Movyo Food.
            </Typography>
          </Stack>

          {/* TOAST DE ERRO */}
          <Snackbar
            open={Boolean(erro)}
            autoHideDuration={8000}
            onClose={() => setErro("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Alert
              onClose={() => setErro("")}
              severity="error"
              variant="filled"
              sx={{
                borderRadius: 999,
                boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                px: 2.5,
              }}
            >
              {erro}
            </Alert>
          </Snackbar>
        </Paper>
      </Fade>
    </Box>
  );
};

export default Login;
