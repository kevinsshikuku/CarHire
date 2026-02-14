import { GraphQLScalarType, Kind } from 'graphql';
import { ErrorWithProps } from 'mercurius';
import { ENV } from '../env.js';
import {
  AuthUser,
  Role,
  getAuthUserFromAuthorizationHeader,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword
} from '../auth/auth.js';
import { encryptString } from '../crypto/fieldEncryption.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { BookingModel } from '../models/Booking.js';
import { EntityType } from '../models/LatestLocation.js';
import {
  TrackingIntegrationModel,
  TrackingIntegrationStatus,
  TrackingMethod,
  TrackingProviderType
} from '../models/TrackingIntegration.js';
import {
  TrackingDeviceHealthStatus,
  TrackingDeviceModel
} from '../models/TrackingDevice.js';
import { UserModel } from '../models/User.js';
import { VehicleModel } from '../models/Vehicle.js';
import { TraccarClient, TraccarPosition } from '../services/traccar/TraccarClient.js';
import { writeLatestAndHistory } from '../services/tracking/writeLocation.js';

type GqlContext = {
  authUser: AuthUser | null;
  pubsub: any;
  traccarClient: TraccarClient;
};

function unauthenticated(): never {
  throw new ErrorWithProps('UNAUTHENTICATED', { code: 'UNAUTHENTICATED' }, 401);
}

function forbidden(): never {
  throw new ErrorWithProps('FORBIDDEN', { code: 'FORBIDDEN' }, 403);
}

function badRequest(message: string): never {
  throw new ErrorWithProps(message, { code: 'BAD_REQUEST' }, 400);
}

function requireAuth(context: GqlContext): AuthUser {
  if (!context.authUser) unauthenticated();
  return context.authUser;
}

function requirePartnerStaff(context: GqlContext): AuthUser {
  const user = requireAuth(context);
  if (!user.roles.includes(Role.PARTNER_STAFF) && !user.roles.includes(Role.ADMIN)) forbidden();
  if (!user.partnerId && !user.roles.includes(Role.ADMIN)) badRequest('Missing partner scope');
  return user;
}

function requirePartnerScope(user: AuthUser, partnerId: string): void {
  if (user.roles.includes(Role.ADMIN)) return;
  if (!user.partnerId || user.partnerId !== partnerId) forbidden();
}

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function toLastLocation(value: any) {
  if (!value) return null;
  return {
    lat: value.lat,
    lng: value.lng,
    heading: value.heading ?? null,
    speed: value.speed ?? null,
    timestamp: value.timestamp?.toISOString?.() ?? value.timestamp,
    source: value.source
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function locationTopicForPartner(partnerId: string): string {
  return `partnerTrackingLocationUpdated:${partnerId}`;
}

function deviceHealthTopicForPartner(partnerId: string): string {
  return `trackingDeviceHealthUpdated:${partnerId}`;
}

function bookingTrackingTopic(bookingId: string): string {
  return `bookingTrackingLocationUpdated:${bookingId}`;
}

function pickNewestPosition(positions: TraccarPosition[]): TraccarPosition | null {
  if (positions.length === 0) return null;
  return positions.reduce((best, cur) => {
    const bestT = new Date(best.fixTime ?? best.serverTime).getTime();
    const curT = new Date(cur.fixTime ?? cur.serverTime).getTime();
    return curT > bestT ? cur : best;
  });
}

export function buildResolvers(deps: { traccarClient: TraccarClient }) {
  return {
    DateTime: new GraphQLScalarType({
      name: 'DateTime',
      serialize(value) {
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string') return new Date(value).toISOString();
        return new Date(String(value)).toISOString();
      },
      parseValue(value) {
        return new Date(String(value));
      },
      parseLiteral(ast) {
        if (ast.kind === Kind.STRING) return new Date(ast.value);
        return null;
      }
    }),

    Query: {
      me: async (_: unknown, __: unknown, ctx: GqlContext) => {
        const user = ctx.authUser;
        if (!user) return null;
        const doc = await UserModel.findById(user.userId).lean();
        if (!doc) return null;
        return {
          id: doc._id.toString(),
          phone: doc.phone,
          name: doc.name ?? null,
          roles: doc.roles,
          partnerId: doc.partnerId?.toString?.() ?? null
        };
      },

      trackingIntegrations: async (_: unknown, __: unknown, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) {
          const all = await TrackingIntegrationModel.find({}).sort({ createdAt: -1 }).lean();
          return all.map((i) => ({
            id: i._id.toString(),
            partnerId: i.partnerId.toString(),
            providerType: i.providerType,
            method: i.method,
            status: i.status,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt
          }));
        }

        const list = await TrackingIntegrationModel.find({ partnerId: user.partnerId }).sort({ createdAt: -1 }).lean();
        return list.map((i) => ({
          id: i._id.toString(),
          partnerId: i.partnerId.toString(),
          providerType: i.providerType,
          method: i.method,
          status: i.status,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt
        }));
      },

      trackingDevices: async (_: unknown, __: unknown, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        const filter = user.roles.includes(Role.ADMIN) ? {} : { partnerId: user.partnerId };
        const list = await TrackingDeviceModel.find(filter).sort({ createdAt: -1 }).lean();
        return list.map((d) => ({
          id: d._id.toString(),
          partnerId: d.partnerId.toString(),
          trackingIntegrationId: d.trackingIntegrationId.toString(),
          label: d.label,
          vehicleId: d.vehicleId?.toString?.() ?? null,
          branchId: d.branchId?.toString?.() ?? null,
          providerType: d.providerType,
          method: d.method,
          externalDeviceId: d.externalDeviceId,
          traccarDeviceId: d.traccarDeviceId ?? null,
          lastSeenAt: d.lastSeenAt ?? null,
          lastLocation: toLastLocation(d.lastLocation),
          healthStatus: d.healthStatus,
          assignedAt: d.assignedAt ?? null,
          unassignedAt: d.unassignedAt ?? null,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }));
      }
    },

    Mutation: {
      signUp: async (_: unknown, args: any) => {
        const { phone, password, name } = args.input;
        const existing = await UserModel.findOne({ phone }).lean();
        if (existing) badRequest('Phone already registered');

        const passwordHash = await hashPassword(password);
        const userDoc = await UserModel.create({ phone, name, passwordHash, roles: [Role.CUSTOMER] });

        const authUser: AuthUser = { userId: userDoc._id.toString(), roles: userDoc.roles as Role[] };
        const accessToken = signAccessToken(authUser);
        const refreshToken = signRefreshToken(authUser.userId, userDoc.refreshTokenVersion);

        return {
          accessToken,
          refreshToken,
          user: {
            id: authUser.userId,
            phone: userDoc.phone,
            name: userDoc.name ?? null,
            roles: userDoc.roles,
            partnerId: null
          }
        };
      },

      login: async (_: unknown, args: any) => {
        const { phone, password } = args.input;
        const userDoc = await UserModel.findOne({ phone });
        if (!userDoc) badRequest('Invalid credentials');
        const ok = await verifyPassword(userDoc.passwordHash, password);
        if (!ok) badRequest('Invalid credentials');

        const authUser: AuthUser = {
          userId: userDoc._id.toString(),
          roles: userDoc.roles as Role[],
          partnerId: userDoc.partnerId?.toString?.()
        };
        const accessToken = signAccessToken(authUser);
        const refreshToken = signRefreshToken(authUser.userId, userDoc.refreshTokenVersion);

        return {
          accessToken,
          refreshToken,
          user: {
            id: authUser.userId,
            phone: userDoc.phone,
            name: userDoc.name ?? null,
            roles: userDoc.roles,
            partnerId: authUser.partnerId ?? null
          }
        };
      },

      createTrackingIntegration: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin partner-scoped creation not implemented yet');
        const partnerId = user.partnerId!;

        const { providerType, method } = args.input as {
          providerType: TrackingProviderType;
          method: TrackingMethod;
          wialon?: { baseUrl?: string; token?: string; pollingIntervalSeconds?: number };
        };

        if (!args.input.authorizationAccepted) {
          badRequest('Partner authorization must be accepted');
        }

        if (providerType === TrackingProviderType.WIALON_API && method !== TrackingMethod.PULL) {
          badRequest('WIALON_API integrations must use PULL');
        }

        const config: any = { ipAllowlist: [] };

        if (providerType === TrackingProviderType.WIALON_API) {
          const token = args.input.wialon?.token;
          if (!token) badRequest('Missing Wialon token');
          config.wialon = {
            baseUrl: args.input.wialon?.baseUrl ?? 'https://hst-api.wialon.com',
            tokenEnc: encryptString(token, ENV.encryptionKey),
            pollingIntervalSeconds: args.input.wialon?.pollingIntervalSeconds ?? ENV.backgroundJobs.wialonPollIntervalSeconds
          };
        }

        const doc = await TrackingIntegrationModel.create({
          partnerId,
          providerType,
          method,
          status: TrackingIntegrationStatus.ACTIVE,
          authorizationAcceptedAt: new Date(),
          config,
          createdByUserId: user.userId
        });

        await AuditLogModel.create({
          actorUserId: user.userId,
          partnerId,
          action: 'TRACKING_INTEGRATION_CREATED',
          entityType: 'TrackingIntegration',
          entityId: doc._id,
          data: { providerType, method }
        });

        return {
          id: doc._id.toString(),
          partnerId: doc.partnerId.toString(),
          providerType: doc.providerType,
          method: doc.method,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        };
      },

      createTrackingDevice: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin device creation not implemented yet');
        const partnerId = user.partnerId!;

        const { trackingIntegrationId, label, externalDeviceId, vehicleId, branchId } = args.input as {
          trackingIntegrationId: string;
          label: string;
          externalDeviceId: string;
          vehicleId?: string;
          branchId?: string;
        };

        const integration = await TrackingIntegrationModel.findById(trackingIntegrationId).lean();
        if (!integration) badRequest('Tracking integration not found');
        if (integration.partnerId.toString() !== partnerId) forbidden();

        let traccarDeviceId: number | undefined;
        if (integration.method === TrackingMethod.FORWARD && (integration.providerType === TrackingProviderType.WIALON || integration.providerType === TrackingProviderType.TRACCAR_DIRECT)) {
          const created = await deps.traccarClient.createDevice({ name: label, uniqueId: externalDeviceId });
          traccarDeviceId = created.id;
        }

        if (vehicleId) {
          const vehicle = await VehicleModel.findById(vehicleId).lean();
          if (!vehicle) badRequest('Vehicle not found');
          if (vehicle.partnerId.toString() !== partnerId) forbidden();
        }

        const now = new Date();
        const doc = await TrackingDeviceModel.create({
          partnerId,
          trackingIntegrationId,
          branchId: branchId ?? undefined,
          vehicleId: vehicleId ?? undefined,
          label,
          providerType: integration.providerType,
          method: integration.method,
          externalDeviceId,
          traccarDeviceId,
          healthStatus: TrackingDeviceHealthStatus.UNKNOWN,
          assignedAt: vehicleId ? now : undefined
        });

        await AuditLogModel.create({
          actorUserId: user.userId,
          partnerId,
          action: 'TRACKING_DEVICE_CREATED',
          entityType: 'TrackingDevice',
          entityId: doc._id,
          data: { trackingIntegrationId, externalDeviceId, traccarDeviceId: traccarDeviceId ?? null }
        });

        return {
          id: doc._id.toString(),
          partnerId: doc.partnerId.toString(),
          trackingIntegrationId: doc.trackingIntegrationId.toString(),
          label: doc.label,
          vehicleId: doc.vehicleId?.toString?.() ?? null,
          branchId: doc.branchId?.toString?.() ?? null,
          providerType: doc.providerType,
          method: doc.method,
          externalDeviceId: doc.externalDeviceId,
          traccarDeviceId: doc.traccarDeviceId ?? null,
          lastSeenAt: doc.lastSeenAt ?? null,
          lastLocation: toLastLocation(doc.lastLocation),
          healthStatus: doc.healthStatus,
          assignedAt: doc.assignedAt ?? null,
          unassignedAt: doc.unassignedAt ?? null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        };
      },

      assignTrackingDeviceToVehicle: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin assignment not implemented yet');
        const partnerId = user.partnerId!;

        const device = await TrackingDeviceModel.findById(args.deviceId);
        if (!device) badRequest('Tracking device not found');
        if (device.partnerId.toString() !== partnerId) forbidden();

        const vehicle = await VehicleModel.findById(args.vehicleId).lean();
        if (!vehicle) badRequest('Vehicle not found');
        if (vehicle.partnerId.toString() !== partnerId) forbidden();

        device.vehicleId = vehicle._id;
        device.assignedAt = new Date();
        device.unassignedAt = undefined;
        await device.save();

        await AuditLogModel.create({
          actorUserId: user.userId,
          partnerId,
          action: 'TRACKING_DEVICE_ASSIGNED',
          entityType: 'TrackingDevice',
          entityId: device._id,
          data: { vehicleId: vehicle._id.toString() }
        });

        return {
          id: device._id.toString(),
          partnerId: device.partnerId.toString(),
          trackingIntegrationId: device.trackingIntegrationId.toString(),
          label: device.label,
          vehicleId: device.vehicleId?.toString?.() ?? null,
          branchId: device.branchId?.toString?.() ?? null,
          providerType: device.providerType,
          method: device.method,
          externalDeviceId: device.externalDeviceId,
          traccarDeviceId: device.traccarDeviceId ?? null,
          lastSeenAt: device.lastSeenAt ?? null,
          lastLocation: toLastLocation(device.lastLocation),
          healthStatus: device.healthStatus,
          assignedAt: device.assignedAt ?? null,
          unassignedAt: device.unassignedAt ?? null,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt
        };
      },

      unassignTrackingDevice: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin unassignment not implemented yet');
        const partnerId = user.partnerId!;

        const device = await TrackingDeviceModel.findById(args.deviceId);
        if (!device) badRequest('Tracking device not found');
        if (device.partnerId.toString() !== partnerId) forbidden();

        device.vehicleId = undefined;
        device.unassignedAt = new Date();
        await device.save();

        await AuditLogModel.create({
          actorUserId: user.userId,
          partnerId,
          action: 'TRACKING_DEVICE_UNASSIGNED',
          entityType: 'TrackingDevice',
          entityId: device._id
        });

        return {
          id: device._id.toString(),
          partnerId: device.partnerId.toString(),
          trackingIntegrationId: device.trackingIntegrationId.toString(),
          label: device.label,
          vehicleId: null,
          branchId: device.branchId?.toString?.() ?? null,
          providerType: device.providerType,
          method: device.method,
          externalDeviceId: device.externalDeviceId,
          traccarDeviceId: device.traccarDeviceId ?? null,
          lastSeenAt: device.lastSeenAt ?? null,
          lastLocation: toLastLocation(device.lastLocation),
          healthStatus: device.healthStatus,
          assignedAt: device.assignedAt ?? null,
          unassignedAt: device.unassignedAt ?? null,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt
        };
      },

      getForwardingConfig: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (!user.partnerId && !user.roles.includes(Role.ADMIN)) badRequest('Missing partner scope');

        const providerType = args.providerType as TrackingProviderType;
        if (providerType !== TrackingProviderType.WIALON) {
          return {
            host: ENV.traccar.forwardHost,
            protocol: 'Contact support',
            ports: [],
            unitIdRule: 'N/A',
            copyPasteGuideText: `Host: ${ENV.traccar.forwardHost}\n(Ports/protocol depend on the device/vendor)`
          };
        }

        const host = ENV.traccar.forwardHost;
        const port = ENV.traccar.wialonIpsPort;
        const protocol = 'Wialon IPS';
        const unitIdRule = 'Configure retransmission to send each unit unique identifier (IMEI recommended).';
        const copyPasteGuideText = [
          'Forward live data (Recommended)',
          '',
          `Protocol: ${protocol}`,
          `Host: ${host}`,
          `Port: ${port}`,
          '',
          'Unit identifier rule:',
          unitIdRule,
          '',
          'After enabling retransmission, add each device in CarHire using the same Unit ID / IMEI.'
        ].join('\n');

        return {
          host,
          protocol,
          ports: [port],
          unitIdRule,
          copyPasteGuideText
        };
      },

      testTrackingConnection: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin test not implemented yet');
        const partnerId = user.partnerId!;

        const device = await TrackingDeviceModel.findById(args.deviceId);
        if (!device) badRequest('Tracking device not found');
        if (device.partnerId.toString() !== partnerId) forbidden();

        if (!device.traccarDeviceId) {
          return {
            lastSeenAt: device.lastSeenAt ?? null,
            lastLocation: toLastLocation(device.lastLocation)
          };
        }

        const now = new Date();
        const from = new Date(now.getTime() - 30 * 60 * 1000);
        const positions = await deps.traccarClient.getPositions({
          deviceId: device.traccarDeviceId,
          from,
          to: now
        });
        const newest = pickNewestPosition(positions);
        if (!newest) {
          return {
            lastSeenAt: device.lastSeenAt ?? null,
            lastLocation: toLastLocation(device.lastLocation)
          };
        }

        const fixTime = new Date(newest.fixTime ?? newest.serverTime);
        device.lastSeenAt = fixTime;
        device.lastLocation = {
          lat: newest.latitude,
          lng: newest.longitude,
          heading: newest.course ?? undefined,
          speed: newest.speed ?? undefined,
          timestamp: fixTime,
          source: 'TRACCAR'
        };
        device.healthStatus = TrackingDeviceHealthStatus.ONLINE;
        await device.save();

        if (device.vehicleId) {
          const written = await writeLatestAndHistory({
            entityType: EntityType.VEHICLE,
            entityId: device.vehicleId.toString(),
            lat: newest.latitude,
            lng: newest.longitude,
            heading: newest.course ?? null,
            speed: newest.speed ?? null,
            accuracy: newest.accuracy ?? null,
            timestamp: fixTime,
            source: 'TRACCAR',
            minHistoryIntervalSeconds: 3
          });

          await ctx.pubsub.publish({
            topic: locationTopicForPartner(partnerId),
            payload: {
              partnerTrackingLocationUpdated: {
                ...written.latest,
                timestamp: written.latest.timestamp,
                receivedAt: written.latest.receivedAt
              }
            }
          });
        }

        return {
          lastSeenAt: device.lastSeenAt ?? null,
          lastLocation: toLastLocation(device.lastLocation)
        };
      },

      postLocationPing: async (_: unknown, args: any, ctx: GqlContext) => {
        const user = requirePartnerStaff(ctx);
        if (user.roles.includes(Role.ADMIN)) badRequest('Admin pings not implemented yet');
        const partnerId = user.partnerId!;

        const input = args.input as {
          entityType: EntityType;
          entityId: string;
          lat: number;
          lng: number;
          heading?: number;
          speed?: number;
          accuracy?: number;
          timestamp?: Date;
          source?: string;
        };

        if (!isValidLatLng(input.lat, input.lng)) badRequest('Invalid coordinates');

        const entityType = input.entityType;
        const entityId = input.entityId;
        const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
        const source = input.source ?? 'PHONE';

        if (entityType === EntityType.VEHICLE) {
          const vehicle = await VehicleModel.findById(entityId).lean();
          if (!vehicle) badRequest('Vehicle not found');
          if (vehicle.partnerId.toString() !== partnerId) forbidden();
        }

        if (entityType === EntityType.DELIVERY_TASK) {
          const booking = await BookingModel.findById(entityId).lean();
          if (!booking) badRequest('Booking not found');
          if (booking.partnerId.toString() !== partnerId) forbidden();
          if (!booking.deliveryTrackingEnabled) forbidden();
        }

        const written = await writeLatestAndHistory({
          entityType,
          entityId,
          lat: input.lat,
          lng: input.lng,
          heading: input.heading ?? null,
          speed: input.speed ?? null,
          accuracy: input.accuracy ?? null,
          timestamp,
          source,
          minHistoryIntervalSeconds: 3
        });

        await AuditLogModel.create({
          actorUserId: user.userId,
          partnerId,
          action: 'LOCATION_PING_RECEIVED',
          entityType,
          entityId,
          data: { source }
        });

        const payload = {
          entityType,
          entityId,
          lat: input.lat,
          lng: input.lng,
          heading: input.heading ?? null,
          speed: input.speed ?? null,
          accuracy: input.accuracy ?? null,
          timestamp,
          source,
          receivedAt: written.latest.receivedAt
        };

        if (entityType === EntityType.VEHICLE) {
          await ctx.pubsub.publish({
            topic: locationTopicForPartner(partnerId),
            payload: { partnerTrackingLocationUpdated: payload }
          });
        }

        if (entityType === EntityType.DELIVERY_TASK) {
          await ctx.pubsub.publish({
            topic: bookingTrackingTopic(entityId),
            payload: { bookingTrackingLocationUpdated: payload }
          });
        }

        return payload;
      }
    },

    Subscription: {
      partnerTrackingLocationUpdated: {
        subscribe: async (_: unknown, args: any, ctx: GqlContext) => {
          const user = requirePartnerStaff(ctx);
          const partnerId = String(args.partnerId);
          requirePartnerScope(user, partnerId);
          return ctx.pubsub.subscribe(locationTopicForPartner(partnerId));
        }
      },
      bookingTrackingLocationUpdated: {
        subscribe: async (_: unknown, args: any, ctx: GqlContext) => {
          const user = requireAuth(ctx);
          const bookingId = String(args.bookingId);
          const booking = await BookingModel.findById(bookingId).lean();
          if (!booking) badRequest('Booking not found');
          if (!booking.deliveryTrackingEnabled) forbidden();
          if (!user.roles.includes(Role.ADMIN) && booking.customerId.toString() !== user.userId) forbidden();
          return ctx.pubsub.subscribe(bookingTrackingTopic(bookingId));
        }
      },
      trackingDeviceHealthUpdated: {
        subscribe: async (_: unknown, args: any, ctx: GqlContext) => {
          const user = requirePartnerStaff(ctx);
          const partnerId = String(args.partnerId);
          requirePartnerScope(user, partnerId);
          return ctx.pubsub.subscribe(deviceHealthTopicForPartner(partnerId));
        }
      }
    }
  };
}

export function buildContext(deps: { traccarClient: TraccarClient }) {
  return (requestOrConn: any, reply?: any) => {
    const authHeader =
      requestOrConn?.headers?.authorization ??
      requestOrConn?.connectionParams?.authorization ??
      undefined;
    const authUser = getAuthUserFromAuthorizationHeader(authHeader);
    return {
      authUser,
      traccarClient: deps.traccarClient
    };
  };
}
