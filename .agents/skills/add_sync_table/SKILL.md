---
name: add-sync-table
description: Como adicionar uma nova tabela ao sistema local-first (RxDB + Supabase) do Siga Cattle.
---

# Skill: Adicionar Nova Tabela Sincronizada

Quando o usuário pedir para adicionar um novo recurso (ex: `feed_logs` ou `inseminations`), siga ESTRITAMENTE este workflow para garantir que o mecanismo Local-First e o Sync funcionem perfeitamente.

## Passo 1: O Tipo e o Schema RxDB
1. Crie a tipagem em `src/types/<tabela>.type.ts`. Lembre-se: se a tabela referenciar um animal, chame a variável local de `rgn` ou `animal_rgn` (string limit 10). O ID local do evento deve ser um UUID gerado pelo cliente.
2. Adicione `created_at` (number), `updated_at` (number) e `_deleted` (boolean).
3. Crie `src/db/schemas/<tabela>.schema.ts`. Use a formatação JSON Schema rigorosa do RxDB. Preencha `additionalProperties: false`.

## Passo 2: O Arquivo de Replicação
1. Crie `src/db/replication/<tabela>.replication.ts`.
2. Use o template `createReplication` vindo de `./base`.
3. Em `mapToSupabase`, traduza do formato RxDB para as colunas exatas do Supabase (remova `_deleted` se não existir no Supabase, mapeie os campos no `upsert`, etc).
4. Em `mapFromSupabase`, processe o que vem da `/api/sync`. Em geral, apenas `cleanSupabaseDocument(doc)` e converter para seu Type já basta. Não converta RGN aqui.

## Passo 3: Adicionar a tabela ao Cliente RxDB
1. Vá até `src/db/client.ts`.
2. Adicione sua collection no objeto `myDatabaseCollections`.
3. Na função `getDatabase`, você verá a chamada `await setupReplication(db)`. Entre em `setupReplication` (em `src/db/replication.ts`) e inicie sua nova replication na lista.

## Passo 4: Atualizar a `/api/sync/route.ts` (CRÍTICO)
Se a nova tabela usar chaves estrangeiras (FK) para animais no Supabase:
1. Adicione o nome da tabela ao `ALLOWED_TABLES`.
2. Adicione o nome da tabela à lista `needsJoin` no handler `GET`. E certifique-se de injetar e mapear `animals.rgn` corretamente, garantindo DELETAR o UUID da foreign key antes de enviar os dados (caso contrário o RxDB dará erro 422).
3. Adicione o nome da tabela à lista `needsLookup` no handler `POST`. Recupere o `id` (UUID) baseado no RGN para poder enviar pro Supabase.

## Passo 5: Banco de Dados Supabase (Não esquecer as triggers!)
Informe ao usuário que ele precisa rodar SQL no backend dele:
1. Criar a tabela.
2. Adicionar os campos técnicos: `org_id`, `device_id`, `server_updated_at`, `field_updated_at`.
3. Associar a trigger `lww_merge` à tabela recém criada, e a trigger de `soft_delete` se necessário.
4. Definir RLS (Row Level Security).
