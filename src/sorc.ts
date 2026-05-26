// Sorc's generic threading currently requires a handful of structural
// `any`s at the Wave-A consumer boundary (event-class arrays, ReadModel
// `<Doc, AvailableSorcEvents, ListenEvents, SorcCtx>` over a Sorc whose
// event set is the union of all setupEvent calls). Tightening these
// belongs in Wave B once the Tenants domain has actually exercised the
// API end-to-end.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Sorc,
    type ISorcEvent,
    type DefaultISorcEvent,
} from '@event-sorcerer/core';
import { memorystore } from '@event-sorcerer/engine-memory';
import { createMongoStore } from '@event-sorcerer/engine-mongo';
import { MongoClient } from 'mongodb';
import { metricsPrometheus } from '@event-sorcerer/metrics-prometheus';
import { cryptoshredding } from '@event-sorcerer/plugin-cryptoshredding';
import {
    SorcReadModel,
    MemoryReadModelStore,
} from '@event-sorcerer/read-models';
import { collectDefaultMetrics } from 'prom-client';
import {
    tenantEvents,
    membershipEvents,
    type TenantStreamPattern,
    type MembershipStreamPattern,
} from '@/domains/tenants';
import {
    tenantReducer,
    tenantCommands,
} from '@/domains/tenants/tenant.aggregate';
import {
    membershipReducer,
    membershipCommands,
} from '@/domains/tenants/membership.aggregate';
import {
    tenantsApply,
    tenantsKey,
    tenantsListen,
    type TenantDoc,
} from '@/domains/tenants/tenant.readmodel';
import {
    membershipsApply,
    membershipsKey,
    membershipsListen,
    type MembershipDoc,
} from '@/domains/tenants/tenants.readmodel';
import {
    adminEvents,
    type AdminActionsStreamPattern,
    type PlatformRoleStreamPattern,
} from '@/domains/admin';
import {
    adminActionsReducer,
    adminCommands,
} from '@/domains/admin/admin.aggregate';
import {
    adminActivityApply,
    adminActivityKey,
    adminActivityListen,
    type AdminActivityDoc,
} from '@/domains/admin/admin.readmodel';
import {
    platformRoleReducer,
    platformRoleCommands,
} from '@/domains/admin/platform-role.aggregate';
import {
    platformRolesApply,
    platformRolesKey,
    platformRolesListen,
    type PlatformRoleDoc,
} from '@/domains/admin/platform-roles.readmodel';
import {
    activityApply,
    activityKey,
    activityListen,
    type ActivityDoc,
} from '@/domains/activity';
import {
    userEvents,
    type UserStreamPattern,
} from '@/domains/users';
import {
    userReducer,
    userCommands,
} from '@/domains/users/user.aggregate';
import {
    usersByIdApply,
    usersByIdKey,
    usersByIdListen,
    type UserByIdDoc,
} from '@/domains/users/users-by-id.readmodel';

// ----- HMR-safe singleton bootstrap -----

type FinancesSorcCache = {
    bundle: ReturnType<typeof buildSorc>;
    metrics: ReturnType<typeof metricsPrometheus>;
    readModels: ReturnType<typeof buildReadModels>;
};

function buildSorc(metrics: ReturnType<typeof metricsPrometheus>) {
    type AnyEventClass = new (
        ...args: any[]
    ) => ISorcEvent<DefaultISorcEvent>;

    // The example reuses the framework's MongoDB replica set. URI defaults
    // to localhost:27020-22 from `pnpm infra:up`. Override with
    // `FINANCES_MONGO_URI` (or fall back to `AUTH_MONGO_URI` so a single env
    // var configures both Auth.js and the event store in dev).
    const mongoUri =
        process.env.FINANCES_MONGO_URI ??
        process.env.AUTH_MONGO_URI ??
        'mongodb://localhost:27020,localhost:27021,localhost:27022/?replicaSet=rs0';

    const mongostore = createMongoStore({
        createClient: () =>
            new MongoClient(mongoUri, {
                // Default Mongo driver options are fine for Wave A. Db name
                // baked into the URI/connection — we use the default DB.
            }) as never,
        names: {
            getEventStoreCompendiumCollectionName: () => 'sorc-compendium',
            getEventStoreCollectionName: () => 'sorc-events',
            getCryptoKeysCollectionName: () => 'sorc-crypto-keys',
        },
    });

    const sorc = new Sorc()
        // Keep `memorystore` registered so the cryptoshredding key store has a
        // fallback in environments where Mongo isn't reachable (e.g. local
        // tests without `pnpm infra:up`). Mongostore is the real durable
        // store used by every aggregate below.
        .setupStore(memorystore)
        .setupStore(mongostore as never)
        .plugin(
            'cs',
            cryptoshredding({
                sensitiveTags: ['pii'],
                keys: [
                    'payload.tenantId',
                    'payload.userId',
                    'payload.membershipId',
                ],
                keyStoreName: 'mongostore',
            }),
        )
        .plugin('metrics', metrics)
        .setupEvent([...tenantEvents] as unknown as AnyEventClass[])
        .setupEvent([...membershipEvents] as unknown as AnyEventClass[])
        .setupEvent([...adminEvents] as unknown as AnyEventClass[])
        .setupEvent([...userEvents] as unknown as AnyEventClass[]);

    const aggregates = {
        tenant: sorc.aggregate({
            name: 'Tenant',
            streams: ['tenant-*' as TenantStreamPattern],
            events: [
                { name: 'TenantCreated', version: '*' },
                { name: 'TenantRenamed', version: '*' },
                { name: 'TenantArchived', version: '*' },
            ],
            initial: null as ReturnType<typeof tenantReducer>,
            reducer: tenantReducer as never,
            commands: tenantCommands as never,
        }),
        membership: sorc.aggregate({
            name: 'Membership',
            streams: ['tenant-*-membership-*' as MembershipStreamPattern],
            events: [
                { name: 'MemberInvited', version: '*' },
                { name: 'InvitationAccepted', version: '*' },
                { name: 'MemberRoleChanged', version: '*' },
                { name: 'MemberRemoved', version: '*' },
            ],
            initial: null as ReturnType<typeof membershipReducer>,
            reducer: membershipReducer as never,
            commands: membershipCommands as never,
        }),
        adminActions: sorc.aggregate({
            name: 'AdminActions',
            streams: ['admin-actions-*' as AdminActionsStreamPattern],
            events: [
                { name: 'ImpersonationStarted', version: '*' },
                { name: 'ImpersonationEnded', version: '*' },
                { name: 'AdminActionTaken', version: '*' },
            ],
            initial: null as ReturnType<typeof adminActionsReducer>,
            reducer: adminActionsReducer as never,
            commands: adminCommands as never,
        }),
        platformRole: sorc.aggregate({
            name: 'PlatformRole',
            streams: ['platform-role-*' as PlatformRoleStreamPattern],
            events: [
                { name: 'AdminGranted', version: '*' },
                { name: 'AdminRemoved', version: '*' },
            ],
            initial: null as ReturnType<typeof platformRoleReducer>,
            reducer: platformRoleReducer as never,
            commands: platformRoleCommands as never,
        }),
        users: sorc.aggregate({
            name: 'User',
            streams: ['user-*' as UserStreamPattern],
            events: [
                { name: 'UserCreated', version: '*' },
                { name: 'UserProfileUpdated', version: '*' },
                { name: 'UserDeleted', version: '*' },
            ],
            initial: null as ReturnType<typeof userReducer>,
            reducer: userReducer as never,
            commands: userCommands as never,
        }),
    };

    return { sorc, aggregates };
}

function buildReadModels(sorc: ReturnType<typeof buildSorc>['sorc']) {
    const tenants = new SorcReadModel<TenantDoc, any, any, typeof sorc>(
        sorc,
        {
            name: 'tenants',
            storeName: 'mongostore',
            events: tenantsListen as never,
            store: new MemoryReadModelStore<TenantDoc>(),
            key: tenantsKey as never,
            apply: tenantsApply as never,
        },
    );

    const memberships = new SorcReadModel<
        MembershipDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'memberships',
        storeName: 'mongostore',
        events: membershipsListen as never,
        store: new MemoryReadModelStore<MembershipDoc>(),
        key: membershipsKey as never,
        apply: membershipsApply as never,
    });

    const adminActivity = new SorcReadModel<
        AdminActivityDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'admin-activity',
        storeName: 'mongostore',
        events: adminActivityListen as never,
        store: new MemoryReadModelStore<AdminActivityDoc>(),
        key: adminActivityKey as never,
        apply: adminActivityApply as never,
    });

    const platformRoles = new SorcReadModel<
        PlatformRoleDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'platform-roles',
        storeName: 'mongostore',
        events: platformRolesListen as never,
        store: new MemoryReadModelStore<PlatformRoleDoc>(),
        key: platformRolesKey as never,
        apply: platformRolesApply as never,
    });

    const activity = new SorcReadModel<ActivityDoc, any, any, typeof sorc>(
        sorc,
        {
            name: 'activity',
            storeName: 'mongostore',
            events: activityListen as never,
            store: new MemoryReadModelStore<ActivityDoc>(),
            key: activityKey as never,
            apply: activityApply as never,
        },
    );

    const usersById = new SorcReadModel<UserByIdDoc, any, any, typeof sorc>(
        sorc,
        {
            name: 'users-by-id',
            storeName: 'mongostore',
            events: usersByIdListen as never,
            store: new MemoryReadModelStore<UserByIdDoc>(),
            key: usersByIdKey as never,
            apply: usersByIdApply as never,
        },
    );

    return {
        tenants,
        memberships,
        adminActivity,
        platformRoles,
        activity,
        usersById,
    };
}

const globalForSorc = globalThis as unknown as {
    __financesSorc?: FinancesSorcCache;
};

let cache = globalForSorc.__financesSorc;
if (!cache) {
    const metrics = metricsPrometheus({
        prefix: 'finances_',
        defaultLabels: { app: 'finances' },
    });
    collectDefaultMetrics({ register: metrics.registry });
    const bundle = buildSorc(metrics);
    const readModels = buildReadModels(bundle.sorc);

    // Subscribe read models at boot. 5s default polling per read-models pkg.
    void readModels.tenants.subscribe();
    void readModels.memberships.subscribe();
    void readModels.adminActivity.subscribe();
    void readModels.platformRoles.subscribe();
    void readModels.activity.subscribe();
    void readModels.usersById.subscribe();

    cache = { bundle, metrics, readModels };
    if (process.env.NODE_ENV !== 'production') {
        globalForSorc.__financesSorc = cache;
    }
}

export const sorc = cache.bundle.sorc;
export const aggregates = cache.bundle.aggregates;
export const readModels = cache.readModels;
export const metricsRegistry = cache.metrics.registry;
