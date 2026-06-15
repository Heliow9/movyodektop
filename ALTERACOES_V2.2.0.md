# Movyo Desktop 2.2.0

- licença e bloqueio validados no login, sessão, foco e chamadas da API;
- tolerância offline controlada por 12 horas após a última validação válida;
- tela profissional para bloqueio, vencimento e validação indisponível;
- atualização automática com progresso, instalação e modo obrigatório;
- reconexão infinita do Socket com recuperação dos pedidos pela API;
- fila persistente de impressão, tentativas exponenciais e reprocessamento;
- central de diagnóstico com API, Socket, licença, impressoras, versão, logs e fila;
- permissões persistidas por operador de caixa;
- autenticação automática nas chamadas Axios;
- instância única do Electron mantida.
- relatórios financeiros refinados: somente vendas confirmadas entram no faturamento, ticket, pagamentos, origem, produtos e horários de pico;
- exportação XLSX identifica venda confirmada e data financeira.
