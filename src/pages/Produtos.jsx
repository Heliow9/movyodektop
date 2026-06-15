// src/pages/Produtos.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Paper,
} from "@mui/material";
import ProdutosTab from "../components/ProdutosTab";
import CategoriasTab from "../components/CategoriasTab";

export default function Produtos() {
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // opcional: lembrar última aba aberta
  useEffect(() => {
    const stored = localStorage.getItem("produtos_tab");
    if (stored !== null) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) setTab(parsed);
    }
  }, []);

  const handleChangeTab = (_e, value) => {
    setTab(value);
    localStorage.setItem("produtos_tab", String(value));
  };

  const handleSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const handleCloseSnackbar = () =>
    setSnackbar((prev) => ({ ...prev, open: false }));

  return (
    <Box
      sx={{
        minHeight: "100vh",
        p: 3,
        backgroundColor: "#050816",
        backgroundImage: `
          radial-gradient(circle at top left, rgba(255,59,138,0.35), transparent 55%),
          radial-gradient(circle at bottom right, rgba(255,155,45,0.30), transparent 55%)
        `,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1440,
        }}
      >
        <Paper
          elevation={10}
          sx={{
            borderRadius: 4,
            p: 2.5,
            background:
              "radial-gradient(circle at top, rgba(255,59,138,0.10), transparent 60%), #ffffff",
            boxShadow: "0 24px 60px rgba(15,23,42,0.55)",
          }}
        >
          {/* Cabeçalho */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              mb: 2.5,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: "#083358",
                letterSpacing: 0.4,
              }}
            >
              Movyo Food — Produtos & Cardápio
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", maxWidth: 520 }}
            >
              Gerencie categorias, produtos e deixe o seu cardápio sempre
              organizado para o app e para o delivery.
            </Typography>
          </Box>

          {/* Abas */}
          <Tabs
            value={tab}
            onChange={handleChangeTab}
            sx={{
              mb: 2.5,
              minHeight: 0,
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
                minHeight: 42,
                borderRadius: 999,
                mr: 1,
                px: 2.5,
              },
              "& .MuiTab-root.Mui-selected": {
                color: "#0f172a",
                background:
                  "linear-gradient(135deg, rgba(255,59,138,0.12), rgba(255,155,45,0.12))",
              },
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <Tab label="Categorias" />
            <Tab label="Produtos" />
          </Tabs>

          {/* Conteúdo das abas */}
          <Box
            sx={{
              mt: 1,
              borderRadius: 3,
              border: "1px solid rgba(148,163,184,0.35)",
              p: 2,
              backgroundColor: "#f9fafb",
            }}
          >
            {tab === 0 && <CategoriasTab handleSnackbar={handleSnackbar} />}
            {tab === 1 && <ProdutosTab handleSnackbar={handleSnackbar} />}
          </Box>
        </Paper>

        {/* Snackbar global da tela */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
