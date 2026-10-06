---
name: mock_offline_testing
description: Como escrever testes unitários que contornam chamadas de API reais e testam a lógica local via Mocking do RxDB.
---

# Skill: Testes Unitários e Mocking Offline

O aplicativo confia plenamente em sua capacidade de operar offline. Para assegurarmos a robustez dos componentes, testes unitários (como Jest ou Vitest) precisam isolar as camadas de persistência local da rede externa.

## O Que Mockar

### 1. `navigator.onLine`
Você deve forçar explicitamente a variável `navigator.onLine` para `false` durante o ambiente do teste quando for simular a ausência de internet.
```typescript
Object.defineProperty(navigator, 'onLine', {
  value: false,
  writable: true
});
```
Verifique se a UI responde sem travar e não joga erros `net::ERR_INTERNET_DISCONNECTED`.

### 2. O Banco Local (RxDB)
Nunca crie um RxDB real, nem chame `setupReplication()` dentro de testes, pois a engine tentará fazer requests para a `/api/sync/route.ts`. 

- O ideal é criar um mock do Provider do banco que retorne um objeto que simula o Dexie.
- Exemplo usando Jest:
```typescript
const mockDb = {
  animals: {
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([ /* fake data */ ]) }),
    insert: jest.fn().mockResolvedValue(true)
  }
};
jest.mock('@/providers/LocalFirstProvider', () => ({
  useDatabase: () => mockDb
}));
```

### 3. Falhas do Fetch
Sempre verifique como a UI reage caso um request explicitamente rejeite (ex: o health check retornou falso). A UI não deve apresentar "Loading Infinito", mas sim transacionar os componentes para estado de aviso "Sincronização Pendente".
