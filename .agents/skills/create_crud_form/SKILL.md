---
name: create_crud_form
description: Como criar formulários consistentes para o sistema Local-First, gerando IDs offline e persistindo no RxDB.
---

# Skill: Criar Padrão de Formulário CRUD

Para manter a integridade offline e prevenir que usuários quebrem o estado da aplicação ao salvarem dados em locais sem internet, siga estas regras ao construir um formulário de Criação/Edição.

## 1. Geração Segura de Identificadores
Ao inserir um novo documento, NUNCA utilize IDs numéricos incrementais e NUNCA realize queries para obter "o último ID inserido + 1". 
- Se a tabela usar o padrão UUID (como `reproduction_events` com o `event_id`), sempre importe a biblioteca e crie o ID na própria interface no momento do `insert`. Ex: `import { v4 as uuidv4 } from 'uuid'; const id = uuidv4();`

## 2. Controle de Formulário
- Sempre utilize React Hook Form em conjunto com bibliotecas de Validação (Zod / Yup).
- Exemplo de definição de tipos: `type FormData = z.infer<typeof seuSchema>;`
- Valores iniciais (defaultValues) de campos ausentes devem começar como `null` ou strings vazias caso não possuam fallback. O Supabase detesta undefined.

## 3. Submissão (Submit)
Ao confirmar (Salvar) a edição:
1. Obtenha a instância do banco RxDB via hook de contexto ou state.
2. Valide o payload do form.
3. Obtenha os valores `org_id` através do contexto global ou cache se necessário.
4. Rode a query de persistência:
```typescript
try {
  await db.collections[sua_colecao].insert({
    ...payload,
    id: uuidv4(),
    created_at: Date.now(),
    updated_at: Date.now(),
    _deleted: false
  });
  toast.success("Salvo localmente!");
  // Feche a modal ou limpe o form
} catch(err) {
  toast.error("Falha ao salvar. Valide os campos.");
}
```

## 4. Ocultar Lógica de Sync
Você NUNCA deve chamar a API `fetch('/api/sync')` ou mostrar "Salvando na nuvem" após o submit. Assim que a promessa de inserção no banco local (RxDB) for resolvida, a UI deve destravar instantaneamente para o usuário. 
A engine de replicação do RxDB detectará essa mutação em background através do hook de event listeners, montará um pacote e o enviará assim que houver rede disponível.
