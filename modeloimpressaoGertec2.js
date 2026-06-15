const printer = require("@thiagoelg/node-printer");
const iconv = require('iconv-lite');
const moment = require('moment');

const nomeImpressora = 'G250';

// ESC/POS
const ESC = '\x1B';
const LF = '\x0A';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const TEXT_NORMAL = ESC + '!' + '\x00';
const TEXT_DOUBLE = ESC + '!' + '\x30';
const CUT_PAPER = ESC + 'm';

// Função para alinhar item e preço
function formatarLinha(nome, valor) {
  const maxCol = 48;
  const nomeFormatado = nome.length > 30 ? nome.substring(0, 30) : nome;
  const espacos = maxCol - nomeFormatado.length - valor.length;
  return nomeFormatado + ' '.repeat(espacos > 0 ? espacos : 1) + valor + LF;
}

// Função para imprimir
function imprimirTexto(texto) {
  const buffer = iconv.encode(texto, 'win1252');
  printer.printDirect({
    data: buffer,
    printer: nomeImpressora,
    type: 'RAW',
    success: jobID => console.log(`✅ Impressão enviada. ID: ${jobID}`),
    error: err => console.error(`❌ Erro ao imprimir: ${err}`)
  });
}

// Texto do cupom
let texto = '';

texto += ALIGN_CENTER + TEXT_DOUBLE + 'RapiGO Delivery' + LF;
texto += TEXT_NORMAL + ALIGN_CENTER + 'PEDIDO #01234' + LF;
texto += ALIGN_CENTER + moment().format('DD/MM/YYYY HH:mm') + LF;
texto += '-'.repeat(48) + LF + LF;

texto += ALIGN_LEFT;
texto += 'Cliente: Maria Oliveira' + LF;
texto += 'Endereço: Av. Brasil, 500' + LF;
texto += 'Bairro: Boa Vista' + LF;
texto += 'Referência: Perto da padaria' + LF;
texto += '-'.repeat(48) + LF + LF;

texto += formatarLinha('2x Pastel Carne', 'R$ 12,00');
texto += formatarLinha('1x Guaraná Lata', 'R$ 5,00');
texto += formatarLinha('Taxa de entrega', 'R$ 3,00');
texto += LF;

texto += ALIGN_RIGHT + TEXT_DOUBLE + 'Total: R$ 20,00' + LF + LF;

texto += ALIGN_CENTER + TEXT_NORMAL;
texto += 'Acompanhe seu pedido pelo app!' + LF + LF;
texto += 'Obrigado pela preferência!' + LF + LF + LF + LF;

texto += CUT_PAPER;

imprimirTexto(texto);
