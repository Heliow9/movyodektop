// src/components/mesas/PrintableGridQRCodes.jsx
import React from "react";
import { QRCodeSVG } from "qrcode.react";

// Estilos por tamanho
const sizeStyles = {
  grande: { qrSize: 256, titleSize: "2.5rem" },
  medio: { qrSize: 180, titleSize: "2rem" },
  pequeno: { qrSize: 128, titleSize: "1.5rem" },
  mini: { qrSize: 90, titleSize: "1.2rem" },
  micro: { qrSize: 64, titleSize: "1rem" },
};

const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://seusite.com");

// Um componente simples que representa um único item na grade de impressão
function QRCodeItem({ mesa, url, size }) {
  const styles = sizeStyles[size] || sizeStyles.pequeno;

  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        color: "black",
        padding: "20px",
        border: "1px dashed #ccc",
        breakInside: "avoid", // evita cortar entre páginas
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1
        style={{
          fontWeight: "bold",
          margin: "10px 0",
          fontSize: styles.titleSize,
        }}
      >
        Mesa: {mesa.numero}
      </h1>

      <div style={{ padding: "5px", backgroundColor: "white" }}>
        <QRCodeSVG value={url} size={styles.qrSize} />
      </div>

      <p
        style={{
          marginTop: "8px",
          fontSize: "0.7rem",
          maxWidth: "100%",
          wordBreak: "break-all",
        }}
      >
        {url}
      </p>
    </div>
  );
}

// Componente principal que cria a grade
export default function PrintableGridQRCodes({
  mesas,
  size = "pequeno",
  restauranteSlug,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: "20px",
        padding: "20px",
      }}
    >
      {mesas.map((mesa) => {
        const url = restauranteSlug
          ? `${PUBLIC_BASE_URL}/pedido/${restauranteSlug}?mesa=${mesa.qrCodeIdentifier}`
          : `${PUBLIC_BASE_URL}/pedido/SLUG_NAO_DEFINIDO?mesa=${mesa.qrCodeIdentifier}`;

        return (
          <QRCodeItem
            key={mesa._id}
            mesa={mesa}
            url={url}
            size={size}
          />
        );
      })}
    </div>
  );
}
