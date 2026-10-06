# Clube Manager

Aplicação web estática para gestão de clube, publicada via Vercel e integrada ao Supabase.

## Produção

- Entrada da aplicação: `index.html`
- Roteamento Vercel: `vercel.json`
- Banco/Auth: Supabase `tfhowvwycmdskunbasdj`
- Frontend usa somente a chave publishable do Supabase.
- A `service_role` nunca deve ser exposta no navegador ou no repositório.

## Persistência

O estado funcional existente continua no objeto `DB` e é salvo em:

1. `public.clube_manager_state` no Supabase, por usuário autenticado;
2. `localStorage` como cache local por usuário.

A tabela usa RLS baseada em `auth.uid() = user_id`.

## Autenticação

A aplicação oferece login e criação de conta por e-mail/senha usando Supabase Auth. Sem sessão autenticada, o sistema fica protegido pela tela de acesso.

## Deploy Vercel

O projeto é estático, sem framework e sem build obrigatório. O `vercel.json` direciona as rotas para `/index.html`.

No Vercel, o Root Directory deve apontar para a raiz do repositório.
