# Schemas, Models e Mapeamento

O maior ponto de falha do Siga Cattle é o desalinhamento entre como o banco local RxDB enxerga os dados e como o backend Supabase enxerga.

## A Regra de Ouro do RGN (CRÍTICA!)
A tabela `animals` e todas as entidades relacionadas (`sales`, `deaths`, `reproduction_events`, `animal_vaccines`, `metrics`, etc.) usam identificações diferentes no RxDB e no Supabase:

1. **No RxDB (Client)**: 
   - A Primary Key da tabela `animals` é `rgn` (string curta legível por humanos, no máximo 10 chars, ex: "BR1234").
   - Outras tabelas referenciam isso como `rgn` ou `animal_rgn`. NENHUM UUID é trafegado para o RxDB para referenciar o animal.

2. **No Supabase (Server)**:
   - A Primary Key da tabela `animals` é `id` (UUID gerado pelo Postgres).
   - As tabelas relacionadas usam chaves estrangeiras (FK) chamadas `animal_id`, referenciando o `id` do animal. O Supabase NÃO usa o `rgn` como chave relacional.

## Como as peças se encaixam (`/api/sync/route.ts`)
A ponte que traduz RGN <-> UUID fica inteiramente contida no backend (`src/app/api/sync/route.ts`). O cliente e os schemas locais NUNCA veem UUIDs de animais.

- **GET (Pull)**: A API do Next.js faz um JOIN com a tabela `animals` no Postgres, extrai a string `rgn`, insere-a no payload sob as chaves `rgn` ou `animal_rgn` (dependendo do que o RxDB espera), e **deleta** o UUID `animal_id` do payload antes de enviar para o cliente, pois o RxDB (com `additionalProperties: false`) daria erro `RC_PULL`.
- **POST (Push)**: A API do Next.js recebe documentos do cliente, lê o campo `rgn` ou `animal_rgn`, faz um lookup `SELECT id FROM animals WHERE rgn = ...`, converte de volta para `animal_id` (UUID), deleta o RGN falso e faz o `upsert` no Supabase.

### Tabelas Especiais: Movements
O schema RxDB de `movements` surpreendentemente tem um campo chamado `animal_id`, mas que **armazena a string curta do RGN**, não um UUID. A tradução na API de Sync precisa ser cuidadosa: sobrescreve o `animal_id` (UUID do Postgres) com o `animals.rgn` do JOIN na leitura, e faz a tradução reversa na escrita.

### Tabelas Especiais: Exchanges
A tabela de troca de animais no Supabase não usa chaves relacionais (FK) para animais. Os RGNs são salvos diretamente em texto puro: `animal_rgn`, `traded_animal_rgn`, `substitute_animal_rgn`. Devido a isso, a sincronização de `exchanges` NÃO faz JOINs com a tabela animals no `/api/sync/route.ts`.
