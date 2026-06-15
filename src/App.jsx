import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CssBaseline from "@mui/material/CssBaseline";
import Logo from "../src/assets/logo.png";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Whatsapp from "./pages/Whatsapp";
import Pedidos from "./pages/Pedidos";
import Produtos from "./pages/Produtos";
import Mesas from "./pages/Mesas";
import Frete from "./pages/Fretes";
import Garcons from "./pages/Garcons";
import Motoristas from "./pages/Motoristas";
import Configuracoes from "./pages/Configuracoes";
import Sidebar from "./components/SideBar";
import Estoque from "./pages/Estoque";
import Caixa from "./pages/Caixa";
import Diagnostico from "./pages/Diagnostico";
import UpdateManager from "./components/UpdateManager";
import AccessBlockedScreen from "./components/AccessBlockedScreen";
import { saveValidLicense, getOfflineGrace, clearLicenseCache } from "./utils/offlineLicense";
import { PedidosProvider } from "../src/contexts/PedidosContext";
import GlobalPedidosSync from "./components/GlobalPedidosSync";
import { ACCESS_BLOCK_EVENT, fetchMe } from "./services/api";
import {
  getAuthBlockMessageFromError,
  getRestauranteAccessBlockMessage,
  pickRestauranteFromPayload,
} from "./utils/licenseGuard";

const TOKEN_KEY = "_token";
const RESTAURANTE_ID_KEY = "_id";
const ACCESS_MESSAGE_KEY = "movyoAccessBlockMessage";
const ACCESS_VALIDATION_INTERVAL_MS = 60_000;

function getStoredAuth() {
  const token = String(localStorage.getItem(TOKEN_KEY) || "").trim();
  const restauranteId = String(localStorage.getItem(RESTAURANTE_ID_KEY) || "").trim();
  if (!token || !restauranteId) return null;
  return { token, restauranteId };
}

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(RESTAURANTE_ID_KEY);
  localStorage.removeItem("tokenRestaurante");
  localStorage.removeItem("token");
  localStorage.removeItem("restauranteToken");
}

async function clearElectronAuth() {
  try {
    await window.electron?.limparSessao?.();
  } catch (error) {
    console.warn("Não foi possível limpar a sessão do Electron:", error?.message || error);
  }
}

function restaurantFromMeResponse(payload) {
  return pickRestauranteFromPayload(payload) || (payload && typeof payload === "object" ? payload : null);
}

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error || "") };
  }

  componentDidCatch(error, info) {
    console.error("[Movyo] Erro de renderização na página:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4 }}>
          <h2>Não foi possível abrir esta tela.</h2>
          <p>{this.state.message || "Veja o console do DevTools para o erro completo."}</p>
          <button onClick={() => this.setState({ hasError: false, message: "" })}>
            Tentar novamente
          </button>
        </Box>
      );
    }
    return this.props.children;
  }
}

function Splash({ message = "Preparando seu painel..." }) {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      flexDirection="column"
      sx={{
        background:
          "radial-gradient(circle at 25% 15%, rgba(255,59,138,.18), transparent 28rem), radial-gradient(circle at 78% 5%, rgba(255,155,45,.22), transparent 26rem), linear-gradient(180deg, #fff8fc 0%, #f4f7fb 100%)",
        animation: "fadeIn 1s ease-in-out",
      }}
    >
      <img
        src={Logo}
        alt="Movyo"
        style={{
          width: 220,
          marginBottom: 20,
          opacity: 0,
          animation: "fadeLogo 1.4s ease forwards",
        }}
      />
      <Typography sx={{ mt: -1, mb: 2, fontWeight: 800, color: "#0f172a", letterSpacing: 0.2 }}>
        {message}
      </Typography>
      <Box
        sx={{
          width: 40,
          height: 40,
          border: "4px solid rgba(255,59,138,.16)",
          borderTop: "4px solid #ff3b8a",
          boxShadow: "0 12px 30px rgba(255,59,138,.18)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes fadeLogo { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </Box>
  );
}

function AuthRedirector({ authenticated }) {
  const location = useLocation();

  if (!authenticated && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  if (authenticated && (location.pathname === "/" || location.pathname === "/login")) {
    return <Navigate to="/dashboard" replace />;
  }

  return null;
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [blockedReason, setBlockedReason] = useState(() => sessionStorage.getItem(ACCESS_MESSAGE_KEY) || "");
  const [mostrandoSplash, setMostrandoSplash] = useState(true);
  const [splashMessage] = useState(
    () => sessionStorage.getItem("movyoTransitionMessage") || "Preparando seu painel..."
  );
  const validationInFlightRef = useRef(false);
  const logoutInFlightRef = useRef(false);

  const forceLogout = useCallback(async (message) => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    try {
      if (message) {
        const current=getStoredAuth();
        if(current){ sessionStorage.setItem('movyoBlockedToken',current.token); sessionStorage.setItem('movyoBlockedRestaurantId',current.restauranteId); }
        sessionStorage.setItem(ACCESS_MESSAGE_KEY, message); setBlockedReason(message);
      }
      clearStoredAuth();
      setAuth(null);
      await clearElectronAuth();

      if (window.location.hash !== "#/login") {
        window.location.hash = "#/login";
      }
    } finally {
      logoutInFlightRef.current = false;
    }
  }, []);

  const validateAccess = useCallback(
    async (authToValidate = getStoredAuth()) => {
      if (!authToValidate?.token || !authToValidate?.restauranteId) return false;
      if (validationInFlightRef.current) return true;

      validationInFlightRef.current = true;
      try {
        const response = await fetchMe(authToValidate.token);
        const restaurante = restaurantFromMeResponse(response?.data);
        const blockMessage = getRestauranteAccessBlockMessage(restaurante);

        if (blockMessage) {
          await forceLogout(blockMessage);
          return false;
        }

        saveValidLicense(restaurante);
        sessionStorage.removeItem(ACCESS_MESSAGE_KEY);
        setBlockedReason("");
        return true;
      } catch (error) {
        const blockMessage = getAuthBlockMessageFromError(error);
        if (blockMessage) {
          await forceLogout(blockMessage);
          return false;
        }

        // Falha temporária usa a última validação válida por um período controlado.
        const grace = getOfflineGrace();
        console.warn("Não foi possível validar a licença agora:", error?.message || error);
        if (grace.allowed) return true;
        setBlockedReason("Não foi possível validar a licença com o servidor por mais de 12 horas. Conecte este computador à internet e tente novamente.");
        return false;
      } finally {
        validationInFlightRef.current = false;
      }
    },
    [forceLogout]
  );

  useEffect(() => {
    let alive = true;

    const syncFromStorageOrElectron = async () => {
      try {
        let stored = getStoredAuth();

        // O localStorage é a sessão principal do renderer. O Electron serve como recuperação.
        if (!stored && window.electron?.obterSessao) {
          const sessao = await window.electron.obterSessao();
          if (sessao?.token && sessao?.restauranteId) {
            localStorage.setItem(TOKEN_KEY, sessao.token);
            localStorage.setItem(RESTAURANTE_ID_KEY, sessao.restauranteId);
            stored = { token: sessao.token, restauranteId: sessao.restauranteId };
          }
        }

        if (!alive) return;

        if (stored) {
          const allowed = await validateAccess(stored);
          if (!alive) return;
          setAuth(allowed ? getStoredAuth() : null);
        } else {
          setAuth(null);
          if (window.location.hash !== "#/login") window.location.hash = "#/login";
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
        if (!alive) return;
        clearStoredAuth();
        await clearElectronAuth();
        setAuth(null);
        if (window.location.hash !== "#/login") window.location.hash = "#/login";
      } finally {
        setTimeout(() => {
          if (!alive) return;
          sessionStorage.removeItem("movyoTransitionMessage");
          setMostrandoSplash(false);
        }, 650);
      }
    };

    syncFromStorageOrElectron();
    return () => {
      alive = false;
    };
  }, [validateAccess]);

  useEffect(() => {
    const checkToken = () => {
      const stored = getStoredAuth();
      setAuth(stored);
      if (!stored && window.location.hash !== "#/login") {
        window.location.hash = "#/login";
      }
    };

    window.addEventListener("storage", checkToken);
    window.addEventListener("movyo:auth-changed", checkToken);
    const timer = setInterval(checkToken, 1500);

    return () => {
      window.removeEventListener("storage", checkToken);
      window.removeEventListener("movyo:auth-changed", checkToken);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onAccessBlocked = (event) => {
      const message = event?.detail?.message;
      if (message) forceLogout(message);
    };

    window.addEventListener(ACCESS_BLOCK_EVENT, onAccessBlocked);
    return () => window.removeEventListener(ACCESS_BLOCK_EVENT, onAccessBlocked);
  }, [forceLogout]);

  useEffect(() => {
    if (!auth?.token || !auth?.restauranteId) return undefined;

    const runValidation = () => validateAccess(getStoredAuth());
    const onFocus = () => runValidation();
    const onOnline = () => runValidation();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") runValidation();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = setInterval(runValidation, ACCESS_VALIDATION_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(timer);
    };
  }, [auth?.restauranteId, auth?.token, validateAccess]);

  const authenticated = useMemo(
    () => Boolean(auth?.token && auth?.restauranteId),
    [auth]
  );

  if (mostrandoSplash) return <Splash message={splashMessage} />;

  if (blockedReason) {
    return <AccessBlockedScreen
      message={blockedReason}
      onRetry={async()=>{ let stored=getStoredAuth(); if(!stored){const token=sessionStorage.getItem('movyoBlockedToken');const restauranteId=sessionStorage.getItem('movyoBlockedRestaurantId');if(token&&restauranteId){localStorage.setItem(TOKEN_KEY,token);localStorage.setItem(RESTAURANTE_ID_KEY,restauranteId);stored={token,restauranteId};}} if(stored){ setMostrandoSplash(true); const ok=await validateAccess(stored); setMostrandoSplash(false); if(ok){sessionStorage.removeItem('movyoBlockedToken');sessionStorage.removeItem('movyoBlockedRestaurantId');setAuth(getStoredAuth());} } }}
      onLogout={async()=>{ sessionStorage.removeItem(ACCESS_MESSAGE_KEY); sessionStorage.removeItem('movyoBlockedToken'); sessionStorage.removeItem('movyoBlockedRestaurantId'); setBlockedReason(''); clearLicenseCache(); clearStoredAuth(); await clearElectronAuth(); window.location.hash='#/login'; }}
    />;
  }

  return (
    <PedidosProvider>
      <Router>
        <CssBaseline />
        <AuthRedirector authenticated={authenticated} />
        <GlobalPedidosSync authenticated={authenticated} />
        <Routes>
          <Route
            path="/login"
            element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />}
          />

          <Route
            path="/dashboard"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Home />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/whatsapp"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Whatsapp />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/pedidos"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Pedidos />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/produtos"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Produtos />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/estoque"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Estoque />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/caixa"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Caixa />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/mesas"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Mesas />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/fretes"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Frete />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/garcons"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Garcons />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/motoristas"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Motoristas />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/configuracoes"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary>
                    <Configuracoes />
                  </PageErrorBoundary>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/diagnostico"
            element={
              authenticated ? (
                <Layout>
                  <PageErrorBoundary><Diagnostico /></PageErrorBoundary>
                </Layout>
              ) : <Navigate to="/login" replace />
            }
          />

          <Route path="*" element={<Navigate to={authenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Router>
    </PedidosProvider>
  );
}

function Layout({ children }) {
  return (
    <Box className="movyo-app-shell">
      <Sidebar />
      <Box component="main" className="movyo-main">
        {children}
      </Box>
      <UpdateManager />
    </Box>
  );
}
