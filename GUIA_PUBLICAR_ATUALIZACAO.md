# Como publicar uma atualização do Movyo Desktop

## 1. Altere a versão
No `package.json`, aumente a versão seguindo SemVer:
- correção: `2.2.0` → `2.2.1`
- nova funcionalidade: `2.2.0` → `2.3.0`
- mudança incompatível: `2.2.0` → `3.0.0`

## 2. Configure o GitHub
O `package.json` publica no repositório privado `Heliow9/movyodektop`.
Crie um token do GitHub com acesso ao repositório e, no PowerShell da máquina de build, execute:

```powershell
$env:GH_TOKEN="SEU_TOKEN_DO_GITHUB"
```

Não salve o token no `.env`, no Git ou dentro do instalador.

## 3. Instale e gere a versão

```powershell
npm install
npm run dist:publish
```

O Electron Builder cria o instalador em `release/` e publica a Release com `latest.yml` e os artefatos necessários ao `electron-updater`.

## 4. Atualização obrigatória
Na descrição/notas da Release do GitHub, inclua exatamente:

```text
[OBRIGATORIA]
```

O Desktop bloqueará a operação com uma tela de atualização até que a nova versão seja baixada e instalada. Use isso somente quando houver incompatibilidade crítica, correção de segurança ou alteração obrigatória da API.

## 5. Atualização normal
Sem `[OBRIGATORIA]`, o app baixa em segundo plano e mostra o botão **Reiniciar e atualizar**.

## 6. Teste antes de liberar
1. Instale a versão anterior em outro computador.
2. Publique a nova versão como Release.
3. Abra a versão anterior.
4. Confira em **Diagnóstico → Atualização**.
5. Valide download, reinício, versão e impressão.

## Observação sobre repositório privado
Aplicações distribuídas para clientes não devem depender de um token secreto embutido. Para produção, o recomendado é publicar os artefatos de atualização em um repositório público exclusivo para releases ou em um servidor/S3 com URL assinada. O código atual mantém compatibilidade com GitHub privado quando `GH_TOKEN` estiver disponível no ambiente apropriado.
