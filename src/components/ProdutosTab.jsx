// ProdutosTab.jsx – Movyo turbinada (UI/UX) + vínculo Produto -> Receita (Estoque Avançado)
// ✅ PLUS: imagens favoritas no BACKEND, upload local e importação de URL para o servidor
// ✅ PLUS: switches Destaque, Impressão e Ativo na Vitrine
//
// Requer backend:
// - GET    /api/imagens/buscar?q=...        (busca somente favoritas)
// - POST   /api/imagens/importar-url        { url } copia imagem para /uploads/produtos
// - POST   /api/imagens/upload              multipart image
// - GET/POST/DELETE /api/imagens/favoritas
// - POST   /api/imagens/favoritas/sync      { urls: [] }

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

import {
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  IconButton,
  FormControlLabel,
  InputAdornment,
  Switch,
  CircularProgress,
  Tooltip,
  Stack,
  Tabs,
  Tab,
  Skeleton,
} from "@mui/material";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PrintIcon from "@mui/icons-material/Print";
import PrintDisabledIcon from "@mui/icons-material/PrintDisabled";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import axios from "axios";
import { attachAccessGuardInterceptor } from "../services/api";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CategoryIcon from "@mui/icons-material/Category";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import CloseIcon from "@mui/icons-material/Close";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import LinkIcon from "@mui/icons-material/Link";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StorefrontIcon from "@mui/icons-material/Storefront";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";
const MOCK_IMAGE =
  "https://cdn.pixabay.com/photo/2017/12/09/08/18/pizza-3007395_960_720.jpg";

// ---------- Auth token ----------
function getToken() {
  return localStorage.getItem("_token") || "";
}

// ---------- Estoque API (com token) ----------
const estoqueApi = axios.create({
  baseURL: `${API_URL}/api/estoque`,
  timeout: 20000,
});

attachAccessGuardInterceptor(estoqueApi);

estoqueApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Imagens API (com token) ----------
const imagensApi = axios.create({
  baseURL: `${API_URL}/api/imagens`,
  timeout: 20000,
});

attachAccessGuardInterceptor(imagensApi);

imagensApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Helpers ----------

function normalizeUrl(u) {
  return String(u || "").trim();
}

const KEYWORDS_NAO_IMPRIMIR = [
  "refrigerante", "refri", "coca", "guaraná", "fanta", "sprite", "água", "agua", "suco",
  "cerveja", "drink", "vinho", "energético", "energetico", "lata", "600ml", "1l", "2l",
  "cupom", "taxa", "frete", "entrega", "troco", "embalagem", "sacola", "guardanapo",
  "talher", "canudo", "gelo",
];

const KEYWORDS_IMPRIMIR = [
  "pizza", "hamburg", "hambúrg", "lanche", "sandu", "hot dog", "cachorro", "pastel", "coxinha",
  "esfiha", "açaí", "acai", "sushi", "temaki", "yakisoba", "prato", "marmita", "almoço", "almoco",
  "jantar", "combo", "porção", "porcao", "batata", "frango", "carne", "peixe", "massa", "macarr",
  "lasanha", "risoto", "salada", "sobremesa", "torta", "bolo", "brigadeiro", "pudim",
  "milk shake", "milkshake", "sorvete",
];

const SINAIS_COMIDA = ["com", "sem", "adicional", "borda", "sabor", "recheio"];


// -------- Impressão: sugestão inteligente --------
function sugerirImpressaoPorNome(nome) {
  const n = String(nome || "").toLowerCase().trim();
  if (!n) return { sugestao: true, motivo: "Sem nome: padrão como imprimir." };

  const tem = (arr) => arr.some((k) => n.includes(k));

  if (tem(KEYWORDS_NAO_IMPRIMIR)) {
    return { sugestao: false, motivo: "Parece bebida/serviço/acessório (geralmente não imprime)." };
  }
  if (tem(KEYWORDS_IMPRIMIR)) {
    return { sugestao: true, motivo: "Parece item de preparo (geralmente imprime na produção)." };
  }
  if (tem(SINAIS_COMIDA)) {
    return { sugestao: true, motivo: "Tem indícios de preparo/personalização (recomendado imprimir)." };
  }
  return { sugestao: true, motivo: "Não identificado — mantendo padrão como imprimir." };
}


function uniqUrls(urls) {
  const s = new Set();
  (urls || []).forEach((u) => {
    const nu = normalizeUrl(u);
    if (nu) s.add(nu);
  });
  return Array.from(s);
}

// ✅ Card de imagem reutilizável (favoritas/resultados)
function ImageCard({
  url,
  thumb,
  isFav,
  onSelect,
  onToggleFav,
  onRemoveFav,
  variant = "result", // "fav" | "result"
}) {
  const imgSrc = thumb || url;

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(148,163,184,0.35)",
        cursor: "pointer",
        bgcolor: "#f8fafc",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 25px rgba(2,6,23,0.06)" },
        WebkitAppRegion: "no-drag",
      }}
      onClick={onSelect}
      title="Clique para selecionar"
    >
      <Box
        component="img"
        src={imgSrc}
        alt="imagem"
        loading="lazy"
        sx={{
          width: "100%",
          height: 150,
          objectFit: "cover",
          display: "block",
          background: "#f1f5f9",
        }}
        onError={(e) => {
          e.currentTarget.src = MOCK_IMAGE;
        }}
      />

      <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 0.5 }}>
        {variant === "fav" ? (
          <Tooltip title="Remover dos favoritos">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFav?.();
              }}
              sx={{
                bgcolor: "rgba(255,255,255,0.92)",
                "&:hover": { bgcolor: "rgba(255,255,255,1)" },
                WebkitAppRegion: "no-drag",
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={isFav ? "Remover dos favoritos" : "Favoritar"}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav?.();
              }}
              sx={{
                bgcolor: "rgba(255,255,255,0.92)",
                "&:hover": { bgcolor: "rgba(255,255,255,1)" },
                WebkitAppRegion: "no-drag",
              }}
            >
              {isFav ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function ProdutosTab({ handleSnackbar }) {
  const restauranteId = localStorage.getItem("_id");

  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [produtoDestaqueId, setProdutoDestaqueId] = useState(null);
  const [impressaoUsuarioDefiniu, setImpressaoUsuarioDefiniu] = useState(false);

  const produtoRefs = useRef({});
  const formRef = useRef(null);

  // -------- Receitas (estoque avançado) --------
  const [receitas, setReceitas] = useState([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);

  const fetchReceitas = async () => {
    try {
      setLoadingReceitas(true);
      const res = await estoqueApi.get("/receitas");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];

      const norm = list
        .map((r) => ({
          id: String(r.id || r._id),
          nome: r.nome || "(sem nome)",
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setReceitas(norm);
    } catch (err) {
      console.error("Erro ao buscar receitas:", err);
      handleSnackbar?.("Erro ao carregar receitas do estoque", "error");
      setReceitas([]);
    } finally {
      setLoadingReceitas(false);
    }
  };

  const receitaById = useMemo(() => {
    const m = new Map();
    receitas.forEach((r) => m.set(String(r.id), r));
    return m;
  }, [receitas]);



  // -------- Produto Form --------
  const [produtoForm, setProdutoForm] = useState({
    nome: "",
    descricao: "",
    precoBase: "",
    imagem: "",
    categoria: "",
    sabores: [],
    bordas: [],
    adicionais: [],
    complementos: [],
    extras: {},
    receita: "",
    // ✅ NOVO
    destaque: false,
    // ✅ NOVO
    ativoVitrine: true,
    // ✅ NOVO
    imprimir: true,


  });

  const [tempInputs, setTempInputs] = useState({
    sabores: { nome: "", preco: "" },
    bordas: { nome: "", preco: "" },
    adicionais: { nome: "", preco: "" },
    complementos: { nome: "", preco: "" },
    extras: {},
  });

  const [produtoEditandoId, setProdutoEditandoId] = useState(null);
  const [categoriaErro, setCategoriaErro] = useState(false);

  // Filtros de UI
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [mostrarSomenteInativos, setMostrarSomenteInativos] = useState(false);

  // -------- Modal Imagens + Favoritas no BACKEND --------
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [imgQuery, setImgQuery] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState("");
  const [imgResults, setImgResults] = useState([]); // [{url, thumb}]
  const [favImages, setFavImages] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [imgTab, setImgTab] = useState(0); // 0 = Favoritas, 1 = Resultados
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [imgImporting, setImgImporting] = useState(false);
  const imgFileInputRef = useRef(null);

  const fetchFavoritas = async (silent = false) => {
    try {
      if (!silent) setFavLoading(true);
      const r = await imagensApi.get("/favoritas");
      const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setFavImages(uniqUrls(list));
    } catch (err) {
      console.error("Erro ao buscar favoritas:", err);
      setFavImages([]);
      handleSnackbar?.("Erro ao carregar favoritas", "error");
    } finally {
      if (!silent) setFavLoading(false);
    }
  };

  const addFavorita = async (url) => {
    const u = normalizeUrl(url);
    if (!u) return;
    try {
      await imagensApi.post("/favoritas", { url: u });
      setFavImages((prev) => uniqUrls([u, ...(prev || [])]));
    } catch (err) {
      console.error("Erro ao favoritar:", err);
      handleSnackbar?.("Erro ao favoritar imagem", "error");
    }
  };

  const removeFavorita = async (url) => {
    const u = normalizeUrl(url);
    if (!u) return;
    try {
      await imagensApi.delete("/favoritas", { data: { url: u } });
      setFavImages((prev) => (prev || []).filter((x) => normalizeUrl(x) !== u));
    } catch (err) {
      console.error("Erro ao remover favorita:", err);
      handleSnackbar?.("Erro ao remover favorita", "error");
    }
  };

  const isFav = (url) => {
    const u = normalizeUrl(url);
    return (favImages || []).some((x) => normalizeUrl(x) === u);
  };

  const syncFavoritasFromProdutos = async (listaProdutos) => {
    try {
      const urls = uniqUrls((listaProdutos || []).map((p) => p?.imagem).filter(Boolean));
      if (!urls.length) return;
      const r = await imagensApi.post("/favoritas/sync", { urls });
      const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setFavImages(uniqUrls(list));
    } catch (err) {
      console.warn("syncFavoritasFromProdutos falhou:", err);
    }
  };

  const openImageModal = async () => {
    setImgError("");
    setImgResults([]);
    setImgTab(0);
    setImgQuery(produtoForm?.nome ? String(produtoForm.nome).slice(0, 60) : "");
    setImgUrlInput("");
    setImgModalOpen(true);
    await fetchFavoritas(true);
  };

  const closeImageModal = () => {
    setImgModalOpen(false);
    setImgLoading(false);
    setImgError("");
  };

  const selectImage = async (url) => {
    const u = normalizeUrl(url);
    if (!u) return;

    setProdutoForm((prev) => ({ ...prev, imagem: u }));

    // ✅ vira favorita compartilhada
    await addFavorita(u);

    handleSnackbar?.("Imagem selecionada!", "success");
    closeImageModal();
  };

  const toggleFavFromAny = async (url) => {
    if (isFav(url)) await removeFavorita(url);
    else await addFavorita(url);
  };


  const isLocalUploadUrl = (url) => {
    const u = normalizeUrl(url);
    return !u || u.includes("/uploads/produtos/") || u.startsWith("/uploads/produtos/");
  };

  const importarImagemUrl = async (url, { selecionar = true } = {}) => {
    const u = normalizeUrl(url);
    if (!u) {
      handleSnackbar?.("Informe a URL da imagem.", "warning");
      return null;
    }
    try {
      setImgImporting(true);
      const res = await imagensApi.post("/importar-url", { url: u });
      const localUrl = normalizeUrl(res.data?.url || res.data?.data);
      if (!localUrl) throw new Error("URL local não retornada pelo servidor");
      setFavImages((prev) => uniqUrls([localUrl, ...(prev || [])]));
      if (selecionar) {
        setProdutoForm((prev) => ({ ...prev, imagem: localUrl }));
        handleSnackbar?.("Imagem copiada para o servidor e selecionada!", "success");
        closeImageModal();
      } else {
        handleSnackbar?.("Imagem copiada para o servidor!", "success");
      }
      return localUrl;
    } catch (err) {
      console.error("Erro ao importar imagem por URL:", err);
      handleSnackbar?.("Não foi possível copiar a imagem para o servidor.", "error");
      return null;
    } finally {
      setImgImporting(false);
    }
  };

  const uploadImagemProduto = async (file) => {
    if (!file) return null;
    try {
      setImgImporting(true);
      const form = new FormData();
      form.append("image", file);
      const res = await imagensApi.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const localUrl = normalizeUrl(res.data?.url || res.data?.data);
      if (!localUrl) throw new Error("URL local não retornada pelo servidor");
      setFavImages((prev) => uniqUrls([localUrl, ...(prev || [])]));
      setProdutoForm((prev) => ({ ...prev, imagem: localUrl }));
      handleSnackbar?.("Imagem enviada e selecionada!", "success");
      closeImageModal();
      return localUrl;
    } catch (err) {
      console.error("Erro ao enviar imagem:", err);
      handleSnackbar?.("Erro ao enviar imagem para o servidor.", "error");
      return null;
    } finally {
      setImgImporting(false);
      if (imgFileInputRef.current) imgFileInputRef.current.value = "";
    }
  };

  const prepararImagemProduto = async (imagem) => {
    const u = normalizeUrl(imagem);
    if (!u || u === MOCK_IMAGE || isLocalUploadUrl(u)) return u;
    // Se o usuário colou uma URL externa direto no campo, copia antes de salvar o produto.
    return (await importarImagemUrl(u, { selecionar: false })) || u;
  };

  const searchImages = async () => {
    const q = String(imgQuery || "").trim();
    // Busca somente nas imagens favoritas salvas no servidor.
    try {
      setImgTab(1);
      setImgLoading(true);
      setImgError("");

      const res = await imagensApi.get("/buscar", { params: { q } });
      const data = res.data;

      let list = [];
      if (Array.isArray(data)) {
        list = data.map((u) => ({ url: String(u), thumb: String(u) }));
      } else if (Array.isArray(data?.results)) {
        list = data.results
          .map((it) => ({
            url: String(it.url || it.image || it.src || ""),
            thumb: String(it.thumb || it.preview || it.url || it.image || ""),
          }))
          .filter((x) => x.url);
      } else if (Array.isArray(data?.data)) {
        list = data.data
          .map((it) => ({
            url: String(it.url || it.image || it.src || ""),
            thumb: String(it.thumb || it.preview || it.url || it.image || ""),
          }))
          .filter((x) => x.url);
      }

      const seen = new Set();
      const norm = [];
      for (const it of list) {
        const u = normalizeUrl(it.url);
        if (!u || seen.has(u)) continue;
        seen.add(u);
        norm.push({ url: u, thumb: normalizeUrl(it.thumb) || u });
      }

      setImgResults(norm);
      if (!norm.length) setImgError("Nenhuma favorita encontrada. Envie uma imagem ou copie uma URL para criar favoritas.");
    } catch (err) {
      console.error("Erro ao buscar imagens:", err);
      setImgResults([]);
      setImgError("Falha ao buscar favoritas no servidor.");
    } finally {
      setImgLoading(false);
    }
  };

  // -------- init --------
  useEffect(() => {
    fetchCategorias();
    fetchProdutos();
    fetchReceitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}



  const fetchCategorias = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/categorias/${restauranteId}`);
      setCategorias(res.data || []);
    } catch (e) {
      console.error("Erro ao buscar categorias:", e);
      handleSnackbar?.("Erro ao carregar categorias", "error");
      setCategorias([]);
    }
  };

  const fetchProdutos = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/produtos/${restauranteId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      const dataUnica = Array.from(new Map(data.map((p) => [String(p._id || p.id || p.nome), p])).values());
      const comImagem = dataUnica.map((p) => ({
        ...p,
        imagem: p.imagem || MOCK_IMAGE,
      }));
      setProdutos(comImagem);

      // ✅ sincroniza imagens usadas para virar favoritas no backend
      await syncFavoritasFromProdutos(comImagem);
    } catch (e) {
      console.error("Erro ao buscar produtos:", e);
      handleSnackbar?.("Erro ao carregar produtos", "error");
      setProdutos([]);
    }
  };

  const limparFormulario = () => {
    setProdutoForm({
      nome: "",
      descricao: "",
      precoBase: "",
      imagem: "",
      categoria: "",
      sabores: [],
      bordas: [],
      adicionais: [],
      complementos: [],
      extras: {},
      receita: "",
      // ✅ NOVO
      destaque: false,
      ativoVitrine: true,
      imprimir: true,

    });

    setTempInputs({
      sabores: { nome: "", preco: "" },
      bordas: { nome: "", preco: "" },
      adicionais: { nome: "", preco: "" },
      complementos: { nome: "", preco: "" },
      extras: {},
    });

    setProdutoEditandoId(null);
    setCategoriaErro(false);
    setImpressaoUsuarioDefiniu(false);
  };

  const handleCreateProduto = async () => {
    if (!produtoForm.nome || !produtoForm.categoria || produtoForm.categoria === "none") {
      setCategoriaErro(true);
      handleSnackbar?.("Por favor, selecione uma categoria válida.", "warning");
      return;
    }

    const precoBaseNumber = Number(String(produtoForm.precoBase || "").replace(",", "."));

    const imagemPreparada = await prepararImagemProduto(produtoForm.imagem || "");

    const payload = {
      ...produtoForm,
      precoBase: Number.isNaN(precoBaseNumber) ? 0 : precoBaseNumber,
      imagem: imagemPreparada || MOCK_IMAGE,
      restaurante: restauranteId,
      receita: produtoForm.receita ? produtoForm.receita : null,
      // ✅ garante boolean
      destaque: !!produtoForm.destaque,
      ativoVitrine: produtoForm.ativoVitrine !== false,
      imprimir: !!produtoForm.imprimir,
      imprimeNaCozinha: !!produtoForm.imprimir,

    };

    try {
      if (produtoEditandoId) {
        await axios.put(`${API_URL}/api/produtos/${produtoEditandoId}`, payload);
      } else {
        await axios.post(`${API_URL}/api/produtos`, payload);
      }

      // ✅ garante favorita no backend
      if (payload.imagem) await addFavorita(payload.imagem);

      limparFormulario();
      fetchProdutos();

      handleSnackbar?.(
        produtoEditandoId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!"
      );
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      handleSnackbar?.("Erro ao salvar produto", "error");
    }
  };

  const handleAddItem = (key, tipoExtra = null) => {
    if (tipoExtra) {
      const temp = tempInputs.extras[tipoExtra] || { nome: "", preco: "" };
      const precoFloat = Number(String(temp.preco || "").replace(",", "."));
      if (!temp.nome || Number.isNaN(precoFloat)) return;

      setProdutoForm((prev) => ({
        ...prev,
        extras: {
          ...prev.extras,
          [tipoExtra]: [...(prev.extras[tipoExtra] || []), { nome: temp.nome, preco: precoFloat }],
        },
      }));

      setTempInputs((prev) => ({
        ...prev,
        extras: {
          ...prev.extras,
          [tipoExtra]: { nome: "", preco: "" },
        },
      }));
    } else {
      const temp = tempInputs[key];
      const precoFloat = Number(String(temp.preco || "").replace(",", "."));
      if (!temp.nome || Number.isNaN(precoFloat)) return;

      setProdutoForm((prev) => ({
        ...prev,
        [key]: [...prev[key], { nome: temp.nome, preco: precoFloat }],
      }));

      setTempInputs((prev) => ({
        ...prev,
        [key]: { nome: "", preco: "" },
      }));
    }
  };

  const handleDuplicarProduto = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/api/produtos/duplicar/${id}`);
      const novoId = res.data?._id;
      setProdutoDestaqueId(novoId);
      await fetchProdutos();

      setTimeout(() => {
        const ref = produtoRefs.current[novoId];
        if (ref) ref.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);

      setTimeout(() => setProdutoDestaqueId(null), 4000);
      handleSnackbar?.("Produto duplicado!");
    } catch (err) {
      console.error("Erro ao duplicar produto:", err);
      handleSnackbar?.("Erro ao duplicar produto", "error");
    }
  };

  const handleRemoveItem = (key, index, tipoExtra = null) => {
    if (tipoExtra) {
      const novaLista = (produtoForm.extras[tipoExtra] || []).filter((_, i) => i !== index);
      setProdutoForm((prev) => ({
        ...prev,
        extras: { ...prev.extras, [tipoExtra]: novaLista },
      }));
    } else {
      const novaLista = produtoForm[key].filter((_, i) => i !== index);
      setProdutoForm((prev) => ({ ...prev, [key]: novaLista }));
    }
  };

  const moverProduto = (categoriaId, produtoId, direcao) => {
    const novaLista = [...produtos];
    const produtosDaCategoria = novaLista
      .filter((p) => (p.categoria?._id || p.categoria) === categoriaId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const index = produtosDaCategoria.findIndex((p) => p._id === produtoId);
    const destino = index + direcao;
    if (index < 0 || destino < 0 || destino >= produtosDaCategoria.length) return;

    [produtosDaCategoria[index], produtosDaCategoria[destino]] = [
      produtosDaCategoria[destino],
      produtosDaCategoria[index],
    ];

    produtosDaCategoria.forEach((p, i) => (p.ordem = i));

    const novaOrdemFinal = novaLista.map((p) => {
      const atualizado = produtosDaCategoria.find((px) => px._id === p._id);
      return atualizado || p;
    });

    setProdutos(novaOrdemFinal);

    const payload = produtosDaCategoria.map((p) => ({ _id: p._id, ordem: p.ordem }));

    handleSnackbar?.("Reordenando produtos…", "info");
    axios
      .put(`${API_URL}/api/produtos/ordem/reordenar`, { produtos: payload })
      .then(() => handleSnackbar?.("Ordem atualizada!"))
      .catch(() => handleSnackbar?.("Erro ao atualizar ordem", "error"));
  };

  const toggleProdutoAtivo = async (produtoId, estadoAtual) => {
    try {
      await axios.put(`${API_URL}/api/produtos/${produtoId}/${estadoAtual ? "desativar" : "ativar"}`);
      fetchProdutos();
      handleSnackbar?.(`Produto ${estadoAtual ? "desativado" : "ativado"}!`);
    } catch (err) {
      console.error("Erro ao ativar/desativar produto:", err);
      handleSnackbar?.("Erro ao alterar status do produto", "error");
    }
  };


  const toggleProdutoVitrine = async (produtoId, estadoAtual) => {
    try {
      await axios.put(`${API_URL}/api/produtos/${produtoId}/vitrine`, {
        ativoVitrine: !(estadoAtual !== false),
      });
      fetchProdutos();
      handleSnackbar?.(`Produto ${estadoAtual !== false ? "removido da vitrine" : "liberado na vitrine"}!`);
    } catch (err) {
      console.error("Erro ao alterar vitrine:", err);
      handleSnackbar?.("Erro ao alterar produto na vitrine", "error");
    }
  };

  const handleDeleteProduto = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      await axios.delete(`${API_URL}/api/produtos/${id}`);
      fetchProdutos();
      handleSnackbar?.("Produto excluído!");
    } catch (err) {
      console.error("Erro ao excluir produto:", err);
      handleSnackbar?.("Erro ao excluir produto", "error");
    }
  };
  const sugestaoImpressao = useMemo(() => {
    return sugerirImpressaoPorNome(produtoForm.nome);
  }, [produtoForm.nome]);

  useEffect(() => {
    if (!produtoForm.categoria) return;
    if (impressaoUsuarioDefiniu) return;

    const alvo = !!sugestaoImpressao.sugestao;

    // ✅ NÃO faz setState se já está igual
    if (produtoForm.imprimir === alvo) return;

    setProdutoForm((prev) => ({
      ...prev,
      imprimir: alvo,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestaoImpressao.sugestao, produtoForm.categoria, impressaoUsuarioDefiniu, produtoForm.imprimir]);



  const renderAdicionais = () => {
    const categoriaSelecionada = categorias.find((c) => c._id === produtoForm.categoria);
    if (!categoriaSelecionada) return null;



    const renderGrupo = (label, key) => (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography fontWeight={900}>{label}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Adicione opções e valores extras para o cliente escolher
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px solid rgba(148,163,184,0.35)",
            bgcolor: "rgba(2,6,23,0.02)",
          }}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nome"
                size="small"
                fullWidth
                value={tempInputs[key].nome}
                onChange={(e) =>
                  setTempInputs((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], nome: e.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Preço"
                size="small"
                fullWidth
                type="number"
                inputProps={{ step: "0.01", min: "0" }}
                value={tempInputs[key].preco}
                onChange={(e) =>
                  setTempInputs((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], preco: e.target.value },
                  }))
                }
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => handleAddItem(key)}
                sx={{ height: 40, textTransform: "none", fontWeight: 800, borderRadius: 2 }}
              >
                Adicionar
              </Button>
            </Grid>

            <Grid item xs={12}>
              {(produtoForm[key] || []).length ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {produtoForm[key].map((item, index) => (
                    <Chip
                      key={index}
                      label={`${item.nome} • R$ ${Number(item.preco || 0).toFixed(2)}`}
                      onDelete={() => handleRemoveItem(key, index)}
                      sx={{ maxWidth: "100%" }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Nenhum item adicionado ainda.
                </Typography>
              )}
            </Grid>
          </Grid>
        </Paper>
      </Box>
    );

    const getDescricaoTipoExtra = (extra) => {
      if (extra.tipoSelecion === "multiplo") {
        return `Múltiplas escolhas ${extra.obrigatorio ? `(mín. ${extra.minimoSelecionados}, ` : "("
          }máx. ${extra.maximoSelecionados})`;
      }
      return extra.obrigatorio ? "Escolha única (obrigatório)" : "Escolha única";
    };

    const renderExtras = () =>
      categoriaSelecionada.tiposExtras?.map((extra, idx) => (
        <Box key={idx} sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
            <Typography fontWeight={900}>
              {extra.nome}{" "}
              <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.8 }}>
                — {getDescricaoTipoExtra(extra)}
              </Typography>
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.35)",
              bgcolor: "rgba(2,6,23,0.02)",
            }}
          >
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nome"
                  size="small"
                  fullWidth
                  value={tempInputs.extras?.[extra.nome]?.nome || ""}
                  onChange={(e) =>
                    setTempInputs((prev) => ({
                      ...prev,
                      extras: {
                        ...prev.extras,
                        [extra.nome]: {
                          ...prev.extras?.[extra.nome],
                          nome: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Preço"
                  size="small"
                  fullWidth
                  type="number"
                  inputProps={{ step: "0.01", min: "0" }}
                  value={tempInputs.extras?.[extra.nome]?.preco || ""}
                  onChange={(e) =>
                    setTempInputs((prev) => ({
                      ...prev,
                      extras: {
                        ...prev.extras,
                        [extra.nome]: {
                          ...prev.extras?.[extra.nome],
                          preco: e.target.value,
                        },
                      },
                    }))
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddItem(null, extra.nome)}
                  sx={{ height: 40, textTransform: "none", fontWeight: 800, borderRadius: 2 }}
                >
                  Adicionar
                </Button>
              </Grid>

              <Grid item xs={12}>
                {(produtoForm.extras?.[extra.nome] || []).length ? (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {(produtoForm.extras?.[extra.nome] || []).map((item, index) => (
                      <Chip
                        key={index}
                        label={`${item.nome} • R$ ${Number(item.preco || 0).toFixed(2)}`}
                        onDelete={() => handleRemoveItem(null, index, extra.nome)}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nenhum item adicionado ainda.
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Box>
      ));

    return (
      <Box mt={3}>
        <Paper
          elevation={0}
          sx={{
            p: 1.6,
            borderRadius: 2,
            border: "1px solid rgba(148,163,184,0.35)",
            bgcolor: "rgba(15, 23, 42, 0.03)",
            mb: 2,
          }}
        >
          <StackReceitaVinculo
            produtoForm={produtoForm}
            setProdutoForm={setProdutoForm}
            receitas={receitas}
            loadingReceitas={loadingReceitas}
          />
        </Paper>

        {categoriaSelecionada.permiteSabores && renderGrupo("Sabores", "sabores")}
        {categoriaSelecionada.permiteBordas && renderGrupo("Bordas", "bordas")}
        {categoriaSelecionada.permiteAdicionais && renderGrupo("Adicionais", "adicionais")}
        {categoriaSelecionada.permiteComplementos && renderGrupo("Complementos", "complementos")}
        {renderExtras()}
      </Box>
    );
  };

  // -------- filtros --------
const filtroTextoDebounced = useDebouncedValue(filtroTexto, 180);

const produtosFiltrados = useMemo(() => {
  const texto = (filtroTextoDebounced || "").trim().toLowerCase();
  const cat = filtroCategoria;
  const onlyInativos = mostrarSomenteInativos;

  return (produtos || []).filter((p) => {
    const nome = (p.nome || "").toLowerCase();
    const desc = (p.descricao || "").toLowerCase();

    const matchTexto = !texto || nome.includes(texto) || desc.includes(texto);
    const matchCategoria = cat === "todas" || (p.categoria?._id || p.categoria) === cat;
    const matchStatus = onlyInativos ? p.ativo === false : true;

    return matchTexto && matchCategoria && matchStatus;
  });
}, [produtos, filtroTextoDebounced, filtroCategoria, mostrarSomenteInativos]);


const produtosPorCategoria = useMemo(() => {
  const map = new Map();
  (categorias || []).forEach((c) => map.set(String(c._id), []));
  (produtosFiltrados || []).forEach((p) => {
    const cid = String(p.categoria?._id || p.categoria || "");
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid).push(p);
  });
  // ordena por ordem dentro de cada categoria
  for (const [cid, arr] of map.entries()) {
    arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  return map;
}, [categorias, produtosFiltrados]);


  const nenhumaCategoriaComProdutos = categorias.every((cat) => {
    const produtosCat = produtosFiltrados.filter(
      (p) => (p.categoria?._id || p.categoria) === cat._id
    );
    return produtosCat.length === 0;
  });

  const categoriaSelecionada = categorias.find((c) => c._id === produtoForm.categoria);

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: "linear-gradient(180deg, rgba(248,250,252,0.95), #ffffff)",
      }}
    >
      {/* ---------- MODAL BUSCA DE IMAGENS + FAVORITAS (BACKEND) ---------- */}
      <Dialog
        open={imgModalOpen}
        onClose={closeImageModal}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: { WebkitAppRegion: "no-drag", borderRadius: 3, overflow: "hidden" },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            WebkitAppRegion: "no-drag",
            bgcolor: "rgba(2,6,23,0.02)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, WebkitAppRegion: "no-drag" }}>
            <ImageSearchIcon />
            <Box>
              <Typography fontWeight={900}>Imagens do restaurante</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Use favoritas, copie uma URL para o servidor ou envie um arquivo
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={closeImageModal} size="small" sx={{ WebkitAppRegion: "no-drag" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pb: 2, WebkitAppRegion: "no-drag" }}>
          {/* Favoritas, URL e upload */}
          <Grid container spacing={1.5} alignItems="center" sx={{ mb: 1, WebkitAppRegion: "no-drag" }}>
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth
                autoFocus
                size="small"
                label="Buscar nas favoritas"
                value={imgQuery}
                onChange={(e) => setImgQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchImages();
                  if (e.key === "Escape") closeImageModal();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                inputProps={{
                  style: { WebkitAppRegion: "no-drag" },
                  onMouseDown: (e) => e.stopPropagation(),
                  onClick: (e) => e.stopPropagation(),
                }}
                InputProps={{
                  sx: { WebkitAppRegion: "no-drag" },
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {!!imgQuery && (
                        <Tooltip title="Limpar">
                          <IconButton
                            size="small"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setImgQuery("");
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
                helperText="Dica: Enter para buscar • Esc para fechar"
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={searchImages}
                disabled={imgLoading || imgImporting}
                onMouseDown={(e) => e.stopPropagation()}
                sx={{
                  textTransform: "none",
                  fontWeight: 900,
                  borderRadius: 2,
                  height: 40,
                }}
                startIcon={imgLoading ? <CircularProgress size={16} /> : null}
              >
                {imgLoading ? "Buscando" : "Buscar favoritas"}
              </Button>
            </Grid>

            {/* Sugestões */}
            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {["pizza", "hambúrguer", "sushi", "açaí", "coxinha"].map((t) => (
                  <Chip
                    key={t}
                    size="small"
                    label={t}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setImgQuery(t);
                      setTimeout(searchImages, 0);
                    }}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={1.5} alignItems="center" sx={{ mt: 0.5, mb: 1.5 }}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                size="small"
                label="Copiar imagem de uma URL para o servidor"
                placeholder="Cole aqui a URL da imagem encontrada no Google"
                value={imgUrlInput}
                onChange={(e) => setImgUrlInput(e.target.value)}
                disabled={imgImporting}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => importarImagemUrl(imgUrlInput, { selecionar: true })}
                disabled={imgImporting || !normalizeUrl(imgUrlInput)}
                sx={{ height: 40, borderRadius: 2, fontWeight: 900, textTransform: "none" }}
              >
                {imgImporting ? <CircularProgress size={18} /> : "Copiar"}
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <input
                ref={imgFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => uploadImagemProduto(e.target.files?.[0])}
              />
              <Button
                fullWidth
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => imgFileInputRef.current?.click()}
                disabled={imgImporting}
                sx={{ height: 40, borderRadius: 2, fontWeight: 900, textTransform: "none" }}
              >
                Enviar
              </Button>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          {/* Tabs */}
          <Box sx={{ mb: 1 }}>
            <Tabs
              value={imgTab}
              onChange={(_, v) => setImgTab(v)}
              variant="fullWidth"
              sx={{
                borderRadius: 2,
                border: "1px solid rgba(148,163,184,0.35)",
                bgcolor: "rgba(2,6,23,0.02)",
                overflow: "hidden",
                "& .MuiTab-root": { textTransform: "none", fontWeight: 900 },
              }}
            >
              <Tab
                icon={<StarIcon fontSize="small" />}
                iconPosition="start"
                label={`Favoritas (${favImages?.length || 0})`}
              />
              <Tab
                icon={<ImageSearchIcon fontSize="small" />}
                iconPosition="start"
                label={`Busca nas favoritas (${imgResults?.length || 0})`}
              />
            </Tabs>
          </Box>

          {/* Conteúdo */}
          {imgTab === 0 ? (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography fontWeight={900}>Favoritas do restaurante</Typography>
                {favLoading && <CircularProgress size={16} />}
              </Box>

              {favImages?.length ? (
                <Box sx={{ maxHeight: 360, overflow: "auto", pr: 0.5 }}>
                  <Grid container spacing={1}>
                    {favImages.map((url) => (
                      <Grid item xs={6} sm={4} md={3} key={url}>
                        <ImageCard
                          url={url}
                          thumb={url}
                          isFav={true}
                          variant="fav"
                          onSelect={() => selectImage(url)}
                          onRemoveFav={() => removeFavorita(url)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px dashed rgba(148,163,184,0.6)",
                    color: "text.secondary",
                    bgcolor: "#f9fafb",
                  }}
                >
                  <Typography variant="body2">
                    Ainda não há favoritas. Quando você selecionar uma imagem, ela entra aqui para todos os usuários.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              <Typography fontWeight={900} sx={{ mb: 1 }}>
                Resultados da pesquisa
              </Typography>

              {imgError && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: 2,
                    borderRadius: 2,
                    border: "1px solid rgba(239,68,68,0.25)",
                    bgcolor: "rgba(239,68,68,0.06)",
                    color: "#b91c1c",
                  }}
                >
                  <Typography variant="body2">{imgError}</Typography>
                </Box>
              )}

              {imgLoading ? (
                <Grid container spacing={1}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Grid item xs={6} sm={4} md={3} key={i}>
                      <Skeleton variant="rounded" height={150} />
                    </Grid>
                  ))}
                </Grid>
              ) : imgResults?.length ? (
                <Box sx={{ maxHeight: 360, overflow: "auto", pr: 0.5 }}>
                  <Grid container spacing={1}>
                    {imgResults.map((it) => (
                      <Grid item xs={6} sm={4} md={3} key={it.url}>
                        <ImageCard
                          url={it.url}
                          thumb={it.thumb || it.url}
                          isFav={isFav(it.url)}
                          variant="result"
                          onSelect={() => selectImage(it.url)}
                          onToggleFav={() => toggleFavFromAny(it.url)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px dashed rgba(148,163,184,0.6)",
                    color: "text.secondary",
                    bgcolor: "#f9fafb",
                  }}
                >
                  <Typography variant="body2">Busque nas favoritas ou envie/copie uma imagem nova para o servidor.</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, WebkitAppRegion: "no-drag" }}>
          <Button
            onClick={async () => {
              await fetchFavoritas(true);
              closeImageModal();
            }}
            sx={{ textTransform: "none" }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- TOPO: título + mini resumo ---------- */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 1000 }}>
          Produtos
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Cadastre e organize seus produtos, vincule com receitas do estoque e personalize opções (sabores, bordas, adicionais e extras).
        </Typography>
      </Box>

      {/* ---------- FORMULÁRIO ---------- */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: "1px solid rgba(148,163,184,0.35)",
          bgcolor: "rgba(2,6,23,0.01)",
          mb: 2,
        }}
      >
        <Box ref={formRef} sx={{ mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 1000 }}>
                {produtoEditandoId ? "Editar produto" : "Cadastrar novo produto"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Dica: escolha a categoria primeiro para liberar campos e opções.
              </Typography>
            </Box>

            {(produtoEditandoId || produtoForm.nome || produtoForm.descricao || produtoForm.precoBase || produtoForm.imagem) && (
              <Tooltip title="Limpar formulário">
                <Button
                  startIcon={<RestartAltIcon />}
                  onClick={limparFormulario}
                  variant="text"
                  color="inherit"
                  sx={{ textTransform: "none", fontWeight: 900 }}
                >
                  Limpar
                </Button>
              </Tooltip>
            )}
          </Box>

          <Grid container spacing={2}>
            {/* Categoria */}
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth error={categoriaErro} size="small">
                <InputLabel id="categoria-label">Categoria</InputLabel>
                <Select
                  labelId="categoria-label"
                  label="Categoria"
                  value={produtoForm.categoria}
                  onChange={(e) => {
                    setProdutoForm({ ...produtoForm, categoria: e.target.value });
                    setCategoriaErro(false);
                  }}
                  startAdornment={
                    <InputAdornment position="start">
                      <CategoryIcon fontSize="small" />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="none">Selecione</MenuItem>
                  {categorias.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {cat.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!!categoriaSelecionada && (
                <Typography variant="caption" sx={{ display: "block", mt: 0.7, color: "text.secondary" }}>
                  Categoria: <b>{categoriaSelecionada.nome}</b>
                </Typography>
              )}
            </Grid>

            {/* Campos */}
            <Grid item xs={12} sm={9}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nome do produto"
                    size="small"
                    fullWidth
                    value={produtoForm.nome}
                    onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })}
                    disabled={!produtoForm.categoria}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Descrição"
                    size="small"
                    fullWidth
                    value={produtoForm.descricao}
                    onChange={(e) => setProdutoForm({ ...produtoForm, descricao: e.target.value })}
                    disabled={!produtoForm.categoria}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Preço base"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01", min: "0" }}
                    value={produtoForm.precoBase}
                    onChange={(e) => setProdutoForm({ ...produtoForm, precoBase: e.target.value })}
                    disabled={!produtoForm.categoria}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                    }}
                  />
                </Grid>

                {/* ✅ NOVO: Destaque */}
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      px: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(148,163,184,0.35)",
                      bgcolor: "rgba(2,6,23,0.02)",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={!!produtoForm.destaque}
                          onChange={(e) => setProdutoForm((prev) => ({ ...prev, destaque: e.target.checked }))}
                          disabled={!produtoForm.categoria}
                        />
                      }
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                          {produtoForm.destaque ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Destaque</Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </Paper>
                </Grid>

                {/* ✅ NOVO: Ativo na Vitrine */}
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      px: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(148,163,184,0.35)",
                      bgcolor: produtoForm.ativoVitrine === false ? "rgba(100,116,139,0.08)" : "rgba(34,197,94,0.08)",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={produtoForm.ativoVitrine !== false}
                          onChange={(e) => setProdutoForm((prev) => ({ ...prev, ativoVitrine: e.target.checked }))}
                          disabled={!produtoForm.categoria}
                        />
                      }
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                          <StorefrontIcon fontSize="small" />
                          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Vitrine</Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </Paper>
                </Grid>

                {/* ✅ NOVO: Impressão (com sugestão inteligente) */}
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      px: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(148,163,184,0.35)",
                      bgcolor: "rgba(2,6,23,0.02)",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={!!produtoForm.imprimir}
                          onChange={(e) => {
                            setImpressaoUsuarioDefiniu(true);
                            setProdutoForm((prev) => ({ ...prev, imprimir: e.target.checked }));
                          }}
                          disabled={!produtoForm.categoria}
                        />
                      }
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                          {produtoForm.imprimir ? <PrintIcon fontSize="small" /> : <PrintDisabledIcon fontSize="small" />}
                          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>Imprimir</Typography>
                          <Tooltip title={sugestaoImpressao.motivo}>
                            <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.65 }} />
                          </Tooltip>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </Paper>

                  <Typography variant="caption" sx={{ display: "block", mt: 0.7, color: "text.secondary" }}>
                    Sugestão: <b>{sugestaoImpressao.sugestao ? "Imprimir" : "Não imprimir"}</b> — {sugestaoImpressao.motivo}
                    {impressaoUsuarioDefiniu ? " (você decidiu manualmente)" : " (auto)"}.
                  </Typography>
                </Grid>


                {/* Imagem */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Imagem (URL)"
                    size="small"
                    fullWidth
                    value={produtoForm.imagem}
                    onChange={(e) => setProdutoForm({ ...produtoForm, imagem: e.target.value })}
                    disabled={!produtoForm.categoria}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="Buscar imagens e usar favoritas do restaurante">
                            <span>
                              <IconButton
                                onClick={openImageModal}
                                disabled={!produtoForm.categoria}
                                edge="end"
                                size="small"
                              >
                                <ImageSearchIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                    helperText="Clique na lupa para buscar imagens e gerenciar favoritas (compartilhado entre usuários)."
                  />
                </Grid>

                {/* Preview imagem */}
                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1.5,
                      alignItems: "center",
                      p: 1.2,
                      borderRadius: 2,
                      border: "1px solid rgba(148,163,184,0.35)",
                      bgcolor: "rgba(255,255,255,0.75)",
                    }}
                  >
                    <Box
                      component="img"
                      src={produtoForm.imagem || MOCK_IMAGE}
                      alt="preview"
                      onError={(e) => {
                        e.currentTarget.src = MOCK_IMAGE;
                      }}
                      sx={{
                        width: 92,
                        height: 58,
                        objectFit: "cover",
                        borderRadius: 1.5,
                        border: "1px solid rgba(148,163,184,0.35)",
                        flexShrink: 0,
                        background: "#f1f5f9",
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                          {produtoForm.nome || "Prévia do produto"}
                        </Typography>

                        {!!produtoForm.destaque && (
                          <Chip
                            size="small"
                            icon={<StarIcon sx={{ color: "#111827 !important" }} />}
                            label="Destaque"
                            sx={{
                              height: 20,
                              fontSize: "0.7rem",
                              borderRadius: 999,
                              bgcolor: "rgba(250,204,21,0.25)",
                              fontWeight: 1000,
                            }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {produtoForm.descricao || "A descrição aparece no cardápio."}
                      </Typography>
                    </Box>
                    <Box sx={{ ml: "auto" }}>
                      <Chip
                        size="small"
                        label={`R$ ${Number(String(produtoForm.precoBase || 0).replace(",", ".") || 0).toFixed(2)}`}
                        sx={{ fontWeight: 900 }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* Opções avançadas */}
            {produtoForm.categoria && (
              <Grid item xs={12}>
                {renderAdicionais()}
              </Grid>
            )}

            {/* Ações */}
            <Grid item xs={12}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  onClick={handleCreateProduto}
                  disabled={!produtoForm.categoria}
                  sx={{
                    textTransform: "none",
                    fontWeight: 900,
                    borderRadius: 999,
                    px: 3,
                    backgroundImage: produtoEditandoId
                      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                      : "linear-gradient(135deg, #ff3b8a, #ff9b2d)",
                  }}
                >
                  {produtoEditandoId ? "Salvar alterações" : "Cadastrar produto"}
                </Button>

                {produtoEditandoId && (
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={limparFormulario}
                    sx={{ textTransform: "none", fontWeight: 900 }}
                  >
                    Cancelar edição
                  </Button>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* ---------- FILTROS ---------- */}
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: 1.5,
          borderRadius: 3,
          border: "1px solid rgba(148,163,184,0.35)",
          backgroundColor: "#f9fafb",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <FilterAltIcon fontSize="small" />
          <Typography fontWeight={1000}>Filtros</Typography>
          <Box sx={{ ml: "auto" }}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<RestartAltIcon />}
              onClick={() => {
                setFiltroTexto("");
                setFiltroCategoria("todas");
                setMostrarSomenteInativos(false);
              }}
              sx={{ textTransform: "none", fontWeight: 900 }}
            >
              Reset
            </Button>
          </Box>
        </Box>

        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              size="small"
              fullWidth
              label="Buscar por nome ou descrição"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="filtro-cat-label">Categoria</InputLabel>
              <Select
                labelId="filtro-cat-label"
                label="Categoria"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <MenuItem value="todas">Todas</MenuItem>
                {categorias.map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={mostrarSomenteInativos}
                  onChange={(e) => setMostrarSomenteInativos(e.target.checked)}
                />
              }
              label="Somente inativos"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Mostrando <b>{produtosFiltrados.length}</b> produto(s)
        </Typography>
      </Paper>

      {/* ---------- LISTA ---------- */}
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 1000, mb: 1.5 }}>
        Produtos cadastrados
      </Typography>

      {nenhumaCategoriaComProdutos ? (
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px dashed rgba(148,163,184,0.6)",
            textAlign: "center",
            color: "text.secondary",
            backgroundColor: "#f9fafb",
          }}
        >
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Nenhum produto encontrado com os filtros atuais.
          </Typography>
          <Typography variant="caption">
            Ajuste os filtros ou cadastre um novo produto usando o formulário acima.
          </Typography>
        </Box>
      ) : (
        categorias.map((cat) => {
          const produtosCat = produtosFiltrados
            .filter((p) => (p.categoria?._id || p.categoria) === cat._id)
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

          if (!produtosCat.length) return null;

          return (
            <Accordion
              key={cat._id}
              sx={{
                mb: 1.5,
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid rgba(148,163,184,0.35)",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ bgcolor: "rgba(2,6,23,0.02)" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography fontWeight={1000}>{cat.nome}</Typography>
                  <Chip size="small" label={`${produtosCat.length}`} sx={{ fontWeight: 900 }} />
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <Grid container spacing={2}>
                  {produtosCat.map((prod) => {
                    const receitaId = String(prod?.receita?._id || prod?.receita || "");
                    const receitaNome = receitaId ? receitaById.get(receitaId)?.nome || "Receita vinculada" : null;

                    return (
                      <Grid item xs={12} md={6} key={prod._id}>
                        <Paper
                          ref={(el) => (produtoRefs.current[prod._id] = el)}
                          sx={{
                            p: 2,
                            display: "flex",
                            gap: 2,
                            alignItems: "flex-start",
                            borderRadius: 2.5,
                            border: "1px solid rgba(148,163,184,0.35)",
                            backgroundColor: prod._id === produtoDestaqueId ? "rgba(255, 249, 196, 0.8)" : "white",
                            transition: "background-color 0.5s ease, transform 0.12s ease",
                            "&:hover": { transform: "translateY(-1px)" },
                          }}
                        >
                          {/* Imagem + infos */}
                          <Box sx={{ width: 180, flexShrink: 0 }}>
                            <Box
                              component="img"
                              src={prod.imagem || MOCK_IMAGE}
                              sx={{
                                width: "100%",
                                height: 110,
                                objectFit: "cover",
                                borderRadius: 1.5,
                                mb: 1,
                                border: "1px solid rgba(148,163,184,0.35)",
                                background: "#f1f5f9",
                              }}
                              onError={(e) => {
                                e.currentTarget.src = MOCK_IMAGE;
                              }}
                            />

                            <Typography fontWeight={1000} sx={{ fontSize: "0.95rem", lineHeight: 1.2 }}>
                              {prod.nome}
                            </Typography>

                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                              R$ {Number(prod.precoBase || 0).toFixed(2)}
                            </Typography>

                            <Box sx={{ mt: 0.8, display: "flex", flexWrap: "wrap", gap: 0.6 }}>
                              <Chip
                                size="small"
                                label={prod.ativo === false ? "Inativo" : "Ativo"}
                                sx={{
                                  height: 20,
                                  fontSize: "0.7rem",
                                  borderRadius: 999,
                                  bgcolor: prod.ativo === false ? "#4b5563" : "#16a34a",
                                  color: "#fff",
                                  fontWeight: 900,
                                }}
                              />

                              <Chip
                                size="small"
                                label={prod.ativoVitrine === false ? "Fora da vitrine" : "Na vitrine"}
                                sx={{
                                  height: 22,
                                  fontWeight: 900,
                                  bgcolor: prod.ativoVitrine === false ? "#e5e7eb" : "#dcfce7",
                                  color: prod.ativoVitrine === false ? "#374151" : "#166534",
                                }}
                              />
                              {!!prod.destaque && (
                                <Chip
                                  size="small"
                                  icon={<StarIcon sx={{ color: "#111827 !important" }} />}
                                  label="Destaque"
                                  sx={{
                                    height: 20,
                                    fontSize: "0.7rem",
                                    borderRadius: 999,
                                    bgcolor: "rgba(250,204,21,0.25)",
                                    fontWeight: 1000,
                                  }}
                                />
                              )}

                              {!!receitaNome && (
                                <Tooltip title={`Vinculado ao estoque: ${receitaNome}`}>
                                  <Chip
                                    size="small"
                                    icon={<Inventory2OutlinedIcon sx={{ color: "#111827 !important" }} />}
                                    label="Receita"
                                    sx={{
                                      height: 20,
                                      fontSize: "0.7rem",
                                      borderRadius: 999,
                                      bgcolor: "rgba(255,59,138,0.10)",
                                      fontWeight: 1000,
                                    }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </Box>

                          {/* Conteúdo / ações */}
                          <Box flex={1} sx={{ minWidth: 0 }}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                mb: 1,
                              }}
                            >
                              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                                <Tooltip title="Mover para cima">
                                  <span>
                                    <IconButton size="small" onClick={() => moverProduto(cat._id, prod._id, -1)}>
                                      <ArrowUpwardIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Mover para baixo">
                                  <span>
                                    <IconButton size="small" onClick={() => moverProduto(cat._id, prod._id, 1)}>
                                      <ArrowDownwardIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Duplicar produto">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="secondary"
                                      onClick={() => handleDuplicarProduto(prod._id)}
                                    >
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Editar">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => {
                                        setProdutoEditandoId(prod._id);
                                        setProdutoForm({
                                          nome: prod.nome,
                                          descricao: prod.descricao || "",
                                          precoBase: prod.precoBase || "",
                                          imagem: prod.imagem || MOCK_IMAGE,
                                          categoria: prod.categoria?._id || prod.categoria,
                                          sabores: prod.sabores || [],
                                          bordas: prod.bordas || [],
                                          adicionais: prod.adicionais || [],
                                          complementos: prod.complementos || [],
                                          extras: prod.extras || {},
                                          receita: String(prod.receita?._id || prod.receita || ""),
                                          // ✅ NOVO: carregar flags no editar
                                          destaque: !!prod.destaque,
                                          ativoVitrine: prod.ativoVitrine !== false,
                                          imprimir: prod.imprimeNaCozinha !== false && prod.imprimir !== false,
                                        });

                                        setTimeout(() => {
                                          formRef.current?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          });
                                        }, 100);
                                      }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Excluir">
                                  <span>
                                    <IconButton size="small" color="error" onClick={() => handleDeleteProduto(prod._id)}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>

                              <FormControlLabel
                                control={
                                  <Switch
                                    size="small"
                                    checked={prod.ativo !== false}
                                    onChange={() => toggleProdutoAtivo(prod._id, prod.ativo)}
                                  />
                                }
                                label={prod.ativo === false ? "Inativo" : "Ativo"}
                                sx={{ ml: 1 }}
                              />
                              <FormControlLabel
                                control={
                                  <Switch
                                    size="small"
                                    checked={prod.ativoVitrine !== false}
                                    onChange={() => toggleProdutoVitrine(prod._id, prod.ativoVitrine)}
                                  />
                                }
                                label={prod.ativoVitrine === false ? "Fora da vitrine" : "Vitrine"}
                                sx={{ ml: 1 }}
                              />
                            </Box>

                            <Typography
                              variant="body2"
                              sx={{
                                color: prod.descricao ? "text.primary" : "text.secondary",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {prod.descricao || "Sem descrição"}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
    </Paper>
  );
}

// ---- componente interno simples pra manter o JSX organizado ----
function StackReceitaVinculo({ produtoForm, setProdutoForm, receitas, loadingReceitas }) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}>
        <Inventory2OutlinedIcon fontSize="small" />
        <Typography sx={{ fontWeight: 1000 }}>Vínculo com Estoque (Receita)</Typography>
        {loadingReceitas && <CircularProgress size={16} />}
      </Box>

      <Typography sx={{ fontSize: 12, opacity: 0.75, mb: 1.2 }}>
        Selecione uma receita para o produto baixar automaticamente os insumos após a confirmação do pedido.
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel id="receita-label">Receita (estoque)</InputLabel>
        <Select
          labelId="receita-label"
          label="Receita (estoque)"
          value={produtoForm.receita || ""}
          onChange={(e) => setProdutoForm((prev) => ({ ...prev, receita: e.target.value }))}
          startAdornment={
            <InputAdornment position="start">
              <Inventory2OutlinedIcon fontSize="small" />
            </InputAdornment>
          }
        >
          <MenuItem value="">
            <em>Sem receita (não baixa estoque)</em>
          </MenuItem>

          {loadingReceitas ? (
            <MenuItem value="" disabled>
              Carregando receitas...
            </MenuItem>
          ) : (
            receitas.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.nome}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
    </Box>
  );
}
