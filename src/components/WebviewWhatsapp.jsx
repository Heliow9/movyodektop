import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WebviewCtx = createContext(null);

export function useWhatsappWebview() {
  return useContext(WebviewCtx);
}

export default function WebviewHost() {
  const rootEl = document.getElementById("webview-root");
  const webviewRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // cria o <webview> apenas uma vez
  useEffect(() => {
    if (webviewRef.current) return;
    const wv = document.createElement("webview");

    wv.src = "https://web.whatsapp.com";
    wv.style.position = "fixed";
    wv.style.inset = "0";
    wv.style.width = "100vw";
    wv.style.height = "100vh";
    wv.style.display = "block";
    wv.style.zIndex = "1";
    wv.setAttribute("allowpopups", "true");
    wv.setAttribute("partition", "persist:whatsapp"); // mantém sessão
    wv.setAttribute(
      "webpreferences",
      "contextIsolation=false, nativeWindowOpen=true"
    );
    wv.setAttribute(
      "useragent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    );

    // eventos opcionais
    wv.addEventListener("dom-ready", () => {
      console.log("✅ WhatsApp Web pronto");
      // injeções opcionais aqui, se quiser
      // wv.executeJavaScript("console.log('hello from host')");
    });

    wv.addEventListener("did-fail-load", (e) => {
      console.error("❌ Falha no webview:", e.errorDescription);
    });

    rootEl.appendChild(wv);
    webviewRef.current = wv;

    return () => {
      // normalmente não desmontaremos o host, mas se desmontar a app:
      try {
        rootEl.removeChild(wv);
      } catch {}
      webviewRef.current = null;
    };
  }, [rootEl]);

  // alterna visibilidade sem desmontar
  useEffect(() => {
    const root = document.getElementById("webview-root");
    if (!root) return;
    if (visible) {
      root.style.pointerEvents = "auto";
      root.style.opacity = "1";
      root.style.visibility = "visible";
    } else {
      root.style.pointerEvents = "none";
      root.style.opacity = "0";
      root.style.visibility = "hidden";
    }
  }, [visible]);

  const api = useMemo(
    () => ({
      show: () => setVisible(true),
      hide: () => setVisible(false),
      getEl: () => webviewRef.current,
    }),
    []
  );

  // usamos portal só para manter um provider estável; não renderizamos nada visual no portal
  return createPortal(
    <WebviewCtx.Provider value={api} />,
    document.getElementById("webview-root")
  );
}
