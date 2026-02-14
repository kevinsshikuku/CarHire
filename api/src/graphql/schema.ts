export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum Role {
    CUSTOMER
    PARTNER_STAFF
    ADMIN
  }

  enum TrackingProviderType {
    WIALON
    TRACCAR_DIRECT
    PHONE
    WIALON_API
  }

  enum TrackingMethod {
    FORWARD
    PULL
  }

  enum TrackingIntegrationStatus {
    ACTIVE
    PAUSED
    ERROR
  }

  enum TrackingDeviceHealthStatus {
    ONLINE
    OFFLINE
    UNKNOWN
  }

  enum EntityType {
    VEHICLE
    DELIVERY_TASK
    YARD
  }

  type User {
    id: ID!
    phone: String!
    name: String
    roles: [Role!]!
    partnerId: ID
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type TrackingIntegration {
    id: ID!
    partnerId: ID!
    providerType: TrackingProviderType!
    method: TrackingMethod!
    status: TrackingIntegrationStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type LastLocation {
    lat: Float!
    lng: Float!
    heading: Float
    speed: Float
    timestamp: DateTime!
    source: String!
  }

  type TrackingDevice {
    id: ID!
    partnerId: ID!
    trackingIntegrationId: ID!
    label: String!
    vehicleId: ID
    branchId: ID
    providerType: TrackingProviderType!
    method: TrackingMethod!
    externalDeviceId: String!
    traccarDeviceId: Int
    lastSeenAt: DateTime
    lastLocation: LastLocation
    healthStatus: TrackingDeviceHealthStatus!
    assignedAt: DateTime
    unassignedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type LocationUpdate {
    entityType: EntityType!
    entityId: ID!
    lat: Float!
    lng: Float!
    heading: Float
    speed: Float
    accuracy: Float
    timestamp: DateTime!
    source: String!
    receivedAt: DateTime!
  }

  type ForwardingConfig {
    host: String!
    protocol: String!
    ports: [Int!]!
    unitIdRule: String!
    copyPasteGuideText: String!
  }

  type TrackingConnectionTestResult {
    lastSeenAt: DateTime
    lastLocation: LastLocation
  }

  input SignUpInput {
    phone: String!
    password: String!
    name: String
  }

  input LoginInput {
    phone: String!
    password: String!
  }

  input WialonIntegrationConfigInput {
    baseUrl: String
    token: String
    pollingIntervalSeconds: Int
  }

  input CreateTrackingIntegrationInput {
    providerType: TrackingProviderType!
    method: TrackingMethod!
    authorizationAccepted: Boolean!
    wialon: WialonIntegrationConfigInput
  }

  input CreateTrackingDeviceInput {
    trackingIntegrationId: ID!
    label: String!
    externalDeviceId: String!
    vehicleId: ID
    branchId: ID
  }

  input PostLocationPingInput {
    entityType: EntityType!
    entityId: ID!
    lat: Float!
    lng: Float!
    heading: Float
    speed: Float
    accuracy: Float
    timestamp: DateTime
    source: String
  }

  type Query {
    me: User
    trackingIntegrations: [TrackingIntegration!]!
    trackingDevices: [TrackingDevice!]!
  }

  type Mutation {
    signUp(input: SignUpInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    createTrackingIntegration(input: CreateTrackingIntegrationInput!): TrackingIntegration!
    createTrackingDevice(input: CreateTrackingDeviceInput!): TrackingDevice!
    assignTrackingDeviceToVehicle(deviceId: ID!, vehicleId: ID!): TrackingDevice!
    unassignTrackingDevice(deviceId: ID!): TrackingDevice!

    getForwardingConfig(providerType: TrackingProviderType!): ForwardingConfig!
    testTrackingConnection(deviceId: ID!): TrackingConnectionTestResult!

    postLocationPing(input: PostLocationPingInput!): LocationUpdate!
  }

  type Subscription {
    partnerTrackingLocationUpdated(partnerId: ID!): LocationUpdate!
    bookingTrackingLocationUpdated(bookingId: ID!): LocationUpdate!
    trackingDeviceHealthUpdated(partnerId: ID!): TrackingDevice!
  }
`;
