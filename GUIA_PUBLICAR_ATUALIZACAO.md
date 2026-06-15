# Publicar atualização do Movyo Desktop

## Configuração atual

- Repositório: `Heliow9/movyodektop`
- Canal: GitHub Releases público
- Release: publicada automaticamente, não rascunho
- Token: usado somente na máquina de publicação

## Passos

1. Altere a versão no `package.json`.
2. Abra o PowerShell dentro da pasta do projeto.
3. Execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\publicar-atualizacao.ps1
```

4. Cole o token quando solicitado.
5. Aguarde a validação final da release e dos arquivos.

O script executa o build, publica e confirma a existência de:

- `latest.yml`
- `Movyo-Food-Setup-VERSAO.exe`
- `Movyo-Food-Setup-VERSAO.exe.blockmap`

## Teste correto após a correção 2.2.2

A versão 2.2.1 foi empacotada com o canal antigo marcado como privado. Instale manualmente a 2.2.2 uma única vez.

Depois:

1. mantenha a 2.2.2 instalada;
2. altere o projeto para 2.2.3;
3. publique a 2.2.3 com o script;
4. abra a 2.2.2;
5. acesse Diagnóstico e clique em `Verificar update`.

O esperado é detectar, baixar e instalar a 2.2.3 sem token no computador do restaurante.
