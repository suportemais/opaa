# Opiina — Ouça. Entenda. Fidelize.

SaaS B2B multi-tenant para pesquisas de satisfação/NPS, central de feedbacks, recuperação (ocorrências/casos) e CRM básico.

## Stack

- API: NestJS + Prisma + PostgreSQL
- Web: Vite + React + Tailwind
- Infra local: Docker Compose (PostgreSQL na porta `55432`) + Mailhog

## Requisitos

- Node.js (recomendado: a versão que você já usa no projeto)
- Docker Desktop (com Engine rodando)
- Corepack habilitado (para PNPM)

## Setup local

1) Variáveis de ambiente

- API:
  - Copie `apps/api/.env.example` para `apps/api/.env`
  - Ajuste os valores conforme necessário
- Web:
  - Copie `apps/web/.env.example` para `apps/web/.env`

2) Subir banco e Mailhog

Use o Docker Compose do projeto (Postgres na porta `55432`).

3) Instalar dependências

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm -r install
```

4) Migrar/seed do banco (API)

```bash
corepack pnpm --filter api prisma:generate
corepack pnpm --filter api prisma:migrate
corepack pnpm --filter api prisma -- seed
```

5) Rodar em dev

```bash
corepack pnpm --filter api dev
corepack pnpm --filter web dev
```

- Web: http://localhost:5173
- API: http://localhost:3000
- Swagger: http://localhost:3000/api

## Build

```bash
corepack pnpm -r build
```

## Troubleshooting

- Erro 500 no onboarding geralmente indica que o PostgreSQL não está acessível na porta `55432` (Docker Desktop/Engine parado).
- Se ocorrer 403 após adicionar permissões, rode o sync de RBAC no tenant existente (módulo `rbac-sync`).
