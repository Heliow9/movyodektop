# Ajustes Movyo Printer Service

Atualização focada apenas nos layouts de impressão.

## O que foi ajustado

- Impressão passa a aceitar e exibir forma de pagamento.
- Impressão passa a aceitar e exibir status do pagamento.
- Impressão passa a aceitar e exibir vendedor/garçom/atendente.
- Itens agora imprimem adicionais, complementos, opcionais, personalizações, sabores e observações quando enviados pelo Desktop.
- Mantida compatibilidade com os campos antigos do payload.

## Campos aceitos no payload

Pagamento:
- formaPagamento
- metodoPagamento
- tipoPagamento
- pagamento.forma
- pagamento.metodo
- pagamento.tipo

Status:
- statusPagamento
- pagamentoStatus
- pagamento.status

Vendedor:
- vendedor
- vendedorNome
- nomeVendedor
- garcom
- garcomNome
- nomeGarcom
- usuario
- usuarioNome
- criadoPor
- atendente

Itens:
- adicionais
- adicionaisSelecionados
- opcoes
- opcoesSelecionadas
- opcionais
- complementos
- complementosSelecionados
- personalizacoes
- modificadores
- extras
- sabores
- saboresSelecionados

## Importante

Não foram alterados eventos de socket nem porta do serviço. Continua usando `imprimir-pedido` em `127.0.0.1:9100`.
