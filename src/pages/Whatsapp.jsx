import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import iconPath from '../assets/movyo.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export default function Whatsapp() {
  const [qrCode, setQrCode] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [restauranteId, setRestauranteId] = useState('');
  const [statusMsg, setStatusMsg] = useState('🔄 Inicializando...');
  const [carregando, setCarregando] = useState(true);

  const navigate = useNavigate();
  const webviewRef = useRef(null);
  const intervaloRef = useRef(null);

  const iniciarBotSeNecessario = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/bot/status/${id}`);
      if (!data.ligado) {
        setStatusMsg('📴 Bot desligado. Iniciando...');
        await axios.post(`${API_URL}/api/bot/start`, { restauranteId: id });
      }
    } catch (err) {
      console.warn('Erro ao iniciar bot:', err);
    }
  };

  const buscarQrCode = async (id) => {
    let tent = 0;
    while (tent < 15) {
      try {
        const { data } = await axios.get(`${API_URL}/api/bot/qr/${id}`);
        if (data?.qr) {
          setQrCode(data.qr);
          setStatusMsg('📱 Escaneie o QR Code para ativar o atendimento automático');

          new window.Notification('QR Code disponível', {
            body: 'Escaneie com o WhatsApp da loja.',
            icon: iconPath,
          }).onclick = () => {
            navigate('/whatsapp');
            window.focus();
          };

          return;
        }
      } catch {}

      tent++;
      await new Promise(r => setTimeout(r, 500));
    }

    setQrCode(null);
    setStatusMsg('⏳ Aguardando QR...');
  };

  const checarStatus = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/bot/status/${id}`);
      setConectado(data.conectado);

      if (data.conectado) {
        setQrCode(null);
        setStatusMsg('✅ Bot conectado!');
        clearInterval(intervaloRef.current);
      } else {
        await buscarQrCode(id);
      }
    } catch (err) {
      setStatusMsg('⚠️ Erro ao checar status do bot');
    }
  };

  useEffect(() => {
    (async () => {
      const sess = await window.electron?.obterSessao();
      if (!sess?.restauranteId) return;

      setRestauranteId(sess.restauranteId);
      await iniciarBotSeNecessario(sess.restauranteId);
      await checarStatus(sess.restauranteId);
      setCarregando(false);

      intervaloRef.current = setInterval(() => {
        checarStatus(sess.restauranteId);
      }, 5000);
    })();

    return () => clearInterval(intervaloRef.current);
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const handleDomReady = () => {
      console.log('✅ WebView pronto');

      const script = `
        const waitForInputField = () => {
          const checkInterval = setInterval(() => {
            const input = document.querySelector('div[contenteditable="true"][role="textbox"][aria-label="Digite uma mensagem"]');
            if (input) {
              clearInterval(checkInterval);
              const parent = input.parentElement;
              parent.style.position = 'relative';

              if (!document.querySelector('#meu-botao-engr')) {
                const button = document.createElement('button');
                button.textContent = '⚙️';
                button.style.position = 'absolute';
                button.style.right = '7px';
                button.style.bottom = '7px';
                button.style.background = '#25D366';
                button.style.color = 'white';
                button.style.border = 'none';
                button.style.borderRadius = '50%';
                button.style.width = '30px';
                button.style.height = '30px';
                button.style.cursor = 'pointer';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
                button.style.fontSize = '16px';
                button.style.zIndex = '9999';
                button.id = 'meu-botao-engr';

                button.onclick = () => {
                  alert('Botão engrenagem clicado!');
                };

                parent.appendChild(button);
              }
            }
          }, 1000);
        };

        waitForInputField();
      `;

      wv.executeJavaScript(script);
    };

    const handleError = () => {
      console.error('❌ Erro ao carregar WhatsApp Web');
      setStatusMsg('Erro ao carregar o WhatsApp Web.');
    };

    wv.addEventListener('dom-ready', handleDomReady);
    wv.addEventListener('did-fail-load', handleError);

    return () => {
      wv.removeEventListener('dom-ready', handleDomReady);
      wv.removeEventListener('did-fail-load', handleError);
    };
  }, [conectado]);

  // TELAS
  if (carregando) {
    return <Typography align="center" mt={6}>🔄 Inicializando WhatsApp Bot...</Typography>;
  }

  if (qrCode && !conectado) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography variant="h6" mb={2}>{statusMsg}</Typography>
        <QRCodeCanvas value={qrCode} size={256} />
      </Box>
    );
  }

  if (!qrCode && !conectado) {
    return (
      <Box textAlign="center" mt={6}>
        <CircularProgress />
        <Typography mt={2}>{statusMsg}</Typography>
      </Box>
    );
  }

  if (conectado) {
    return (
      <Box sx={{ height: 'calc(100vh - 64px)' }}>
        <webview
          ref={webviewRef}
          src="https://web.whatsapp.com"
          style={{ width: '100%', height: '100%' }}
          allowpopups="true"
          webpreferences="contextIsolation=false, nativeWindowOpen=true"
          useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        />
      </Box>
    );
  }

  return null;
}
