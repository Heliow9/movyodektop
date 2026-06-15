import React from "react";
import {
  Grid,
  Paper,
  Card,
  CardContent,
  Box,
  Typography,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  Skeleton,
  LinearProgress,
  Avatar,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function formatBRL(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

// converte custo base (R$/kg, R$/l, R$/un) para custo por unidadePadrao (R$/g, R$/ml, etc)
function costPerUnidadePadrao(costBase, unidadePadrao) {
  const c = Number(costBase || 0);
  if (!c) return 0;

  // base kg
  if (unidadePadrao === "kg") return c;
  if (unidadePadrao === "g") return c / 1000;

  // base l
  if (unidadePadrao === "l") return c;
  if (unidadePadrao === "ml") return c / 1000;

  // base un
  if (unidadePadrao === "un") return c;

  return c;
}

export default function InsumosTab({
  loading,
  insumosFiltrados,
  brand,
  fromBase,
  formatQtd,
  onEdit,
  onRemove,
}) {
  const list = Array.isArray(insumosFiltrados) ? insumosFiltrados : [];

  const LoadingGrid = () => (
    <Grid container spacing={2}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid item xs={12} md={6} lg={4} key={`sk_${i}`}>
          <Paper sx={{ p: 2.2, borderRadius: 4 }}>
            <Skeleton variant="text" height={28} width="60%" />
            <Skeleton variant="text" height={18} width="40%" />
            <Divider sx={{ my: 1.6 }} />
            <Skeleton variant="text" height={32} width="70%" />
            <Skeleton variant="text" height={18} width="50%" />
            <Skeleton variant="rounded" height={36} width="100%" sx={{ mt: 1.2, borderRadius: 99 }} />
            <Skeleton variant="rounded" height={32} width="40%" sx={{ mt: 1.2, borderRadius: 99 }} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  if (loading) return <LoadingGrid />;

  return (
    <Grid container spacing={2}>
      {list.map((ins, idx) => {
        // ✅ fallback de chave/id
        const insId = ins?.id ?? ins?._id ?? `ins_${idx}`;

        const unidadePadrao = ins?.unidadePadrao || "kg";
        const baseUnit = ins?.baseUnit || (unidadePadrao === "g" || unidadePadrao === "kg"
          ? "kg"
          : unidadePadrao === "ml" || unidadePadrao === "l"
          ? "l"
          : "un");

        const qtdMostrada = fromBase(Number(ins?.quantidadeBase || 0), unidadePadrao);
        const minMostrado = fromBase(Number(ins?.minimoBase || 0), unidadePadrao);

        const q = Number(ins?.quantidadeBase || 0);
        const m = Number(ins?.minimoBase || 0);
        const abaixoMin = q <= m;

        const ratio = m <= 0 ? (q > 0 ? 1 : 0) : clamp01(q / m);

        const statusLabel = abaixoMin ? "Reposição" : "OK";
        const statusIcon = abaixoMin ? <WarningAmberRoundedIcon /> : <CheckCircleRoundedIcon />;

        const costBase = Number(ins?.costBase || 0); // R$/kg | R$/l | R$/un
        const temCusto = costBase > 0;

        const custoPorUnPadrao = costPerUnidadePadrao(costBase, unidadePadrao);

        // valor do estoque na baseUnit: quantidadeBase * costBase
        const valorEstoque = temCusto ? q * costBase : 0;

        return (
          <Grid item xs={12} md={6} lg={4} key={insId}>
            <Card
              sx={{
                borderRadius: 4,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
                overflow: "hidden",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 14px 26px rgba(0,0,0,0.09)",
                },
              }}
            >
              <Box sx={{ height: 6, background: brand?.grad }} />

              <CardContent sx={{ p: 2.2 }}>
                {/* Header */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
                  <Stack direction="row" gap={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        background: "rgba(0,0,0,0.06)",
                        color: "rgba(0,0,0,0.70)",
                        fontWeight: 900,
                      }}
                    >
                      <Inventory2OutlinedIcon fontSize="small" />
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: 16 }} noWrap>
                        {ins?.nome || "—"}
                      </Typography>

                      <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 0.4, flexWrap: "wrap" }}>
                        <Typography sx={{ opacity: 0.65, fontSize: 12 }} noWrap>
                          Unidade: <b>{unidadePadrao}</b>
                        </Typography>

                        <Chip
                          icon={statusIcon}
                          label={statusLabel}
                          size="small"
                          sx={{
                            fontWeight: 900,
                            borderRadius: 99,
                            bgcolor: abaixoMin ? "rgba(255,59,138,0.12)" : "rgba(0,0,0,0.06)",
                            color: abaixoMin ? "#c2185b" : "rgba(0,0,0,0.75)",
                          }}
                        />

                        {!temCusto && (
                          <Chip
                            label="Sem custo"
                            size="small"
                            sx={{
                              fontWeight: 900,
                              borderRadius: 99,
                              bgcolor: "rgba(255,193,7,0.18)",
                            }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction="row" gap={0.4}>
                    <Tooltip title="Editar">
                      <IconButton
                        onClick={() => onEdit?.(insId)}
                        size="small"
                        sx={{
                          borderRadius: 2,
                          bgcolor: "rgba(0,0,0,0.04)",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Remover">
                      <IconButton
                        onClick={() => onRemove?.(insId)}
                        size="small"
                        sx={{
                          borderRadius: 2,
                          bgcolor: "rgba(0,0,0,0.04)",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.6 }} />

                {/* Números */}
                <Grid container spacing={1.2}>
                  <Grid item xs={6}>
                    <Typography sx={{ opacity: 0.7, fontSize: 12 }}>Disponível</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>
                      {formatQtd(qtdMostrada, unidadePadrao)}
                    </Typography>
                  </Grid>

                  <Grid item xs={6} sx={{ textAlign: "right" }}>
                    <Typography sx={{ opacity: 0.7, fontSize: 12 }}>Mínimo</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>
                      {formatQtd(minMostrado, unidadePadrao)}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Custo */}
                <Box sx={{ mt: 1.3 }}>
                  <Typography sx={{ opacity: 0.7, fontSize: 12 }}>Custo</Typography>

                  {temCusto ? (
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                      <Typography sx={{ fontWeight: 900, fontSize: 14 }} noWrap>
                        {formatBRL(costBase)} / <b>{baseUnit}</b>
                      </Typography>

                      <Typography sx={{ fontSize: 12, opacity: 0.75 }} noWrap>
                        {formatBRL(custoPorUnPadrao)} / {unidadePadrao}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                      Cadastre o custo para calcular o gasto por receita.
                    </Typography>
                  )}

                  {temCusto && (
                    <Typography sx={{ fontSize: 12, opacity: 0.75, mt: 0.2 }}>
                      Valor do estoque: <b>{formatBRL(valorEstoque)}</b>
                    </Typography>
                  )}
                </Box>

                {/* Barra “saúde do estoque” */}
                <Box sx={{ mt: 1.4 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>Nível do estoque</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
                      {Math.round(ratio * 100)}%
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={Math.round(ratio * 100)}
                    sx={{
                      height: 10,
                      borderRadius: 99,
                      bgcolor: "rgba(0,0,0,0.06)",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 99,
                        background: abaixoMin ? "#ff3b8a" : "#2e7d32",
                      },
                    }}
                  />

                  {abaixoMin && (
                    <Typography sx={{ mt: 0.8, fontSize: 12, color: "#c2185b", fontWeight: 800 }}>
                      Abaixo do mínimo — considere repor para não ficar indisponível.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}

      {!list.length && (
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 4,
              textAlign: "center",
              opacity: 0.85,
              border: "1px dashed rgba(0,0,0,0.15)",
              bgcolor: "rgba(0,0,0,0.02)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>Nenhum insumo encontrado</Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.75, mt: 0.5 }}>
              Tente ajustar o termo de busca ou cadastre um novo insumo.
            </Typography>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
}
