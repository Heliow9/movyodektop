const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  iniciarBot: (restauranteId) => ipcRenderer.invoke('bot:iniciar', restauranteId),
  pararBot: (restauranteId) => ipcRenderer.invoke('bot:parar', restauranteId),
  botEstaConectado: (restauranteId) => ipcRenderer.invoke('bot:status', restauranteId),
  liberarBot: (restauranteId) => ipcRenderer.invoke('liberarBot', restauranteId),

  onQRCode: (callback) => ipcRenderer.on('bot:qrcode', (_, qr) => callback(qr)),
  onConectado: (callback) => ipcRenderer.on('bot:conectado', callback),

  obterSessao: () => ipcRenderer.invoke('login:get'),
  salvarSessao: (data) => ipcRenderer.invoke('login:save', data),
  limparSessao: () => ipcRenderer.invoke('login:clear'),
  notificar: ({ title, body }) => {
    ipcRenderer.send('mostrar-notificacao', { title, body });
  },

  // NOVO: ação do botão custom no WhatsApp Web
  abrirMenuCustom: () => ipcRenderer.send('abrir-menu-custom'),
});

// Injeção automática no DOM do WhatsApp Web
window.addEventListener('DOMContentLoaded', () => {
  const interval = setInterval(() => {
    const inputContainer = document.querySelector("div[aria-label='Digite uma mensagem'][role='textbox']");
    if (inputContainer && !document.querySelector('#meu-botao-custom')) {
      const botao = document.createElement('button');
      botao.id = 'meu-botao-custom';
      botao.innerText = '⚙️';
      botao.style.marginLeft = '10px';
      botao.style.cursor = 'pointer';
      botao.style.height = '40px';
      botao.style.border = 'none';
      botao.style.background = '#25D366';
      botao.style.borderRadius = '5px';
      botao.style.color = 'white';
      botao.onclick = () => {
        window.electron.abrirMenuCustom();
      };

      inputContainer.parentElement.appendChild(botao);
      console.log('✅ Botão custom adicionado no input do WhatsApp Web!');
      clearInterval(interval);
    }
  }, 1000);
});