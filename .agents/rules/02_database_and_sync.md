# Banco de Dados e Sincronização

## RxDB (Banco Local)
- Baseado no Dexie (IndexedDB).
- Definimos schemas restritos (`db/schemas/*.schema.ts`) com `additionalProperties: false`.
- **Campos obrigatórios em TODAS as tabelas**: `_deleted` (boolean), `updated_at` (number), `created_at` (number).

## Supabase (Banco Remoto)
- Usa PostgreSQL.
- Regras de Row Level Security (RLS) baseadas no `org_id` e no `auth.uid()`.
- O cliente nunca fala com o Supabase diretamente para tabelas sincronizadas, tudo passa pelo `/api/sync/route.ts`.

## Lógica de Sincronização (O Padrão Siga Cattle)
NÃO usamos o plugin de replicação nativo do RxDB com GraphQL. Construímos um handler customizado usando `createReplication` (`db/replication/base/createReplication.ts`).

### Fluxo (Pull)
1. RxDB envia um checkpoint (o último `updated_at` que recebeu).
2. Faz GET para `/api/sync?table=xyz&lastModified=...`
3. A API `/api/sync` filtra os dados no Supabase usando `server_updated_at` e pagina os resultados.
4. Os dados chegam na engine do RxDB, que os insere localmente. O checkpoint é atualizado para o `server_updated_at` da última linha recebida.

### Fluxo (Push)
1. RxDB detecta uma mudança local.
2. Chama o handler Push e manda um POST para `/api/sync` com a lista de documentos e qual tabela.
3. A API `/api/sync` descobre o `org_id` do usuário, injeta `org_id` e `device_id`, e faz um `.upsert()`.
4. Uma database trigger no Supabase (`lww_merge`) compara o `updated_at` do client contra o `updated_at` salvo no banco para resolver conflitos e atualiza o `server_updated_at`.

### Conflitos Comuns
- `RC_PULL` e `validationErrors`: Geralmente causados porque o RxDB bloqueia campos não declarados no schema, ou os tipos não batem (ex: mandar string "null" ao invés de null real).
