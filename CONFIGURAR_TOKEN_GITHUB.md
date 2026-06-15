# Token do GitHub — publicação das atualizações Movyo

O repositório de releases usado pelo aplicativo é:

- `https://github.com/Heliow9/movyodektop`
- visibilidade: **público**

Por isso, o token é necessário **somente na máquina que gera e publica a atualização**. Os computadores dos restaurantes não precisam e não devem receber token.

## Permissões do token

Crie um Fine-grained Personal Access Token com:

- Resource owner: `Heliow9`
- Repository access: `Only select repositories`
- Repositório: `movyodektop`
- Contents: `Read and write`
- Metadata: `Read`

## Publicar

Dentro da pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\publicar-atualizacao.ps1
```

O script solicita o token de forma oculta, publica a versão e valida se a release ficou pública com estes arquivos:

- `latest.yml`
- `Movyo-Food-Setup-VERSAO.exe`
- `Movyo-Food-Setup-VERSAO.exe.blockmap`

O token não deve ser colocado no `package.json`, `main.js`, `.env`, instalador ou nos computadores dos clientes.
