import React, { useState } from 'react';
import { Box, IconButton, Button, Popover, Stack } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export default function ChatOptions({ userId }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleOptionClick = (action) => {
    console.log(`Executando ação '${action}' para usuário ${userId}`);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <Box>
      <IconButton onClick={handleOpen}>
        <MoreVertIcon />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Stack p={2} spacing={1}>
          <Button variant="contained" onClick={() => handleOptionClick('flood')}>
            Ativar bot flood 1h
          </Button>
          <Button variant="contained" color="warning" onClick={() => handleOptionClick('criar_pedido')}>
            Criar pedido para usuário
          </Button>
          <Button variant="contained" color="success" onClick={() => handleOptionClick('reativar_automatico')}>
            Reativar mensagens automáticas
          </Button>
        </Stack>
      </Popover>
    </Box>
  );
}