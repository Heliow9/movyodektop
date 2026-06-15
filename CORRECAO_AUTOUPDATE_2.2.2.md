# Correção do auto-update — Movyo Food 2.2.2

## Causa do erro da versão 2.2.1

O repositório `Heliow9/movyodektop` é público, mas o pacote havia sido gerado com:

```json
"private": true
```

Isso fez o `electron-updater` usar o provedor de repositório privado e exigir `GH_TOKEN` também no computador do restaurante. Como o aplicativo normalmente é iniciado sem esse token, a consulta falhava.

Além disso, o `electron-builder` cria releases como rascunho por padrão. Releases em rascunho não são encontradas pelo auto-update.

## Ajustes aplicados

- versão atualizada para `2.2.2`;
- `build.publish.private` alterado para `false`;
- `build.publish.releaseType` definido como `release`;
- token mantido apenas no processo de publicação;
- consulta automática silenciosa em falhas temporárias;
- erro temporário passa a aparecer como `Temporariamente indisponível`, sem interromper o painel;
- tela Diagnóstico agora acompanha o estado do updater em tempo real;
- botão `Verificar update` atualiza a tela imediatamente;
- script de publicação valida se a release ficou pública e se contém todos os arquivos obrigatórios.

## Primeira migração

A versão 2.2.1 instalada ainda contém a configuração antiga dentro do `app-update.yml`. Portanto, instale manualmente a versão 2.2.2 uma única vez.

Depois disso, publique a versão 2.2.3 para testar a atualização automática de 2.2.2 para 2.2.3.
