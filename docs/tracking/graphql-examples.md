# GraphQL examples (Tracking)

Assumes API is running at `http://localhost:4000/graphql`.

## 1) Login (partner staff)

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    user { id phone roles partnerId }
  }
}
```

Variables:

```json
{ "input": { "phone": "+254700000000", "password": "Passw0rd!Passw0rd!" } }
```

Use the returned `accessToken` as:

`Authorization: Bearer <token>`

## 2) Create a forwarding integration (Wialon → Traccar)

```graphql
mutation CreateIntegration($input: CreateTrackingIntegrationInput!) {
  createTrackingIntegration(input: $input) {
    id
    providerType
    method
    status
  }
}
```

Variables:

```json
{
  "input": {
    "providerType": "WIALON",
    "method": "FORWARD",
    "authorizationAccepted": true
  }
}
```

## 3) Show copy/paste forwarding config

```graphql
mutation {
  getForwardingConfig(providerType: WIALON) {
    host
    protocol
    ports
    unitIdRule
    copyPasteGuideText
  }
}
```

## 4) Add a device (creates it in Traccar)

```graphql
mutation CreateDevice($input: CreateTrackingDeviceInput!) {
  createTrackingDevice(input: $input) {
    id
    label
    externalDeviceId
    traccarDeviceId
    healthStatus
    lastSeenAt
  }
}
```

Variables:

```json
{
  "input": {
    "trackingIntegrationId": "<integrationId>",
    "label": "KDB-123A Tracker",
    "externalDeviceId": "357881234567890"
  }
}
```

## 5) Subscribe to partner tracking updates

WebSocket protocol: `graphql-ws`

Connection params (send in `connection_init`):

```json
{ "authorization": "Bearer <accessToken>" }
```

Subscription:

```graphql
subscription PartnerLocations($partnerId: ID!) {
  partnerTrackingLocationUpdated(partnerId: $partnerId) {
    entityType
    entityId
    lat
    lng
    heading
    speed
    timestamp
    source
  }
}
```

