import React, { useState, useEffect, useRef } from 'react'; // 👈 1. IMPORTE O useEffect
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, CircularProgress, Alert 
} from '@mui/material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export default function ModalCriarMesa({ open, onClose, onMesaCriada, restauranteId }) {
  const [numeroMesa, setNumeroMesa] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const creatingRef = useRef(false);
  const idempotencyKeyRef = useRef(null);

  // 👇 2. ADICIONE ESTE useEffect PARA RESETAR O MODAL
  // Este efeito será executado sempre que a prop 'open' mudar.
  useEffect(() => {
    // Se o modal está sendo aberto, limpa todos os campos para um estado inicial.
    if (open) {
      setNumeroMesa('');
      setError('');
      creatingRef.current = false;
      idempotencyKeyRef.current = null;
      setIsCreating(false);
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (creatingRef.current || isCreating) return;
    if (!numeroMesa.trim()) {
      setError('O número da mesa é obrigatório.');
      return;
    }

    creatingRef.current = true;
    setIsCreating(true);
    setError('');

    try {
      const idempotencyKey = idempotencyKeyRef.current || `${restauranteId || 'rest'}:${String(numeroMesa).trim()}:${Date.now()}`;
      idempotencyKeyRef.current = idempotencyKey;

      const response = await axios.post(`${API_URL}/api/mesas`, {
        numero: numeroMesa,
        restauranteId: restauranteId,
      }, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      });
      
      onMesaCriada(response.data);
      onClose(); // Apenas chama a função do pai para fechar
    } catch (err) {
      console.error('Erro ao criar mesa:', err);
      setError(err.response?.data?.message || 'Não foi possível criar a mesa. Tente novamente.');
    } finally {
      creatingRef.current = false;
      idempotencyKeyRef.current = null;
      setIsCreating(false);
    }
  };

  return (
    // 👇 3. SIMPLIFIQUE o onClose AQUI, passando diretamente a prop
    <Dialog open={open} onClose={isCreating ? undefined : onClose} PaperProps={{ component: 'form', onSubmit: handleSubmit }}>
      <DialogTitle>Adicionar Nova Mesa</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          required
          margin="dense"
          id="numero"
          name="numero"
          label="Número ou Nome da Mesa (ex: 5, 12A, Varanda)"
          type="text"
          fullWidth
          variant="outlined"
          value={numeroMesa}
          onChange={(e) => setNumeroMesa(e.target.value)}
          disabled={isCreating}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} disabled={isCreating}>Cancelar</Button>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={isCreating || !numeroMesa.trim()}
        >
          {isCreating ? <CircularProgress size={24} /> : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}