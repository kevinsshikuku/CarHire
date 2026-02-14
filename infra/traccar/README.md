# Traccar Hub (Docker)

This runs the **Traccar compatibility hub** that receives forwarded GPS messages (e.g., Wialon IPS) and stores normalized positions.

## Start

```bash
docker compose up -d
```

Traccar web UI (dev): `http://localhost:8082`

## First-time setup

1) Open the Traccar UI and create an admin user.
2) Put those credentials in `api/.env`:
   - `TRACCAR_USERNAME`
   - `TRACCAR_PASSWORD`

## Important production notes

- This repo sets `device.register=false` in `traccar.xml`.
  - Devices will **not** auto-register when data arrives.
  - You must create devices in CarHire (GraphQL `createTrackingDevice`), which creates them in Traccar.
- Restrict access to `8082` (Traccar UI/API) via firewall/VPN and strong passwords.
- Only expose the protocol ports you need (example: `5003/TCP` for Wialon IPS).

