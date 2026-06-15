import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { API_URL, fetchMe } from '../services/api';
import { getPrintQueueStatus, retryPrintJob, clearFinishedPrintJobs, processPrintQueue } from '../services/printQueue';
import { SOCKET_STATUS_EVENT } from '../services/sockets';
import { getOfflineGrace } from '../utils/offlineLicense';

const UPDATE_LABELS = {
  idle: 'Aguardando',
  checking: 'Verificando...',
  'up-to-date': 'Atualizado',
  available: 'Disponível',
  downloading: 'Baixando',
  ready: 'Pronta para instalar',
  unavailable: 'Temporariamente indisponível',
  development: 'Modo desenvolvimento',
};

const Row = ({ label, value, status }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.2 }}>
    <Typography color="text.secondary">{label}</Typography>
    <Chip
      size="small"
      color={status === 'ok' ? 'success' : status === 'warn' ? 'warning' : status === 'error' ? 'error' : 'default'}
      label={String(value ?? '—')}
    />
  </Box>
);

function updaterChipStatus(status) {
  if (['up-to-date'].includes(status)) return 'ok';
  if (['available', 'downloading', 'ready', 'checking', 'unavailable'].includes(status)) return 'warn';
  if (status === 'error') return 'error';
  return undefined;
}

export default function Diagnostico() {
  const [diag, setDiag] = useState(null);
  const [apiState, setApiState] = useState({ status: 'verificando' });
  const [socket, setSocket] = useState({ status: 'desconhecido' });
  const [queue, setQueue] = useState(getPrintQueueStatus());

  const updater = diag?.updater || {};
  const updaterLabel = useMemo(() => {
    const base = UPDATE_LABELS[updater.status] || updater.status || '—';
    if (updater.status === 'downloading') return `${base} • ${updater.progress || 0}%`;
    if (updater.status === 'available' && updater.availableVersion) return `${base} • v${updater.availableVersion}`;
    if (updater.status === 'ready' && updater.availableVersion) return `${base} • v${updater.availableVersion}`;
    return base;
  }, [updater.status, updater.progress, updater.availableVersion]);

  async function load() {
    const diagnostic = await window.electron?.obterDiagnostico?.();
    setDiag(diagnostic || null);

    const started = Date.now();
    try {
      await fetchMe(localStorage.getItem('_token'));
      setApiState({ status: 'online', ms: Date.now() - started });
    } catch (error) {
      setApiState({ status: 'erro', error: error?.message });
    }

    setQueue(getPrintQueueStatus());
  }

  async function checkUpdate() {
    const nextUpdater = await window.electron?.verificarAtualizacao?.();
    if (nextUpdater) {
      setDiag((current) => ({ ...(current || {}), updater: nextUpdater }));
    }
  }

  useEffect(() => {
    load();

    const onSocket = (event) => setSocket(event.detail || {});
    const onQueue = (event) => setQueue(event.detail || getPrintQueueStatus());
    const offUpdater = window.electron?.onStatusAtualizacao?.((nextUpdater) => {
      setDiag((current) => ({ ...(current || {}), updater: nextUpdater }));
    });

    window.addEventListener(SOCKET_STATUS_EVENT, onSocket);
    window.addEventListener('movyo:print-queue-changed', onQueue);

    return () => {
      window.removeEventListener(SOCKET_STATUS_EVENT, onSocket);
      window.removeEventListener('movyo:print-queue-changed', onQueue);
      offUpdater?.();
    };
  }, []);

  const grace = getOfflineGrace();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={950}>Diagnóstico Movyo</Typography>
          <Typography color="text.secondary">Conexão, atualização, impressoras, licença e fila de impressão.</Typography>
        </Box>
        <Button startIcon={<RefreshRoundedIcon />} variant="contained" onClick={load}>Atualizar</Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900}>Aplicativo</Typography>
            <Divider sx={{ my: 1 }} />
            <Row label="Versão" value={diag?.app?.version} />
            <Row label="Electron" value={diag?.system?.electron} />
            <Row label="Plataforma" value={`${diag?.system?.platform || ''} ${diag?.system?.arch || ''}`} />
            <Row label="Atualização" value={updaterLabel} status={updaterChipStatus(updater.status)} />
            {updater.status === 'unavailable' && updater.error && (
              <Alert severity="warning" sx={{ mt: 1 }}>{updater.error}</Alert>
            )}
            <Stack direction="row" gap={1} mt={2}>
              <Button size="small" onClick={checkUpdate}>Verificar update</Button>
              <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => window.electron?.abrirPastaLogs?.()}>Abrir logs</Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900}>Conectividade</Typography>
            <Divider sx={{ my: 1 }} />
            <Row label="API" value={apiState.status === 'online' ? `Online • ${apiState.ms}ms` : apiState.error || apiState.status} status={apiState.status === 'online' ? 'ok' : 'error'} />
            <Row label="Socket" value={socket.status} status={socket.status === 'online' ? 'ok' : socket.status === 'reconectando' ? 'warn' : 'error'} />
            <Row label="Servidor" value={API_URL} />
            <Row label="Internet" value={navigator.onLine ? 'Online' : 'Offline'} status={navigator.onLine ? 'ok' : 'error'} />
            <Row label="Tolerância offline" value={grace.allowed ? `${Math.ceil(grace.remainingMs / 3600000)}h restantes` : 'expirada'} status={grace.allowed ? 'ok' : 'error'} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900}>Impressão</Typography>
            <Divider sx={{ my: 1 }} />
            <Row label="Impressoras detectadas" value={diag?.printers?.length || 0} status={diag?.printers?.length ? 'ok' : 'warn'} />
            <Row label="Pendentes" value={queue.pendentes || 0} status={queue.pendentes ? 'warn' : 'ok'} />
            <Row label="Falhas" value={queue.falhas || 0} status={queue.falhas ? 'error' : 'ok'} />
            <Row label="Concluídas no histórico" value={queue.impressos || 0} />
            <Stack direction="row" gap={1} mt={2}>
              <Button size="small" startIcon={<PrintRoundedIcon />} onClick={processPrintQueue}>Processar fila</Button>
              <Button size="small" onClick={clearFinishedPrintJobs}>Limpar concluídas</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {queue.falhas > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Há impressões com falha.{' '}
          {queue.items?.filter((item) => item.status === 'falha').slice(0, 5).map((item) => (
            <Button key={item.jobId} size="small" onClick={() => retryPrintJob(item.jobId)}>Repetir {item.pedidoId}</Button>
          ))}
        </Alert>
      )}
    </Box>
  );
}
