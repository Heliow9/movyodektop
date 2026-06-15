// src/components/mesas/ModalCriarLote.js
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Alert, Grid } from '@mui/material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export default function ModalCriarLote({ open, onClose, onLoteCriado, restauranteId }) {
  const [form, setForm] = useState({
    quantidade: 10,
    prefixo: 'Mesa ',
    numeroInicial: 1,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const creatingRef = useRef(false);
  const idempotencyKeyRef = useRef(null);

  useEffect(() => {
    if (open) {
      setError('');
      creatingRef.current = false;
      idempotencyKeyRef.current = null;
      setIsCreating(false);
      setForm({ quantidade: 10, prefixo: 'Mesa ', numeroInicial: 1 });
    }
  }, [open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'quantidade' || name === 'numeroInicial' ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (creatingRef.current || isCreating) return;
    creatingRef.current = true;
    setIsCreating(true);
    setError('');

    try {
      const idempotencyKey = idempotencyKeyRef.current || `${restauranteId || 'rest'}:lote:${form.prefixo}:${form.numeroInicial}:${form.quantidade}:${Date.now()}`;
      idempotencyKeyRef.current = idempotencyKey;

      const response = await axios.post(`${API_URL}/api/mesas/lote`, {
        ...form,
        restauranteId,
      }, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      });
      onLoteCriado(response.data); // Envia o array de mesas de volta
      onClose();
    } catch (err) {
      console.error('Erro ao criar mesas em lote:', err);
      setError(err.response?.data?.message || 'Não foi possível criar as mesas.');
    } finally {
      creatingRef.current = false;
      idempotencyKeyRef.current = null;
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={isCreating ? undefined : onClose} PaperProps={{ component: 'form', onSubmit: handleSubmit }}>
      <DialogTitle>Adicionar Mesas em Lote</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              autoFocus
              required
              name="quantidade"
              label="Quantidade"
              type="number"
              fullWidth
              variant="outlined"
              value={form.quantidade}
              onChange={handleChange}
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              name="numeroInicial"
              label="Número Inicial"
              type="number"
              fullWidth
              variant="outlined"
              value={form.numeroInicial}
              onChange={handleChange}
               inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="prefixo"
              label="Prefixo (ex: Mesa, Balcão)"
              type="text"
              fullWidth
              variant="outlined"
              value={form.prefixo}
              onChange={handleChange}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={isCreating}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={isCreating}>
          {isCreating ? <CircularProgress size={24} /> : `Criar ${form.quantidade || 0} Mesas`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}