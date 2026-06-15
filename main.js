// main.js
const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  nativeImage,
  shell,
  session,
  Menu,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const Store = require("electron-store").default;
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
require("dotenv").config();

// ✅ Evita cache antigo do Vite/Electron em modo dev
app.commandLine.appendSwitch("disable-http-cache");

// Log inicial
const earlyLogPath = path.join(app.getPath("userData"), "early.log");
fs.writeFileSync(earlyLogPath, "🟡 main.js iniciado\n");

log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "main.log");
log.info("🚀 Iniciando main.js");

const store = new Store();
let mainWindow;
let oauthWindow = null;
let updaterState = { status:'idle', currentVersion:app.getVersion(), availableVersion:null, progress:0, error:null, mandatory:false };
function publishUpdaterState(patch={}){ updaterState={...updaterState,...patch,currentVersion:app.getVersion()}; if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('atualizacao:status',updaterState); return updaterState; }

const runtimeUpdateToken = String(
  process.env.MOVYO_UPDATE_TOKEN || process.env.GH_TOKEN || ""
).trim();
if (!process.env.GH_TOKEN && runtimeUpdateToken) {
  process.env.GH_TOKEN = runtimeUpdateToken;
}

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function friendlyUpdateError(error) {
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();
  if (lower.includes("404") || lower.includes("not found") || lower.includes("releases.atom")) {
    return "Canal de atualização não encontrado ou sem autorização. Verifique o repositório de releases e o GH_TOKEN.";
  }
  if (lower.includes("401") || lower.includes("bad credentials") || lower.includes("unauthorized")) {
    return "Token de atualização inválido, expirado ou sem permissão para acessar as releases.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "O GitHub recusou o acesso ao canal de atualizações. Verifique as permissões do token.";
  }
  if (
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("network") ||
    lower.includes("internet")
  ) {
    return "Não foi possível consultar atualizações agora. Confira a internet e tente novamente.";
  }
  return "Não foi possível verificar atualizações. O aplicativo continuará funcionando normalmente.";
}

function reportUpdaterError(error) {
  log.error("AutoUpdater:", error);
  return publishUpdaterState({
    status: "error",
    error: friendlyUpdateError(error),
  });
}

const orderNotificationCache = new Map();
function focusMovyoWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  if (typeof mainWindow.moveTop === "function") mainWindow.moveTop();
}

function getNotificationIcon() {
  const filePath = path.join(__dirname, "assets", "notification.png");
  try {
    const image = nativeImage.createFromPath(filePath);
    return image.isEmpty() ? undefined : image;
  } catch {
    return undefined;
  }
}

function showPedidoNotification(payload = {}) {
  if (!Notification.isSupported()) return { ok: false, reason: "unsupported" };

  const pedidoId = String(payload?.pedidoId || "").trim();
  const now = Date.now();
  for (const [key, ts] of orderNotificationCache.entries()) {
    if (now - ts > 60 * 60 * 1000) orderNotificationCache.delete(key);
  }
  if (pedidoId && orderNotificationCache.has(pedidoId)) {
    return { ok: true, duplicate: true };
  }
  if (pedidoId) orderNotificationCache.set(pedidoId, now);

  const cliente = String(payload?.cliente || "Cliente").trim() || "Cliente";
  const notification = new Notification({
    title: `Movyo - Versão ${app.getVersion()}`,
    body: `Novo pedido recebido!
Pedido de ${cliente} chegou.`,
    icon: getNotificationIcon(),
    timeoutType: "default",
  });
  notification.on("click", focusMovyoWindow);
  notification.show();
  return { ok: true };
}

// Garante que apenas uma instância do Movyo fique aberta por vez.
// Quando o usuário tenta abrir novamente, a janela existente é restaurada e recebe foco.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  log.info("Uma instância do Movyo já está aberta. Encerrando a segunda tentativa.");
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();

    const activeWindow = oauthWindow && !oauthWindow.isDestroyed() ? oauthWindow : mainWindow;
    if (!activeWindow.isVisible()) activeWindow.show();
    activeWindow.focus();
    if (typeof activeWindow.moveTop === "function") activeWindow.moveTop();
  });
}

// ✅ Nome do app (pode mudar)
app.setName("Movyo Food");
if (process.platform === "win32") app.setAppUserModelId("com.movyo.desktop");

// ✅ Partition do OAuth (Mercado Pago)
const OAUTH_PARTITION = "persist:mp-oauth";

// Captura de erros
process.on("uncaughtException", (err) => {
  log.error("❌ Uncaught Exception:", err);
  fs.appendFileSync(earlyLogPath, `❌ Uncaught Exception: ${err.stack || err}\n`);
});
process.on("unhandledRejection", (reason) => {
  log.error("❌ Unhandled Rejection:", reason);
  fs.appendFileSync(earlyLogPath, `❌ Unhandled Rejection: ${reason}\n`);
});

async function createWindow() {
  try {
    fs.appendFileSync(earlyLogPath, "🟢 Entrando em createWindow()\n");

    // ✅ Ícone (janela / taskbar no Windows/Linux)
    // Coloque seu arquivo em: <pasta_do_main.js>/assets/icon.png
    const iconPath = path.join(__dirname, "assets", "icon.png");

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,

      // ✅ Agora pode fullscreen e maximizar
      resizable: true,
      fullscreenable: true,
      maximizable: true,
      minimizable: true,

      // ✅ Nome/título no topo
      title: "Movyo Food",

      // ✅ some com a barra de menu
      autoHideMenuBar: true,

      // ✅ ícone
      icon: iconPath,

      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webviewTag: false,
      },
    });

    // ✅ Remove menu File/Edit/View/Window/Help
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    const isDev = !app.isPackaged;

    if (isDev) {
      log.info("💻 Rodando em modo desenvolvimento");

      // ✅ Limpa cache/storage antigo antes de carregar o Vite
      try {
        await mainWindow.webContents.session.clearCache();
        await mainWindow.webContents.session.clearStorageData({
          storages: [
            "appcache",
            "cookies",
            "filesystem",
            "indexdb",
            "localstorage",
            "shadercache",
            "websql",
            "serviceworkers",
            "cachestorage",
          ],
        });
      } catch (cacheErr) {
        log.warn("⚠️ Não consegui limpar cache dev:", cacheErr);
      }

      // ✅ Cache-buster para impedir Electron de reutilizar index antigo do build
      mainWindow.loadURL(`http://localhost:5173/?dev=${Date.now()}`);
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      log.info("📦 Rodando build empacotado");
      mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

      if (!runtimeUpdateToken) {
        log.warn("Atualizador iniciado sem GH_TOKEN. Repositórios privados exigem token no computador do usuário.");
      }

      autoUpdater.checkForUpdatesAndNotify().catch(reportUpdaterError);
    }

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();

      // ✅ FULLSCREEN ao abrir
      mainWindow.maximize();
      mainWindow.setFullScreen(true);

      // 🔒 Se quiser TRAVAR modo totem:
      // mainWindow.setKiosk(true);
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (err) {
    log.error("🔥 Erro ao criar a janela:", err);
    fs.appendFileSync(earlyLogPath, `🔥 Erro em createWindow(): ${err.stack || err}\n`);
  }
}

/**
 * ✅ Limpa cookies/storage da partition do OAuth
 * Resolve o “lembrar-me” / login automático ao reconectar
 */
async function clearOauthPartition() {
  try {
    const ses = session.fromPartition(OAUTH_PARTITION);

    await ses.clearStorageData({
      storages: [
        "cookies",
        "localstorage",
        "sessionstorage",
        "indexdb",
        "serviceworkers",
        "cachestorage",
      ],
      quotas: ["temporary", "persistent", "syncable"],
    });

    try {
      await ses.clearCache();
    } catch (_) { }

    log.info("🧹 OAuth partition limpa com sucesso:", OAUTH_PARTITION);
    return { ok: true };
  } catch (err) {
    log.error("🧹 Falha ao limpar OAuth partition:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * ✅ OAuth Modal Mercado Pago
 * Fecha automaticamente ao detectar:
 * - callback do backend (/api/mercadopago/oauth/callback)
 * - ou retorno ao APP_URL com mp=ok/mp=erro (inclusive no # hash)
 *
 * ✅ Fecha com delay de 5 segundos
 */
function openOAuthWindow(oauthUrl) {
  if (!mainWindow) return { ok: false, error: "mainWindow não inicializada" };

  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
    oauthWindow = null;
  }

  const iconPath = path.join(__dirname, "assets", "icon.png");

  oauthWindow = new BrowserWindow({
    width: 760,
    height: 760,
    parent: mainWindow,
    modal: true,
    show: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Conectar Mercado Pago",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // ✅ importante: esta partition guarda cookies/session do OAuth
      partition: OAUTH_PARTITION,
    },
  });

  // ✅ remove menus também no modal
  oauthWindow.setMenuBarVisibility(false);

  // ✅ links que tentam abrir nova janela vão pro navegador externo
  oauthWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const CLOSE_DELAY_MS = 5000;
  const CALLBACK_PATH = "/api/mercadopago/oauth/callback";

  const isCallbackUrl = (url) => url.includes(CALLBACK_PATH);

  const isDoneUrl = (url) => {
    // Fecha quando o backend terminar e redirecionar pro app com mp=ok ou mp=erro
    // Suporta tanto query normal quanto hash router (#/configuracoes?mp=ok)
    return url.includes("mp=ok") || url.includes("mp=erro");
  };

  let finishing = false;

  const finish = (payload) => {
    if (finishing) return;
    finishing = true;

    log.info(`⏳ OAuth finalizado. Fechando modal em ${CLOSE_DELAY_MS}ms...`, payload);

    setTimeout(() => {
      if (oauthWindow && !oauthWindow.isDestroyed()) {
        oauthWindow.close();
        oauthWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.webContents.send("mp:oAuthDone", payload);
      }
    }, CLOSE_DELAY_MS);
  };

  // ✅ redirects clássicos
  oauthWindow.webContents.on("will-redirect", (_event, url) => {
    log.info("➡️ OAuth will-redirect:", url);

    // 1) caiu no callback do backend
    if (isCallbackUrl(url)) {
      finish({ ok: null, reason: "callback_redirect", url });
      return;
    }

    // 2) voltou pro app com mp=ok/mp=erro
    if (isDoneUrl(url)) {
      const ok = url.includes("mp=ok");
      finish({ ok, reason: "done_redirect", url });
      return;
    }
  });

  // ✅ navegação normal
  oauthWindow.webContents.on("did-navigate", (_event, url) => {
    log.info("🧭 OAuth did-navigate:", url);

    if (isCallbackUrl(url)) {
      finish({ ok: null, reason: "callback_navigate", url });
      return;
    }

    if (isDoneUrl(url)) {
      const ok = url.includes("mp=ok");
      finish({ ok, reason: "done_navigate", url });
      return;
    }
  });

  // ✅ SPA/hash router
  oauthWindow.webContents.on("did-navigate-in-page", (_event, url) => {
    log.info("🧭 OAuth in-page:", url);

    if (isDoneUrl(url)) {
      const ok = url.includes("mp=ok");
      finish({ ok, reason: "done_in_page", url });
      return;
    }
  });

  oauthWindow.on("closed", () => {
    // se fechou sem finish, usuário cancelou
    if (!finishing && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("mp:oAuthDone", { ok: false, reason: "user_closed" });
    }
    oauthWindow = null;
  });

  oauthWindow.loadURL(oauthUrl);
  return { ok: true };
}

/* =========================
   ✅ IPC (Preload -> Main)
========================= */

// ✅ IPC pro preload chamar (abrir modal OAuth)
ipcMain.handle("open-oauth-window", async (_evt, url) => {
  try {
    return openOAuthWindow(url);
  } catch (err) {
    log.error("open-oauth-window error:", err);
    return { ok: false, error: err?.message || String(err) };
  }
});

// ✅ IPC pra limpar sessão do OAuth (cookies/storage)
ipcMain.handle("oauth:clearSession", async () => {
  try {
    // se o modal estiver aberto, fecha antes de limpar
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
      oauthWindow = null;
    }
    return await clearOauthPartition();
  } catch (err) {
    log.error("oauth:clearSession error:", err);
    return { ok: false, error: err?.message || String(err) };
  }
});

// manter openExternal pra outros links
ipcMain.handle("open-external", async (_evt, url) => {
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

/* =========================
   Atualizações
========================= */

autoUpdater.on("checking-for-update", () => publishUpdaterState({status:"checking",error:null}));
autoUpdater.on("update-not-available", () => publishUpdaterState({status:"up-to-date",availableVersion:null,progress:0,error:null}));
autoUpdater.on("download-progress", (p) => publishUpdaterState({status:"downloading",progress:Math.round(Number(p?.percent||0))}));
autoUpdater.on("error", reportUpdaterError);
autoUpdater.on("update-available", (info) => {
  publishUpdaterState({status:"available",availableVersion:info?.version||null,progress:0,error:null,mandatory:Boolean(info?.releaseNotes && String(info.releaseNotes).includes("[OBRIGATORIA]"))});
  log.info("🔄 Atualização disponível. Baixando...");
  if (mainWindow) mainWindow.webContents.send("atualizacao:disponivel");
  new Notification({
    title: "Movyo Food - Atualização disponível",
    body: "Nova versão sendo baixada em segundo plano.",
    icon: getNotificationIcon(),
  }).show();
});

autoUpdater.on("update-downloaded", (info) => {
  publishUpdaterState({status:"ready",availableVersion:info?.version||updaterState.availableVersion,progress:100,error:null});
  log.info("✅ Atualização baixada. Pronta para instalar.");
  if (mainWindow) mainWindow.webContents.send("atualizacao:pronta");
  new Notification({
    title: "Movyo Food - Atualização pronta",
    body: "Reinicie o app para aplicar a nova versão.",
    icon: getNotificationIcon(),
  }).show();
});

ipcMain.handle('atualizacao:status', async () => updaterState);
ipcMain.handle('atualizacao:verificar', async () => {
  if(!app.isPackaged) return publishUpdaterState({status:'development',error:null});
  try { publishUpdaterState({status:'checking',error:null}); await autoUpdater.checkForUpdates(); return updaterState; }
  catch(error){ return reportUpdaterError(error); }
});
ipcMain.handle('diagnostico:get', async () => {
  let printers=[]; try{ printers=mainWindow && !mainWindow.isDestroyed()?await mainWindow.webContents.getPrintersAsync():[]; }catch{}
  return {app:{name:app.getName(),version:app.getVersion(),packaged:app.isPackaged,userData:app.getPath('userData')},system:{platform:process.platform,arch:process.arch,node:process.version,electron:process.versions.electron,hostname:os.hostname()},updater:updaterState,printers:(printers||[]).map(p=>({name:p.name,isDefault:!!p.isDefault,status:p.status})),logs:{main:path.join(app.getPath('userData'),'main.log'),early:earlyLogPath}};
});
ipcMain.handle('diagnostico:abrirLogs', async () => { await shell.openPath(app.getPath('userData')); return {ok:true}; });

ipcMain.on("atualizacao:reiniciar", () => {
  log.info("♻️ Reiniciando para instalar atualização...");
  autoUpdater.quitAndInstall();
});

/* =========================
   Sessão (electron-store)
========================= */

ipcMain.on('app:version', (event) => { event.returnValue = app.getVersion(); });
ipcMain.handle("login:save", async (_, data) => store.set("session", data));
ipcMain.handle("login:get", async () => store.get("session"));
ipcMain.handle("login:clear", async () => store.delete("session"));

/* =========================
   Notificações / Menu / Print
========================= */

ipcMain.on("mostrar-notificacao", (_event, { title, body }) => {
  new Notification({ title, body, icon: getNotificationIcon() }).show();
});

ipcMain.on("pedido:notificar", (_event, payload) => {
  showPedidoNotification(payload);
});

ipcMain.on("abrir-menu-custom", () => {
  log.info("⚙️ Menu custom acionado!");
});

ipcMain.handle("print-component", async (_event, htmlContent) => {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `print-${Date.now()}.html`);

  try {
    await fs.promises.writeFile(filePath, htmlContent);

    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      autoHideMenuBar: true,
    });

    printWindow.setMenuBarVisibility(false);

    await printWindow.loadFile(filePath);

    const result = await new Promise((resolve) => {
      printWindow.webContents.print({}, (success, errorType) => {
        resolve({ success, errorType: errorType || null });
      });
    });

    printWindow.close();

    try { await fs.promises.unlink(filePath); } catch { }

    if (!result.success) return { ok: false, error: result.errorType || "print_failed" };
    return { ok: true };
  } catch (err) {
    try { await fs.promises.unlink(filePath); } catch { }
    return { ok: false, error: err?.message || String(err) };
  }
});


/* =========================
   Inicialização
========================= */


// ✅ Lista impressoras instaladas no Windows/Linux/macOS via Electron
ipcMain.handle("listar-impressoras", async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return (printers || []).map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: !!p.isDefault,
      status: p.status,
      options: p.options || {},
    }));
  } catch (err) {
    log.error("Erro ao listar impressoras:", err);
    return [];
  }
});

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    fs.appendFileSync(earlyLogPath, "🟢 app.whenReady executado\n");
    log.info("🚀 Aplicação iniciando...");

    // ✅ remove menu do app inteiro
    Menu.setApplicationMenu(null);

    createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
