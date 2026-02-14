# Wialon → CarHire (Connect via API / Pull)

Use this **only** if forwarding/retransmission can’t be enabled.

## What you need

- A Wialon **API token** (from the yard/provider account with explicit authorization)
- Wialon base URL (default: `https://hst-api.wialon.com`)

## CarHire setup

1) Create a tracking integration:
   - Provider: `WIALON_API`
   - Method: `PULL`
   - Provide `wialon.token`
2) Add devices:
   - `externalDeviceId` must be the **Wialon Unit ID** (numeric)
3) Assign devices to vehicles

## Notes

- Polling interval is controlled by `WIALON_POLL_INTERVAL_SECONDS` (or per-integration config later).
- This mode depends on the partner’s provider plan/permissions; it may not be “free” in practice.

