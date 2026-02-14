# CarHire

Kenya-localized car hire marketplace.

This repo currently contains the **tracking compatibility hub** implementation:

- **CarHire API** (Node.js + GraphQL + MongoDB): partner onboarding for tracker integrations, device mapping, normalized locations, and subscriptions.
- **Traccar hub** (Docker + MariaDB): protocol ingestion for forwarded GPS streams (e.g., Wialon IPS).

## Quick start (local dev)

### 1) Start MongoDB

```bash
cd infra/dev
docker compose up -d
```

### 2) (Optional) Start Traccar + MariaDB

You need Docker Desktop running.

```bash
cd infra/traccar
docker compose up -d
```

### 3) Run the API

```bash
cd api
npm install
cp .env.example .env
npm run dev
```

GraphQL endpoint: `http://localhost:4000/graphql`

## Environment

See:
- `api/.env.example`
- `infra/traccar/docker-compose.yml`

## Docs

- `docs/tracking/wialon-forwarding.md`
- `docs/tracking/graphql-examples.md`
