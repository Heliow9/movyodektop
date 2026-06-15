"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SERVICE_NAME = "MovyoPrinterService";
const INSTALL_DIR = "C:\\ProgramData\\MovyoPrinterService";
const NSSM_EXE = path.join(INSTALL_DIR, "nssm.exe");
const UNINSTALL_LOG = path.join(INSTALL_DIR, "uninstaller.log");

function log(msg) {
  const ts = new Date().toISOString();
  try {
    fs.appendFileSync(UNINSTALL_LOG, `[${ts}] ${msg}\n`, "utf8");
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
    log(`⚠️ Falhou: ${cmd}`);
    if (!ignoreError) throw e;
    return false;
  }
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

  if (!serviceExists()) {
    log("ℹ️ Serviço não existe. Nada para remover.");
  } else {
    if (fs.existsSync(NSSM_EXE)) {
      run(`"${NSSM_EXE}" stop "${SERVICE_NAME}"`, true);
      run(`"${NSSM_EXE}" remove "${SERVICE_NAME}" confirm`, true);
    } else {
      // fallback: tenta pelo sc (pode funcionar, mas nssm é o ideal)
      run(`sc stop "${SERVICE_NAME}"`, true);
      run(`sc delete "${SERVICE_NAME}"`, true);
    }
    log("✅ Serviço removido.");
  }

  // opcional: manter arquivos (logs/config) ou limpar tudo
  // Se quiser limpar tudo, descomente:
  // try {
  //   fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
  //   log("✅ Pasta removida: " + INSTALL_DIR);
  // } catch (e) {
  //   log("⚠️ Não consegui remover pasta: " + INSTALL_DIR + " | " + e.message);
  // }

  log("✅ Uninstall finalizado.");
})();
