# React, Estado e Padrões de Código

## Acesso aos Dados Local-First
Siga estas regras ao escrever código de UI:

1. **Nunca use Supabase Client na UI**: O cliente Supabase (`supabase.from(...)`) só deve ser usado nas rotas de backend (dentro de `/api/`) ou em scripts específicos de migração/auth. Componentes React devem ler 100% de dados da instância RxDB.
2. **Hooks do RxDB**: Sempre envolva o acesso a dados usando os hooks reativos, ex: `const query = db.animals.find(); const { result } = useRxQuery(query);` ou `const { result } = useRxData('animals', ...);`. Isso garante que a UI reaja imediatamente se o banco sincronizar no fundo e atualizar a tabela.

## Lógica de Formulários
Para criação e edição:
1. Sempre crie um ID local (se a tabela for identificada por UUID ou id randômico) usando algo seguro para offline como `uuidv4()`. NUNCA use IDs numéricos gerados sequencialmente. NUNCA faça queries no banco para saber qual o próximo ID, pois estando offline em dois tablets, ambos gerariam o mesmo ID sequencial e dariam conflito no Supabase mais tarde (embora o RxDB já deva ter protegido com RGN pra animais e UUIDs pras demais tabelas).
2. Não invoque APIs diretas ao salvar formulários. Ao invés disso, faça apenas `await db.collections[x].insert({...})`.
3. A instância do RxDB cuidará de acionar o Push Sync nos bastidores logo após você salvar localmente.

## Estado de Sincronização
Para reportar se o app está offline ou sincronizando, ouçam os eventos lançados pelo log de replicação (no SyncLogger). O usuário deve saber visualmente se está 100% atualizado com a nuvem ou se existem pendências não subidas.
