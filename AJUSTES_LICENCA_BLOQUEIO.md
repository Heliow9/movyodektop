# Movyo Desktop 2.1.3 — licença, bloqueio e instância única

## Proteção de acesso adicionada

- Validação do restaurante imediatamente após o login.
- Validação da sessão salva antes de abrir o dashboard.
- Nova validação a cada 60 segundos.
- Nova validação ao restaurar/focar o aplicativo, voltar à aba ou recuperar a internet.
- Interceptação das respostas da API que informem bloqueio ou licença vencida.
- Limpeza conjunta do `localStorage` e da sessão persistida no Electron.
- Retorno automático ao login com mensagem específica:
  - `Restaurante bloqueado. Entre em contato com o suporte Movyo.`
  - `Licença vencida. Regularize o plano para continuar usando o Movyo.`
- Falhas comuns de internet ou indisponibilidade do servidor não são interpretadas como vencimento.
- `Token expirado` não é interpretado incorretamente como `licença expirada`.

## Instância única

O `main.js` mantém `app.requestSingleInstanceLock()`. Ao tentar abrir o Movyo novamente, a segunda inicialização é encerrada e a janela existente é restaurada e focada.

## Arquivos principais alterados

- `main.js`
- `src/App.jsx`
- `src/pages/Login.jsx`
- `src/services/api.js`
- `src/utils/licenseGuard.js`
- `src/utils/licenseInfo.js`
- `src/components/ProdutosTab.jsx`
- `src/pages/Estoque.jsx`
- `src/pages/Garcons.jsx`
