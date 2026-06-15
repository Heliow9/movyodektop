import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDrag } from 'react-dnd';
import {
  Box, Typography, Tooltip, IconButton, Paper, Divider, Chip, Button
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import PersonIcon from '@mui/icons-material/Person';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { enviarParaImpressao } from '../../utils/enviarImpressao';
import { toBRL, toMoneyNumber } from '../../utils/money';
const CARD_STYLES = {
  p: 2, mb: 2, borderRadius: 3, transition: '0.3s',
  border: '1px solid #e0e0e0', backgroundColor: '#fff'
};

function CardPedido({ pedido, onAvancar, finalizarEntrega, disableDrag = false, loading = false }) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'CARD',
      item: { id: pedido.id },
      canDrag: !disableDrag,
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [pedido?.id, disableDrag]
  );

  const entregaValor = useMemo(() => {
    const e = pedido?.itens?.find(i => i?.nome?.toLowerCase() === 'entrega');
    return e ? toBRL(toMoneyNumber(e.precoUnitario) * Number(e.quantidade || 1)) : null;
  }, [pedido?.itens]);

  const totalLabel = useMemo(() => toBRL(pedido?.total || 0), [pedido?.total]);
  const itensSemEntrega = useMemo(
    () => (pedido?.itens || []).filter(i => i?.nome?.toLowerCase() !== 'entrega'),
    [pedido?.itens]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Paper
        ref={drag}
        elevation={3}
        sx={{ ...CARD_STYLES, opacity: isDragging ? 0.6 : 1 }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Chip label={pedido.nome} size="small" color="error" />
          <Box display="flex" alignItems="center" gap={1}>
            <PersonIcon fontSize="small" />
            <Typography variant="body2" fontWeight={500}>{pedido.cliente}</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* Itens */}
        <Box component="ul" sx={{ pl: 0, mb: 1, listStyle: 'none' }}>
          {itensSemEntrega.map((item, i) => (
            <Box
              key={`${item.nome}-${i}-${item.quantidade}`}
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              sx={{ px: 1, py: 0.5 }}
            >
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {item.quantidade}x {item.nome}
                </Typography>

                {Array.isArray(item.saboresSelecionados) && item.saboresSelecionados.length > 0 && (
                  <Box ml={2}>
                    {item.saboresSelecionados.map((sabor, idx) => (
                      <Typography
                        key={idx}
                        variant="body2"
                        sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
                      >
                        • {String(sabor).trim()}
                      </Typography>
                    ))}
                  </Box>
                )}

                {item.bordaSelecionada && (
                  <Typography variant="body2" sx={{ ml: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
                    Borda: {item.bordaSelecionada.nome} (+{toBRL(item.bordaSelecionada.preco)})
                  </Typography>
                )}

                {item.adicionalSelecionado && (
                  <Typography variant="body2" sx={{ ml: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
                    Adicional: {item.adicionalSelecionado.nome} (+{toBRL(item.adicionalSelecionado.preco)})
                  </Typography>
                )}

                {Array.isArray(item.complementosSelecionados) && item.complementosSelecionados.length > 0 && (
                  <Typography variant="body2" sx={{ ml: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
                    Complementos: {item.complementosSelecionados
                      .map((c, idx) => `${c.nome} (+${toBRL(c.preco)})${idx < item.complementosSelecionados.length - 1 ? ', ' : ''}`)}
                  </Typography>
                )}

                {item.tiposExtrasSelecionados && Object.entries(item.tiposExtrasSelecionados).map(([tipoNome, extras]) =>
                  (extras || []).map((extra, j) => (
                    <Typography
                      key={`${tipoNome}-${j}`}
                      variant="body2"
                      sx={{ ml: 2, fontSize: '0.85rem', color: 'text.secondary' }}
                    >
                      {tipoNome}: {extra?.nome} (+{toBRL(extra?.preco)})
                    </Typography>
                  ))
                )}
              </Box>

              <Typography variant="body2" fontWeight="bold">
                {toBRL(Number(item.quantidade || 1) * toMoneyNumber(item.precoUnitario))}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Entrega */}
        {entregaValor && (
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight={500}>Entrega:</Typography>
            <Typography variant="body2" color="text.secondary">{entregaValor}</Typography>
          </Box>
        )}

        {/* Total */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" fontWeight={500}>Total:</Typography>
          <Chip
            icon={<AttachMoneyIcon sx={{ fontSize: 18 }} />}
            label={totalLabel}
            size="small"
            sx={{ backgroundColor: '#4CAF50', color: 'white', fontWeight: 'bold' }}
          />
        </Box>

        {/* Ações */}
        <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
          {/* 👇 sempre disponível, em qualquer coluna */}
          <Tooltip title="Imprimir pedido">
            <IconButton size="small" color="primary" onClick={() => enviarParaImpressao(pedido)}>
              <PrintIcon />
            </IconButton>
          </Tooltip>

          {pedido.status === 'pago' && (
            <Button
              onClick={() => onAvancar?.(pedido)}
              variant="contained"
              size="small"
              disabled={loading}
              sx={{
                bgcolor: '#C8102E',
                color: 'white',
                borderRadius: 2,
                boxShadow: 2,
                px: 3,
                fontWeight: 'bold',
                transition: '0.2s ease-in-out',
                '&:hover': { bgcolor: '#A0001F', boxShadow: 4, transform: 'scale(1.03)' }
              }}
            >
              ACEITAR
            </Button>
          )}

          {pedido.status === 'em_producao' && (
            <Button
              onClick={() => onAvancar?.(pedido)}
              variant="contained"
              size="small"
              disabled={loading}
              sx={{
                bgcolor: '#2196F3',
                color: 'white',
                '&:hover': { bgcolor: '#1976D2' },
                borderRadius: 2,
                px: 2,
                fontWeight: 'bold',
                boxShadow: 2
              }}
            >
              PARA ENTREGA
            </Button>
          )}

          {pedido.status === 'em_entrega' && (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300 }}>
              <Button
                onClick={() => finalizarEntrega?.(pedido)}
                variant="contained"
                size="small"
                disabled={loading}
                sx={{ bgcolor: '#4CAF50', color: 'white', '&:hover': { bgcolor: '#388E3C' }, borderRadius: 2, boxShadow: 2, px: 3, fontWeight: 'bold' }}
              >
                FINALIZAR ENTREGA
              </Button>
            </motion.div>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
}

export default memo(CardPedido);
