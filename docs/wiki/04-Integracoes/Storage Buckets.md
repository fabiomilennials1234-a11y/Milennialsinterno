---
title: Storage Buckets
tags:
  - integracao
  - storage
---

# Storage Buckets

> [!abstract] Três buckets públicos
> Arquivos ficam em Supabase Storage. Três buckets: `card-attachments` (anexos de cards de kanban), `avatars` (fotos de perfil), `tech-attachments` (arquivos de Mtech).

## `card-attachments`

- **Público**: sim (URLs públicas retornadas via `getPublicUrl`)
- **Limites**: sem limite de tamanho explícito (exceto uso prático)
- **Uso**: anexos de cards em [[03-Features/Kanban Devs|Kanban Devs]] (principal) e outros boards que vierem a suportar
- **Path**: `{card_id}/{timestamp}_{safe_filename}`
- **Metadados**: `card_attachments` table (`card_id`, `file_name`, `file_url`, `file_type`, `file_size`, `created_by`)

### Policies

- **SELECT**: qualquer autenticado
- **INSERT**: qualquer autenticado (quem criar card pode anexar)
- **UPDATE**: dono ou executivo
- **DELETE**: executivo ou uploader

## `avatars`

- **Público**: sim
- **Uso**: foto de perfil dos usuários
- **Path**: `{user_id}/avatar.{ext}` (ou similar)
- **Sem tabela de metadados** — URL armazenada direto em `profiles.avatar`

## `tech-attachments`

- **Público**: sim
- **Uso**: anexos de tasks do [[03-Features/Mtech — Milennials Tech|Mtech]]
- **Path**: `{task_id}/{timestamp}_{filename}`
- **Metadados**: `tech_task_attachments`

### Policies

- **SELECT**: qualquer autenticado (task é público internamente se `can_see_tech`)
- **INSERT**: `can_see_tech(auth.uid())` (via RPC `tech_submit_attachment`)
- **DELETE**: executivo ou uploader

Migration: `supabase/migrations/20260416160000_create_tech_attachments.sql`.

## Convenções

> [!tip]
> - **Sempre** sanitize o filename antes de upload (há `sanitizeFileName` helper)
> - **Sempre** use `Date.now()` no prefixo para evitar colisão
> - **Sempre** insira metadados na tabela correspondente — URL avulsa no bucket sem linha no DB vira órfã

## Housekeeping

Atualmente sem job de limpeza automática. Ao deletar card/task, anexos **ficam no bucket** mesmo depois do DB ser limpo.

Considerar: job mensal que lista objetos sem row correspondente e deleta.

## Links

- [[03-Features/Kanban Devs]]
- [[03-Features/Mtech — Milennials Tech]]
- [[00-Arquitetura/Supabase e RLS]]
