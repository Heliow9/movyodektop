// utils/calcularValorPedido.js

export const calcularValorItem = (item) => {
  let total = item.precoUnitario * item.quantidade;

  if (item.bordaSelecionada) {
    total += parseFloat(item.bordaSelecionada.preco || 0) * item.quantidade;
  }

  if (item.adicionalSelecionado) {
    total += parseFloat(item.adicionalSelecionado.preco || 0) * item.quantidade;
  }

  if (Array.isArray(item.complementosSelecionados)) {
    item.complementosSelecionados.forEach(c => {
      total += parseFloat(c.preco || 0) * item.quantidade;
    });
  }

  if (item.tiposExtrasSelecionados) {
    Object.values(item.tiposExtrasSelecionados).forEach(lista => {
      lista.forEach(extra => {
        total += parseFloat(extra?.preco || 0) * item.quantidade;
      });
    });
  }

  return total;
};

export const calcularValorTotalPedido = (itens) => {
  return itens.reduce((acc, item) => acc + calcularValorItem(item), 0);
};
