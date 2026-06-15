# Token do GitHub para publicar atualizações da Movyo

## 1. Criar o token

1. Entre no GitHub e abra **Settings**.
2. Acesse **Developer settings → Personal access tokens → Fine-grained tokens**.
3. Clique em **Generate new token**.
4. Defina um nome, por exemplo: `Movyo Desktop Releases`.
5. Escolha uma expiração curta e renovável.
6. Em **Resource owner**, selecione a conta ou organização que possui o repositório.
7. Em **Repository access**, escolha **Only select repositories** e selecione `movyodektop`.
8. Em **Repository permissions**, conceda **Contents: Read and write**.
9. Gere o token e copie-o imediatamente.

Se o repositório pertencer a uma organização, o token pode precisar de aprovação do administrador.

## 2. Onde colocar

**Não coloque o token no `package.json`, no `main.js`, no `.env` enviado ao GitHub ou dentro do instalador.**

Na máquina usada para gerar/publicar a atualização, você pode usar o script seguro incluído no pacote. Ele solicita o token com a entrada oculta, valida o acesso e remove a variável ao terminar:

```powershell
powershell -ExecutionPolicy Bypass -File .\publicar-atualizacao.ps1
```

Também é possível configurar apenas na janela atual do PowerShell:

```powershell
$env:GH_TOKEN="github_pat_SEU_TOKEN_AQUI"
npm run dist:publish
```

A variável acima vale somente para a janela atual do PowerShell. Para salvar apenas no seu usuário do Windows:

```powershell
[Environment]::SetEnvironmentVariable(
  "GH_TOKEN",
  "github_pat_SEU_TOKEN_AQUI",
  "User"
)
```

Depois, feche e abra novamente o PowerShell. Para conferir sem exibir o token completo:

```powershell
if ($env:GH_TOKEN) { "GH_TOKEN configurado" } else { "GH_TOKEN ausente" }
```

## 3. Repositório privado e computadores dos clientes

O `electron-updater` exige `GH_TOKEN` também no computador que consulta uma release privada. Não distribua um token de escrita aos restaurantes. Para produção, prefira uma destas opções:

- repositório **público separado apenas para releases**, sem o código-fonte;
- servidor próprio, por exemplo `updates.movyo.delivery`, usando o provider `generic`.

O código desta versão não envia mais um cabeçalho `Authorization` vazio e transforma falhas do atualizador em mensagens seguras, sem despejar o erro técnico completo na tela.
