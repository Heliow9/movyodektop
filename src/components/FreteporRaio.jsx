// components/FretePorRaio.jsx
import React from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Paper,
  Grid,
  TextField,
  InputAdornment,
  Button,
  Stack,
  IconButton,
  Chip,
  Tooltip,
  Divider,
} from "@mui/material";
import {
  ExpandMore,
  AddCircleOutline,
  Save,
  DeleteOutline,
  InfoOutlined,
} from "@mui/icons-material";

const FretePorRaio = ({ faixasRaio, setFaixasRaio, onSalvar }) => {
  const handleChangeFaixa = (index, field, value) => {
    // permite campo vazio enquanto o usuário digita
    const parsed =
      value === "" ? "" : Number.isNaN(parseFloat(value)) ? "" : parseFloat(value);

    setFaixasRaio((prev) =>
      prev.map((faixa, i) =>
        i === index
          ? {
              ...faixa,
              [field]: parsed,
            }
          : faixa
      )
    );
  };

  const adicionarFaixa = () => {
    setFaixasRaio((prev) => [
      ...prev,
      {
        ate: prev.length ? prev[prev.length - 1].ate || 0 : 0,
        valor: 0,
      },
    ]);
  };

  const removerFaixa = (index) => {
    setFaixasRaio((prev) => prev.filter((_, i) => i !== index));
  };

  // pequenas infos para o cabeçalho
  const totalFaixas = faixasRaio.length;
  const menorValor =
    totalFaixas > 0
      ? Math.min(
          ...faixasRaio
            .map((f) => Number(f.valor))
            .filter((v) => !Number.isNaN(v))
        )
      : null;
  const maiorValor =
    totalFaixas > 0
      ? Math.max(
          ...faixasRaio
            .map((f) => Number(f.valor))
            .filter((v) => !Number.isNaN(v))
        )
      : null;

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: "100%" }}
            spacing={1}
          >
            <Stack spacing={0.3}>
              <Typography variant="h6">Faixas de frete por raio</Typography>
              <Typography variant="body2" color="text.secondary">
                Defina quanto o cliente paga de entrega conforme a distância em
                quilômetros do seu restaurante.
              </Typography>
            </Stack>

            {totalFaixas > 0 && (
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                justifyContent="flex-end"
              >
                <Chip
                  size="small"
                  label={`${totalFaixas} faixa${
                    totalFaixas > 1 ? "s" : ""
                  } configurada${totalFaixas > 1 ? "s" : ""}`}
                  variant="outlined"
                />
                {menorValor != null && !Number.isNaN(menorValor) && (
                  <Chip
                    size="small"
                    icon={<InfoOutlined fontSize="small" />}
                    label={`Frete a partir de R$ ${menorValor.toFixed(2)}`}
                    variant="outlined"
                  />
                )}
                {maiorValor != null &&
                  !Number.isNaN(maiorValor) &&
                  maiorValor !== menorValor && (
                    <Chip
                      size="small"
                      icon={<InfoOutlined fontSize="small" />}
                      label={`Máx. R$ ${maiorValor.toFixed(2)}`}
                      variant="outlined"
                    />
                  )}
              </Stack>
            )}
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          {faixasRaio.map((faixa, index) => (
            <Paper
              key={index}
              elevation={1}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={1.5}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  Faixa {index + 1}
                </Typography>
                {faixasRaio.length > 1 && (
                  <Tooltip title="Remover faixa">
                    <IconButton
                      size="small"
                      onClick={() => removerFaixa(index)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Até (km)"
                    type="number"
                    fullWidth
                    size="small"
                    value={faixa.ate === "" ? "" : faixa.ate}
                    onChange={(e) =>
                      handleChangeFaixa(index, "ate", e.target.value)
                    }
                    inputProps={{ min: 0, step: "0.1" }}
                    helperText="Distância máxima desta faixa"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Valor do frete (R$)"
                    type="number"
                    fullWidth
                    size="small"
                    value={faixa.valor === "" ? "" : faixa.valor}
                    onChange={(e) =>
                      handleChangeFaixa(index, "valor", e.target.value)
                    }
                    inputProps={{ min: 0, step: "0.01" }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">R$</InputAdornment>
                      ),
                    }}
                    helperText="Quanto o cliente paga nessa distância"
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}

          <Divider sx={{ my: 2 }} />

          <Button
            startIcon={<AddCircleOutline />}
            onClick={adicionarFaixa}
            sx={{ mt: 1 }}
          >
            Adicionar faixa
          </Button>
        </AccordionDetails>
      </Accordion>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          onClick={onSalvar}
          startIcon={<Save />}
          sx={{ mt: 3 }}
        >
          Salvar configurações
        </Button>
      </Stack>
    </>
  );
};

export default FretePorRaio;
