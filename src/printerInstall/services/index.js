"use strict";

const fs = require("fs");
const path = require("path");

// =====================================================
// LOG SUPER ROBUSTO (sempre no diretório do index.js)
// =====================================================
const LOG_PATH = path.join(__dirname, "log.txt");

function log(msg, err) {
  const ts = new Date().toISOString();
  const line =
    `[${ts}] ${msg}` +
    (err ? ` | ${err?.stack || err?.message || String(err)}` : "") +
    "\n";
  try {
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch (_) {
    // nunca derruba por log
  }
}

// Log inicial ANTES de qualquer require pesado
log("BOOT: index.js iniciou");
log(`ENV: node=${process.version} pid=${process.pid}`);
log(`PATH: __dirname=${__dirname}`);
log(`PATH: cwd=${process.cwd()}`);

// =====================================================
// CAPTURA DE CRASH (não morrer mudo)
// =====================================================
process.on("uncaughtException", (err) => {
  log("FATAL: uncaughtException", err);
  // opcional: descomente se quiser encerrar com exit code claro
  // process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log("FATAL: unhandledRejection", err);
  // opcional: process.exit(1);
});

// =====================================================
// IMPORTS - COM TRATAMENTO (pra você ver o erro no log)
// =====================================================
let createServer, Server;
try {
  ({ createServer } = require("http"));
  ({ Server } = require("socket.io"));
  log("OK: http + socket.io carregados");
} catch (err) {
  log("FALHA: ao carregar http/socket.io", err);
  process.exit(11);
}

// layouts
let gerarTextoEntregaA, gerarTextoEntregaB, gerarTextoCozinhaA, layoutRegistry;
try {
  gerarTextoEntregaA = require("./layouts/layoutEntregaA");
  gerarTextoEntregaB = require("./layouts/layoutEntregaB");
  gerarTextoCozinhaA = require("./layouts/layoutCozinhaA");
  layoutRegistry = require("./layoutRegistry");
  log("OK: layouts/layoutRegistry carregados");
} catch (err) {
  log("FALHA: ao carregar layouts/layoutRegistry (caminho/require)", err);
  process.exit(12);
}

// node-printer (binding nativo costuma dar erro aqui)
let printer;
try {
  printer = require("@thiagoelg/node-printer");
  log("OK: node-printer carregado com sucesso");
} catch (err) {
  log("FALHA: ao carregar @thiagoelg/node-printer (DLL/VC++/arch?)", err);
  process.exit(10);
}

// =====================================================
// SERVIDOR
// =====================================================
const PORT = Number(process.env.MOVYO_PORT || 9100);
const HOST = "127.0.0.1";

log(`INIT: preparando servidor em http://${HOST}:${PORT}`);

// healthcheck útil (com status do printer)
function safeGetPrinters() {
  try {
    return printer.getPrinters?.() || [];
  } catch (e) {
    log("WARN: getPrinters falhou", e);
    return [];
  }
}

function safeDefaultPrinter() {
  try {
    return printer.getDefaultPrinterName?.() || null;
  } catch (e) {
    log("WARN: getDefaultPrinterName falhou", e);
    return null;
  }
}

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    const printers = safeGetPrinters();
    const def = safeDefaultPrinter();

    const payload = {
      ok: true,
      ts: new Date().toISOString(),
      pid: process.pid,
      node: process.version,
      cwd: process.cwd(),
      dir: __dirname,
      host: HOST,
      port: PORT,
      printersCount: printers.length,
      defaultPrinter: def,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// =====================================================
// HELPERS
// =====================================================
function resolveLayout(layout) {
  if (layout === "entregaA") return gerarTextoEntregaA;
  if (layout === "entregaB") return gerarTextoEntregaB;
  if (layout === "cozinhaA" || layout === "cozinha") return gerarTextoCozinhaA;
  return null;
}

function ensurePrinterName(nomeImpressora) {
  const defaultName = safeDefaultPrinter();
  const target = nomeImpressora || defaultName;

  if (!target) {
    throw new Error(
      "Nenhuma impressora padrão encontrada e nomeImpressora não foi informado."
    );
  }

  const printers = safeGetPrinters();
  const exists = printers.some((p) => p?.name === target);

  return { target, exists };
}

function normalizePrintSettings(ps = {}) {
  const columns = Number(ps.columns);
  const feedLines = Number(ps.feedLines);

  return {
    columns: Number.isFinite(columns) && columns > 0 ? columns : 48,
    feedLines: Number.isFinite(feedLines) && feedLines >= 0 ? feedLines : 3,
    cutMode: ps.cutMode || "full", // full | partial | none
    encoding: ps.encoding || "win1252", // win1252 | utf8 | cp860 | etc
    nomeRestaurante: ps.nomeRestaurante || ps.restauranteNome || ps.restaurantName || ps.empresaNome || "",
    restauranteNome: ps.restauranteNome || ps.nomeRestaurante || ps.restaurantName || ps.empresaNome || "",
    restaurantName: ps.restaurantName || ps.nomeRestaurante || ps.restauranteNome || ps.empresaNome || "",
    empresaNome: ps.empresaNome || ps.nomeRestaurante || ps.restauranteNome || ps.restaurantName || "",
  };
}

// =====================================================
// SOCKET EVENTS
// =====================================================
io.on("connection", (socket) => {
  log("SOCKET: cliente conectado");

  socket.on("listar-impressoras", () => {
    try {
      const impressoras = safeGetPrinters();
      socket.emit("lista-impressoras", impressoras);
      log(`OK: listou impressoras (${impressoras?.length || 0})`);
    } catch (err) {
      log("ERRO: listar-impressoras", err);
      socket.emit("lista-impressoras", []);
    }
  });

  socket.on("listar-layouts", ({ modeloImpressora } = {}) => {
    try {
      const aliases = {
        g250: "Gertec",
        gertec: "Gertec",
        elgin: "Elgin",
        bematech: "Bematech",
        daruma: "Daruma",
        epson: "Epson",
        pos58: "POS-58",
        "pos-58": "POS-58",
      };

      const chaveNormalizada = (modeloImpressora || "").toLowerCase();
      const modeloFinal = aliases[chaveNormalizada] || modeloImpressora;

      const layouts = layoutRegistry[modeloFinal] || [];
      socket.emit("lista-layouts", layouts);
      log(`OK: listou layouts modelo=${modeloFinal} (${layouts.length})`);
    } catch (err) {
      log("ERRO: listar-layouts", err);
      socket.emit("lista-layouts", []);
    }
  });

  socket.on("imprimir-pedido", (payload = {}) => {
    const { layout, dados, nomeImpressora, printSettings } = payload;

    try {
      if (!layout) throw new Error("layout não informado");
      if (!dados) throw new Error("dados não informados");

      const layoutFn = resolveLayout(layout);
      if (!layoutFn) {
        log(`ERRO: layout não reconhecido: ${layout}`);
        socket.emit("impressao-erro", { layout, message: "Layout não reconhecido" });
        return;
      }

      const { target, exists } = ensurePrinterName(nomeImpressora);
      const ps = normalizePrintSettings(printSettings);

      log(
        `PRINT: layout=${layout} printer=${target} exists=${exists} columns=${ps.columns} feedLines=${ps.feedLines} cutMode=${ps.cutMode} encoding=${ps.encoding}`
      );

      let buffer = layoutFn(dados, ps);

      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer, "utf8");
      }

      if (!Buffer.isBuffer(buffer)) {
        throw new Error("Layout não retornou Buffer nem string");
      }

      printer.printDirect({
        data: buffer,
        printer: target,
        type: "RAW",
        success: (jobID) => {
          log(`OK: impressão enviada jobID=${jobID} printer=${target} layout=${layout}`);
          socket.emit("impressao-sucesso", { layout, printer: target, jobID });
        },
        error: (err) => {
          log(`ERRO: impressão falhou printer=${target} layout=${layout}`, err);
          socket.emit("impressao-erro", {
            layout,
            printer: target,
            message: err?.message || String(err),
          });
        },
      });
    } catch (err) {
      log("ERRO: imprimir-pedido", err);
      socket.emit("impressao-erro", {
        layout,
        printer: nomeImpressora,
        message: err?.message || String(err),
      });
    }
  });
});

// =====================================================
// START LISTEN
// =====================================================
httpServer.listen(PORT, HOST, () => {
  log(`OK: servidor escutando em http://${HOST}:${PORT}`);
});

httpServer.on("error", (err) => {
  log("FATAL: erro no servidor HTTP (listen)", err);
});
