# Siga Cattle: Architecture Overview

## Contexto de Negócio
O Siga Cattle é um sistema de gerenciamento de gado de corte. O foco é coletar e gerenciar dados de animais, pesagens, reprodução, vacinas, mortes e vendas no campo.

## Paradigma Local-First (Offline-First)
- **Regra de Ouro**: O aplicativo foi construído para funcionar 100% offline em fazendas sem internet.
- **Leitura/Escrita**: Todo o código da aplicação (UI, Hooks, Formulários) lê e escreve exclusivamente no **banco de dados local RxDB**.
- NUNCA faça requisições diretas ao Supabase REST/GraphQL dentro dos componentes React, exceto para autenticação ou operações de sync. O Supabase é tratado apenas como um backup/repositório remoto.

## Stack Tecnológico
- **Framework**: Next.js (App Router) + React.
- **Linguagem**: TypeScript (Strict mode).
- **Banco de Dados Local**: RxDB (Dexie).
- **Backend/Autenticação**: Supabase (PostgreSQL).
- **PWA**: Configurado com Service Workers para cache de assets e acesso offline.

## Arquitetura de Autenticação
- Usamos Supabase Auth.
- Os tokens (session) são cacheados localmente no `localStorage` ou `IndexedDB` para permitir o login offline.
- Apenas usuários com `org_id` ativo (via tabela `org_members`) podem sincronizar dados.
