# Wialon → CarHire (Forward live data)

This is the **recommended** “no paid API calls” integration.

## What you need

- Your CarHire Traccar hub host (DNS or static IP)
- The **Wialon IPS** port you opened on the server (default in this repo: `5003/TCP`)

## Wialon setup (high level)

1) In Wialon, create a **Retranslator** (or ask your Wialon provider/installer to do it).
2) Set the retranslator protocol to **Wialon IPS**.
3) Set destination:
   - **Host:** your Traccar hub (example: `your-vps.example.com`)
   - **Port:** `5003`
4) Configure the **unit identifier** used in retransmission:
   - Use a stable unique identifier (IMEI/Unit ID).
   - Whatever identifier is sent must match what you create in CarHire as the device `externalDeviceId`.

## CarHire setup

1) Create a tracking integration:
   - Provider: `WIALON`
   - Method: `FORWARD`
2) Add each device:
   - `externalDeviceId` must match the identifier configured in Wialon retransmission
3) Assign each device to a vehicle
4) Verify “Last seen” updates in Partner → Tracking dashboard.

## Production safety checklist (must do)

- Restrict Traccar web UI (`8082`) to ops IP/VPN.
- Only expose the minimum protocol ports required (e.g., `5003/TCP`).
- Keep a written partner authorization agreement (location data is sensitive).

