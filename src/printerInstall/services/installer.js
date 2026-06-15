"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SERVICE_NAME = "MovyoPrinterService";
const DISPLAY_NAME = "Movyo Printer Service";
const DESCRIPTION = "Serviço de impressão Movyo (Socket 9100 / USB)";

const INSTALL_DIR = "C:\\ProgramData\\MovyoPrinterService";
const LOG_DIR = path.join(INSTALL_DIR, "logs");
const INSTALL_LOG = path.join(INSTALL_DIR, "installer.log");

const BASE_DIR = path.dirname(process.execPath);
const PAYLOAD_DIR = path.join(BASE_DIR, "payload");

const NSSM_SRC = path.join(PAYLOAD_DIR, "nssm.exe");
const NODE_SRC = path.join(PAYLOAD_DIR, "node", "node.exe");
const APP_SRC = path.join(PAYLOAD_DIR, "app");

const NSSM_DST = path.join(INSTALL_DIR, "nssm.exe");
const NODE_DST = path.join(INSTALL_DIR, "node.exe");
const APP_DST = path.join(INSTALL_DIR, "app");
const INDEX_DST = path.join(APP_DST, "index.js");

const STDOUT_LOG = path.join(LOG_DIR, "service.out.log");
const STDERR_LOG = path.join(LOG_DIR, "service.err.log");

function log(msg) {
  const ts = new Date().toISOString();
  try {
    if (!fs.existsSync(INSTALL_DIR)) fs.mkdirSync(INSTALL_DIR, { recursive: true });
    fs.appendFileSync(INSTALL_LOG, `[${ts}] ${msg}\n`, "utf8");
  } catch (_) {}
  console.log(msg);
}

function ensureAdminOrDie() {
  try {
    execSync("net session", { stdio: "ignore" });
  } catch {
    console.error("❌ Execute como Administrador.");
    process.exit(1);
  }
}

function run(cmd, ignoreError = false) {
  log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (e) {
    log(`❌ Falhou: ${cmd}`);
    if (!ignoreError) throw e;
    return false;
  }
}

function existsOrDie(p, friendly) {
  if (!fs.existsSync(p)) {
    log(`❌ Não encontrei: ${friendly || p}`);
    process.exit(1);
  }
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  log(`✅ Copiado: ${src} -> ${dst}`);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  if (fs.cpSync) {
    fs.cpSync(src, dst, { recursive: true, force: true });
  } else {
    run(`xcopy "${src}" "${dst}" /E /I /Y`);
  }
  log(`✅ Pasta copiada: ${src} -> ${dst}`);
}

function sleep(ms) {
  run(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, true);
}

function serviceExists() {
  try {
    execSync(`sc query "${SERVICE_NAME}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

(function main() {
  ensureAdminOrDie();

  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  log(`BASE_DIR: ${BASE_DIR}`);
  log(`PAYLOAD_DIR: ${PAYLOAD_DIR}`);

  existsOrDie(PAYLOAD_DIR, "pasta payload");
  existsOrDie(NSSM_SRC, "payload\\nssm.exe");
  existsOrDie(NODE_SRC, "payload\\node\\node.exe");
  existsOrDie(APP_SRC, "payload\\app");
  existsOrDie(path.join(APP_SRC, "index.js"), "payload\\app\\index.js");

  copyFile(NSSM_SRC, NSSM_DST);
  copyFile(NODE_SRC, NODE_DST);
  copyDir(APP_SRC, APP_DST);

  // remove anterior (se existir)
  if (serviceExists()) {
    log("ℹ️ Serviço já existe, removendo para reinstalar...");
    run(`"${NSSM_DST}" stop "${SERVICE_NAME}"`, true);
    run(`"${NSSM_DST}" remove "${SERVICE_NAME}" confirm`, true);
    sleep(1200);
  }

  // instala: nssm install <service> <app> [args]
  run(`"${NSSM_DST}" install "${SERVICE_NAME}" "${NODE_DST}" "${INDEX_DST}"`);

  // diretório de trabalho (crítico)
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppDirectory "${APP_DST}"`);

  // display + description
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" DisplayName "${DISPLAY_NAME}"`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" Description "${DESCRIPTION}"`);

  // logs + rotação
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppStdout "${STDOUT_LOG}"`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppStderr "${STDERR_LOG}"`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppRotateFiles 1`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppRotateOnline 1`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppRotateSeconds 86400`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppRotateBytes 10485760`);

  // restart automático
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppExit Default Restart`);
  run(`"${NSSM_DST}" set "${SERVICE_NAME}" AppRestartDelay 1500`);

  // start auto
  run(`sc config "${SERVICE_NAME}" start= auto`);

  // start
  run(`"${NSSM_DST}" start "${SERVICE_NAME}"`);

  log("✅ Serviço instalado e iniciado!");
  log(`Logs: ${STDOUT_LOG}`);
  log(`Erros: ${STDERR_LOG}`);
  log("Teste: http://127.0.0.1:9100/health");
})();
