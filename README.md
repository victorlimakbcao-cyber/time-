# Clube Manager

Aplicação web estática publicada no Vercel, com backend no Supabase.

## Arquitetura

```text
Vercel
  └── index.html
        └── Supabase JS
              ├── Auth
              ├── PostgreSQL + RLS
              └── Storage
```

O frontend usa somente a **publishable key**. A `service_role` não fica no navegador nem no GitHub.

## Backend do Clube Manager

O backend multi-tenant usa tabelas com prefixo `cm_`, isoladas das demais estruturas existentes no mesmo projeto Supabase.

### Identidade e acesso

- `cm_profiles`
- `cm_clubs`
- `cm_members`
- `cm_invites`
- `cm_role_permissions`

### Compatibilidade da aplicação atual

- `cm_club_state`: snapshot compartilhado do estado atual do clube enquanto o frontend legado é migrado módulo a módulo.
- `cm_settings`: mensalidade, saldo inicial, pesos de avaliação, listas e demais configurações.

O snapshot é acessível apenas a funções administrativas. As tabelas normalizadas possuem RLS por clube e por área.

### Futebol

- `cm_players`
- `cm_staff`
- `cm_opponents`
- `cm_competitions`
- `cm_competition_teams`
- `cm_competition_games`
- `cm_matches`
- `cm_match_players`
- `cm_match_events`
- `cm_player_ratings`

### Financeiro

- `cm_transactions`
- `cm_monthly_fees`

### Comercial e documentos

- `cm_sponsors`
- `cm_sponsor_history`
- `cm_contracts`
- `cm_documents`
- `cm_audit_log`

### Storage

Buckets privados:

- `cm-media`
- `cm-documents`

Os caminhos devem começar pelo UUID do clube para que as políticas de Storage validem a associação do usuário ao clube.

## Segurança

- RLS habilitado em todas as tabelas `cm_*`.
- Associação do usuário ao clube validada por `auth.uid()`.
- Escrita esportiva, financeira, documental e administrativa separada por função.
- Integridade multi-tenant reforçada por chaves estrangeiras compostas com `club_id`.
- Funções auxiliares de autorização ficam no schema privado `private`, não expostas pela Data API.
- `service_role` nunca é usada no frontend.

## Persistência atual

A aplicação mantém cache local por usuário para resiliência, mas o estado oficial do clube é sincronizado em `cm_club_state`. Ao primeiro acesso autenticado:

1. se o usuário já pertence a clubes, os clubes são carregados do backend;
2. se houver estado local antigo real, ele é migrado para um clube remoto;
3. em instalação nova, é criado um clube vazio, sem dados fictícios;
4. novos clubes são criados diretamente no Supabase.

As tabelas normalizadas estão preparadas para substituir gradualmente o snapshot sem quebrar a aplicação existente.

## Deploy

- Entrada: `index.html`
- Rotas: `vercel.json`
- Branch de produção: `main`
- Framework no Vercel: estático / Other
- Não há build obrigatório.
