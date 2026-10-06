# Padrões de Interface (UI) e Design System

## Responsividade e Foco
O app é usado primariamente no campo, através de tablets e smartphones. Portanto:
- Sempre projete interfaces "Mobile-First" ou "Touch-First".
- O contraste deve ser alto para leitura sob o sol.
- Botões e alvos de clique (`Tap Targets`) devem ser grandes.

## Componentes
- Reutilize os componentes base que já existem na pasta `src/components/` ou `src/app/` quando aplicável.
- Mantenha a consistência com a paleta existente (usualmente a identidade visual verde/dourado típica de agro, caso exista, leia os arquivos CSS globais/tailwind config para confirmar).

## Feedback Visual Essencial (UX Offline)
O maior desafio da UI offline é manter o usuário informado. Ao construir telas:
- **Nunca trave o app esperando um request**: Todas as telas devem renderizar imediatamente os dados do banco local (RxDB).
- **Tratamento de Estado**: Se você inserir algo localmente, não exiba um *spinner de "Salvando na nuvem"* que trava a tela. Mostre um feedback de "Salvo" imediatamente, feche o modal, e deixe o background sync (RxDB) resolver a nuvem.
- Se o campo obrigatório não puder ser obtido offline, trate o erro cordialmente e peça para o usuário conectar à rede para operações super críticas (como auth ou sincronização pesada). Formulários do dia a dia não devem exigir conexão.
