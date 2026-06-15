import React from "react";
import { Box, Chip, Paper, Typography } from "@mui/material";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

const PALETTES = {
  success: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    border: "#bbf7d0",
    iconBackground: "#dcfce7",
    iconColor: "#16a34a",
    titleColor: "#166534",
    chipBackground: "#bbf7d0",
    chipColor: "#166534",
  },
  warning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)",
    border: "#fde68a",
    iconBackground: "#fef3c7",
    iconColor: "#f59e0b",
    titleColor: "#92400e",
    chipBackground: "#fde68a",
    chipColor: "#92400e",
  },
  danger: {
    background: "linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)",
    border: "#fecdd3",
    iconBackground: "#ffe4e6",
    iconColor: "#ef4444",
    titleColor: "#be123c",
    chipBackground: "#fecdd3",
    chipColor: "#be123c",
  },
  neutral: {
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "#e2e8f0",
    iconBackground: "#f1f5f9",
    iconColor: "#64748b",
    titleColor: "#334155",
    chipBackground: "#e2e8f0",
    chipColor: "#334155",
  },
};

function StatusIcon({ tone, sx }) {
  if (tone === "danger") return <WarningAmberRoundedIcon sx={sx} />;
  if (tone === "warning") return <TimerOutlinedIcon sx={sx} />;
  return <VerifiedUserOutlinedIcon sx={sx} />;
}

export default function LicenseStatusCard({ info }) {
  const tone = info?.tone || "neutral";
  const palette = PALETTES[tone] || PALETTES.neutral;
  const chipText = info?.hasDate
    ? info.daysLeft < 0
      ? "Vencida"
      : info.daysLeft === 0
        ? "Vence hoje"
        : `${info.daysLeft} ${info.daysLeft === 1 ? "dia" : "dias"}`
    : "Sem data";

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 1.8 },
        borderRadius: 3,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "auto 1fr", sm: "auto 1fr auto" },
          alignItems: "center",
          gap: 1.35,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: palette.iconBackground,
            flexShrink: 0,
          }}
        >
          <StatusIcon tone={tone} sx={{ color: palette.iconColor, fontSize: 27 }} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: palette.titleColor,
              fontSize: 10.5,
              fontWeight: 950,
              letterSpacing: 1.1,
              lineHeight: 1.1,
            }}
          >
            LICENÇA MOVYO
          </Typography>
          <Typography sx={{ mt: 0.35, color: palette.titleColor, fontWeight: 950, fontSize: 17, lineHeight: 1.2 }}>
            {info?.title || "Status da licença"}
          </Typography>
          <Typography sx={{ mt: 0.35, color: "#475569", fontSize: 12.5, lineHeight: 1.35 }}>
            {info?.subtitle || "Acompanhe o vencimento da licença do restaurante."}
          </Typography>
        </Box>

        <Chip
          label={chipText}
          sx={{
            gridColumn: { xs: "1 / -1", sm: "auto" },
            justifySelf: { xs: "start", sm: "end" },
            bgcolor: palette.chipBackground,
            color: palette.chipColor,
            fontWeight: 950,
            borderRadius: 999,
            px: 0.5,
          }}
        />
      </Box>
    </Paper>
  );
}
