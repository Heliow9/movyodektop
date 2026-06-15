# Movyo Desktop 2.2.1

## Atualizador
- removido envio de `Authorization` vazio ao GitHub;
- suporte a `GH_TOKEN`/`MOVYO_UPDATE_TOKEN` somente por variável de ambiente;
- tratamento amigável de 401, 403, 404 e falhas de rede;
- erro técnico completo permanece apenas nos logs;
- verificação automática agora possui `catch`, evitando erro bruto na interface.

## Notificações
- título padronizado como `Movyo - Versão X.Y.Z`;
- mensagem de novo pedido padronizada;
- ícone oficial da Movyo nas notificações;
- AppUserModelID configurado no Windows;
- clique na notificação restaura e foca o aplicativo;
- deduplicação por pedido;
- notificação global mesmo fora da Home, com fallback pelo polling.

## Contadores de pedidos
- parser único para datas UTC, ISO sem `Z`, epoch, Mongo Extended JSON e formato brasileiro;
- correção do deslocamento de fuso horário;
- contador usa o início do estágio atual quando a API fornece o marco de Produção/Entrega;
- fallback seguro para criação do pedido/ObjectId;
- datas futuras ou inválidas não geram minutos negativos.
