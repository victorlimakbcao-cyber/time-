# Supabase para o Clube Manager

Este diretório reúne os artefatos de integração e preparação do banco do Clube Manager.

## Objetivo

A aplicação usa o Supabase como autoridade final de autenticação, persistência e regras de acesso. A mudança de permissões por função para permissões por ação deve ocorrer com revisão do schema real antes da aplicação.

## Arquivos

- `diagnostics/inspect_cm_schema.sql` — leitura do schema atual de tabelas `cm_*` e funções privadas.
- `migrations/20261006000000_role_permissions_by_action.sql` — proposta de migração para permissões por ação.

## Regras de segurança

- Não reutilizar `service_role` no frontend.
- Não expor chaves secretas em repositórios públicos ou arquivos do cliente.
- Não executar alterações em tabelas fora do domínio `cm_*`.
- Validar o schema do projeto antes de aplicar qualquer migration.

## Fluxo recomendado

1. Abrir o SQL Editor no Supabase.
2. Rodar `diagnostics/inspect_cm_schema.sql`.
3. Confirmar nomes, policies, triggers e funções do schema atual.
4. Revisar a migration em `migrations/20261006000000_role_permissions_by_action.sql`.
5. Aplicar somente após aprovação final.

## Observação

Este repositório conserva o processo em etapas e sem alterações de produção sem revisão. O objetivo é manter a aplicação operando e aumentar a segurança por RLS com migração incremental.
