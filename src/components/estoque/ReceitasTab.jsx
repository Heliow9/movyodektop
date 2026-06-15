// src/components/estoque/ReceitasTab.jsx
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
  Button,
  TextField,
  InputAdornment,
  Skeleton,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

// -------- Helpers locais (não dependem do Estoque.jsx) --------
function formatBRL(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function baseFromUnidade(unidade) {
  if (unidade === "g" || unidade === "kg") return "kg";
  if (unidade === "ml" || unidade === "l") return "l";
  if (unidade === "un") return "un";
  return unidade;
}

function toBaseValue(qtd, unidade) {
  const n = Number(qtd || 0);
  if (unidade === "g") return { base: "kg", value: n / 1000 };
  if (unidade === "kg") return { base: "kg", value: n };
  if (unidade === "ml") return { base: "l", value: n / 1000 };
  if (unidade === "l") return { base: "l", value: n };
  if (unidade === "un") return { base: "un", value: n };
  return { base: unidade, value: n };
}

function calcCustoReceita(r, insumoMap) {
  // custo por 1 unidade do produto (somatório de consumoBase * costBase)
  // retorna: { custoUn, faltandoCustoCount, itensComCustoCount }
  let custoUn = 0;
  let faltandoCustoCount = 0;
  let itensComCustoCount = 0;

  for (const it of r?.itens || []) {
    const ins = insumoMap.get(it.insumoId);
    if (!ins) continue;

    const conv = toBaseValue(it.qtd, it.unidade);
    const baseInsumo = baseFromUnidade(ins.unidadePadrao || ins.baseUnit);

    // unidade incompatível: ignora custo (mas mantém sinalização)
    if (conv.base !== baseInsumo) continue;

    const costBase = Number(ins.costBase || 0);
    if (costBase > 0) {
      custoUn += conv.value * costBase;
      itensComCustoCount += 1;
    } else {
      faltandoCustoCount += 1;
    }
  }

  return { custoUn, faltandoCustoCount, itensComCustoCount };
}

export default function ReceitasTab({
  loading,
  receitasFiltradas,
  brand,
  insumoMap,
  formatQtd,
  calcProducaoMaxima,
  simQtyByReceita,
  setSimQtyByReceita,
  parseNum,
  onOpenDetalhes, // (id, qtd?) — agora usamos qtd
  onEdit,
  onRemove,
}) {
  const LoadingGrid = () => (
    <Grid container spacing={2}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid item xs={12} md={6} lg={4} key={`sk_${i}`}>
          <Paper sx={{ p: 2.2, borderRadius: 4 }}>
            <Skeleton variant="text" height={26} width="60%" />
            <Skeleton variant="text" height={16} width="40%" />
            <Divider sx={{ my: 1.6 }} />
            <Skeleton variant="rounded" height={28} width="70%" sx={{ borderRadius: 99 }} />
            <Skeleton variant="text" height={18} width="90%" sx={{ mt: 1.2 }} />
            <Skeleton variant="text" height={18} width="80%" />
            <Skeleton variant="rounded" height={38} width="100%" sx={{ mt: 1.2, borderRadius: 2.2 }} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  if (loading) return <LoadingGrid />;

  return (
    <Grid container spacing={2}>
      {receitasFiltradas.map((r) => {
        const prod = calcProducaoMaxima(r, insumoMap);
        const itensCount = r.itens?.length || 0;

        const { custoUn, faltandoCustoCount } = calcCustoReceita(r, insumoMap);

        const label =
          prod.motivo === "unidade_incompativel"
            ? "Unidade incompatível"
            : prod.motivo === "sem_itens"
              ? "Sem insumos"
              : `Produz até ${prod.max} un`;

        const chipBg =
          prod.motivo === "unidade_incompativel"
            ? "rgba(255,193,7,0.20)"
            : prod.motivo === "sem_itens"
              ? "rgba(0,0,0,0.06)"
              : prod.max <= 0 && itensCount > 0
                ? "rgba(244,67,54,0.12)"
                : "rgba(0,0,0,0.06)";

        const chipColor =
          prod.motivo === "unidade_incompativel"
            ? "#8a6d00"
            : prod.max <= 0 && itensCount > 0
              ? "#c62828"
              : "rgba(0,0,0,0.78)";

        const tooltipTitle =
          prod.motivo !== "ok" ? (
            <Box sx={{ p: 0.5, maxWidth: 280 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 12, mb: 0.4 }}>Não foi possível calcular</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                {prod.motivo === "unidade_incompativel"
                  ? "Existe insumo com unidade incompatível com a receita."
                  : "Adicione insumos e quantidades válidas."}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 0.5, maxWidth: 360 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 12, mb: 0.6 }}>Cálculo por insumo</Typography>

              {(prod.detalhes || []).slice(0, 8).map((d) => {
                const ins = d.insumo;
                const custoItemUn =
                  Number(ins?.costBase || 0) > 0
                    ? Number(d.consumoBasePorUn || 0) * Number(ins.costBase || 0)
                    : null;

                return (
                  <Stack key={d.insumo.id} direction="row" justifyContent="space-between" gap={2} sx={{ mb: 0.35 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, opacity: 0.95 }} noWrap>
                        {ins?.nome}
                      </Typography>
                      <Typography sx={{ fontSize: 11, opacity: 0.75 }}>
                        Consumo/un: <b>{d.consumoBasePorUn}</b> {ins?.baseUnit || d.base}
                        {custoItemUn !== null && (
                          <>
                            {" "}
                            • custo/un: <b>{formatBRL(custoItemUn)}</b>
                          </>
                        )}
                      </Typography>
                    </Box>

                    <Typography sx={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                      {d.maxPorInsumo} un
                    </Typography>
                  </Stack>
                );
              })}

              <Divider sx={{ my: 0.8, borderColor: "rgba(255,255,255,0.25)" }} />
              <Typography sx={{ fontSize: 12 }}>
                Resultado (gargalo): <b>{prod.max} un</b>
              </Typography>
            </Box>
          );

        const simVal = simQtyByReceita[r.id] ?? "";
        const simNum = Math.floor(Number(parseNum(simVal) || 0));
        const simDisabled = simNum <= 0;

        const custoTotalSim = simNum > 0 ? custoUn * simNum : 0;
        const temCusto = custoUn > 0;

        // ✅ FIX: NÃO USAR useMemo dentro do map (Hooks rule)
        // Preview: 3 primeiros itens com custo estimado
        const preview = (r.itens || []).slice(0, 3).map((it) => {
          const ins = insumoMap.get(it.insumoId);
          const conv = toBaseValue(it.qtd, it.unidade);
          const baseInsumo = baseFromUnidade(ins?.unidadePadrao || ins?.baseUnit);
          const compat = conv.base === baseInsumo;

          const costBase = Number(ins?.costBase || 0);
          const custoItemUn = compat && costBase > 0 ? conv.value * costBase : null;

          return { it, ins, custoItemUn, compat };
        });

        return (
          <Grid item xs={12} md={6} lg={4} key={r.id}>
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
              <Box sx={{ height: 6, background: brand.grad }} />

              <CardContent sx={{ p: 2.2 }}>
                {/* topo */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 16 }} noWrap>
                      {r.nome}
                    </Typography>

                    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 0.5, alignItems: "center" }}>
                      <Typography sx={{ opacity: 0.65, fontSize: 12 }}>
                        {itensCount} insumo(s)
                      </Typography>

                      {faltandoCustoCount > 0 && (
                        <Chip
                          icon={<WarningAmberRoundedIcon />}
                          label={`Falta custo (${faltandoCustoCount})`}
                          size="small"
                          sx={{
                            fontWeight: 900,
                            borderRadius: 99,
                            bgcolor: "rgba(255,193,7,0.18)",
                          }}
                        />
                      )}
                    </Stack>

                    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.1, alignItems: "center" }}>
                      <Tooltip title={tooltipTitle} placement="bottom-start">
                        <Chip
                          icon={<InfoOutlinedIcon />}
                          label={label}
                          sx={{
                            fontWeight: 900,
                            borderRadius: 99,
                            bgcolor: chipBg,
                            color: chipColor,
                            cursor: "help",
                          }}
                        />
                      </Tooltip>

                      <Chip
                        icon={<AttachMoneyRoundedIcon />}
                        label={temCusto ? `${formatBRL(custoUn)} / un` : "Custo: —"}
                        sx={{
                          fontWeight: 900,
                          borderRadius: 99,
                          bgcolor: temCusto ? "rgba(46,125,50,0.10)" : "rgba(0,0,0,0.06)",
                          color: temCusto ? "#1b5e20" : "rgba(0,0,0,0.65)",
                        }}
                      />

                      <Button
                        onClick={() => onOpenDetalhes(r.id, simNum > 0 ? simNum : undefined)}
                        variant="text"
                        sx={{ textTransform: "none", fontWeight: 900, p: 0, minWidth: 0 }}
                      >
                        Detalhes
                      </Button>
                    </Stack>
                  </Box>

                  <Stack direction="row" gap={0.4}>
                    <Tooltip title="Editar">
                      <IconButton onClick={() => onEdit(r.id)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover">
                      <IconButton onClick={() => onRemove(r.id)} size="small">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.4 }} />

                {/* preview compacto */}
                <Stack gap={0.7} sx={{ mb: 1.2 }}>
                  {preview.map(({ it, ins, custoItemUn, compat }, idx) => (
                    <Stack key={`${r.id}_${idx}`} direction="row" justifyContent="space-between" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, opacity: 0.88 }} noWrap>
                          {ins?.nome || "Insumo removido"}
                        </Typography>
                        {!compat && (
                          <Typography sx={{ fontSize: 11, color: "#8a6d00", fontWeight: 900 }}>
                            Unidade incompatível
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                          {formatQtd(it.qtd, it.unidade)}
                        </Typography>
                        {custoItemUn !== null && (
                          <Typography sx={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>
                            {formatBRL(custoItemUn)} / un
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ))}

                  {(r.itens || []).length > 3 && (
                    <Typography sx={{ fontSize: 12, opacity: 0.6 }}>
                      + {r.itens.length - 3} itens…
                    </Typography>
                  )}
                </Stack>

                {/* simulação */}
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ sm: "center" }}>
                  <TextField
                    value={simVal}
                    onChange={(e) => setSimQtyByReceita((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    size="small"
                    placeholder="Qtd para simular (ex: 25)"
                    sx={{
                      flex: 1,
                      bgcolor: "white",
                      borderRadius: 2,
                      "& fieldset": { border: "1px solid rgba(0,0,0,0.10)" },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalculateOutlinedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    onClick={() => onOpenDetalhes(r.id, simNum)}
                    variant="contained"
                    disabled={simDisabled}
                    sx={{
                      borderRadius: 2.2,
                      textTransform: "none",
                      fontWeight: 900,
                      background: brand.grad,
                      boxShadow: "0 10px 18px rgba(255,59,138,0.18)",
                      width: { xs: "100%", sm: 140 },
                    }}
                  >
                    Simular
                  </Button>
                </Stack>

                {/* resumo custo sim */}
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.9 }}>
                  <Typography sx={{ fontSize: 12, opacity: 0.65 }}>
                    {simDisabled ? "Informe uma quantidade > 0 para simular." : "Custo estimado (simulação):"}
                  </Typography>
                  {!simDisabled && (
                    <Typography sx={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
                      {temCusto ? formatBRL(custoTotalSim) : "—"}
                    </Typography>
                  )}
                </Stack>

                <Typography sx={{ fontSize: 12, opacity: 0.6, mt: 0.75 }}>
                  *Simulação não debita estoque. Para baixar estoque de verdade, faremos uma ação separada depois.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        );
      })}

      {!receitasFiltradas.length && (
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 4, textAlign: "center", opacity: 0.7 }}>
            Nenhuma receita encontrada.
          </Paper>
        </Grid>
      )}
    </Grid>
  );
}
