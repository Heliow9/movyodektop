// pages/Configuracoes.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  TextField,
  Button,
  Divider,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Paper,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  Chip,
  Tooltip,
} from "@mui/material";
import axios from "axios";
import { io } from "socket.io-client";
import { useLocation } from "react-router-dom";
import { resolveAssetUrl, resolveLogoUrl } from "../utils/resolveAssetUrl";
import { enviarParaImpressao } from "../utils/enviarImpressao";

import StorefrontIcon from "@mui/icons-material/Storefront";
import PlaceIcon from "@mui/icons-material/Place";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SettingsIcon from "@mui/icons-material/Settings";
import LockResetIcon from "@mui/icons-material/LockReset";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import PrintIcon from "@mui/icons-material/Print";

import MessageIcon from "@mui/icons-material/Message";

const PRINT_SERVICE_URL = "http://localhost:9100";

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <Box sx={{ mt: 2 }}>{children}</Box>;
}

/** =========================
 *  ✅ IMPRESSÃO — PADRÃO ÚNICO
 *  ========================= */
const PRINT_SETTINGS_KEY = "printSettings";
const KITCHEN_PRINT_SETTINGS_KEY = "kitchenPrintSettings";

const defaultPrintSettingsByBrand = (brand) => {
  const b = (brand || "").toLowerCase();
  const isPos58 = b === "pos-58" || b === "pos58";
  return {
    printerName: "",
    brand: brand || "",
    layout: "entregaA",
    columns: isPos58 ? 32 : 48,
    feedLines: 3,
    cutMode: "full", // full | partial | none
    encoding: "win1252", // win1252 | cp860 | utf8
    copies: 1,
  };
};


const layoutsPadraoPorMarca = (brand = "") => {
  const b = String(brand || "").toLowerCase();
  if (b.includes("gertec")) return ["entregaA", "entregaB", "cozinhaA", "balcaoA"];
  if (b.includes("elgin")) return ["entregaA", "cozinhaA", "balcaoA"];
  if (b.includes("bematech")) return ["entregaA", "cozinhaA", "balcaoA"];
  if (b.includes("epson")) return ["entregaA", "cozinhaA", "balcaoA"];
  if (b.includes("daruma")) return ["entregaA", "cozinhaA", "balcaoA"];
  return ["entregaA", "cozinhaA", "balcaoA"];
};

const normalizarListaLayouts = (payload) => {
  const lista = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.layouts)
      ? payload.layouts
      : Array.isArray(payload?.layoutDisponivel)
        ? payload.layoutDisponivel
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

  return lista
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return item;
      return item.value || item.id || item.nome || item.name || item.layout || null;
    })
    .filter(Boolean);
};

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function readPrintSettings(key = PRINT_SETTINGS_KEY) {
  // 1) novo formato
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // ignora
    }
  }

  // 2) migração legado (se existir)
  const printerName = localStorage.getItem("impressoraSelecionada") || "";
  const brand = localStorage.getItem("modeloImpressora") || "";
  const layout = localStorage.getItem("layoutSelecionado") || "entregaA";

  if (printerName || brand) {
    const d = defaultPrintSettingsByBrand(brand);
    const ps = {
      printerName,
      brand,
      layout,
      columns: d.columns,
      feedLines: d.feedLines,
      cutMode: d.cutMode,
      encoding: d.encoding,
      copies: d.copies,
    };
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(ps));
    return ps;
  }

  return null;
}

function writeLegacyPrintSettings(ps) {
  // espelho legado (caso outras telas usem)
  localStorage.setItem("impressoraSelecionada", ps?.printerName || "");
  localStorage.setItem("modeloImpressora", ps?.brand || "");
  localStorage.setItem("layoutSelecionado", ps?.layout || "entregaA");
}

const Configuracoes = () => {
  const location = useLocation();

  const defaultHorarios = {
    segunda: { abre: "", fecha: "", fechado: false },
    terca: { abre: "", fecha: "", fechado: false },
    quarta: { abre: "", fecha: "", fechado: false },
    quinta: { abre: "", fecha: "", fechado: false },
    sexta: { abre: "", fecha: "", fechado: false },
    sabado: { abre: "", fecha: "", fechado: false },
    domingo: { abre: "", fecha: "", fechado: false },
  };

  const defaultMensagens = {
    saudacoes: [],
    respostaSaudacao: "",
    statusPedidoAceito: "",
    statusSaiuParaEntrega: "",
    statusEntregue: "",
    mensagemPosEntrega: "",
  };

  const defaultMercadoPago = {
    conectado: false,
    userId: null,
    tokenExpiraEm: null,
    ultimoOAuthEm: null,
  };

  // ✅ FIX CRÍTICO: estado vem ANTES do useEffect que usa setAbaAtual
  const [abaAtual, setAbaAtual] = useState(0);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    logoUrl: "",
    chavePix: "",
    slugIdentificador: "",
    horariosFuncionamento: defaultHorarios,
    tempoMedioEntregaMin: 45,
    maxPedidosPorEntregador: 3,
    enderecoCep: "",
    enderecoRua: "",
    enderecoNumero: "",
    enderecoBairro: "",
    enderecoCidade: "",
    enderecoEstado: "",
    localizacao: { latitude: null, longitude: null },

    // Integrações
    anotaaiStatus: false,
    anotaaiUrl: "",
    anotaaiIdentificador: "",
    anotaaiToken: "",
    ifoodStatus: false,
    ifoodIdentificador: "",
    ifoodPrecisaConfirmacao: false,
    ifoodIgnorarPronto: false,

    // ✅ Controle do pagamento com cartão na vitrine
    pagamentoCartaoAtivo: true,

    // Mercado Pago (Split)
    mercadoPago: defaultMercadoPago,

    mensagensPersonalizadas: defaultMensagens,
  });

  useEffect(() => {
    const tabFromState = location?.state?.tab;
    if (typeof tabFromState === "number") setAbaAtual(tabFromState);
  }, [location?.state]);

  const [loading, setLoading] = useState(false);
  const [loadingMP, setLoadingMP] = useState(false);
  const [loadingToggleCartao, setLoadingToggleCartao] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [tipoMensagem, setTipoMensagem] = useState("success");
  const [mostrarMensagem, setMostrarMensagem] = useState(false);

  // ===== Impressão =====
  const [impressoras, setImpressoras] = useState([]);
  const [impressoraSelecionada, setImpressoraSelecionada] = useState("");
  const [modeloPrintSelecionada, setModeloPrintSelecionada] = useState("");
  const [layoutDisponivel, setLayoutDisponivel] = useState([]);
  const [layoutSelecionado, setLayoutSelecionado] = useState("entregaA");

  // configs avançadas
  const [colunasPrint, setColunasPrint] = useState(48);
  const [feedLinesPrint, setFeedLinesPrint] = useState(3);
  const [cutModePrint, setCutModePrint] = useState("full");
  const [encodingPrint, setEncodingPrint] = useState("win1252");
  const [viasPrint, setViasPrint] = useState(1);

  // configs da impressora de cozinha
  const [cozinhaImpressoraSelecionada, setCozinhaImpressoraSelecionada] = useState("");
  const [cozinhaModeloPrintSelecionada, setCozinhaModeloPrintSelecionada] = useState("");
  const [cozinhaLayoutSelecionado, setCozinhaLayoutSelecionado] = useState("cozinhaA");
  const [cozinhaColunasPrint, setCozinhaColunasPrint] = useState(48);
  const [cozinhaFeedLinesPrint, setCozinhaFeedLinesPrint] = useState(3);
  const [cozinhaCutModePrint, setCozinhaCutModePrint] = useState("full");
  const [cozinhaEncodingPrint, setCozinhaEncodingPrint] = useState("win1252");
  const [cozinhaViasPrint, setCozinhaViasPrint] = useState(1);

  // status do serviço
  const [servicoOnline, setServicoOnline] = useState(false);
  const [servicoMsg, setServicoMsg] = useState("");

  // ===== Logo upload =====
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ===== Segurança / troca de senha =====
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:10000").replace(/\/$/, "");

const normalizeApiUrl = resolveAssetUrl;


const safeJson = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return typeof value === "object" ? value : fallback;
};


const normalizeRestauranteConfig = (data = {}, prev = {}) => {
  const horariosRaw = safeJson(data.horariosFuncionamento, prev.horariosFuncionamento || defaultHorarios);
  const mensagensRaw = safeJson(data.mensagensPersonalizadas, prev.mensagensPersonalizadas || defaultMensagens);
  const mercadoPagoRaw = safeJson(data.mercadoPago, prev.mercadoPago || defaultMercadoPago);
  const localizacaoRaw = safeJson(data.localizacao, prev.localizacao || { latitude: null, longitude: null });

  const horariosFuncionamento = Object.keys(defaultHorarios).reduce((acc, dia) => {
    const item = horariosRaw?.[dia] || {};
    acc[dia] = {
      abre: item.abre || "",
      fecha: item.fecha || "",
      fechado: !!item.fechado,
    };
    return acc;
  }, {});

  const saudacoes = Array.isArray(mensagensRaw?.saudacoes)
    ? mensagensRaw.saudacoes
    : String(mensagensRaw?.saudacoes || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    ...prev,
    ...data,
    horariosFuncionamento,
    mensagensPersonalizadas: {
      ...defaultMensagens,
      ...mensagensRaw,
      saudacoes,
    },
    mercadoPago: {
      ...defaultMercadoPago,
      ...mercadoPagoRaw,
    },
    localizacao: {
      latitude: localizacaoRaw?.latitude ?? null,
      longitude: localizacaoRaw?.longitude ?? null,
    },
    tempoMedioEntregaMin: data?.tempoMedioEntregaMin ?? prev.tempoMedioEntregaMin ?? 45,
    maxPedidosPorEntregador: data?.maxPedidosPorEntregador ?? prev.maxPedidosPorEntregador ?? 3,
    logoUrl: resolveLogoUrl(data, prev.logoUrl || prev.logoSlug || ""),
    logoSlug: data?.logoSlug || prev.logoSlug || "",
  };
};

  // ✅ ROTA PARA ATIVAR/DESATIVAR CARTÃO NA VITRINE
  const PAGAMENTO_CARTAO_TOGGLE_ROUTE = `${API_URL}/api/restaurantes/pagamento-cartao`;

  // ✅ NÃO usar useMemo pra token/id (login/logout sem reload)
  const getRestauranteId = () => localStorage.getItem("_id");
  const getToken = () => {
    const raw = localStorage.getItem("_token") || localStorage.getItem("tokenRestaurante") || "";
    const token = String(raw || "").trim();
    if (!token) return "";
    return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  };

  // ✅ socket único (porta do serviço: 9100)
  const socket = useMemo(
    () =>
      io(PRINT_SERVICE_URL, {
        transports: ["websocket"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        timeout: 3000,
      }),
    []
  );

  // ✅ cleanup global do socket (evita ficar conectado ao sair da tela)
  useEffect(() => {
    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {
        // ignore
      }
    };
  }, [socket]);

  // ===== helpers UI =====
  const toast = (type, text) => {
    setTipoMensagem(type);
    setMensagem(text);
    setMostrarMensagem(true);
  };

  const ensurePrintConnected = useCallback(() => {
    try {
      if (!socket.connected) socket.connect();
    } catch {
      // ignore
    }
  }, [socket]);

  const normalizarListaImpressoras = (payload) => {
    const lista = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.impressoras)
        ? payload.impressoras
        : Array.isArray(payload?.printers)
          ? payload.printers
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

    return lista
      .map((imp) => {
        if (!imp) return null;
        if (typeof imp === "string") return { name: imp, displayName: imp };
        const name = imp.name || imp.nome || imp.printerName || imp.displayName;
        return name ? { ...imp, name, displayName: imp.displayName || imp.nome || name } : null;
      })
      .filter(Boolean);
  };

  const carregarImpressorasElectron = useCallback(async () => {
    try {
      const fn = window.electron?.listarImpressoras || window.electronAPI?.listarImpressoras;
      if (!fn) return [];
      const lista = normalizarListaImpressoras(await fn());
      if (lista.length) {
        setImpressoras(lista);
        const nomes = lista.map((i) => i.name).filter(Boolean);
        const saved = readPrintSettings()?.printerName || "";
        const atual = impressoraSelecionada || saved;
        const padrao = lista.find((i) => i.isDefault)?.name || nomes[0] || "";
        if (atual && nomes.includes(atual)) {
          if (!impressoraSelecionada) setImpressoraSelecionada(atual);
        } else if (padrao) {
          setImpressoraSelecionada(padrao);
        }
      }
      return lista;
    } catch (e) {
      console.warn("Falha ao listar impressoras pelo Electron:", e?.message || e);
      return [];
    }
  }, [impressoraSelecionada]);

  // Fallback local: garante que o select de layouts nunca fique vazio se o serviço 9100
  // não responder ao evento listar-layouts.
  useEffect(() => {
    const locais = layoutsPadraoPorMarca(modeloPrintSelecionada);
    setLayoutDisponivel((prev) => (prev?.length ? prev : locais));
    if (!layoutSelecionado || !locais.includes(layoutSelecionado)) {
      setLayoutSelecionado((readPrintSettings()?.layout && locais.includes(readPrintSettings().layout)) ? readPrintSettings().layout : locais[0]);
    }
  }, [modeloPrintSelecionada]);

  // -------- Mercado Pago (OAuth) --------
  const intervalRef = useRef(null);

  const limparPollingMP = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const abrirOAuthMercadoPago = async (oauthUrl) => {
    if (window.electron?.openOAuth) return await window.electron.openOAuth(oauthUrl);
    if (window.electronAPI?.openOAuth) return await window.electronAPI.openOAuth(oauthUrl);

    window.open(oauthUrl, "_blank", "noopener,noreferrer");
    return { ok: true, web: true };
  };

  const refreshStatusMercadoPago = async () => {
    const restauranteId = getRestauranteId();
    const token = getToken();

    if (!restauranteId) throw new Error("Restaurante ID não encontrado (_id).");
    if (!token) throw new Error("Token não encontrado (_token). Faça login novamente.");

    const st = await axios.get(`${API_URL}/api/mercadopago/status/${restauranteId}`, {
      headers: { Authorization: token },
    });

    setForm((prev) => ({
      ...prev,
      mercadoPago: {
        conectado: !!st.data?.conectado,
        userId: st.data?.userId || null,
        tokenExpiraEm: st.data?.tokenExpiraEm || null,
        ultimoOAuthEm: st.data?.ultimoOAuthEm || null,
      },
    }));

    return st.data;
  };

  const conectarMercadoPago = async () => {
    try {
      setLoadingMP(true);

      const restauranteId = getRestauranteId();
      const token = getToken();

      if (!restauranteId) throw new Error("Restaurante ID não encontrado (_id).");
      if (!token) throw new Error("Token não encontrado (_token). Faça login novamente.");

      const { data } = await axios.get(`${API_URL}/api/mercadopago/oauth/start/${restauranteId}`, {
        headers: { Authorization: token },
      });

      if (!data?.url) throw new Error("URL OAuth não retornada pelo servidor.");

      const opened = await abrirOAuthMercadoPago(data.url);

      if (opened?.ok === false) {
        throw new Error(opened?.error || "Falha ao abrir modal OAuth.");
      }

      toast("info", "Autorize o Mercado Pago no modal e aguarde...");

      const startedAt = Date.now();
      limparPollingMP();

      intervalRef.current = setInterval(async () => {
        try {
          const st = await refreshStatusMercadoPago();

          if (st?.conectado) {
            limparPollingMP();
            toast("success", "Mercado Pago conectado! ✅");
            setLoadingMP(false);
            return;
          }

          if (Date.now() - startedAt > 120_000) {
            limparPollingMP();
            toast("info", "Se já autorizou, clique em 'Atualizar status'.");
            setLoadingMP(false);
          }
        } catch {
          // ignore
        }
      }, 2500);
    } catch (error) {
      console.error(error);
      toast("error", error?.message || "Erro ao iniciar conexão com Mercado Pago.");
      setLoadingMP(false);
      limparPollingMP();
    }
  };

  const desconectarMercadoPago = async () => {
    try {
      setLoadingMP(true);

      const token = getToken();
      if (!token) throw new Error("Token não encontrado (_token).");

      await axios.post(`${API_URL}/api/mercadopago/disconnect`, {}, { headers: { Authorization: token } });

      try {
        if (window.electron?.clearOAuthSession) await window.electron.clearOAuthSession();
        if (window.electronAPI?.clearOAuthSession) await window.electronAPI.clearOAuthSession();
      } catch (e) {
        console.warn("Não consegui limpar sessão do OAuth:", e?.message);
      }

      setForm((prev) => ({
        ...prev,
        mercadoPago: { conectado: false, userId: null, tokenExpiraEm: null, ultimoOAuthEm: null },
      }));

      toast("success", "Mercado Pago desconectado e sessão do OAuth limpa.");
    } catch (error) {
      console.error(error);
      toast("error", error?.message || "Erro ao desconectar Mercado Pago.");
    } finally {
      setLoadingMP(false);
    }
  };

  const atualizarStatusMP = async () => {
    try {
      setLoadingMP(true);
      await refreshStatusMercadoPago();
      toast("success", "Status do Mercado Pago atualizado.");
    } catch (e) {
      console.error(e);
      toast("error", "Não consegui atualizar o status do Mercado Pago.");
    } finally {
      setLoadingMP(false);
    }
  };

  useEffect(() => () => limparPollingMP(), []);

  useEffect(() => {
    const query =
      window.location.search || (window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "");

    const params = new URLSearchParams(query || "");
    const mp = params.get("mp");

    (async () => {
      if (mp === "ok") {
        toast("success", "Mercado Pago conectado! ✅");
        try {
          await refreshStatusMercadoPago();
        } catch (e) {
          console.error(e);
        }
      }
      if (mp === "erro") toast("error", "Falha ao conectar Mercado Pago.");
    })();

    if (mp) {
      if (window.location.hash.includes("?")) {
        const baseHash = window.location.hash.split("?")[0];
        window.history.replaceState({}, document.title, `${window.location.pathname}${baseHash}`);
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!window.electron?.onMpOAuthDone) return;

    const handler = async (payload) => {
      try {
        await new Promise((r) => setTimeout(r, 350));
        const st = await refreshStatusMercadoPago();

        if (st?.conectado) toast("success", "Mercado Pago conectado! ✅");
        else toast(payload?.ok ? "info" : "error", "OAuth finalizou, mas não conectou.");
      } catch (e) {
        console.error(e);
        toast("error", "OAuth terminou, mas não consegui atualizar o status.");
      } finally {
        setLoadingMP(false);
        limparPollingMP();
      }
    };

    window.electron.onMpOAuthDone(handler);
    return () => { };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** =========================
   *  ✅ IMPRESSÃO — CONEXÃO / EVENTOS
   *  ========================= */

  // carregar settings salvos (1 única fonte) ao montar
  useEffect(() => {
    const ps = readPrintSettings();
    if (!ps) return;

    if (ps?.printerName) setImpressoraSelecionada(ps.printerName);
    if (ps?.brand) setModeloPrintSelecionada(ps.brand);
    if (ps?.layout) setLayoutSelecionado(ps.layout);

    if (ps?.columns != null) setColunasPrint(clampInt(ps.columns, 20, 64, 48));
    if (ps?.feedLines != null) setFeedLinesPrint(clampInt(ps.feedLines, 0, 10, 3));
    if (ps?.cutMode) setCutModePrint(ps.cutMode);
    if (ps?.encoding) setEncodingPrint(ps.encoding);
    setViasPrint(clampInt(ps?.copies, 1, 10, 1));

    const kp = readPrintSettings(KITCHEN_PRINT_SETTINGS_KEY);
    if (kp?.printerName) setCozinhaImpressoraSelecionada(kp.printerName);
    if (kp?.brand) setCozinhaModeloPrintSelecionada(kp.brand);
    if (kp?.layout) setCozinhaLayoutSelecionado(kp.layout);
    if (kp?.columns != null) setCozinhaColunasPrint(clampInt(kp.columns, 20, 64, 48));
    if (kp?.feedLines != null) setCozinhaFeedLinesPrint(clampInt(kp.feedLines, 0, 10, 3));
    if (kp?.cutMode) setCozinhaCutModePrint(kp.cutMode);
    if (kp?.encoding) setCozinhaEncodingPrint(kp.encoding);
    setCozinhaViasPrint(clampInt(kp?.copies, 1, 10, 1));
  }, []);

  // status do serviço + conectar automaticamente (e pedir lista no connect)
  useEffect(() => {
    ensurePrintConnected();

    const onConnect = () => {
      setServicoOnline(true);
      setServicoMsg("Serviço conectado (localhost:9100).");

      socket.emit("listar-impressoras");
      carregarImpressorasElectron();

      if (modeloPrintSelecionada) {
        socket.emit("listar-layouts", { modeloImpressora: modeloPrintSelecionada });
      }
    };

    const onDisconnect = () => {
      setServicoOnline(false);
      setServicoMsg("Serviço offline. Verifique se está instalado/rodando.");
    };

    const onConnectError = () => {
      setServicoOnline(false);
      setServicoMsg("Não consegui conectar no serviço (localhost:9100).");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket, ensurePrintConnected, modeloPrintSelecionada, carregarImpressorasElectron]);

  // receber retorno de impressão
  useEffect(() => {
    const onOk = (p) => toast("success", `Impresso ✅ (${p?.printer || "—"}) Job: ${p?.jobID || "—"}`);
    const onErr = (p) => toast("error", `Erro ao imprimir: ${p?.message || "desconhecido"}`);

    socket.on("impressao-sucesso", onOk);
    socket.on("impressao-erro", onErr);

    return () => {
      socket.off("impressao-sucesso", onOk);
      socket.off("impressao-erro", onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // lista impressoras do serviço (não sobrescreve seleção à toa)
  useEffect(() => {
    ensurePrintConnected();

    const handler = (payload) => {
      const lista = normalizarListaImpressoras(payload);
      if (!lista.length) {
        carregarImpressorasElectron();
        return;
      }

      setImpressoras(lista);

      const nomes = lista.map((i) => i?.name || i).filter(Boolean);

      const saved = readPrintSettings()?.printerName || "";
      const current = impressoraSelecionada || saved;

      if (current && nomes.includes(current)) {
        if (!impressoraSelecionada) setImpressoraSelecionada(current);
        return;
      }

      if (nomes[0]) setImpressoraSelecionada(nomes[0]);
    };

    socket.on("lista-impressoras", handler);
    socket.on("impressoras", handler);
    socket.on("printers", handler);
    carregarImpressorasElectron();
    return () => {
      socket.off("lista-impressoras", handler);
      socket.off("impressoras", handler);
      socket.off("printers", handler);
    };
  }, [socket, ensurePrintConnected, impressoraSelecionada, carregarImpressorasElectron]);

  // lista layouts do serviço conforme marca
  useEffect(() => {
    if (!modeloPrintSelecionada) return;

    ensurePrintConnected();
    socket.emit("listar-layouts", { modeloImpressora: modeloPrintSelecionada });

    const handler = (payload) => {
      const listaServico = normalizarListaLayouts(payload);
      const lista = listaServico.length ? listaServico : layoutsPadraoPorMarca(modeloPrintSelecionada);

      setLayoutDisponivel(lista);

      const savedLayout =
        readPrintSettings()?.layout || localStorage.getItem("layoutSelecionado") || "entregaA";

      if (savedLayout && lista.includes(savedLayout)) {
        setLayoutSelecionado(savedLayout);
      } else if (lista[0]) {
        setLayoutSelecionado(lista[0]);
      }
    };

    socket.on("lista-layouts", handler);
    socket.on("layouts", handler);
    socket.on("listaLayouts", handler);

    // mostra opções locais imediatamente, mesmo antes do retorno do serviço
    handler(layoutsPadraoPorMarca(modeloPrintSelecionada));

    return () => {
      socket.off("lista-layouts", handler);
      socket.off("layouts", handler);
      socket.off("listaLayouts", handler);
    };
  }, [modeloPrintSelecionada, socket, ensurePrintConnected]);

  /** =========================
   *  ✅ RESTAURANTE — FETCH CONFIG
   *  ========================= */
  useEffect(() => {
async function fetchConfig() {
  try {
    const token = getToken();
    if (!token) {
      toast("error", "Token não encontrado (_token). Faça login novamente.");
      return;
    }

    const response = await axios.get(`${API_URL}/api/restaurantes/me`, {
      headers: { Authorization: token },
    });

    if (response.data) {
      setForm((prev) => normalizeRestauranteConfig(response.data, prev));

      if (response.data?.logoUrl) {
        setLogoPreview(`${normalizeApiUrl(response.data.logoUrl)}?v=${Date.now()}`);
        setLogoFile(null);
      }
    }

    // Não bloquear a tela de configurações esperando Mercado Pago/externos.
    refreshStatusMercadoPago().catch(() => {});

    toast("success", "Dados carregados com sucesso!");
  } catch (error) {
    console.error(error);
    toast("error", "Erro ao carregar dados do restaurante.");
  }
}


    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_URL]);

  // ===== Logo preview cleanup =====
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  // handler genérico com suporte a campos aninhados
const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  if (name.startsWith("horariosFuncionamento.")) {
    const [, dia, campo] = name.split(".");
    setForm((prev) => ({
      ...prev,
      horariosFuncionamento: {
        ...(prev.horariosFuncionamento || defaultHorarios),
        [dia]: {
          ...((prev.horariosFuncionamento || defaultHorarios)[dia] || defaultHorarios[dia]),
          [campo]: type === "checkbox" ? checked : value,
        },
      },
    }));
    return;
  }

  if (name.startsWith("mensagensPersonalizadas.")) {
    const [, campo] = name.split(".");
    let novoValor = type === "checkbox" ? checked : value;

    if (campo === "saudacoes") {
      novoValor = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    setForm((prev) => ({
      ...prev,
      mensagensPersonalizadas: {
        ...(prev.mensagensPersonalizadas || defaultMensagens),
        [campo]: novoValor,
      },
    }));
    return;
  }

  // ✅ campos numéricos do restaurante
  if (name === "tempoMedioEntregaMin" || name === "maxPedidosPorEntregador") {
    setForm((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
    return;
  }

  setForm((prev) => ({
    ...prev,
    [name]: type === "checkbox" ? checked : value,
  }));
};


  const buscarEnderecoPorCep = async () => {
    const cep = form.enderecoCep?.replace(/\D/g, "");
    if (!cep || cep.length !== 8) return;

    try {
      const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      if (res.data && !res.data.erro) {
        setForm((prev) => ({
          ...prev,
          enderecoRua: res.data.logradouro,
          enderecoBairro: res.data.bairro,
          enderecoCidade: res.data.localidade,
          enderecoEstado: res.data.uf,
        }));
      } else {
        toast("error", "CEP inválido ou não encontrado.");
      }
    } catch (error) {
      console.error(error);
      toast("error", "Erro ao buscar o endereço pelo CEP.");
    }
  };

  const MAPBOX_API_KEY = import.meta.env.VITE_MAPBOX_TOKEN;

  const buscarCoordenadasEndereco = async (formAtualizado) => {
    const { enderecoRua, enderecoNumero, enderecoBairro, enderecoCidade, enderecoEstado } = formAtualizado;

    const enderecoCompleto = `${enderecoRua}, ${enderecoNumero}, ${enderecoBairro}, ${enderecoCidade} - ${enderecoEstado}`;

    try {
      const res = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(enderecoCompleto)}.json`,
        { params: { access_token: MAPBOX_API_KEY, limit: 1, language: "pt-BR" } }
      );

      if (res.data?.features?.length > 0) {
        const [lon, lat] = res.data.features[0].center;
        return { latitude: lat, longitude: lon };
      }
    } catch (error) {
      console.error(error);
      toast("error", "Erro ao buscar localização no Mapbox.");
    }

    return null;
  };

  // ===== Logo upload handlers =====
  const onChooseLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast("error", "Formato inválido. Use PNG, JPG/JPEG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("error", "Arquivo muito grande. Máx: 2MB.");
      return;
    }

    setLogoFile(file);

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
  };

  const removerLogoLocal = () => {
    setLogoFile(null);
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview("");
    setForm((prev) => ({ ...prev, logoUrl: "" }));
  };

  const uploadLogo = async () => {
    try {
      if (!logoFile) {
        toast("info", "Selecione um arquivo de logo antes de enviar.");
        return;
      }

      setUploadingLogo(true);
      const token = getToken();
      if (!token) throw new Error("Token não encontrado (_token). Faça login novamente.");

      const fd = new FormData();
      fd.append("logo", logoFile);

      const { data } = await axios.post(`${API_URL}/api/restaurantes/logo`, fd, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      if (!data?.logoUrl) throw new Error("Servidor não retornou logoUrl.");

      setForm((prev) => ({ ...prev, logoUrl: data.logoUrl, logoSlug: data.logoSlug }));

      // mantém a sessão local atualizada para Home/Pedidos exibirem a logo sem relogar
      try {
        const sessaoAtual = (await window.electron?.obterSessao?.()) || {};
        if (window.electron?.salvarSessao) {
          await window.electron.salvarSessao({ ...sessaoAtual, logoUrl: data.logoUrl });
        }
      } catch (e) {
        console.warn("Não consegui atualizar logoUrl na sessão local:", e?.message);
      }

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview(`${normalizeApiUrl(data.logoUrl)}?v=${Date.now()}`);
      setLogoFile(null);

      toast("success", "Logo enviada e salva com sucesso ✅");
    } catch (err) {
      console.error(err);
      toast("error", err?.message || "Erro ao enviar logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // ✅ CHAMAR ROTA AO LIGAR/DESLIGAR CARTÃO
  const onTogglePagamentoCartao = async (checked) => {
    const token = getToken();
    if (!token) {
      toast("error", "Token não encontrado (_token). Faça login novamente.");
      return;
    }

    const before = !!form.pagamentoCartaoAtivo;
    setForm((prev) => ({ ...prev, pagamentoCartaoAtivo: checked }));

    try {
      setLoadingToggleCartao(true);

      await axios.patch(
        PAGAMENTO_CARTAO_TOGGLE_ROUTE,
        { pagamentoCartaoAtivo: checked },
        { headers: { Authorization: token } }
      );

      toast("success", checked ? "Cartão ativado na vitrine ✅" : "Cartão desativado na vitrine ✅");
    } catch (e) {
      console.error(e);
      setForm((prev) => ({ ...prev, pagamentoCartaoAtivo: before }));
      toast("error", "Não consegui atualizar a opção de cartão. Tente novamente.");
    } finally {
      setLoadingToggleCartao(false);
    }
  };

  const handleTrocarSenha = async () => {
    const atual = String(senhaAtual || "");
    const nova = String(novaSenha || "");
    const confirmar = String(confirmarNovaSenha || "");

    if (!atual || !nova || !confirmar) {
      toast("error", "Preencha a senha atual, a nova senha e a confirmação.");
      return;
    }
    if (nova.length < 6) {
      toast("error", "A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (nova !== confirmar) {
      toast("error", "A confirmação da nova senha não confere.");
      return;
    }

    const token = getToken();
    if (!token) {
      toast("error", "Token não encontrado (_token). Faça login novamente.");
      return;
    }

    try {
      setSalvandoSenha(true);
      const headers = { Authorization: token?.startsWith("Bearer ") ? token : `Bearer ${token}` };
      const payload = { senhaAtual: atual, novaSenha: nova, senha: nova, senhaAntiga: atual };
      const rotasSenha = [
        ["patch", `${API_URL}/api/restaurantes/configuracoes/senha`],
        ["put", `${API_URL}/api/restaurantes/configuracoes/senha`],
        ["post", `${API_URL}/api/restaurantes/configuracoes/senha`],
        ["patch", `${API_URL}/api/restaurantes/senha`],
        ["put", `${API_URL}/api/restaurantes/senha`],
      ];

      let ultimoErro = null;
      for (const [method, url] of rotasSenha) {
        try {
          await axios({ method, url, data: payload, headers });
          ultimoErro = null;
          break;
        } catch (err) {
          ultimoErro = err;
          if (err?.response?.status && err.response.status !== 404 && err.response.status !== 405) throw err;
        }
      }
      if (ultimoErro) throw ultimoErro;
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      toast("success", "Senha do restaurante atualizada com sucesso ✅");
    } catch (e) {
      console.error(e);
      toast("error", e?.response?.data?.mensagem || "Erro ao atualizar a senha do restaurante.");
    } finally {
      setSalvandoSenha(false);
    }
  };

const handleSalvar = async () => {
  try {
    setLoading(true);

    const token = getToken();
    if (!token) {
      toast("error", "Token não encontrado (_token). Faça login novamente.");
      return;
    }

    const coordenadas = await buscarCoordenadasEndereco(form);

    const payload = {
      ...form,
      localizacao: coordenadas ?? form.localizacao,
      chavePix: /[a-zA-Z@]/.test(form.chavePix) ? form.chavePix : form.chavePix.replace(/\D/g, ""),

      // ✅ força número pra não ir string
      tempoMedioEntregaMin: Number(form.tempoMedioEntregaMin || 45),
      maxPedidosPorEntregador: Number(form.maxPedidosPorEntregador || 3),
    };

    const { data } = await axios.put(`${API_URL}/api/restaurantes/configuracoes`, payload, {
      headers: { Authorization: token },
    });

    if (data?.restaurante) {
      setForm((prev) => normalizeRestauranteConfig(data.restaurante, prev));
      {
        const resolvedLogo = resolveLogoUrl(data.restaurante);
        if (resolvedLogo) setLogoPreview(`${resolvedLogo}?v=${Date.now()}`);
      }
    }

    toast("success", "Configurações salvas com sucesso!");
  } catch (error) {
    console.error(error);
    toast("error", "Erro ao salvar configurações.");
  } finally {
    setLoading(false);
  }
};


  /** =========================
   *  ✅ IMPRESSÃO — SALVAR / RESTAURAR / TESTE
   *  ========================= */
  function handlerSetPrinter() {
    const ps = {
      printerName: impressoraSelecionada,
      brand: modeloPrintSelecionada,
      layout: layoutSelecionado,
      columns: clampInt(colunasPrint, 20, 64, 48),
      feedLines: clampInt(feedLinesPrint, 0, 10, 3),
      cutMode: cutModePrint,
      encoding: encodingPrint,
      copies: clampInt(viasPrint, 1, 10, 1),
    };

    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(ps));
    writeLegacyPrintSettings(ps);

    toast("success", "Configurações de impressão salvas!");
  }

  function handlerSetKitchenPrinter() {
    const ps = {
      printerName: cozinhaImpressoraSelecionada || impressoraSelecionada,
      brand: cozinhaModeloPrintSelecionada || modeloPrintSelecionada,
      layout: cozinhaLayoutSelecionado || "cozinhaA",
      columns: clampInt(cozinhaColunasPrint, 20, 64, 48),
      feedLines: clampInt(cozinhaFeedLinesPrint, 0, 10, 3),
      cutMode: cozinhaCutModePrint,
      encoding: cozinhaEncodingPrint,
      copies: clampInt(cozinhaViasPrint, 1, 10, 1),
    };

    localStorage.setItem(KITCHEN_PRINT_SETTINGS_KEY, JSON.stringify(ps));
    toast("success", "Configurações de impressão da cozinha salvas!");
  }

  const restaurarPadraoMarca = () => {
    const d = defaultPrintSettingsByBrand(modeloPrintSelecionada);
    setColunasPrint(d.columns);
    setFeedLinesPrint(d.feedLines);
    setCutModePrint(d.cutMode);
    setEncodingPrint(d.encoding);
    setViasPrint(d.copies || 1);
    toast("info", "Padrões aplicados para a marca selecionada.");
  };

  const handleTestPrint = async () => {
    const layoutFinal = layoutSelecionado || layoutsPadraoPorMarca(modeloPrintSelecionada)[0] || "entregaA";

    if (!impressoraSelecionada) {
      toast("error", "Selecione uma impressora antes de testar.");
      return;
    }

    if (!modeloPrintSelecionada) {
      toast("error", "Selecione a marca/modelo antes de testar.");
      return;
    }

    const ps = {
      printerName: impressoraSelecionada,
      brand: modeloPrintSelecionada,
      layout: layoutFinal,
      columns: clampInt(colunasPrint, 20, 64, 48),
      feedLines: clampInt(feedLinesPrint, 0, 10, 3),
      cutMode: cutModePrint,
      encoding: encodingPrint,
      copies: clampInt(viasPrint, 1, 10, 1),
    };

    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(ps));
    writeLegacyPrintSettings(ps);

    const dadosTeste = {
      _id: "TESTE",
      codigoPedido: "TESTE",
      numero: "TESTE",
      origem: "balcao",
      tipo: "balcao",
      cliente: "Cliente Teste",
      telefone: "(00) 00000-0000",
      endereco: "Rua Teste, 123 - Centro",
      itens: [
        { nome: "Produto 1", quantidade: 1, qtd: 1, preco: 10.5, valor: 10.5 },
        { nome: "Produto 2", quantidade: 2, qtd: 2, preco: 7.99, valor: 7.99 },
        { nome: "Entrega", quantidade: 1, qtd: 1, preco: 5.0, valor: 5.0 },
      ],
      total: 31.48,
      formaPagamento: "Teste",
      observacao: "Teste de impressão Movyo",
      criadoEm: new Date().toISOString(),
    };

    try {
      toast("info", "Enviando teste para impressão...");
      await enviarParaImpressao(dadosTeste, {
        layout: layoutFinal,
        printerName: impressoraSelecionada,
        brand: modeloPrintSelecionada,
        tipoImpressao: "balcao",
        pluginOnly: true,
        origemTeste: true,
      });
      toast("success", "Teste enviado para a impressora ✅");
    } catch (err) {
      console.error("Erro no teste de impressão:", err);
      toast("error", `Erro no teste: ${err?.message || "não foi possível imprimir"}`);
    }
  };


  const handleTestKitchenPrint = async () => {
    const printerName = cozinhaImpressoraSelecionada || impressoraSelecionada;
    const brand = cozinhaModeloPrintSelecionada || modeloPrintSelecionada;
    if (!printerName) return toast("error", "Selecione a impressora da cozinha antes de testar.");
    if (!brand) return toast("error", "Selecione a marca/modelo da cozinha antes de testar.");

    const ps = {
      printerName,
      brand,
      layout: cozinhaLayoutSelecionado || "cozinhaA",
      columns: clampInt(cozinhaColunasPrint, 20, 64, 48),
      feedLines: clampInt(cozinhaFeedLinesPrint, 0, 10, 3),
      cutMode: cozinhaCutModePrint,
      encoding: cozinhaEncodingPrint,
      copies: clampInt(cozinhaViasPrint, 1, 10, 1),
    };
    localStorage.setItem(KITCHEN_PRINT_SETTINGS_KEY, JSON.stringify(ps));

    const dadosTeste = {
      _id: "COZINHA_TESTE",
      codigoPedido: "COZINHA",
      origem: "balcao",
      cliente: "Cliente Teste",
      itens: [
        { nome: "X-Burger Artesanal", quantidade: 1, qtd: 1, adicionais: [{ nome: "Bacon extra" }, { nome: "Cheddar", quantidade: 2 }], observacao: "Sem cebola" },
        { nome: "Pizza metade calabresa/metade frango", quantidade: 1, qtd: 1, saboresSelecionados: ["Calabresa", "Frango c/ catupiry"], complementos: ["Borda recheada"], obs: "Caprichar no molho" },
      ],
      observacao: "Teste de impressão da cozinha Movyo",
      criadoEm: new Date().toISOString(),
    };

    try {
      toast("info", "Enviando teste da cozinha...");
      await enviarParaImpressao(dadosTeste, {
        layout: ps.layout,
        printerName: ps.printerName,
        brand: ps.brand,
        tipoImpressao: "cozinha",
        pluginOnly: true,
        origemTeste: true,
      });
      toast("success", "Teste de cozinha enviado ✅");
    } catch (err) {
      console.error("Erro no teste de cozinha:", err);
      toast("error", `Erro no teste da cozinha: ${err?.message || "não foi possível imprimir"}`);
    }
  };
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Paper elevation={3} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3 }}>
        {/* Cabeçalho */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          mb={2}
        >
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StorefrontIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                Configurações do Restaurante
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Ajuste dados da loja, horários, integrações e impressão em um só lugar.
            </Typography>
          </Stack>

          <Button
            variant="contained"
            color="primary"
            onClick={handleSalvar}
            disabled={loading}
            startIcon={<SettingsIcon />}
          >
            {loading ? <CircularProgress size={20} /> : "Salvar tudo"}
          </Button>
        </Stack>

        {/* Snackbar */}
        <Snackbar
          open={mostrarMensagem}
          autoHideDuration={4000}
          onClose={() => setMostrarMensagem(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert severity={tipoMensagem} onClose={() => setMostrarMensagem(false)} sx={{ width: "100%" }}>
            {mensagem}
          </Alert>
        </Snackbar>

        {/* Tabs */}
        <Tabs
          value={abaAtual}
          onChange={(_, v) => setAbaAtual(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab icon={<StorefrontIcon fontSize="small" />} iconPosition="start" label="Geral" />
          <Tab icon={<PlaceIcon fontSize="small" />} iconPosition="start" label="Endereço" />
          <Tab icon={<AccessTimeIcon fontSize="small" />} iconPosition="start" label="Horários" />
          <Tab icon={<IntegrationInstructionsIcon fontSize="small" />} iconPosition="start" label="Integrações" />
          <Tab icon={<PrintIcon fontSize="small" />} iconPosition="start" label="Impressão" />
          <Tab icon={<MessageIcon fontSize="small" />} iconPosition="start" label="Mensagens" />
        </Tabs>

        {/* ABA 0 – GERAL */}
        <TabPanel value={abaAtual} index={0}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Informações básicas
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Nome, contato, Pix e URL pública da sua loja.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nome do restaurante" name="nome" fullWidth value={form.nome} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Telefone" name="telefone" fullWidth value={form.telefone} onChange={handleChange} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Chave Pix (Celular, CPF, CNPJ ou E-mail)"
                name="chavePix"
                fullWidth
                value={form.chavePix}
                onChange={(e) => {
                  const valor = e.target.value;
                  const numeros = valor.replace(/\D/g, "");
                  let formatado = valor;

                  if (/^\d{11}$/.test(numeros)) {
                    if (/^(\d{2})9\d{8}$/.test(numeros)) {
                      formatado = numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                    } else {
                      formatado = numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    }
                  } else if (/^\d{14}$/.test(numeros)) {
                    formatado = numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                  } else if (/^\d{10,11}$/.test(numeros)) {
                    formatado = numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                  }

                  setForm((prev) => ({
                    ...prev,
                    chavePix: /[a-zA-Z@]/.test(valor) ? valor : formatado,
                  }));
                }}
                helperText="Suporta celular, CPF, CNPJ ou e-mail/chave aleatória."
              />
            </Grid>

            {/* Logo upload + preview */}
            <Grid item xs={12} sm={6}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Logo do restaurante
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 88,
                      height: 88,
                      borderRadius: 2,
                      border: "1px dashed",
                      borderColor: "divider",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      bgcolor: "background.default",
                    }}
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Prévia da logo"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary" align="center" px={1}>
                        Sem logo
                      </Typography>
                    )}
                  </Box>

                  <Stack spacing={1} sx={{ flex: 1, width: "100%" }}>
                    <Button variant="outlined" component="label">
                      Selecionar arquivo
                      <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={onChooseLogo} />
                    </Button>

                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" onClick={uploadLogo} disabled={!logoFile || uploadingLogo} fullWidth>
                        {uploadingLogo ? <CircularProgress size={18} /> : "Enviar logo"}
                      </Button>

                      <Button
                        variant="outlined"
                        color="error"
                        onClick={removerLogoLocal}
                        disabled={!logoPreview && !form.logoUrl}
                      >
                        Remover
                      </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      PNG/JPG/WEBP • até 2MB. Ao enviar, a URL é salva no restaurante.
                    </Typography>

                    <TextField
                      label="Logo URL (opcional)"
                      name="logoUrl"
                      fullWidth
                      size="small"
                      value={form.logoUrl || ""}
                      onChange={handleChange}
                    />
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Slug da loja"
                name="slugIdentificador"
                fullWidth
                value={form.slugIdentificador || ""}
                onChange={handleChange}
                helperText={`Esse será o endereço público da loja: ex: movyoapp.com/pedido/${form.slugIdentificador || "sua-loja"}`}
              />
            </Grid>

            <Grid container spacing={2}>
  <Grid item xs={12} sm={4} md={3}>
    <TextField
      label="Tempo médio de entrega (min)"
      name="tempoMedioEntregaMin"
      type="number"
      size="small"
      fullWidth
      value={form.tempoMedioEntregaMin ?? ""}
      onChange={handleChange}
      inputProps={{ min: 1 }}
    />
  </Grid>

  <Grid item xs={12} sm={4} md={3}>
    <TextField
      label="Máximo de pedidos por entregador"
      name="maxPedidosPorEntregador"
      type="number"
      size="small"
      fullWidth
      value={form.maxPedidosPorEntregador ?? ""}
      onChange={handleChange}
      inputProps={{ min: 1 }}
    />
  </Grid>
</Grid>


          </Grid>

          <Divider sx={{ my: 3 }} />
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <LockResetIcon fontSize="small" />
              <Typography variant="h6">Senha do restaurante</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Use esta área para substituir a senha de acesso do painel desktop deste restaurante.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Senha atual"
                  type="password"
                  fullWidth
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  autoComplete="current-password"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nova senha"
                  type="password"
                  fullWidth
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  helperText="Mínimo de 6 caracteres"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Confirmar nova senha"
                  type="password"
                  fullWidth
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={salvandoSenha ? <CircularProgress size={18} /> : <LockResetIcon />}
                  onClick={handleTrocarSenha}
                  disabled={salvandoSenha}
                  sx={{ fontWeight: 800 }}
                >
                  {salvandoSenha ? "Atualizando..." : "Atualizar senha"}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </TabPanel>

        {/* ABA 1 – ENDEREÇO */}
        <TabPanel value={abaAtual} index={1}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Endereço do restaurante
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Usado para cálculo de frete e localização no mapa.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="CEP"
                name="enderecoCep"
                fullWidth
                value={form.enderecoCep}
                onChange={handleChange}
                onBlur={buscarEnderecoPorCep}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Rua" name="enderecoRua" fullWidth value={form.enderecoRua} disabled />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Número"
                name="enderecoNumero"
                fullWidth
                value={form.enderecoNumero}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Bairro" name="enderecoBairro" fullWidth value={form.enderecoBairro} disabled />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Cidade" name="enderecoCidade" fullWidth value={form.enderecoCidade} disabled />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField label="Estado" name="enderecoEstado" fullWidth value={form.enderecoEstado} disabled />
            </Grid>
          </Grid>
        </TabPanel>

        {/* ABA 2 – HORÁRIOS */}
        <TabPanel value={abaAtual} index={2}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Horário de funcionamento
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Defina os horários de cada dia para aparecer no app e controlar recebimento de pedidos.
          </Typography>

          <Grid container spacing={2}>
            {Object.entries(form.horariosFuncionamento).map(([dia, dados]) => (
              <Grid item xs={12} sm={3} key={dia}>
                <Paper sx={{ p: 1.5 }} variant="outlined">
                  <Typography variant="subtitle2" sx={{ textTransform: "capitalize", mb: 1 }}>
                    {dia}
                  </Typography>

                  <TextField
                    label="Abre"
                    type="time"
                    fullWidth
                    size="small"
                    name={`horariosFuncionamento.${dia}.abre`}
                    value={dados.abre}
                    onChange={handleChange}
                    disabled={dados.fechado}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 1 }}
                  />

                  <TextField
                    label="Fecha"
                    type="time"
                    fullWidth
                    size="small"
                    name={`horariosFuncionamento.${dia}.fecha`}
                    value={dados.fecha}
                    onChange={handleChange}
                    disabled={dados.fechado}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 1 }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        name={`horariosFuncionamento.${dia}.fechado`}
                        checked={dados.fechado}
                        onChange={handleChange}
                        size="small"
                      />
                    }
                    label={<Typography fontSize="14px">Fechado</Typography>}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* ABA 3 – INTEGRAÇÕES */}
        <TabPanel value={abaAtual} index={3}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Integrações
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            AnotaAI
          </Typography>
          <FormControlLabel
            control={<Switch checked={form.anotaaiStatus} onChange={handleChange} name="anotaaiStatus" />}
            label="Ativo"
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="URL" name="anotaaiUrl" fullWidth value={form.anotaaiUrl} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Identificador"
                name="anotaaiIdentificador"
                fullWidth
                value={form.anotaaiIdentificador}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Token" name="anotaaiToken" fullWidth value={form.anotaaiToken} onChange={handleChange} />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            iFood
          </Typography>
          <FormControlLabel
            control={<Switch checked={form.ifoodStatus} onChange={handleChange} name="ifoodStatus" />}
            label="Ativo"
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Identificador"
                name="ifoodIdentificador"
                fullWidth
                value={form.ifoodIdentificador}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch checked={form.ifoodPrecisaConfirmacao} onChange={handleChange} name="ifoodPrecisaConfirmacao" />
                }
                label="Precisa de confirmação"
              />
              <FormControlLabel
                control={<Switch checked={form.ifoodIgnorarPronto} onChange={handleChange} name="ifoodIgnorarPronto" />}
                label="Ignorar status 'Pronto' do iFood"
              />
            </Grid>
          </Grid>

          {/* Mercado Pago (Split) */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Mercado Pago (Split / Marketplace)
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
            <Chip
              label={form?.mercadoPago?.conectado ? "Conectado" : "Não conectado"}
              color={form?.mercadoPago?.conectado ? "success" : "default"}
              variant={form?.mercadoPago?.conectado ? "filled" : "outlined"}
            />

            {form?.mercadoPago?.userId && <Chip label={`User ID: ${form.mercadoPago.userId}`} variant="outlined" />}

            <Box sx={{ flex: 1 }} />

            {!form?.mercadoPago?.conectado ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={conectarMercadoPago}
                  disabled={loadingMP}
                  startIcon={<IntegrationInstructionsIcon />}
                >
                  {loadingMP ? <CircularProgress size={18} /> : "Conectar"}
                </Button>

                <Button variant="outlined" onClick={atualizarStatusMP} disabled={loadingMP}>
                  Atualizar status
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={atualizarStatusMP} disabled={loadingMP}>
                  Atualizar status
                </Button>
                <Button variant="outlined" color="error" onClick={desconectarMercadoPago} disabled={loadingMP}>
                  Desconectar
                </Button>
              </Stack>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Isso conecta a conta do restaurante ao seu split (marketplace) via OAuth.
          </Typography>

          {/* ✅ Switch cartão vitrine */}
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Pagamento com cartão na vitrine
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={!!form.pagamentoCartaoAtivo}
                onChange={(e) => onTogglePagamentoCartao(e.target.checked)}
                name="pagamentoCartaoAtivo"
                disabled={!form?.mercadoPago?.conectado || loadingToggleCartao}
              />
            }
            label={
              <Stack spacing={0.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontSize="14px" fontWeight={600}>
                    Ativar pagamento com cartão (crédito à vista)
                  </Typography>
                  {loadingToggleCartao && <CircularProgress size={16} />}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {form?.mercadoPago?.conectado
                    ? "Se ativado, o cliente terá acréscimo sobre o total do pedido no crédito à vista."
                    : "Conecte o Mercado Pago para liberar essa opção."}
                </Typography>
              </Stack>
            }
          />

          {form?.mercadoPago?.conectado && form.pagamentoCartaoAtivo && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label="Cartão ativo na vitrine" color="success" />
              <Chip size="small" label="Crédito à vista" variant="outlined" />
            </Stack>
          )}
        </TabPanel>

        {/* ABA 4 – IMPRESSÃO */}
        <TabPanel value={abaAtual} index={4}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Impressão
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Selecione a impressora padrão, modelo, layout e ajuste opções avançadas.
          </Typography>

          <Paper sx={{ p: 3, borderRadius: 2 }} variant="outlined">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
              <Chip label={servicoOnline ? "Serviço ONLINE" : "Serviço OFFLINE"} color={servicoOnline ? "success" : "error"} />
              <Typography variant="caption" color="text.secondary">
                {servicoMsg || "Status do serviço não disponível."}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handleTestPrint}
                disabled={!impressoraSelecionada}
              >
                Testar impressão
              </Button>
            </Stack>

            <Box display="flex" alignItems="flex-start" gap={2} flexWrap="wrap">
              <Box sx={{ width: 260 }}>
                <FormControl fullWidth>
                  <InputLabel id="impressora-label">Selecionar impressora</InputLabel>
                  <Select
                    labelId="impressora-label"
                    value={impressoraSelecionada}
                    label="Selecionar impressora"
                    onChange={(e) => setImpressoraSelecionada(e.target.value)}
                  >
                    {impressoras.length === 0 && (
                      <MenuItem value="" disabled>
                        Nenhuma impressora encontrada
                      </MenuItem>
                    )}
                    {impressoras.map((imp, index) => (
                      <MenuItem key={index} value={imp.name || imp.displayName || imp}>
                        {imp.displayName || imp.name || imp}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ width: 220 }}>
                <TextField
                  select
                  label="Marca da impressora"
                  fullWidth
                  value={modeloPrintSelecionada || ""}
                  onChange={(e) => {
                    const novaMarca = e.target.value;
                    setModeloPrintSelecionada(novaMarca);

                    const d = defaultPrintSettingsByBrand(novaMarca);
                    setColunasPrint(d.columns);
                    setFeedLinesPrint(d.feedLines);
                    setCutModePrint(d.cutMode);
                    setEncodingPrint(d.encoding);
                    setViasPrint(d.copies || 1);
                  }}
                >
                  <MenuItem value="Gertec">Gertec</MenuItem>
                  <MenuItem value="Elgin">Elgin</MenuItem>
                  <MenuItem value="Bematech">Bematech</MenuItem>
                  <MenuItem value="Epson">Epson</MenuItem>
                  <MenuItem value="Daruma">Daruma</MenuItem>
                  <MenuItem value="POS-58">POS-58</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ width: 220 }}>
                <TextField
                  select
                  label="Layout de impressão"
                  fullWidth
                  value={layoutSelecionado}
                  onChange={(e) => setLayoutSelecionado(e.target.value)}
                >
                  {layoutDisponivel.map((item, index) => (
                    <MenuItem key={index} value={item}>
                      {item === "entregaA" ? "Layout 1" : item === "entregaB" ? "Layout 2" : item}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box sx={{ width: 140 }}>
                <Tooltip title="58mm geralmente usa 32 colunas. 80mm geralmente usa 48 colunas.">
                  <TextField
                    label="Colunas"
                    type="number"
                    fullWidth
                    value={colunasPrint}
                    onChange={(e) => setColunasPrint(e.target.value)}
                    inputProps={{ min: 20, max: 64 }}
                  />
                </Tooltip>
              </Box>

              <Box sx={{ width: 170 }}>
                <TextField
                  select
                  label="Corte"
                  fullWidth
                  value={cutModePrint}
                  onChange={(e) => setCutModePrint(e.target.value)}
                >
                  <MenuItem value="full">Corte total</MenuItem>
                  <MenuItem value="partial">Corte parcial</MenuItem>
                  <MenuItem value="none">Sem corte</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ width: 170 }}>
                <TextField
                  label="Linhas finais"
                  type="number"
                  fullWidth
                  value={feedLinesPrint}
                  onChange={(e) => setFeedLinesPrint(e.target.value)}
                  inputProps={{ min: 0, max: 10 }}
                />
              </Box>

              <Box sx={{ width: 160 }}>
                <Tooltip title="Quantidade de vias do mesmo pedido. Ex.: 2 vias imprime cliente/cozinha ou conferência.">
                  <TextField
                    label="Qtd. de vias"
                    type="number"
                    fullWidth
                    value={viasPrint}
                    onChange={(e) => setViasPrint(e.target.value)}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Tooltip>
              </Box>

              <Box sx={{ width: 210 }}>
                <TextField select label="Encoding" fullWidth value={encodingPrint} onChange={(e) => setEncodingPrint(e.target.value)}>
                  <MenuItem value="win1252">Windows-1252 (BR)</MenuItem>
                  <MenuItem value="cp860">CP860 (térmicas)</MenuItem>
                  <MenuItem value="utf8">UTF-8 (se suportar)</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!impressoraSelecionada}
                  onClick={handlerSetPrinter}
                  sx={{ mt: { xs: 1.5, md: 0.5 } }}
                >
                  Salvar impressão
                </Button>

                <Button
                  variant="outlined"
                  onClick={restaurarPadraoMarca}
                  disabled={!modeloPrintSelecionada}
                  sx={{ mt: { xs: 1.5, md: 0.5 } }}
                >
                  Restaurar padrão
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" fontWeight={800} gutterBottom>
              Impressão da cozinha
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Use uma impressora própria da cozinha ou deixe a mesma do balcão. O layout cozinha remove valores e destaca produção, adicionais e observações.
            </Typography>

            <Box display="flex" alignItems="flex-start" gap={2} flexWrap="wrap">
              <Box sx={{ width: 260 }}>
                <FormControl fullWidth>
                  <InputLabel id="cozinha-impressora-label">Impressora da cozinha</InputLabel>
                  <Select
                    labelId="cozinha-impressora-label"
                    value={cozinhaImpressoraSelecionada || impressoraSelecionada}
                    label="Impressora da cozinha"
                    onChange={(e) => setCozinhaImpressoraSelecionada(e.target.value)}
                  >
                    {impressoras.length === 0 && <MenuItem value="" disabled>Nenhuma impressora encontrada</MenuItem>}
                    {impressoras.map((imp, index) => (
                      <MenuItem key={`cozinha-${index}`} value={imp.name || imp.displayName || imp}>
                        {imp.displayName || imp.name || imp}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ width: 220 }}>
                <TextField
                  select
                  label="Marca cozinha"
                  fullWidth
                  value={cozinhaModeloPrintSelecionada || modeloPrintSelecionada || ""}
                  onChange={(e) => {
                    const novaMarca = e.target.value;
                    setCozinhaModeloPrintSelecionada(novaMarca);
                    const d = defaultPrintSettingsByBrand(novaMarca);
                    setCozinhaColunasPrint(d.columns);
                    setCozinhaFeedLinesPrint(d.feedLines);
                    setCozinhaCutModePrint(d.cutMode);
                    setCozinhaEncodingPrint(d.encoding);
                    setCozinhaViasPrint(d.copies || 1);
                  }}
                >
                  <MenuItem value="Gertec">Gertec</MenuItem>
                  <MenuItem value="Elgin">Elgin</MenuItem>
                  <MenuItem value="Bematech">Bematech</MenuItem>
                  <MenuItem value="Epson">Epson</MenuItem>
                  <MenuItem value="Daruma">Daruma</MenuItem>
                  <MenuItem value="POS-58">POS-58</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ width: 220 }}>
                <TextField select label="Layout cozinha" fullWidth value={cozinhaLayoutSelecionado} onChange={(e) => setCozinhaLayoutSelecionado(e.target.value)}>
                  <MenuItem value="cozinhaA">Cozinha</MenuItem>
                </TextField>
              </Box>

              <Box sx={{ width: 140 }}>
                <TextField label="Colunas" type="number" fullWidth value={cozinhaColunasPrint} onChange={(e) => setCozinhaColunasPrint(e.target.value)} inputProps={{ min: 20, max: 64 }} />
              </Box>

              <Box sx={{ width: 140 }}>
                <TextField label="Vias" type="number" fullWidth value={cozinhaViasPrint} onChange={(e) => setCozinhaViasPrint(e.target.value)} inputProps={{ min: 1, max: 10 }} />
              </Box>

              <Box sx={{ width: 180 }}>
                <TextField select label="Encoding" fullWidth value={cozinhaEncodingPrint} onChange={(e) => setCozinhaEncodingPrint(e.target.value)}>
                  <MenuItem value="win1252">Win1252</MenuItem>
                  <MenuItem value="cp860">CP860</MenuItem>
                  <MenuItem value="utf8">UTF-8</MenuItem>
                </TextField>
              </Box>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button variant="contained" onClick={handlerSetKitchenPrinter} disabled={!(cozinhaImpressoraSelecionada || impressoraSelecionada)}>
                  Salvar cozinha
                </Button>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleTestKitchenPrint} disabled={!(cozinhaImpressoraSelecionada || impressoraSelecionada)}>
                  Testar cozinha
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={0.75}>
              <Typography variant="subtitle2">Resumo</Typography>
              <Typography variant="body2" color="text.secondary">
                Impressora: <b>{impressoraSelecionada || "—"}</b> • Marca: <b>{modeloPrintSelecionada || "—"}</b> • Layout:{" "}
                <b>{layoutSelecionado || "—"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Colunas: <b>{clampInt(colunasPrint, 20, 64, 48)}</b> • Corte:{" "}
                <b>{cutModePrint === "full" ? "Total" : cutModePrint === "partial" ? "Parcial" : "Sem corte"}</b> • Linhas finais:{" "}
                <b>{clampInt(feedLinesPrint, 0, 10, 3)}</b> • Vias: <b>{clampInt(viasPrint, 1, 10, 1)}</b> • Encoding: <b>{encodingPrint}</b>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Dica: se a impressão cortar texto no 58mm, mude Colunas para 32. Se os acentos saírem errados, teste CP860.
              </Typography>
            </Stack>
          </Paper>
        </TabPanel>

        {/* ABA 5 – MENSAGENS */}
        <TabPanel value={abaAtual} index={5}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Mensagens personalizadas
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Personalize o texto que o cliente recebe no WhatsApp ou chatbot.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Palavras-chave de saudação"
                name="mensagensPersonalizadas.saudacoes"
                fullWidth
                value={form.mensagensPersonalizadas.saudacoes.join(", ")}
                onChange={handleChange}
                helperText="Ex: oi, olá, bom dia"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Resposta para saudação"
                name="mensagensPersonalizadas.respostaSaudacao"
                fullWidth
                value={form.mensagensPersonalizadas.respostaSaudacao}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensagem de pedido aceito"
                name="mensagensPersonalizadas.statusPedidoAceito"
                fullWidth
                value={form.mensagensPersonalizadas.statusPedidoAceito}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensagem de saiu para entrega"
                name="mensagensPersonalizadas.statusSaiuParaEntrega"
                fullWidth
                value={form.mensagensPersonalizadas.statusSaiuParaEntrega}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensagem de pedido entregue"
                name="mensagensPersonalizadas.statusEntregue"
                fullWidth
                value={form.mensagensPersonalizadas.statusEntregue}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensagem de pós-entrega"
                name="mensagensPersonalizadas.mensagemPosEntrega"
                fullWidth
                value={form.mensagensPersonalizadas.mensagemPosEntrega}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Configuracoes;
