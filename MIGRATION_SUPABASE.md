# Migração: Base de dados no Supabase

## Task 1: Criar projeto e obter credenciais

1. Acesse [app.supabase.com](https://app.supabase.com) e faça login.
2. Crie um **novo projeto** (ou use o existente).
3. Anote:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public key** (Settings > API > Project API keys > `anon` public)
   - **Project ref** = parte do URL (ex: `xxxxx` em `https://xxxxx.supabase.co`)
4. Se for projeto novo: em **Authentication > URL Configuration**, configure **Site URL** e **Redirect URLs** (ex: `http://localhost:5173` para dev).

Copie `.env.example` para `.env` e preencha com os valores do seu projeto.
