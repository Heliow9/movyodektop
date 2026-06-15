import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Objeto que define os estilos para cada tamanho
const sizeStyles = {
  grande: {
    qrSize: 256,
    titleSize: '2.5rem',
    subtitleSize: '1.5rem',
  },
  medio: {
    qrSize: 180,
    titleSize: '2rem',
    subtitleSize: '1.2rem',
  },
  pequeno: {
    qrSize: 128,
    titleSize: '1.5rem',
    subtitleSize: '1rem',
  },
  mini: {
    qrSize: 90,
    titleSize: '1.2rem',
    subtitleSize: '0.8rem',
  },
  micro: {
    qrSize: 64,
    titleSize: '1rem',
    subtitleSize: '0.7rem',
  },
};

export default function PrintableQRCode({ mesa, url, size = 'grande' }) {
  // Pega os estilos corretos com base no tamanho, ou usa 'grande' como padrão
  const styles = sizeStyles[size] || sizeStyles.grande;

  return (
    <div style={{
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      color: 'black',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ fontWeight: 'bold', margin: '20px 0', fontSize: styles.titleSize }}>
        Mesa: {mesa.numero}
      </h1>
      <div style={{ margin: '20px 0', padding: '10px', backgroundColor: 'white' }}>
        <QRCodeSVG value={url} size={styles.qrSize} />
      </div>
      <h2 style={{ fontSize: styles.subtitleSize }}>
        Aponte a câmera do seu celular para o QR Code e faça seu pedido!
      </h2>
    </div>
  );
}