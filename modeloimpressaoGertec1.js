const printer = require("@thiagoelg/node-printer");
const iconv = require('iconv-lite');

// Nome da impressora (ajuste se necessário)
const nomeImpressora = 'G250'; // ou "Generic" / "MP-4200 TH"

// Função para enviar comando ESC/POS (Latin-1)
function imprimirTexto(texto) {
  const buffer = iconv.encode(texto, 'win1252'); // ou 'latin1'
  printer.printDirect({
    data: buffer,
    printer: nomeImpressora,
    type: 'RAW',
    success: jobID => console.log(`Impressão enviada com sucesso. ID: ${jobID}`),
    error: err => console.error(`Erro ao imprimir: ${err}`)
  });
}

// ESC/POS helpers
const ESC = '\x1B';
const LF = '\x0A';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const TEXT_NORMAL = ESC + '!' + '\x00';
const TEXT_DOUBLE = ESC + '!' + '\x30'; // tamanho expandido
const CUT_PAPER = ESC + 'm'; // G250 corta com ESC m

// Monta o texto formatado
let texto = '';

texto += ALIGN_CENTER + TEXT_DOUBLE + 'RapiGO - Pedido #001' + LF;
texto += TEXT_NORMAL + ALIGN_CENTER + 'Obrigado pela preferência!' + LF;
texto += '-'.repeat(32) + LF;

texto += ALIGN_LEFT;
texto += 'Cliente: José da Silva' + LF;
texto += 'Endereço: Rua Exemplo, 123' + LF;
texto += 'Bairro: Centro' + LF;
texto += '-'.repeat(32) + LF;

texto += '1x Coxinha           R$ 5,00' + LF;
texto += '1x Refrigerante      R$ 4,00' + LF;
texto += LF;

texto += ALIGN_RIGHT + TEXT_DOUBLE + 'Total: R$ 9,00' + LF + LF;

texto += ALIGN_CENTER + TEXT_NORMAL + 'Acompanhe seu pedido pelo app!' + LF + LF;

texto += CUT_PAPER;

// Envia para impressora
imprimirTexto(texto);
