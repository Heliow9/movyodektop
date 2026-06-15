// src/pages/Estoque.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { attachAccessGuardInterceptor } from "../services/api";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Switch, // ✅ ADICIONADO
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

// ✅ TABS COMPONENTIZADAS
import InsumosTab from "../components/estoque/InsumosTab";
import ReceitasTab from "../components/estoque/ReceitasTab";
import RelatoriosTab from "../components/estoque/RelatoriosTab";

const brand = {
  grad: "linear-gradient(180deg, #ff3b8a 0%, #ff9b2d 100%)",
  softGrad: "linear-gradient(135deg, rgba(255,59,138,0.12), rgba(255,155,45,0.10))",
};

// ✅ ajuste aqui se seu backend tiver outro host
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

// ✅ ajuste aqui se seu token tiver outra key no storage
function getToken() {
  return localStorage.getItem("_token") || "";
}

const api = axios.create({
  baseURL: `${API_URL}/api/estoque`,
  timeout: 20000,
});

// encerra a sessão se a API informar bloqueio ou licença vencida
attachAccessGuardInterceptor(api);

// injeta auth em toda request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const UNIDADES = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "un", label: "unidade" },
  { value: "ml", label: "ml" },
  { value: "l", label: "litro" },
];

function formatQtd(q, unidade) {
  if (q === null || q === undefined) return "-";
  const n = Number(q);
  if (Number.isNaN(n)) return String(q);
  if (unidade === "g" || unidade === "ml") return `${n.toFixed(0)} ${unidade}`;
  if (unidade === "un") return `${n.toFixed(0)} un`;
  return `${n.toFixed(2)} ${unidade}`;
}

function formatBRL(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/**
 * ✅ parseNum robusto:
 * - aceita "0,16" e "0.16"
 * - aceita "1.234,56" (pt-BR) e "1,234.56" (en-US)
 * - evita bug: "0.16" virar "16"
 */
function parseNum(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;

  // mantém só dígitos, separadores e sinal
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  // Caso 1: tem vírgula e ponto -> decide pelo ÚLTIMO separador como decimal
  // Ex: "1.234,56" (decimal = ,) | "1,234.56" (decimal = .)
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decimalIsComma = lastComma > lastDot;

    if (decimalIsComma) {
      // remove milhares "." e troca "," por "."
      const norm = s.replace(/\./g, "").replace(",", ".");
      const n = Number(norm);
      return Number.isNaN(n) ? null : n;
    } else {
      // remove milhares "," (en-US) e mantém "." decimal
      const norm = s.replace(/,/g, "");
      const n = Number(norm);
      return Number.isNaN(n) ? null : n;
    }
  }

  // Caso 2: só vírgula -> assume vírgula decimal (pt-BR)
  if (hasComma && !hasDot) {
    const norm = s.replace(",", ".");
    const n = Number(norm);
    return Number.isNaN(n) ? null : n;
  }

  // Caso 3: só ponto -> pode ser decimal (0.16) OU milhar (1.234)
  if (hasDot && !hasComma) {
    // se for padrão milhar: 1.234 ou 1.234.567 (sem casas decimais)
    const thousandsLike = /^\-?\d{1,3}(\.\d{3})+$/.test(s);
    const norm = thousandsLike ? s.replace(/\./g, "") : s;
    const n = Number(norm);
    return Number.isNaN(n) ? null : n;
  }

  // Caso 4: só dígitos
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/**
 * ✅ Input pt-BR (receita/estoque):
 * - converte '.' em ','
 * - remove letras/símbolos
 * - mantém só 1 vírgula
 * - limita casas decimais
 */
function sanitizeBRDecimalInput(value, { maxDecimals = 4, allowNegative = false } = {}) {
  let s = String(value ?? "");

  // troca ponto por vírgula (pra evitar 0.16 virar 16 em parse)
  s = s.replace(/\./g, ",");

  // remove tudo que não seja dígito, vírgula ou '-'
  s = s.replace(/[^\d,-]/g, "");

  // sinal negativo (se permitido)
  if (!allowNegative) {
    s = s.replace(/-/g, "");
  } else {
    // só 1 '-' no começo
    s = s.replace(/(?!^)-/g, "");
  }

  // mantém apenas a primeira vírgula
  const parts = s.split(",");
  if (parts.length > 2) {
    s = `${parts[0]},${parts.slice(1).join("")}`;
  }

  // limita casas decimais
  const [intPart, decPart] = s.split(",");
  if (decPart !== undefined) {
    s = `${intPart},${decPart.slice(0, maxDecimals)}`;
  }

  return s;
}

function sanitizeBRIntegerInput(value) {
  let s = String(value ?? "");
  s = s.replace(/[^\d]/g, "");
  return s;
}

function baseFromUnidade(unidade) {
  if (unidade === "g" || unidade === "kg") return "kg";
  if (unidade === "ml" || unidade === "l") return "l";
  if (unidade === "un") return "un";
  return unidade;
}

function toBase(qtd, unidade) {
  const n = Number(qtd || 0);
  if (unidade === "g") return { base: "kg", value: n / 1000 };
  if (unidade === "kg") return { base: "kg", value: n };
  if (unidade === "ml") return { base: "l", value: n / 1000 };
  if (unidade === "l") return { base: "l", value: n };
  if (unidade === "un") return { base: "un", value: n };
  return { base: unidade, value: n };
}

function fromBase(baseValue, unidade) {
  const n = Number(baseValue || 0);
  if (unidade === "g") return n * 1000;
  if (unidade === "kg") return n;
  if (unidade === "ml") return n * 1000;
  if (unidade === "l") return n;
  if (unidade === "un") return n;
  return n;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV(headers, rows) {
  const head = headers.map(csvEscape).join(";");
  const body = rows.map((r) => r.map(csvEscape).join(";")).join("\n");
  return `${head}\n${body}\n`;
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) {
    return false;
  }
}

async function downloadCSV(filename, csvText) {
  try {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function calcProducaoMaxima(receita, insumoMap) {
  if (!receita?.itens?.length) {
    return { max: 0, gargalo: null, detalhes: [], motivo: "sem_itens" };
  }

  const detalhes = [];

  for (const it of receita.itens) {
    const ins = insumoMap.get(it.insumoId);
    if (!ins) continue;

    const consumoBase = toBase(it.qtd, it.unidade);
    const baseInsumo = baseFromUnidade(ins.unidadePadrao);

    if (consumoBase.base !== baseInsumo) {
      return {
        max: 0,
        gargalo: { insumo: ins, motivo: "unidade_incompativel" },
        detalhes: [],
        motivo: "unidade_incompativel",
      };
    }

    if (!consumoBase.value || consumoBase.value <= 0) continue;

    const maxPorInsumo = Math.floor(ins.quantidadeBase / consumoBase.value);

    detalhes.push({
      insumo: ins,
      consumoBasePorUn: consumoBase.value,
      base: consumoBase.base,
      maxPorInsumo,
    });
  }

  if (!detalhes.length) {
    return { max: 0, gargalo: null, detalhes: [], motivo: "sem_detalhes" };
  }

  detalhes.sort((a, b) => a.maxPorInsumo - b.maxPorInsumo);
  const gargalo = detalhes[0];

  return {
    max: Math.max(0, gargalo.maxPorInsumo),
    gargalo,
    detalhes,
    motivo: "ok",
  };
}

function calcConsumoPara(receita, insumoMap, targetQty) {
  const q = Math.max(0, Math.floor(Number(targetQty || 0)));
  const rows = [];

  for (const it of receita?.itens || []) {
    const ins = insumoMap.get(it.insumoId);
    if (!ins) continue;

    const consumoBase = toBase(it.qtd, it.unidade);
    const baseInsumo = baseFromUnidade(ins.unidadePadrao);

    const incompat = consumoBase.base !== baseInsumo;
    const consumoTotalBase = incompat ? null : consumoBase.value * q;

    const estoqueBase = ins.quantidadeBase;
    const faltaBase = incompat || consumoTotalBase === null ? null : Math.max(0, consumoTotalBase - estoqueBase);

    rows.push({
      ins,
      it,
      base: baseInsumo,
      incompat,
      estoqueBase,
      consumoTotalBase,
      faltaBase,
    });
  }

  return rows;
}

function calcCompraConsolidada(receitas, insumoMap, metaPorReceitaMap) {
  const faltas = new Map();
  const incompat = new Map();

  for (const r of receitas) {
    const meta = metaPorReceitaMap?.[r.id] ?? 0;
    const rows = calcConsumoPara(r, insumoMap, meta);

    for (const row of rows) {
      if (row.incompat) {
        incompat.set(row.ins.id, true);
        continue;
      }
      if (!row.faltaBase || row.faltaBase <= 0) continue;
      faltas.set(row.ins.id, (faltas.get(row.ins.id) || 0) + row.faltaBase);
    }
  }

  const out = [];
  for (const [insumoId, faltaBase] of faltas.entries()) {
    const ins = insumoMap.get(insumoId);
    if (!ins) continue;
    out.push({ ins, faltaBase, incompat: incompat.get(insumoId) === true });
  }

  out.sort((a, b) => b.faltaBase - a.faltaBase);
  return out;
}

/**
 * ✅ NOVO BACKEND:
 * Insumo tem: unidadePadrao, baseUnit, quantidadeBase, minimoBase, costBase
 * Receita: ainda aceitamos payload antigo (qtd/unidade) no front e o back normaliza.
 */
function normalizeInsumo(raw) {
  const id = raw?.id || raw?._id;

  const unidadePadrao = raw?.unidadePadrao || raw?.baseUnit || "kg";
  const baseUnit = raw?.baseUnit || baseFromUnidade(unidadePadrao) || "kg";

  const qtdBase = raw?.quantidadeBase ?? raw?.quantityBase ?? 0;
  const minBase = raw?.minimoBase ?? raw?.minimumBase ?? 0;
  const costBase = raw?.costBase ?? 0;

  return {
    id: String(id),
    nome: raw?.nome || "",
    unidadePadrao,
    baseUnit,
    quantidadeBase: Number(qtdBase ?? 0),
    minimoBase: Number(minBase ?? 0),
    costBase: Number(costBase ?? 0),
  };
}

function normalizeReceita(raw) {
  const id = raw?.id || raw?._id;
  const itens = Array.isArray(raw?.itens) ? raw.itens : Array.isArray(raw?.items) ? raw.items : [];

  return {
    id: String(id),
    nome: raw?.nome || "",
    itens: itens.map((x) => ({
      insumoId: String(x?.insumoId || x?.insumo || x?._id || ""),
      qtd: Number(x?.qtd ?? x?.consumoBasePorUn ?? x?.insumoBasePorUn ?? 0),
      unidade: x?.unidade || x?.baseUnit || "g",
    })),
  };
}

function pickApiMessage(err, fallback = "Erro ao comunicar com a API.") {
  const msg = err?.response?.data?.mensagem || err?.response?.data?.message || err?.message || fallback;
  return String(msg);
}

/* =========================================================
   ✅ AUTO CUSTO (EMBALAGEM) - HELPERS
   ========================================================= */
function round4(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10000) / 10000;
}

function canAutoCost(unidadePadrao) {
  return ["kg", "g", "l", "ml"].includes(unidadePadrao);
}

function packToBase(qtd, unidade) {
  const n = Number(qtd || 0);
  if (unidade === "g") return { base: "kg", value: n / 1000 };
  if (unidade === "kg") return { base: "kg", value: n };
  if (unidade === "ml") return { base: "l", value: n / 1000 };
  if (unidade === "l") return { base: "l", value: n };
  return { base: null, value: 0 };
}

function costUnitOptionsByUnidadePadrao(unidadePadrao) {
  if (unidadePadrao === "kg" || unidadePadrao === "g") return ["kg", "g"];
  if (unidadePadrao === "l" || unidadePadrao === "ml") return ["l", "ml"];
  if (unidadePadrao === "un") return ["un"];
  return ["kg", "g", "l", "ml", "un"];
}

export default function Estoque() {
  const [tab, setTab] = useState(0); // 0 insumos, 1 receitas, 2 relatórios
  const [busca, setBusca] = useState("");

  const [insumos, setInsumos] = useState([]);
  const [receitas, setReceitas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // dialogs
  const [openInsumo, setOpenInsumo] = useState(false);
  const [editInsumoId, setEditInsumoId] = useState(null);

  const [openReceita, setOpenReceita] = useState(false);
  const [editReceitaId, setEditReceitaId] = useState(null);

  const [openDetalhes, setOpenDetalhes] = useState(false);
  const [detalhesReceitaId, setDetalhesReceitaId] = useState(null);

  // snackbar
  const [snack, setSnack] = useState({ open: false, msg: "", sev: "success" });

  // ✅ sim input no card (receitas)
  const [simQtyByReceita, setSimQtyByReceita] = useState({}); // { [id]: "10" }

  // ✅ detalhes qty
  const [detalhesQtd, setDetalhesQtd] = useState("10");

  const fetchAll = async (isReload = false) => {
    try {
      if (isReload) setReloading(true);
      else setLoading(true);

      const [insRes, recRes] = await Promise.all([api.get("/insumos"), api.get("/receitas")]);

      const insList = Array.isArray(insRes.data) ? insRes.data : insRes.data?.data || [];
      const recList = Array.isArray(recRes.data) ? recRes.data : recRes.data?.data || [];

      setInsumos(insList.map(normalizeInsumo));
      setReceitas(recList.map(normalizeReceita));
    } catch (err) {
      setSnack({ open: true, sev: "error", msg: pickApiMessage(err, "Falha ao carregar estoque.") });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    fetchAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insumoMap = useMemo(() => {
    const m = new Map();
    insumos.forEach((i) => m.set(i.id, i));
    return m;
  }, [insumos]);

  const insumosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return insumos;
    return insumos.filter((i) => i.nome.toLowerCase().includes(b));
  }, [busca, insumos]);

  const receitasFiltradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return receitas;
    return receitas.filter((r) => r.nome.toLowerCase().includes(b));
  }, [busca, receitas]);

  // ----------------------
  // FORM INSUMO
  // ----------------------
  const [fNome, setFNome] = useState("");
  const [fUnidade, setFUnidade] = useState("kg");
  const [fQtd, setFQtd] = useState("");
  const [fMin, setFMin] = useState("");

  // ✅ custo (UI)
  const [fPreco, setFPreco] = useState(""); // valor digitado
  const [fPrecoUnidade, setFPrecoUnidade] = useState("kg"); // unidade do custo digitado

  // ✅ auto cálculo por embalagem (mostra só p/ kg/g/l/ml)
  const [autoCostOn, setAutoCostOn] = useState(true);
  const [packPrice, setPackPrice] = useState(""); // R$ da embalagem
  const [packQty, setPackQty] = useState(""); // quantidade da embalagem
  const [packUnit, setPackUnit] = useState("l"); // kg/g/l/ml

  const resetFormInsumo = (seed) => {
    if (!seed) {
      setFNome("");
      setFUnidade("kg");
      setFQtd("");
      setFMin("");
      setFPreco("");
      setFPrecoUnidade("kg");

      // ✅ reset auto cálculo
      setAutoCostOn(true);
      setPackPrice("");
      setPackQty("");
      setPackUnit("l");
      return;
    }

    setFNome(seed.nome || "");
    setFUnidade(seed.unidadePadrao || "kg");
    setFQtd(String(fromBase(seed.quantidadeBase, seed.unidadePadrao)));
    setFMin(String(fromBase(seed.minimoBase, seed.unidadePadrao)));

    // Mostra o custo como "por base unit" (porque o banco guarda costBase normalizado)
    setFPreco(seed.costBase ? String(seed.costBase).replace(".", ",") : "");
    setFPrecoUnidade(seed.baseUnit || baseFromUnidade(seed.unidadePadrao) || "kg");

    // ✅ reset auto cálculo
    setAutoCostOn(true);
    setPackPrice("");
    setPackQty("");
    const base = seed.baseUnit || baseFromUnidade(seed.unidadePadrao) || "kg";
    setPackUnit(base === "kg" ? "kg" : "l");
  };

  const openNovoInsumo = () => {
    setEditInsumoId(null);
    resetFormInsumo(null);
    setOpenInsumo(true);
  };

  const openEditarInsumo = (id) => {
    setEditInsumoId(id);
    const seed = insumos.find((x) => x.id === id);
    resetFormInsumo(seed);
    setOpenInsumo(true);
  };

  // ✅ mantém unidade do custo compatível quando muda unidade padrão
  useEffect(() => {
    const allowed = costUnitOptionsByUnidadePadrao(fUnidade);
    if (!allowed.includes(fPrecoUnidade)) {
      const base = baseFromUnidade(fUnidade);
      setFPrecoUnidade(base);
    }

    // packUnit também segue o grupo
    if (fUnidade === "kg" || fUnidade === "g") {
      setPackUnit((u) => (u === "l" || u === "ml" ? "kg" : u));
    }
    if (fUnidade === "l" || fUnidade === "ml") {
      setPackUnit((u) => (u === "kg" || u === "g" ? "l" : u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fUnidade]);

  // ✅ auto calcular custo (R$/kg ou R$/l) a partir do pack
  useEffect(() => {
    if (!autoCostOn) return;
    if (!canAutoCost(fUnidade)) return;

    const price = parseNum(packPrice);
    const qty = parseNum(packQty);
    if (price == null || qty == null) return;
    if (price <= 0 || qty <= 0) return;

    const baseInsumo = baseFromUnidade(fUnidade); // "kg" ou "l"
    const pack = packToBase(qty, packUnit);
    if (!pack.base || pack.base !== baseInsumo) return;
    if (!pack.value || pack.value <= 0) return;

    const calc = round4(price / pack.value);

    setFPreco(String(calc).replace(".", ","));
    setFPrecoUnidade(baseInsumo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCostOn, packPrice, packQty, packUnit, fUnidade]);

  const salvarInsumo = async () => {
    const nome = fNome.trim();
    if (!nome) return setSnack({ open: true, msg: "Informe o nome do insumo.", sev: "warning" });

    const qtdNum = parseNum(fQtd);
    const minNum = parseNum(fMin);
    if (qtdNum === null || qtdNum < 0) return setSnack({ open: true, msg: "Quantidade inválida.", sev: "warning" });
    if (minNum === null || minNum < 0) return setSnack({ open: true, msg: "Mínimo inválido.", sev: "warning" });

    const qtdBase = toBase(qtdNum, fUnidade);
    const minBase = toBase(minNum, fUnidade);

    if (qtdBase.base !== minBase.base) {
      return setSnack({ open: true, msg: "Unidade incompatível.", sev: "warning" });
    }

    const precoNum = fPreco.trim() ? parseNum(fPreco) : null;
    if (precoNum !== null && (precoNum < 0 || Number.isNaN(precoNum))) {
      return setSnack({ open: true, msg: "Custo inválido.", sev: "warning" });
    }

    try {
      const payload = {
        nome,
        unidadePadrao: fUnidade,
        quantidadeBase: qtdBase.value,
        minimoBase: minBase.value,
      };

      if (precoNum !== null) {
        // server converte pra costBase
        payload.preco = precoNum;
        payload.precoUnidade = fPrecoUnidade;
      }

      if (editInsumoId) {
        const res = await api.patch(`/insumos/${editInsumoId}`, payload);
        const updated = normalizeInsumo(res.data?.data || res.data || payload);
        setInsumos((prev) => prev.map((x) => (x.id === editInsumoId ? { ...x, ...updated } : x)));
        setSnack({ open: true, msg: "Insumo atualizado!", sev: "success" });
      } else {
        const res = await api.post("/insumos", payload);
        const created = normalizeInsumo(res.data?.data || res.data || payload);
        setInsumos((prev) => [...prev, created]);
        setSnack({ open: true, msg: "Insumo criado!", sev: "success" });
      }

      setOpenInsumo(false);
    } catch (err) {
      setSnack({ open: true, sev: "error", msg: pickApiMessage(err, "Falha ao salvar insumo.") });
    }
  };

  const removerInsumo = async (id) => {
    const emUso = receitas.some((r) => r.itens.some((it) => it.insumoId === id));
    if (emUso) {
      return setSnack({
        open: true,
        msg: "Esse insumo está em uma receita. Remova da receita antes.",
        sev: "warning",
      });
    }

    try {
      await api.delete(`/insumos/${id}`);
      setInsumos((prev) => prev.filter((x) => x.id !== id));
      setSnack({ open: true, msg: "Insumo removido.", sev: "success" });
    } catch (err) {
      setSnack({ open: true, sev: "error", msg: pickApiMessage(err, "Falha ao remover insumo.") });
    }
  };

  // ----------------------
  // FORM RECEITA
  // ----------------------
  const [rNome, setRNome] = useState("");
  const [rItens, setRItens] = useState([{ insumoId: "", qtd: "", unidade: "g" }]);

  const resetFormReceita = (seed) => {
    if (!seed) {
      setRNome("");
      setRItens([{ insumoId: "", qtd: "", unidade: "g" }]);
      return;
    }
    setRNome(seed.nome || "");
    // mantém como string, mas em pt-BR (troca '.' por ',')
    setRItens(
      seed.itens?.length
        ? seed.itens.map((x) => ({
            ...x,
            qtd: String(x.qtd ?? "").replace(/\./g, ","),
          }))
        : [{ insumoId: "", qtd: "", unidade: "g" }]
    );
  };

  const openNovaReceita = () => {
    setEditReceitaId(null);
    resetFormReceita(null);
    setOpenReceita(true);
  };

  const openEditarReceita = (id) => {
    setEditReceitaId(id);
    const seed = receitas.find((x) => x.id === id);
    resetFormReceita(seed);
    setOpenReceita(true);
  };

  const addLinhaReceita = () => setRItens((prev) => [...prev, { insumoId: "", qtd: "", unidade: "g" }]);
  const rmLinhaReceita = (idx) => setRItens((prev) => prev.filter((_, i) => i !== idx));
  const setLinha = (idx, patch) => setRItens((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const salvarReceita = async () => {
    const nome = rNome.trim();
    if (!nome) return setSnack({ open: true, msg: "Informe o nome do produto/receita.", sev: "warning" });

    const itensOk = rItens
      .map((x) => {
        const qtdNum = parseNum(x.qtd);
        return { insumoId: x.insumoId, qtd: qtdNum, unidade: x.unidade };
      })
      .filter((x) => x.insumoId && x.qtd !== null && x.qtd > 0);

    if (!itensOk.length) return setSnack({ open: true, msg: "Adicione ao menos 1 insumo na receita.", sev: "warning" });

    const payload = { nome, itens: itensOk };

    try {
      if (editReceitaId) {
        const res = await api.patch(`/receitas/${editReceitaId}`, payload);
        const updated = normalizeReceita(res.data?.data || res.data || { id: editReceitaId, ...payload });
        setReceitas((prev) => prev.map((x) => (x.id === editReceitaId ? { ...x, ...updated } : x)));
        setSnack({ open: true, msg: "Receita atualizada!", sev: "success" });
      } else {
        const res = await api.post("/receitas", payload);
        const created = normalizeReceita(res.data?.data || res.data || payload);
        setReceitas((prev) => [...prev, created]);
        setSnack({ open: true, msg: "Receita criada!", sev: "success" });
      }

      setOpenReceita(false);
    } catch (err) {
      setSnack({ open: true, sev: "error", msg: pickApiMessage(err, "Falha ao salvar receita.") });
    }
  };

  const removerReceita = async (id) => {
    try {
      await api.delete(`/receitas/${id}`);
      setReceitas((prev) => prev.filter((x) => x.id !== id));
      setSnack({ open: true, msg: "Receita removida.", sev: "success" });
    } catch (err) {
      setSnack({ open: true, sev: "error", msg: pickApiMessage(err, "Falha ao remover receita.") });
    }
  };

  // ✅ SIMULAÇÃO (SEM debitar estoque)
  const simularReceita = (receitaId, qtd) => {
    const r = receitas.find((x) => x.id === receitaId);
    if (!r) return;

    const q = Math.max(0, Math.floor(Number(qtd || 0)));
    if (!q || q <= 0) {
      return setSnack({ open: true, sev: "warning", msg: "Informe uma quantidade > 0." });
    }

    for (const it of r.itens) {
      const ins = insumoMap.get(it.insumoId);
      if (!ins) continue;

      const consumoBase = toBase(it.qtd, it.unidade);
      const baseInsumo = baseFromUnidade(ins.unidadePadrao);

      if (consumoBase.base !== baseInsumo) {
        return setSnack({
          open: true,
          sev: "warning",
          msg: `Unidade incompatível na receita (${ins.nome}). Ajuste a unidade.`,
        });
      }

      const totalConsumo = consumoBase.value * q;
      if (ins.quantidadeBase - totalConsumo < 0) {
        return setSnack({
          open: true,
          sev: "warning",
          msg: `Para produzir ${q}x ${r.nome}, falta estoque de ${ins.nome}. Veja detalhes.`,
        });
      }
    }

    setSnack({
      open: true,
      sev: "success",
      msg: `Simulação: ${q}x ${r.nome}. (Não debita estoque)`,
    });
  };

  const openDetalhesReceita = (id, qtd) => {
    setDetalhesReceitaId(id);
    const n = Math.floor(Number(parseNum(qtd) || 0));
    if (n > 0) setDetalhesQtd(String(n));
    setOpenDetalhes(true);
  };

  const receitaDetalhes = useMemo(
    () => receitas.find((x) => x.id === detalhesReceitaId),
    [detalhesReceitaId, receitas]
  );

  // ✅ rows com custo
  const detalhesRows = useMemo(() => {
    if (!receitaDetalhes) return [];

    const q = Math.max(0, Math.floor(Number(parseNum(detalhesQtd) || 0)));
    const baseRows = calcConsumoPara(receitaDetalhes, insumoMap, q);

    return baseRows.map((row) => {
      const { ins, it, incompat, consumoTotalBase } = row;

      const consumoPorUnBase = incompat ? null : toBase(it.qtd, it.unidade).value;

      const costBase = Number(ins?.costBase || 0);
      const semCusto = !costBase || costBase <= 0;

      const custoPorUn =
        !incompat && !semCusto && consumoPorUnBase != null ? consumoPorUnBase * costBase : null;

      const custoTotal =
        !incompat && !semCusto && consumoTotalBase != null ? consumoTotalBase * costBase : null;

      return {
        ...row,
        consumoPorUnBase,
        semCusto,
        custoPorUn,
        custoTotal,
      };
    });
  }, [receitaDetalhes, insumoMap, detalhesQtd]);

  const resumoCustos = useMemo(() => {
    let total = 0;
    let semCustoCount = 0;
    let incompatCount = 0;

    for (const r of detalhesRows) {
      if (r.incompat) incompatCount += 1;
      if (r.semCusto && !r.incompat) semCustoCount += 1;
      if (typeof r.custoTotal === "number") total += r.custoTotal;
    }

    return { total, semCustoCount, incompatCount };
  }, [detalhesRows]);

  // ✅ custo por unidade (produto)
  const custoPorUnProduto = useMemo(() => {
    let sum = 0;
    let valid = 0;
    for (const r of detalhesRows) {
      if (typeof r.custoPorUn === "number") {
        sum += r.custoPorUn;
        valid += 1;
      }
    }
    return { value: sum, validCount: valid };
  }, [detalhesRows]);

  // ----------------------
  // RELATÓRIOS
  // ----------------------
  const [tabRel, setTabRel] = useState(0); // 0 produção, 1 compras, 2 alertas

  const receitasReport = useMemo(() => {
    const list = receitas.map((r) => ({ ...r, prod: calcProducaoMaxima(r, insumoMap) }));
    list.sort((a, b) => (a.prod?.max ?? 0) - (b.prod?.max ?? 0));
    return list;
  }, [receitas, insumoMap]);

  const insumosAbaixoMinimo = useMemo(
    () => insumos.filter((i) => i.quantidadeBase <= i.minimoBase).sort((a, b) => a.quantidadeBase - b.quantidadeBase),
    [insumos]
  );

  // meta por receita (para compras)
  const [metaPorReceita, setMetaPorReceita] = useState({});

  useEffect(() => {
    setMetaPorReceita((prev) => {
      const next = { ...prev };
      receitas.forEach((r) => {
        if (next[r.id] === undefined) next[r.id] = 100;
      });
      Object.keys(next).forEach((k) => {
        if (!receitas.some((r) => r.id === k)) delete next[k];
      });
      return next;
    });
  }, [receitas]);

  const comprasConsolidadas = useMemo(() => {
    return calcCompraConsolidada(receitas, insumoMap, metaPorReceita);
  }, [receitas, insumoMap, metaPorReceita]);

  // export handlers
  const exportCSVWithFallback = async (filename, csvText) => {
    const okDownload = await downloadCSV(filename, csvText);
    if (okDownload) {
      setSnack({ open: true, sev: "success", msg: `CSV exportado: ${filename}` });
      return;
    }
    const okCopy = await copyToClipboard(csvText);
    if (okCopy) {
      setSnack({ open: true, sev: "success", msg: "CSV copiado para a área de transferência." });
      return;
    }
    setSnack({ open: true, sev: "warning", msg: "Não foi possível exportar/copiar o CSV." });
  };

  const exportProducaoCSV = async () => {
    const rows = receitasReport.map((r) => {
      const prod = r.prod;
      const gargalo = prod?.motivo === "ok" ? prod?.gargalo?.insumo?.nome || "" : "";
      const motivo =
        prod?.motivo === "ok"
          ? "ok"
          : prod?.motivo === "unidade_incompativel"
          ? "unidade_incompativel"
          : prod?.motivo || "erro";

      return [r.nome, String(prod?.max ?? 0), gargalo, motivo];
    });

    const csv = buildCSV(["Receita", "ProduzAté(un)", "Gargalo", "Status"], rows);
    await exportCSVWithFallback("relatorio_producao.csv", csv);
  };

  const exportComprasConsolidadoCSV = async () => {
    const rows = comprasConsolidadas.map((x) => {
      const falta = fromBase(x.faltaBase, x.ins.unidadePadrao);
      return [x.ins.nome, x.ins.unidadePadrao, formatQtd(falta, x.ins.unidadePadrao)];
    });
    const csv = buildCSV(["Insumo", "Unidade", "FaltaComprar"], rows);
    await exportCSVWithFallback("relatorio_compras_consolidado.csv", csv);
  };

  const exportComprasPorReceitaCSV = async () => {
    const rows = [];
    for (const r of receitas) {
      const meta = metaPorReceita?.[r.id] ?? 0;
      const calc = calcConsumoPara(r, insumoMap, meta);

      for (const row of calc) {
        const { ins, incompat, faltaBase } = row;
        const faltaDisplay =
          incompat || faltaBase === null ? "" : formatQtd(fromBase(faltaBase, ins.unidadePadrao), ins.unidadePadrao);

        rows.push([
          r.nome,
          String(meta),
          ins.nome,
          ins.unidadePadrao,
          incompat ? "incompatível" : faltaBase > 0 ? faltaDisplay : "OK",
        ]);
      }
    }

    const csv = buildCSV(["Receita", "Meta(un)", "Insumo", "Unidade", "FaltaComprar"], rows);
    await exportCSVWithFallback("relatorio_compras_por_receita.csv", csv);
  };

  const exportAlertasCSV = async () => {
    const rows = insumosAbaixoMinimo.map((ins) => {
      const qtdMostrada = fromBase(ins.quantidadeBase, ins.unidadePadrao);
      const minMostrado = fromBase(ins.minimoBase, ins.unidadePadrao);
      return [
        ins.nome,
        ins.unidadePadrao,
        formatQtd(qtdMostrada, ins.unidadePadrao),
        formatQtd(minMostrado, ins.unidadePadrao),
        "abaixo_minimo",
      ];
    });

    const csv = buildCSV(["Insumo", "Unidade", "Disponivel", "Minimo", "Status"], rows);
    await exportCSVWithFallback("relatorio_alertas.csv", csv);
  };

  // Header CTA varia por tab
  const ctaRight = () => {
    if (tab === 0) {
      return (
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Button
            onClick={() => fetchAll(true)}
            variant="outlined"
            sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
            disabled={reloading}
            startIcon={<AssessmentOutlinedIcon />}
          >
            {reloading ? "Atualizando..." : "Atualizar"}
          </Button>

          <Button
            onClick={openNovoInsumo}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 2.2,
              px: 2,
              fontWeight: 800,
              textTransform: "none",
              background: brand.grad,
              boxShadow: "0 10px 18px rgba(255,59,138,0.18)",
            }}
          >
            Novo insumo
          </Button>
        </Stack>
      );
    }

    if (tab === 1) {
      return (
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Button
            onClick={() => fetchAll(true)}
            variant="outlined"
            sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
            disabled={reloading}
            startIcon={<AssessmentOutlinedIcon />}
          >
            {reloading ? "Atualizando..." : "Atualizar"}
          </Button>

          <Button
            onClick={openNovaReceita}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 2.2,
              px: 2,
              fontWeight: 800,
              textTransform: "none",
              background: brand.grad,
              boxShadow: "0 10px 18px rgba(255,59,138,0.18)",
            }}
          >
            Nova receita
          </Button>
        </Stack>
      );
    }

    return (
      <Button
        onClick={() => fetchAll(true)}
        variant="outlined"
        sx={{ borderRadius: 2.2, textTransform: "none", fontWeight: 900 }}
        disabled={reloading}
        startIcon={<AssessmentOutlinedIcon />}
      >
        {reloading ? "Atualizando..." : "Atualizar"}
      </Button>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          p: 2.5,
          mb: 2.5,
          background: brand.softGrad,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Estoque Avançado
            </Typography>
            <Typography sx={{ opacity: 0.7, mt: 0.3 }}>
              Insumos, receitas e relatórios de produção/compras.
            </Typography>
          </Box>

          <Stack direction="row" gap={1.2} flexWrap="wrap" alignItems="center">
            <TextField
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={tab === 0 ? "Buscar insumo..." : tab === 1 ? "Buscar receita..." : "Buscar..."}
              size="small"
              sx={{
                width: 300,
                bgcolor: "white",
                borderRadius: 2,
                "& fieldset": { border: "1px solid rgba(0,0,0,0.10)" },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            {ctaRight()}
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 800 },
              "& .MuiTabs-indicator": { height: 4, borderRadius: 99, background: brand.grad },
            }}
          >
            <Tab icon={<Inventory2Icon />} iconPosition="start" label="Insumos" />
            <Tab icon={<RestaurantMenuIcon />} iconPosition="start" label="Receitas" />
            <Tab icon={<AssessmentOutlinedIcon />} iconPosition="start" label="Relatórios" />
          </Tabs>
        </Box>
      </Paper>

      {/* ✅ TABS */}
      {tab === 0 && (
        <InsumosTab
          loading={loading}
          insumosFiltrados={insumosFiltrados}
          brand={brand}
          fromBase={fromBase}
          formatQtd={formatQtd}
          onEdit={openEditarInsumo}
          onRemove={removerInsumo}
        />
      )}

      {tab === 1 && (
        <ReceitasTab
          loading={loading}
          receitasFiltradas={receitasFiltradas}
          brand={brand}
          insumoMap={insumoMap}
          formatQtd={formatQtd}
          calcProducaoMaxima={calcProducaoMaxima}
          simQtyByReceita={simQtyByReceita}
          setSimQtyByReceita={setSimQtyByReceita}
          parseNum={parseNum}
          onOpenDetalhes={openDetalhesReceita} // ✅ aceita (id, qtd)
          onEdit={openEditarReceita}
          onRemove={removerReceita}
        />
      )}

      {tab === 2 && (
        <RelatoriosTab
          loading={loading}
          brand={brand}
          tabRel={tabRel}
          setTabRel={setTabRel}
          busca={busca}
          receitasReport={receitasReport}
          onOpenDetalhes={openDetalhesReceita}
          onSimularBaixa={simularReceita}
          receitas={receitas}
          metaPorReceita={metaPorReceita}
          setMetaPorReceita={setMetaPorReceita}
          comprasConsolidadas={comprasConsolidadas}
          fromBase={fromBase}
          formatQtd={formatQtd}
          parseNum={parseNum}
          calcConsumoPara={calcConsumoPara}
          insumoMap={insumoMap}
          insumosAbaixoMinimo={insumosAbaixoMinimo}
          exportProducaoCSV={exportProducaoCSV}
          exportComprasConsolidadoCSV={exportComprasConsolidadoCSV}
          exportComprasPorReceitaCSV={exportComprasPorReceitaCSV}
          exportAlertasCSV={exportAlertasCSV}
        />
      )}

      {/* ------------------ DIALOG INSUMO ------------------ */}
      <Dialog open={openInsumo} onClose={() => setOpenInsumo(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editInsumoId ? "Editar insumo" : "Novo insumo"}
          <IconButton onClick={() => setOpenInsumo(false)} sx={{ position: "absolute", right: 10, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack gap={2}>
            <TextField label="Nome do insumo" value={fNome} onChange={(e) => setFNome(e.target.value)} fullWidth />

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <FormControl fullWidth>
                <InputLabel>Unidade padrão</InputLabel>
                <Select value={fUnidade} label="Unidade padrão" onChange={(e) => setFUnidade(e.target.value)}>
                  {UNIDADES.map((u) => (
                    <MenuItem key={u.value} value={u.value}>
                      {u.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Quantidade atual"
                value={fQtd}
                onChange={(e) => setFQtd(sanitizeBRDecimalInput(e.target.value, { maxDecimals: 4 }))}
                inputMode="decimal"
                fullWidth
              />
              <TextField
                label="Estoque mínimo"
                value={fMin}
                onChange={(e) => setFMin(sanitizeBRDecimalInput(e.target.value, { maxDecimals: 4 }))}
                inputMode="decimal"
                fullWidth
              />
            </Stack>

            {/* ✅ CUSTO */}
            <Divider />
            <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Custo do insumo (opcional)</Typography>

            <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }}>
              <TextField
                label="Custo (R$)"
                value={fPreco}
                onChange={(e) => {
                  setFPreco(sanitizeBRDecimalInput(e.target.value, { maxDecimals: 2 }));
                  setAutoCostOn(false); // ✅ se mexeu manual, desliga auto cálculo
                }}
                inputMode="decimal"
                fullWidth
                placeholder="Ex: 39,90"
              />

              <FormControl sx={{ width: { xs: "100%", sm: 220 } }}>
                <InputLabel>Unidade do custo</InputLabel>
                <Select
                  value={fPrecoUnidade}
                  label="Unidade do custo"
                  onChange={(e) => setFPrecoUnidade(e.target.value)}
                  disabled={autoCostOn} // ✅ trava quando auto ligado
                >
                  {costUnitOptionsByUnidadePadrao(fUnidade).map((u) => (
                    <MenuItem key={u} value={u}>
                      {u === "kg" ? "kg" : u === "g" ? "g" : u === "l" ? "litro" : u === "ml" ? "ml" : "unidade"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* ✅ AUTO CÁLCULO (apenas kg/g/l/ml) */}
            {canAutoCost(fUnidade) && (
              <Paper
                elevation={0}
                sx={{
                  mt: 0.6,
                  p: 1.6,
                  borderRadius: 3,
                  bgcolor: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Stack gap={1.2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Calcular custo pela embalagem</Typography>

                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: 12, opacity: 0.75 }}>Auto</Typography>
                      <Switch checked={autoCostOn} onChange={(e) => setAutoCostOn(e.target.checked)} />
                    </Stack>
                  </Stack>

                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                    Exemplo: garrafão <b>20 L</b> por <b>R$ 6,00</b> ⇒ custo <b>R$ 0,30 / L</b>.
                  </Typography>

                  <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                    <TextField
                      label="Preço da embalagem (R$)"
                      value={packPrice}
                      onChange={(e) => setPackPrice(sanitizeBRDecimalInput(e.target.value, { maxDecimals: 2 }))}
                      inputMode="decimal"
                      fullWidth
                      disabled={!autoCostOn}
                      placeholder="Ex: 6,00"
                    />

                    <TextField
                      label="Quantidade da embalagem"
                      value={packQty}
                      onChange={(e) => setPackQty(sanitizeBRDecimalInput(e.target.value, { maxDecimals: 4 }))}
                      inputMode="decimal"
                      fullWidth
                      disabled={!autoCostOn}
                      placeholder={fUnidade === "kg" || fUnidade === "g" ? "Ex: 5" : "Ex: 20"}
                    />

                    <FormControl sx={{ width: { xs: "100%", sm: 180 } }} disabled={!autoCostOn}>
                      <InputLabel>Unidade</InputLabel>
                      <Select value={packUnit} label="Unidade" onChange={(e) => setPackUnit(e.target.value)}>
                        {fUnidade === "kg" || fUnidade === "g" ? (
                          <>
                            <MenuItem value="kg">kg</MenuItem>
                            <MenuItem value="g">g</MenuItem>
                          </>
                        ) : (
                          <>
                            <MenuItem value="l">litro</MenuItem>
                            <MenuItem value="ml">ml</MenuItem>
                          </>
                        )}
                      </Select>
                    </FormControl>
                  </Stack>

                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                    O custo será normalizado automaticamente para <b>R$ / {baseFromUnidade(fUnidade)}</b>.
                  </Typography>
                </Stack>
              </Paper>
            )}

            <Paper
              elevation={0}
              sx={{
                p: 1.6,
                borderRadius: 3,
                bgcolor: "rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                Dica: cadastre em <b>kg</b> e use na receita em <b>g</b> — o Movyo converte sozinho.
                <br />
                Custo: você pode informar por <b>kg</b> ou <b>g</b> (e por <b>l</b>/<b>ml</b>). O sistema normaliza pra custo por base.
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenInsumo(false)} sx={{ textTransform: "none", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button onClick={salvarInsumo} variant="contained" sx={{ textTransform: "none", fontWeight: 900, background: brand.grad }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------ DIALOG RECEITA ------------------ */}
      <Dialog open={openReceita} onClose={() => setOpenReceita(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editReceitaId ? "Editar receita" : "Nova receita"}
          <IconButton onClick={() => setOpenReceita(false)} sx={{ position: "absolute", right: 10, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack gap={2}>
            <TextField label="Nome do produto" value={rNome} onChange={(e) => setRNome(e.target.value)} fullWidth />

            <Paper
              elevation={0}
              sx={{
                p: 1.6,
                borderRadius: 3,
                bgcolor: "rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                Você define o consumo por unidade vendida. Ex: 1 coxinha consome 250g de trigo, 3 tomates e 150g de frango.
              </Typography>
            </Paper>

            <Stack gap={1.2}>
              {rItens.map((it, idx) => (
                <Paper
                  key={idx}
                  elevation={0}
                  sx={{
                    p: 1.6,
                    borderRadius: 3,
                    border: "1px solid rgba(0,0,0,0.06)",
                    bgcolor: "white",
                  }}
                >
                  <Stack direction={{ xs: "column", md: "row" }} gap={1.5} alignItems={{ md: "center" }}>
                    <FormControl fullWidth>
                      <InputLabel>Insumo</InputLabel>
                      <Select value={it.insumoId} label="Insumo" onChange={(e) => setLinha(idx, { insumoId: e.target.value })}>
                        {insumos.map((i) => (
                          <MenuItem key={i.id} value={i.id}>
                            {i.nome}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Quantidade"
                      value={it.qtd}
                      onChange={(e) => setLinha(idx, { qtd: sanitizeBRDecimalInput(e.target.value, { maxDecimals: 4 }) })}
                      inputMode="decimal"
                      sx={{ width: { xs: "100%", md: 180 } }}
                      placeholder="Ex: 0,16"
                    />

                    <FormControl sx={{ width: { xs: "100%", md: 180 } }}>
                      <InputLabel>Unidade</InputLabel>
                      <Select value={it.unidade} label="Unidade" onChange={(e) => setLinha(idx, { unidade: e.target.value })}>
                        {UNIDADES.map((u) => (
                          <MenuItem key={u.value} value={u.value}>
                            {u.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Tooltip title="Remover linha">
                      <span>
                        <IconButton onClick={() => rmLinhaReceita(idx)} disabled={rItens.length === 1}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Button onClick={addLinhaReceita} startIcon={<AddIcon />} sx={{ textTransform: "none", fontWeight: 900, alignSelf: "flex-start" }}>
              Adicionar insumo
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenReceita(false)} sx={{ textTransform: "none", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button onClick={salvarReceita} variant="contained" sx={{ textTransform: "none", fontWeight: 900, background: brand.grad }}>
            Salvar receita
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------ DIALOG DETALHES ------------------ */}
      <Dialog open={openDetalhes} onClose={() => setOpenDetalhes(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>
          Detalhes da receita
          <IconButton onClick={() => setOpenDetalhes(false)} sx={{ position: "absolute", right: 10, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {!receitaDetalhes ? (
            <Paper sx={{ p: 2, borderRadius: 3, opacity: 0.7 }}>Receita não encontrada.</Paper>
          ) : (
            <Stack gap={2}>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{receitaDetalhes.nome}</Typography>
                <Typography sx={{ opacity: 0.7, fontSize: 13, mt: 0.3 }}>
                  Visualize consumo total, faltas e custo estimado.
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} gap={1.2} alignItems={{ sm: "center" }}>
                <TextField
                  label="Simular produção (unidades)"
                  value={detalhesQtd}
                  onChange={(e) => setDetalhesQtd(sanitizeBRIntegerInput(e.target.value))}
                  inputMode="numeric"
                  size="small"
                  sx={{ width: 260, bgcolor: "white", borderRadius: 2 }}
                />
                <Button
                  onClick={() => simularReceita(receitaDetalhes.id, parseNum(detalhesQtd) || 0)}
                  variant="contained"
                  sx={{
                    borderRadius: 2.2,
                    textTransform: "none",
                    fontWeight: 900,
                    background: brand.grad,
                    boxShadow: "0 10px 18px rgba(255,59,138,0.18)",
                    alignSelf: { xs: "flex-start", sm: "auto" },
                  }}
                >
                  Simular
                </Button>

                <Stack sx={{ ml: { sm: "auto" } }} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                  <Typography sx={{ fontSize: 12, opacity: 0.65 }}>*Simulação não debita estoque.</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                    Custo / un: {formatBRL(custoPorUnProduto.value)}
                  </Typography>
                </Stack>
              </Stack>

              <Paper elevation={0} sx={{ borderRadius: 4, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900 }}>Insumo</TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Estoque atual
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Consumo total
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Falta comprar
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Custo / un
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900 }} align="right">
                        Custo total
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {detalhesRows.map((row) => {
                      const { ins, incompat, estoqueBase, consumoTotalBase, faltaBase, custoPorUn, custoTotal, semCusto } = row;

                      const estoqueDisplay = fromBase(estoqueBase, ins.unidadePadrao);
                      const consumoDisplay = incompat || consumoTotalBase === null ? null : fromBase(consumoTotalBase, ins.unidadePadrao);
                      const faltaDisplay = incompat || faltaBase === null ? null : fromBase(faltaBase, ins.unidadePadrao);

                      return (
                        <TableRow key={ins.id} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{ins.nome}</Typography>
                            <Typography sx={{ opacity: 0.65, fontSize: 12 }}>
                              Unidade padrão: <b>{ins.unidadePadrao}</b>
                              {semCusto && !incompat ? (
                                <span style={{ marginLeft: 8, fontWeight: 900, color: "#8a6d00" }}>• sem custo</span>
                              ) : null}
                            </Typography>
                          </TableCell>

                          <TableCell align="right">
                            <Typography sx={{ fontWeight: 900 }}>{formatQtd(estoqueDisplay, ins.unidadePadrao)}</Typography>
                          </TableCell>

                          <TableCell align="right">
                            {incompat ? (
                              <Chip label="Incompatível" sx={{ fontWeight: 900, bgcolor: "rgba(255,193,7,0.20)" }} />
                            ) : (
                              <Typography sx={{ fontWeight: 900 }}>{formatQtd(consumoDisplay, ins.unidadePadrao)}</Typography>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            {incompat ? (
                              <Typography sx={{ opacity: 0.65 }}>-</Typography>
                            ) : faltaBase > 0 ? (
                              <Chip
                                label={formatQtd(faltaDisplay, ins.unidadePadrao)}
                                sx={{ fontWeight: 900, bgcolor: "rgba(244,67,54,0.12)" }}
                              />
                            ) : (
                              <Chip label="OK" sx={{ fontWeight: 900, bgcolor: "rgba(0,0,0,0.06)" }} />
                            )}
                          </TableCell>

                          <TableCell align="right">
                            {incompat ? (
                              <Typography sx={{ opacity: 0.65 }}>-</Typography>
                            ) : semCusto ? (
                              <Chip label="—" sx={{ fontWeight: 900, bgcolor: "rgba(255,193,7,0.16)" }} />
                            ) : (
                              <Typography sx={{ fontWeight: 900 }}>{formatBRL(custoPorUn)}</Typography>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            {incompat ? (
                              <Typography sx={{ opacity: 0.65 }}>-</Typography>
                            ) : semCusto ? (
                              <Chip label="—" sx={{ fontWeight: 900, bgcolor: "rgba(255,193,7,0.16)" }} />
                            ) : (
                              <Typography sx={{ fontWeight: 900 }}>{formatBRL(custoTotal)}</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 1.6,
                  borderRadius: 3,
                  bgcolor: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Custo estimado da produção</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.75 }}>
                      Considera apenas insumos com custo cadastrado (costBase).
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 16 }}>{formatBRL(resumoCustos.total)}</Typography>

                    <Stack direction="row" gap={1} justifyContent={{ sm: "flex-end" }} flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {resumoCustos.semCustoCount > 0 && (
                        <Chip
                          icon={<WarningAmberRoundedIcon />}
                          label={`Sem custo: ${resumoCustos.semCustoCount}`}
                          sx={{ fontWeight: 900, bgcolor: "rgba(255,193,7,0.18)" }}
                        />
                      )}
                      {resumoCustos.incompatCount > 0 && (
                        <Chip
                          icon={<WarningAmberRoundedIcon />}
                          label={`Incompatível: ${resumoCustos.incompatCount}`}
                          sx={{ fontWeight: 900, bgcolor: "rgba(255,193,7,0.18)" }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>

                <Divider sx={{ my: 1.2 }} />

                <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                  *Regra do “Produz até X”: o Movyo calcula quanto dá para produzir por insumo e pega o menor valor (gargalo).
                </Typography>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDetalhes(false)} sx={{ textTransform: "none", fontWeight: 900 }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.sev} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
