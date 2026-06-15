import React from "react";
import {
  Box,
  Paper,
  Stack,
  Tabs,
  Tab,
  Typography,
  Button,
  Divider,
  Grid,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Skeleton,
  InputAdornment,
  TextField,
} from "@mui/material";

import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function RelatoriosTab({
  loading,
  brand,
  tabRel,
  setTabRel,
  busca,

  // produção
  receitasReport,
  onOpenDetalhes,
  onSimularBaixa,

  // compras
  receitas,
  metaPorReceita,
  setMetaPorReceita,
  comprasConsolidadas,
  fromBase,
  formatQtd,
  parseNum,
  calcConsumoPara,
  insumoMap,

  // alertas
  insumosAbaixoMinimo,

  // exports
  exportProducaoCSV,
  exportComprasConsolidadoCSV,
  exportComprasPorReceitaCSV,
  exportAlertasCSV,
}) {
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
            <Skeleton variant="rounded" height={32} width="40%" sx={{ mt: 1.2 }} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          p: 2,
          mb: 2,
          border: "1px solid rgba(0,0,0,0.06)",
          bgcolor: "white",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
          <Tabs
            value={tabRel}
            onChange={(_, v) => setTabRel(v)}
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 900 },
              "& .MuiTabs-indicator": { height: 4, borderRadius: 99, background: brand.grad },
            }}
          >
            <Tab icon={<RestaurantMenuIcon />} iconPosition="start" label="Produção (Gargalos)" />
            <Tab icon={<ShoppingBasketOutlinedIcon />} iconPosition="start" label="Compras (Meta)" />
            <Tab icon={<WarningAmberRoundedIcon />} iconPosition="start" label="Alertas" />
          </Tabs>

          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            {tabRel === 0 && (
              <Button
                onClick={exportProducaoCSV}
                startIcon={<DownloadOutlinedIcon />}
                variant="outlined"
                sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
              >
                Exportar CSV
              </Button>
            )}

            {tabRel === 1 && (
              <>
                <Button
                  onClick={exportComprasConsolidadoCSV}
                  startIcon={<DownloadOutlinedIcon />}
                  variant="outlined"
                  sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                >
                  CSV (Consolidado)
                </Button>
                <Button
                  onClick={exportComprasPorReceitaCSV}
                  startIcon={<DownloadOutlinedIcon />}
                  variant="outlined"
                  sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                >
                  CSV (Por receita)
                </Button>
              </>
            )}

            {tabRel === 2 && (
              <Button
                onClick={exportAlertasCSV}
                startIcon={<DownloadOutlinedIcon />}
                variant="outlined"
                sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
              >
                Exportar CSV
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <LoadingGrid />
      ) : (
        <>
          {/* Produção */}
          {tabRel === 0 && (
            <Grid container spacing={2}>
              {receitasReport
                .filter((r) => {
                  const b = busca.trim().toLowerCase();
                  return !b ? true : r.nome.toLowerCase().includes(b);
                })
                .map((r) => {
                  const prod = r.prod;
                  const semEstoque = prod.motivo === "ok" && prod.max <= 0 && (r.itens?.length || 0) > 0;

                  const chipLabel =
                    prod.motivo === "ok"
                      ? `Produz até ${prod.max} un`
                      : prod.motivo === "unidade_incompativel"
                      ? "Unidade incompatível"
                      : "Sem dados";

                  const gargalo =
                    prod.motivo === "ok" && prod?.gargalo?.insumo?.nome
                      ? `Gargalo: ${prod.gargalo.insumo.nome}`
                      : "";

                  const tooltipTitle =
                    prod.motivo !== "ok" ? (
                      <Box sx={{ p: 0.5 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>Não foi possível calcular</Typography>
                        <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                          {prod.motivo === "unidade_incompativel"
                            ? "Existe insumo com unidade incompatível."
                            : "Adicione insumos/quantidades válidas."}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ p: 0.5 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12, mb: 0.5 }}>Cálculo por insumo</Typography>
                        {prod.detalhes.map((d) => (
                          <Stack
                            key={d.insumo.id}
                            direction="row"
                            justifyContent="space-between"
                            gap={2}
                            sx={{ mb: 0.3 }}
                          >
                            <Typography sx={{ fontSize: 12, opacity: 0.95 }}>{d.insumo.nome}</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{d.maxPorInsumo} un</Typography>
                          </Stack>
                        ))}
                        <Divider sx={{ my: 0.7, borderColor: "rgba(255,255,255,0.25)" }} />
                        <Typography sx={{ fontSize: 12 }}>
                          Resultado (gargalo): <b>{prod.max} un</b>
                        </Typography>
                      </Box>
                    );

                  return (
                    <Grid item xs={12} md={6} lg={4} key={r.id}>
                      <Paper
                        sx={{
                          borderRadius: 4,
                          border: "1px solid rgba(0,0,0,0.06)",
                          boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
                          overflow: "hidden",
                        }}
                      >
                        <Box sx={{ height: 6, background: brand.grad }} />
                        <Box sx={{ p: 2.2 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: 16 }} noWrap>
                            {r.nome}
                          </Typography>

                          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.2, alignItems: "center" }}>
                            <Chip
                              icon={<InfoOutlinedIcon />}
                              label={chipLabel}
                              sx={{
                                fontWeight: 900,
                                bgcolor:
                                  prod.motivo === "unidade_incompativel"
                                    ? "rgba(255,193,7,0.20)"
                                    : semEstoque
                                    ? "rgba(244,67,54,0.12)"
                                    : "rgba(0,0,0,0.06)",
                              }}
                              title=""
                            />
                            {!!gargalo && (
                              <Chip
                                label={gargalo}
                                sx={{ fontWeight: 800, bgcolor: "rgba(255,59,138,0.10)", color: "#c2185b" }}
                              />
                            )}
                          </Stack>

                          <Divider sx={{ my: 1.6 }} />

                          <Stack direction="row" gap={1} flexWrap="wrap">
                            <Button
                              onClick={() => onOpenDetalhes(r.id)}
                              variant="outlined"
                              sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                            >
                              Ver detalhes
                            </Button>
                            <Button
                              onClick={() => onSimularBaixa(r.id, 1)}
                              variant="contained"
                              sx={{
                                borderRadius: 2.2,
                                textTransform: "none",
                                fontWeight: 900,
                                background: brand.grad,
                                boxShadow: "0 10px 18px rgba(255,59,138,0.18)",
                              }}
                            >
                              Simular baixa (1x)
                            </Button>
                          </Stack>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
            </Grid>
          )}

          {/* Compras */}
          {tabRel === 1 && (
            <Stack gap={2}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 4,
                  p: 2,
                  border: "1px solid rgba(0,0,0,0.06)",
                  bgcolor: "white",
                }}
              >
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Meta de produção por receita</Typography>
                <Typography sx={{ fontSize: 12, opacity: 0.7, mb: 2 }}>
                  Defina quantas unidades você quer produzir/vender e veja o que falta comprar.
                </Typography>

                <Grid container spacing={2}>
                  {receitas
                    .filter((r) => {
                      const b = busca.trim().toLowerCase();
                      return !b ? true : r.nome.toLowerCase().includes(b);
                    })
                    .map((r) => (
                      <Grid item xs={12} md={6} lg={4} key={`meta_${r.id}`}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.6,
                            borderRadius: 3,
                            border: "1px solid rgba(0,0,0,0.06)",
                            bgcolor: "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: 14 }} noWrap>
                            {r.nome}
                          </Typography>
                          <TextField
                            value={String(metaPorReceita[r.id] ?? 0)}
                            onChange={(e) =>
                              setMetaPorReceita((prev) => ({
                                ...prev,
                                [r.id]: Math.max(0, Math.floor(Number(parseNum(e.target.value) || 0))),
                              }))
                            }
                            size="small"
                            sx={{ mt: 1, width: "100%", bgcolor: "white", borderRadius: 2 }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <CalculateOutlinedIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            placeholder="Ex: 100"
                          />
                        </Paper>
                      </Grid>
                    ))}
                </Grid>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      p: 2,
                      border: "1px solid rgba(0,0,0,0.06)",
                      bgcolor: "white",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                      <Box>
                        <Typography sx={{ fontWeight: 900, mb: 0.2 }}>Compra sugerida (consolidado)</Typography>
                        <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                          Soma do que falta comprar por insumo, considerando suas metas.
                        </Typography>
                      </Box>

                      <Button
                        onClick={exportComprasConsolidadoCSV}
                        startIcon={<DownloadOutlinedIcon />}
                        variant="outlined"
                        sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                      >
                        Exportar
                      </Button>
                    </Stack>

                    <Divider sx={{ my: 1.6 }} />

                    {!comprasConsolidadas.length ? (
                      <Paper sx={{ p: 2, borderRadius: 3, opacity: 0.7 }}>
                        Nada a comprar (com as metas atuais).
                      </Paper>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 900 }}>Insumo</TableCell>
                            <TableCell sx={{ fontWeight: 900 }} align="right">
                              Falta comprar
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comprasConsolidadas.map((x) => {
                            const falta = fromBase(x.faltaBase, x.ins.unidadePadrao);
                            return (
                              <TableRow key={`cons_${x.ins.id}`} hover>
                                <TableCell>
                                  <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{x.ins.nome}</Typography>
                                  <Typography sx={{ fontSize: 12, opacity: 0.65 }}>
                                    Unidade: <b>{x.ins.unidadePadrao}</b>
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={formatQtd(falta, x.ins.unidadePadrao)}
                                    sx={{ fontWeight: 900, bgcolor: "rgba(244,67,54,0.12)" }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </Paper>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      p: 2,
                      border: "1px solid rgba(0,0,0,0.06)",
                      bgcolor: "white",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                      <Box>
                        <Typography sx={{ fontWeight: 900, mb: 0.2 }}>Detalhe por receita</Typography>
                        <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                          O que falta em cada receita conforme a meta.
                        </Typography>
                      </Box>

                      <Button
                        onClick={exportComprasPorReceitaCSV}
                        startIcon={<DownloadOutlinedIcon />}
                        variant="outlined"
                        sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                      >
                        Exportar
                      </Button>
                    </Stack>

                    <Divider sx={{ my: 1.6 }} />

                    <Stack gap={1.2}>
                      {receitas
                        .filter((r) => {
                          const b = busca.trim().toLowerCase();
                          return !b ? true : r.nome.toLowerCase().includes(b);
                        })
                        .map((r) => {
                          const meta = metaPorReceita[r.id] ?? 0;
                          const rows = calcConsumoPara(r, insumoMap, meta);

                          const faltas = rows
                            .filter((x) => !x.incompat && x.faltaBase && x.faltaBase > 0)
                            .map((x) => ({
                              nome: x.ins.nome,
                              falta: formatQtd(fromBase(x.faltaBase, x.ins.unidadePadrao), x.ins.unidadePadrao),
                            }));

                          return (
                            <Paper
                              key={`r_buy_${r.id}`}
                              elevation={0}
                              sx={{
                                p: 1.4,
                                borderRadius: 3,
                                border: "1px solid rgba(0,0,0,0.06)",
                                bgcolor: "rgba(0,0,0,0.02)",
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                                <Typography sx={{ fontWeight: 900 }} noWrap>
                                  {r.nome}
                                </Typography>
                                <Chip
                                  icon={<ShoppingBasketOutlinedIcon />}
                                  label={`Meta: ${meta} un`}
                                  sx={{ fontWeight: 900, bgcolor: "rgba(0,0,0,0.06)" }}
                                />
                              </Stack>

                              <Divider sx={{ my: 1 }} />

                              {!faltas.length ? (
                                <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                                  OK — sem compras necessárias pra essa meta.
                                </Typography>
                              ) : (
                                <Stack gap={0.6}>
                                  {faltas.slice(0, 4).map((f, idx) => (
                                    <Stack key={`${r.id}_${idx}`} direction="row" justifyContent="space-between" gap={2}>
                                      <Typography sx={{ fontSize: 12, opacity: 0.85 }} noWrap>
                                        {f.nome}
                                      </Typography>
                                      <Chip
                                        label={f.falta}
                                        sx={{ fontWeight: 900, bgcolor: "rgba(244,67,54,0.12)" }}
                                      />
                                    </Stack>
                                  ))}
                                  {faltas.length > 4 && (
                                    <Typography sx={{ fontSize: 12, opacity: 0.6 }}>
                                      + {faltas.length - 4} itens…
                                    </Typography>
                                  )}
                                </Stack>
                              )}
                            </Paper>
                          );
                        })}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* Alertas */}
          {tabRel === 2 && (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 4,
                p: 2,
                border: "1px solid rgba(0,0,0,0.06)",
                bgcolor: "white",
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                <Box>
                  <Typography sx={{ fontWeight: 900, mb: 0.2 }}>Insumos abaixo do mínimo</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                    Priorize reposição para evitar indisponibilidade no cardápio.
                  </Typography>
                </Box>

                <Button
                  onClick={exportAlertasCSV}
                  startIcon={<DownloadOutlinedIcon />}
                  variant="outlined"
                  sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
                >
                  Exportar
                </Button>
              </Stack>

              <Divider sx={{ my: 1.6 }} />

              {!insumosAbaixoMinimo.length ? (
                <Paper sx={{ p: 2, borderRadius: 3, opacity: 0.7 }}>
                  Nenhum insumo abaixo do mínimo 🎉
                </Paper>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900 }}>Insumo</TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Disponível
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Mínimo
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insumosAbaixoMinimo.map((ins) => {
                      const qtdMostrada = fromBase(ins.quantidadeBase, ins.unidadePadrao);
                      const minMostrado = fromBase(ins.minimoBase, ins.unidadePadrao);

                      return (
                        <TableRow key={`alert_${ins.id}`} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{ins.nome}</Typography>
                            <Typography sx={{ fontSize: 12, opacity: 0.65 }}>
                              Unidade: <b>{ins.unidadePadrao}</b>
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography sx={{ fontWeight: 900 }}>
                              {formatQtd(qtdMostrada, ins.unidadePadrao)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography sx={{ fontWeight: 900 }}>
                              {formatQtd(minMostrado, ins.unidadePadrao)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              icon={<WarningAmberRoundedIcon />}
                              label="Abaixo do mínimo"
                              sx={{ fontWeight: 900, bgcolor: "rgba(255,59,138,0.12)", color: "#c2185b" }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
