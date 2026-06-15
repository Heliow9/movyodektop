import React, { useEffect, useState } from 'react';
import { Alert, Backdrop, Box, Button, LinearProgress, Paper, Snackbar, Typography } from '@mui/material';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';

function shouldOpenStatus(state) {
  if (!state) return false;
  if (['available', 'downloading', 'ready'].includes(state.status)) return true;
  return Boolean(state.notifyUser) && ['unavailable', 'up-to-date'].includes(state.status);
}

export default function UpdateManager() {
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let off;

    window.electron?.obterStatusAtualizacao?.().then((nextState) => {
      setState(nextState);
      setOpen(shouldOpenStatus(nextState));
    });

    off = window.electron?.onStatusAtualizacao?.((nextState) => {
      setState(nextState);
      setOpen(shouldOpenStatus(nextState));
    });

    return () => off?.();
  }, []);

  if (!state) return null;

  const ready = state.status === 'ready';
  const downloading = state.status === 'downloading';
  const unavailable = state.status === 'unavailable';
  const upToDate = state.status === 'up-to-date';

  const text = ready
    ? `Versão ${state.availableVersion || 'nova'} pronta para instalar.`
    : downloading
      ? `Baixando atualização: ${state.progress || 0}%`
      : unavailable
        ? state.error || 'O servidor de atualização está temporariamente indisponível.'
        : upToDate
          ? `O Movyo já está atualizado na versão ${state.currentVersion}.`
          : state.status === 'available'
            ? `Nova versão ${state.availableVersion || ''} encontrada.`
            : '';

  const action = ready
    ? (
      <Button color="inherit" size="small" onClick={() => window.electron?.aplicarAtualizacao?.()}>
        REINICIAR E ATUALIZAR
      </Button>
    )
    : unavailable
      ? (
        <Button color="inherit" size="small" onClick={() => window.electron?.verificarAtualizacao?.()}>
          TENTAR NOVAMENTE
        </Button>
      )
      : null;

  const severity = unavailable ? 'warning' : ready || upToDate ? 'success' : 'info';

  return (
    <>
      {state.mandatory && (
        <Backdrop open sx={{ zIndex: 20000, background: 'rgba(15,23,42,.86)', backdropFilter: 'blur(10px)' }}>
          <Paper sx={{ width: 'min(560px,92vw)', p: 5, borderRadius: 5, textAlign: 'center' }}>
            <SystemUpdateAltRoundedIcon sx={{ fontSize: 64, color: '#ff3b8a' }} />
            <Typography variant="h4" fontWeight={950} mt={2}>Atualização obrigatória</Typography>
            <Typography color="text.secondary" mt={1.5}>
              Uma versão essencial do Movyo precisa ser instalada para manter compatibilidade, segurança e funcionamento correto.
            </Typography>
            {downloading && (
              <Box mt={3}>
                <LinearProgress variant="determinate" value={state.progress || 0} />
                <Typography mt={1}>{state.progress || 0}%</Typography>
              </Box>
            )}
            {unavailable && <Alert severity="warning" sx={{ mt: 3 }}>{state.error}</Alert>}
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!ready && downloading}
              sx={{ mt: 3, borderRadius: 3, background: 'linear-gradient(135deg,#ff3b8a,#ff7a45)' }}
              onClick={() => ready ? window.electron?.aplicarAtualizacao?.() : window.electron?.verificarAtualizacao?.()}
            >
              {ready ? 'Reiniciar e instalar agora' : unavailable ? 'Tentar novamente' : 'Baixando atualização...'}
            </Button>
          </Paper>
        </Backdrop>
      )}

      {!state.mandatory && text && (
        <Snackbar
          open={open}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={severity} variant="filled" sx={{ minWidth: 380, alignItems: 'center' }} action={action}>
            {text}
            {downloading && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress variant="determinate" value={state.progress || 0} />
              </Box>
            )}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}
