const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

/**
 * Impressão padrão para comanda
 * @param {Object} pedido - Pedido com itens, total, cliente etc
 * @param {Object} opcoes - { tipo: 'usb' | 'ip', ip?: string }
 */
function imprimirComanda(pedido, opcoes = { tipo: 'usb' }) {
  let device;

  if (opcoes.tipo === 'usb') {
    device = new escpos.USB(); // USB padrão
  } else if (opcoes.tipo === 'ip' && opcoes.ip) {
    device = new escpos.Network(opcoes.ip); // IP da impressora
  } else {
    console.error('Tipo de impressora ou IP não fornecido corretamente');
    return;
  }

  const printer = new escpos.Printer(device);

  device.open(() => {
    printer
      .align('CT')
      .style('B')
      .size(1, 1)
      .text('RapiGO - COMANDA')
      .text(`Pedido #${pedido.numero}`)
      .text('------------------------')
      .align('LT');

    pedido.itens.forEach(item => {
      const valor = (item.preco * item.quantidade).toFixed(2);
      printer.text(`${item.quantidade}x ${item.nome} - R$ ${valor}`);
    });

    printer
      .text('------------------------')
      .text(`Total: R$ ${pedido.total.toFixed(2)}`)
      .cut()
      .close();
  });
}

module.exports = { imprimirComanda };
