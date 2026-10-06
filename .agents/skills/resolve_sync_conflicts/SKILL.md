---
name: resolve-sync-conflicts
description: Guia de troubleshooting para falhas de replicação (RC_PULL e RC_PUSH) no RxDB.
---

# Skill: Resolver Erros de Sync (RC_PULL / RC_PUSH)

Sempre que o usuário reportar que a sincronização quebrou com mensagens como `🔴 [Sync] Replication error (RC_PULL): ... validationErrors`, execute os seguintes passos de investigação ANTES de alterar qualquer código de replicação de bobeira:

## Diagnóstico do Erro `RC_PULL` (Erro no Payload Recebido)
Este erro significa que os dados vindos de `/api/sync` não estão compatíveis com o schema `.schema.ts` local do RxDB. O RxDB (DevMode Plugin) rejeita o insert para proteger a base de dados.

1. **Inspecione a Propriedade Falha**: Leia o erro de validação (ex: `missingProperty: "rgn"` ou `must NOT have more than 10 characters`).
2. **Verifique o Schema Local**: Abra `src/db/schemas/<tabela>.schema.ts` e veja a definição exata desse campo. (ex: `{ type: 'string', maxLength: 10 }`).
3. **Verifique o Tipo Local**: Abra `src/types/<tabela>.type.ts` para confirmar os tipos base.
4. **Olhe a Rota `/api/sync/route.ts`**: Verifique a resposta GET. É 100% de certeza que o backend (Supabase) está enviando um dado bruto (como um UUID no lugar do RGN) ou que a função `cleanSupabaseDocument` não filtrou algum campo extra que não existe no RxDB schema. A rota de sync no backend **precisa tratar (JOIN) e sanitizar (DELETE)** as colunas para deixá-las idênticas ao schema do cliente RxDB antes de responder o HTTP.

## Diagnóstico do Erro `RC_PUSH` (Erro ao enviar dados)
Este erro significa que a chamada POST falhou no backend.

1. **Problemas de `animal_id` vs `rgn`**: Verifique se o POST `/api/sync/route.ts` tentou inserir um `rgn` no Supabase onde na verdade existia uma coluna `animal_id` (UUID). O payload do RxDB nunca vai ter o UUID, então a rota backend DEVE fazer a tradução fazendo lookup em Set<string> na tabela de animals.
2. **OnConflict (Upserts)**: Verifique se a primaryKey enviada no POST existe no banco. Lembre-se que algumas tabelas no Supabase usam `id` (UUID), mas no RxDB podem usar `event_id`. O mapa `SERVER_PK_OVERRIDE` na `route.ts` trata disso.

**Cuidado Final**:
Nunca modifique cegamente os `mapToSupabase` / `mapFromSupabase` nos arquivos `<tabela>.replication.ts` tentando consertar relações (ex: converter UUID para rgn ali). A engine de push/pull envia e recebe pacotes grandes, e o cliente não tem acesso eficiente ao mapeamento de UUIDs ali sem quebrar o offline mode. Conserte essas coisas **sempre no backend (Sync API)**.
