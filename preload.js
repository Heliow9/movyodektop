const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  /* =======================
   * Sessão
   * ======================= */
  obterSessao: () => ipcRenderer.invoke("login:get"),
  salvarSessao: (data) => ipcRenderer.invoke("login:save", data),
  limparSessao: () => ipcRenderer.invoke("login:clear"),

  /* =======================
   * Notificações
   * ======================= */
  notificar: ({ title, body }) => {
    ipcRenderer.send("mostrar-notificacao", { title, body });
  },
  notificarPedido: ({ pedidoId, cliente }) => {
    ipcRenderer.send("pedido:notificar", { pedidoId, cliente });
  },

  /* =======================
   * Impressão
   * ======================= */
  printContent: async (html) => {
    try {
      return await ipcRenderer.invoke("print-component", html);
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  },


  /* =======================
   * 🌐 Links externos genéricos
   * ======================= */
  openExternal: async (url) => {
    try {
      return await ipcRenderer.invoke("open-external", url);
    } catch (err) {
      console.warn("🌐 openExternal falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },

  /* =======================
   * 🔐 Mercado Pago OAuth (MODAL)
   * ======================= */
  openOAuth: async (url) => {
    try {
      return await ipcRenderer.invoke("open-oauth-window", url);
    } catch (err) {
      console.warn("🔐 openOAuth falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },

  /**
   * ✅ NOVO: limpa cookies/storage do OAuth (Mercado Pago)
   * Você vai chamar isso ao "Desconectar" (e opcionalmente antes de "Conectar")
   */
  clearOAuthSession: async () => {
    try {
      return await ipcRenderer.invoke("oauth:clearSession");
    } catch (err) {
      console.warn("🧹 clearOAuthSession falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },

  /**
   * ✅ Evento quando o OAuth termina (modal fecha)
   * Retorna uma função para "desinscrever" (removeListener)
   */
  onMpOAuthDone: (callback) => {
    const handler = (_evt, payload) => {
      try {
        callback(payload);
      } catch (e) {
        console.warn("onMpOAuthDone callback error:", e);
      }
    };

    ipcRenderer.on("mp:oAuthDone", handler);

    // ✅ retorna unsubscribe
    return () => {
      ipcRenderer.removeListener("mp:oAuthDone", handler);
    };
  },

  /* =======================
   * Impressoras
   * ======================= */
  listarImpressoras: async () => {
    try {
      return await ipcRenderer.invoke("listar-impressoras");
    } catch (err) {
      console.warn("🖨️ listarImpressoras não disponível:", err?.message || err);
      return [];
    }
  },

  /* =======================
   * Bot WhatsApp
   * ======================= */
  iniciarBot: async (restauranteId) => {
    try {
      return await ipcRenderer.invoke("bot:iniciar", restauranteId);
    } catch (err) {
      console.warn("🤖 iniciarBot não disponível:", err?.message || err);
      return { sucesso: false, erro: "Função desativada no build" };
    }
  },

  pararBot: async (restauranteId) => {
    try {
      return await ipcRenderer.invoke("bot:parar", restauranteId);
    } catch (err) {
      console.warn("🤖 pararBot não disponível:", err?.message || err);
      return { sucesso: false, erro: "Função desativada no build" };
    }
  },

  botEstaConectado: async (restauranteId) => {
    try {
      return await ipcRenderer.invoke("bot:status", restauranteId);
    } catch (err) {
      console.warn("🤖 botEstaConectado não disponível:", err?.message || err);
      return { conectado: false };
    }
  },

  liberarBot: async (restauranteId) => {
    try {
      return await ipcRenderer.invoke("liberarBot", restauranteId);
    } catch (err) {
      console.warn("🤖 liberarBot não disponível:", err?.message || err);
      return { sucesso: false };
    }
  },

  onQRCode: (callback) =>
    ipcRenderer.on("bot:qrcode", (_evt, qr) => callback(qr)),

  onConectado: (callback) =>
    ipcRenderer.on("bot:conectado", callback),

  /* =======================
   * Menu custom WhatsApp
   * ======================= */
  abrirMenuCustom: () => ipcRenderer.send("abrir-menu-custom"),

  /* =======================
   * Atualizações
   * ======================= */
  appVersion: ipcRenderer.sendSync('app:version'),
  obterStatusAtualizacao: () => ipcRenderer.invoke('atualizacao:status'),
  verificarAtualizacao: () => ipcRenderer.invoke('atualizacao:verificar'),
  obterDiagnostico: () => ipcRenderer.invoke('diagnostico:get'),
  abrirPastaLogs: () => ipcRenderer.invoke('diagnostico:abrirLogs'),
  onStatusAtualizacao: (callback) => { const handler=(_evt,payload)=>callback(payload); ipcRenderer.on('atualizacao:status',handler); return ()=>ipcRenderer.removeListener('atualizacao:status',handler); },

  onAtualizacaoDisponivel: (callback) =>
    ipcRenderer.on("atualizacao:disponivel", callback),

  onAtualizacaoPronta: (callback) =>
    ipcRenderer.on("atualizacao:pronta", callback),

  aplicarAtualizacao: () =>
    ipcRenderer.send("atualizacao:reiniciar"),
});

/* =====================================================
 * Alias opcional (compatibilidade com React)
 * ===================================================== */
contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: async (url) => {
    try {
      return await ipcRenderer.invoke("open-external", url);
    } catch (err) {
      console.warn("🌐 electronAPI.openExternal falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },

  openOAuth: async (url) => {
    try {
      return await ipcRenderer.invoke("open-oauth-window", url);
    } catch (err) {
      console.warn("🔐 electronAPI.openOAuth falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },

  // ✅ NOVO no alias também
  clearOAuthSession: async () => {
    try {
      return await ipcRenderer.invoke("oauth:clearSession");
    } catch (err) {
      console.warn("🧹 electronAPI.clearOAuthSession falhou:", err?.message || err);
      return { ok: false, error: err?.message || String(err) };
    }
  },
});

/* =====================================================
 * Botão custom no WhatsApp Web (mantido)
 * ===================================================== */
if (window.location.href.includes("web.whatsapp.com")) {
  window.addEventListener("DOMContentLoaded", () => {
    const interval = setInterval(() => {
      const inputContainer = document.querySelector(
        "div[aria-label='Digite uma mensagem'][role='textbox']"
      );

      if (inputContainer && !document.querySelector("#meu-botao-custom")) {
        const botao = document.createElement("button");
        botao.id = "meu-botao-custom";
        botao.innerText = "⚙️";
        botao.style.marginLeft = "10px";
        botao.style.cursor = "pointer";
        botao.style.height = "40px";
        botao.style.border = "none";
        botao.style.background = "#25D366";
        botao.style.borderRadius = "5px";
        botao.style.color = "white";

        botao.onclick = () => {
          if (window.electron?.abrirMenuCustom) {
            window.electron.abrirMenuCustom();
          } else {
            console.warn("⚙️ abrirMenuCustom não disponível no preload");
          }
        };

        inputContainer.parentElement.appendChild(botao);
        console.log("✅ Botão custom adicionado no WhatsApp Web!");
        clearInterval(interval);
      }
    }, 1000);
  });
}
