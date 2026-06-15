import React, { memo, useMemo, useCallback, useState } from 'react';
import { useDrop } from 'react-dnd';
import {
  Box,
  Typography,
  Badge,
  TextField,
  InputAdornment,
  IconButton,
  Autocomplete,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import CardPedido from './CardPedido';

const CONTAINER_SX = {
  p: 2,
  borderRadius: 2,
  flex: 1,
  height: 'calc(100vh - 250px)',
  overflowY: 'auto',
  transition: '0.3s',
};

// Heurística: decide se uma string "parece" código de pedido
const pareceCodigo = (str) => {
  if (!str) return false;
  const s = String(str);
  const digits = s.replace(/\D+/g, '');
  if (/#\w*\d+/.test(s)) return true;        // #BT00018
  if (/[A-Z]{1,5}\d{3,}/i.test(s)) return true; // BT00018
  if (digits.length >= 3) return true;        // 00018
  return false;
};

// Coleta candidatos dentro do objeto (raso + leve)
const coletarCandidatos = (obj, maxDepth = 2) => {
  const out = new Set();
  const keyMatch = /(numero|número|num|code|codigo|código|pedido|id|ref|label|display|etiqueta)/i;

  const walk = (o, depth) => {
    if (o == null || depth > maxDepth) return;

    if (typeof o === 'string' || typeof o === 'number') {
      const str = String(o);
      if (pareceCodigo(str)) out.add(str);
      return;
    }

    if (Array.isArray(o)) {
      o.forEach((v) => walk(v, depth + 1));
      return;
    }

    if (typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (keyMatch.test(k) || typeof v === 'string' || typeof v === 'number') {
          const valStr = String(v ?? '');
          if (pareceCodigo(valStr)) out.add(valStr);
        }
        if (typeof v === 'object') walk(v, depth + 1);
      }
    }
  };

  walk(obj, 0);

  // Variações formatadas se existir número cru + possível prefixo
  const numeroCru = obj?.numero ?? obj?.num ?? obj?.numeroPedido;
  if (numeroCru != null && !Number.isNaN(Number(numeroCru))) {
    const padded = String(numeroCru).padStart(5, '0');
    const prefixo = obj?.prefixo ?? obj?.sigla ?? obj?.serie;
    out.add(padded);
    if (prefixo) {
      out.add(`${prefixo}${padded}`);
      out.add(`#${prefixo}${padded}`);
    }
    out.add(`#${padded}`);
  }

  return Array.from(out);
};

// realça o trecho buscado dentro do texto
const Highlight = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const t = String(text);
  const idx = t.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {t.slice(0, idx)}
      <strong>{t.slice(idx, idx + q.length)}</strong>
      {t.slice(idx + q.length)}
    </>
  );
};

function ColunaPedidos({
  title,
  status,
  pedidos,
  onDrop,
  onAvancar,
  finalizarEntrega,
  color,
  disableDrop,
  loading,
}) {
  const [busca, setBusca] = useState('');

  const handleDrop = useCallback(
    (id) => onDrop?.(id, status),
    [onDrop, status]
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'CARD',
      canDrop: () => !disableDrop,
      drop: (item) => !disableDrop && handleDrop(item.id),
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [disableDrop, handleDrop]
  );

  const listaPedidos = useMemo(() => pedidos || [], [pedidos]);

  // === SUGESTÕES ===
  const todasSugs = useMemo(() => {
    const set = new Set();
    for (const p of listaPedidos) {
      for (const s of coletarCandidatos(p)) set.add(s);
    }
    // Ordena por “mais parecido” com a busca corrente
    const arr = Array.from(set);
    const q = busca.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');
    return arr
      .map((s) => {
        const sd = s.replace(/\D+/g, '');
        // score simples: prioriza quem contém q, depois quem contém dígitos
        let score = 0;
        if (q && s.toLowerCase().includes(q)) score += 2;
        if (qDigits && sd.includes(qDigits)) score += 1;
        return { label: s, score };
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .map((x) => x.label);
  }, [listaPedidos, busca]);

  // === FILTRO DOS CARDS ===
  const pedidosFiltrados = useMemo(() => {
    const q = String(busca || '').trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, '');

    if (!q && !qDigits) return listaPedidos;

    return listaPedidos.filter((p) => {
      const candidatos = coletarCandidatos(p);
      if (candidatos.length === 0) return false;

      return candidatos.some((valor) => {
        const s = String(valor ?? '');
        const sLower = s.toLowerCase();
        const sDigits = s.replace(/\D+/g, '');

        const matchTexto = q && sLower.includes(q);
        const matchDigitos =
          qDigits &&
          sDigits &&
          (sDigits.includes(qDigits) ||
            qDigits.includes(sDigits) ||
            sDigits.endsWith(qDigits) ||
            qDigits.endsWith(sDigits));

        return matchTexto || matchDigitos;
      });
    });
  }, [listaPedidos, busca]);

  return (
    <Box
      ref={drop}
      sx={{
        ...CONTAINER_SX,
        backgroundColor: isOver ? '#f0f0f0' : color,
      }}
    >
      <Box display="flex" alignItems="center" mb={2} gap={2}>
        <Typography fontWeight="bold">{title}</Typography>
        <Badge badgeContent={pedidosFiltrados.length} color="primary" />
      </Box>

      {/* Autocomplete com sugestões */}
      <Box mb={2}>
        <Autocomplete
          freeSolo
          options={todasSugs}
          value={busca}
          inputValue={busca}
          onInputChange={(_, v) => setBusca(v)}
          onChange={(_, v) => {
            if (typeof v === 'string') setBusca(v);
          }}
          filterOptions={(x) => x} // não deixe o MUI re-filtrar; já fazemos acima
          clearOnBlur={false}
          noOptionsText="Sem sugestões"
          renderOption={(props, option) => (
            <li {...props} key={option}>
              <Highlight text={option} query={busca} />
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Buscar nº / código do pedido"
              size="small"
              fullWidth
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: busca ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Limpar busca"
                      size="small"
                      onClick={() => setBusca('')}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          )}
        />
      </Box>

      {pedidosFiltrados.map((p) => (
        <CardPedido
          key={p.id}
          pedido={p}
          onAvancar={onAvancar}
          finalizarEntrega={finalizarEntrega}
          disableDrag={disableDrop}
          loading={loading}
        />
      ))}
    </Box>
  );
}

export default memo(ColunaPedidos);
