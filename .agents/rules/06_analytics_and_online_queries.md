# Regras Excepcionais: Quando quebrar o Local-First

## A Arquitetura Padrão (Local-First RxDB)
Como documentado em `01_architecture_overview.md`, 99% da aplicação (listagens de animais, formulários de criação/edição, logs de reprodução) deve interagir estritamente com o RxDB. Isso garante que o usuário no campo (offline) possa operar o sistema.

## A Exceção: Relatórios e Analytics Pesados
O único momento em que é aceitável quebrar a regra de 100% offline e buscar dados diretamente do servidor (Supabase) via Next.js Server Actions ou rotas de API é para **Relatórios Analíticos Pesados** ou **Exports (PDF/Planilhas)**.

### Por que quebrar a regra nesses casos?
1. **Limitação de Memória do Browser**: Fazer processamento de 5.000 ou 50.000 registros para calcular estatísticas agregadas (como média de peso por raça no último ano) pode travar a aba do navegador no celular.
2. **Consultas Complexas**: O PostgreSQL no backend possui índices e funções de agregação muito superiores às abstrações NoSQL locais do RxDB.

### Como Implementar Consultas Online
1. **Use Server Actions ou APIs**: Nunca faça fetches complexos na UI. Crie Server Actions no Next.js (dentro de `src/app/actions/` ou rotas `src/app/api/`) para que o processamento ocorra no backend.
2. **Tratamento Offline**: Como essas views dependem de internet, os componentes de UI de relatórios precisam englobar `navigator.onLine` e mostrar um aviso claro: "A visualização de relatórios gerenciais exige conexão com a internet."
3. **Sincronização Prévia**: É preferível alertar o usuário para sincronizar os dados locais do tablet antes de visualizar relatórios, garantindo que o backend reflita a última realidade da fazenda inserida em campo.
