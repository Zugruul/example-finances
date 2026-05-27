// Sorc's generic threading currently requires a handful of structural
// `any`s at the Wave-A consumer boundary (event-class arrays, ReadModel
// `<Doc, AvailableSorcEvents, ListenEvents, SorcCtx>` over a Sorc whose
// event set is the union of all setupEvent calls). Tightening these
// belongs in Wave B once the Tenants domain has actually exercised the
// API end-to-end.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Sorc,
    actorContextPlugin,
    type ISorcEvent,
    type DefaultISorcEvent,
} from '@event-sorcerer/core';
import { memorystore } from '@event-sorcerer/engine-memory';
import { createMongoStore } from '@event-sorcerer/engine-mongo';
import { MongoClient } from 'mongodb';
import {
    FINANCES_DB,
    getSharedMongoClient,
} from '@/lib/mongo';
import { metricsPrometheus } from '@event-sorcerer/metrics-prometheus';
import { cryptoshredding } from '@event-sorcerer/plugin-cryptoshredding';
import {
    SorcReadModel,
    MongoReadModelStore,
    type MongoReadModelIndex,
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
import { userEvents, type UserStreamPattern } from '@/domains/users';
import { userReducer, userCommands } from '@/domains/users/user.aggregate';
import {
    usersByIdApply,
    usersByIdKey,
    usersByIdListen,
    type UserByIdDoc,
} from '@/domains/users/users-by-id.readmodel';
import {
    userSettingsAuditApply,
    userSettingsAuditKey,
    userSettingsAuditListen,
    type UserSettingsAuditDoc,
} from '@/domains/users/user-settings-audit.readmodel';
import {
    accountEvents,
    accountReducer,
    accountCommands,
    accountsByTenantApply,
    accountsByTenantKey,
    accountsByTenantListen,
    accountBalanceApply,
    accountBalanceKey,
    accountBalanceListen,
    type AccountStreamPattern,
    type AccountDoc,
    type AccountBalanceDoc,
} from '@/domains/accounts';
import {
    categoryEvents,
    categoryReducer,
    categoryCommands,
    categoriesByTenantApply,
    categoriesByTenantKey,
    categoriesByTenantListen,
    type CategoryStreamPattern,
    type CategoryDoc,
} from '@/domains/categories';
import {
    transactionEvents,
    transactionReducer,
    transactionCommands,
    transactionsApply,
    transactionsKey,
    transactionsListen,
    type TransactionStreamPattern,
    type TransactionDoc,
} from '@/domains/transactions';
import {
    budgetEvents,
    budgetReducer,
    budgetCommands,
    budgetsByTenantApply,
    budgetsByTenantKey,
    budgetsByTenantListen,
    type BudgetStreamPattern,
    type BudgetDoc,
} from '@/domains/budgets';
import {
    templateEvents,
    templateReducer,
    templateCommands,
    recurringTemplatesApply,
    recurringTemplatesKey,
    recurringTemplatesListen,
    type TemplateStreamPattern,
    type RecurringTemplateDoc,
} from '@/domains/recurring-templates';
import {
    monthlyAggregateApply,
    monthlyAggregateKey,
    monthlyAggregateListen,
    type MonthlyAggregateDoc,
} from '@/domains/monthly-aggregates';

// ----- HMR-safe singleton bootstrap -----

type FinancesSorcCache = {
    bundle: ReturnType<typeof buildSorc>;
    metrics: ReturnType<typeof metricsPrometheus>;
    readModels: ReturnType<typeof buildReadModels>;
};

function buildSorc(metrics: ReturnType<typeof metricsPrometheus>) {
    type AnyEventClass = new (...args: any[]) => ISorcEvent<DefaultISorcEvent>;

    // Single shared MongoClient — same pool used by Auth.js and the read
    // models. The URI is rewritten to carry `/finances` as the default DB
    // (see `src/lib/mongo.ts`), so engine-mongo's `client.db()` resolves to
    // the consolidated `finances` database.
    const mongostore = createMongoStore({
        createClient: () => getSharedMongoClient() as never,
        names: {
            getEventStoreCompendiumCollectionName: () => 'events_compendium',
            getEventStoreCollectionName: () => 'events',
            getCryptoKeysCollectionName: () => 'events_crypto_keys',
        },
    });

    const sorc = new Sorc()
        // Keep `memorystore` registered so the cryptoshredding key store has a
        // fallback in environments where Mongo isn't reachable (e.g. local
        // tests without `pnpm infra:up`). Mongostore is the real durable
        // store used by every aggregate below.
        .setupStore(memorystore)
        .setupStore(mongostore as never)
        // Register actorContextPlugin BEFORE cryptoshredding so that
        // downstream beforeStorage hooks (including cs) observe the
        // already-stamped `actor` / `onBehalfOf` envelope metadata.
        // Reads from the per-request AsyncLocalStorage bound by
        // `withActorContext()` in `src/lib/actor-context.ts`; passthrough
        // outside a `requestContext.run()` scope.
        .plugin('actorContext', actorContextPlugin)
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
        .setupEvent([...userEvents] as unknown as AnyEventClass[])
        .setupEvent([...accountEvents] as unknown as AnyEventClass[])
        .setupEvent([...categoryEvents] as unknown as AnyEventClass[])
        .setupEvent([...transactionEvents] as unknown as AnyEventClass[])
        .setupEvent([...budgetEvents] as unknown as AnyEventClass[])
        .setupEvent([...templateEvents] as unknown as AnyEventClass[]);

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
                { name: 'UserDefaultCurrencyChanged', version: '*' },
                { name: 'UserTenantSelectorPrefChanged', version: '*' },
            ],
            initial: null as ReturnType<typeof userReducer>,
            reducer: userReducer as never,
            commands: userCommands as never,
        }),
        account: sorc.aggregate({
            name: 'Account',
            streams: ['account-*' as AccountStreamPattern],
            events: [
                { name: 'AccountCreated', version: '*' },
                { name: 'AccountRenamed', version: '*' },
                { name: 'AccountTypeChanged', version: '*' },
                { name: 'AccountArchived', version: '*' },
                { name: 'AccountClosed', version: '*' },
            ],
            initial: null as ReturnType<typeof accountReducer>,
            reducer: accountReducer as never,
            commands: accountCommands as never,
        }),
        category: sorc.aggregate({
            name: 'Category',
            streams: ['category-*' as CategoryStreamPattern],
            events: [
                { name: 'CategoryCreated', version: '*' },
                { name: 'CategoryRenamed', version: '*' },
                { name: 'CategoryReparented', version: '*' },
                { name: 'CategoryColorChanged', version: '*' },
                { name: 'CategoryArchived', version: '*' },
            ],
            initial: null as ReturnType<typeof categoryReducer>,
            reducer: categoryReducer as never,
            commands: categoryCommands as never,
        }),
        transaction: sorc.aggregate({
            name: 'Transaction',
            streams: ['transaction-*' as TransactionStreamPattern],
            events: [
                { name: 'TransactionRecorded', version: '*' },
                { name: 'TransactionUpdated', version: '*' },
                { name: 'TransactionDeleted', version: '*' },
            ],
            initial: null as ReturnType<typeof transactionReducer>,
            reducer: transactionReducer as never,
            commands: transactionCommands as never,
        }),
        budget: sorc.aggregate({
            name: 'Budget',
            streams: ['budget-*' as BudgetStreamPattern],
            events: [
                { name: 'BudgetCreated', version: '*' },
                { name: 'BudgetUpdated', version: '*' },
                { name: 'BudgetArchived', version: '*' },
            ],
            initial: null as ReturnType<typeof budgetReducer>,
            reducer: budgetReducer as never,
            commands: budgetCommands as never,
        }),
        recurringTemplate: sorc.aggregate({
            name: 'RecurringTemplate',
            streams: ['template-*' as TemplateStreamPattern],
            events: [
                { name: 'TemplateCreated', version: '*' },
                { name: 'TemplateUpdated', version: '*' },
                { name: 'TemplateArchived', version: '*' },
                { name: 'TemplateMaterialized', version: '*' },
            ],
            initial: null as ReturnType<typeof templateReducer>,
            reducer: templateReducer as never,
            commands: templateCommands as never,
        }),
    };

    return { sorc, aggregates };
}

function makeStore<Doc extends Record<string, any>>(
    client: MongoClient,
    collectionName: string,
    indexes: MongoReadModelIndex[],
) {
    return new MongoReadModelStore<Doc>({
        client,
        dbName: FINANCES_DB,
        collectionName,
        indexes,
    });
}

function buildReadModels(
    sorc: ReturnType<typeof buildSorc>['sorc'],
    client: MongoClient,
) {
    const tenants = new SorcReadModel<TenantDoc, any, any, typeof sorc>(sorc, {
        name: 'tenants',
        storeName: 'mongostore',
        events: tenantsListen as never,
        store: makeStore<TenantDoc>(client, 'rm_tenants', [
            { key: { tenantId: 1 }, options: { unique: true } },
        ]),
        key: tenantsKey as never,
        apply: tenantsApply as never,
    });

    const memberships = new SorcReadModel<MembershipDoc, any, any, typeof sorc>(
        sorc,
        {
            name: 'memberships',
            storeName: 'mongostore',
            events: membershipsListen as never,
            store: makeStore<MembershipDoc>(client, 'rm_memberships', [
                { key: { membershipId: 1 }, options: { unique: true } },
                { key: { tenantId: 1 } },
                { key: { userId: 1 } },
                { key: { invitedEmail: 1 } },
            ]),
            key: membershipsKey as never,
            apply: membershipsApply as never,
        },
    );

    const adminActivity = new SorcReadModel<
        AdminActivityDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'admin-activity',
        storeName: 'mongostore',
        events: adminActivityListen as never,
        store: makeStore<AdminActivityDoc>(client, 'rm_admin_activity', [
            { key: { eventId: 1 }, options: { unique: true } },
            { key: { occurredAt: -1 } },
        ]),
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
        store: makeStore<PlatformRoleDoc>(client, 'rm_platform_roles', [
            { key: { userId: 1 }, options: { unique: true } },
            { key: { role: 1 } },
        ]),
        key: platformRolesKey as never,
        apply: platformRolesApply as never,
    });

    const activity = new SorcReadModel<ActivityDoc, any, any, typeof sorc>(
        sorc,
        {
            name: 'activity',
            storeName: 'mongostore',
            events: activityListen as never,
            store: makeStore<ActivityDoc>(client, 'rm_activity', [
                { key: { eventId: 1 }, options: { unique: true } },
                { key: { tenantId: 1 } },
                { key: { occurredAt: -1 } },
            ]),
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
            store: makeStore<UserByIdDoc>(client, 'rm_users_by_id', [
                { key: { userId: 1 }, options: { unique: true } },
                { key: { email: 1 } },
            ]),
            key: usersByIdKey as never,
            apply: usersByIdApply as never,
        },
    );

    const userSettingsAudit = new SorcReadModel<
        UserSettingsAuditDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'user-settings-audit',
        storeName: 'mongostore',
        events: userSettingsAuditListen as never,
        store: makeStore<UserSettingsAuditDoc>(client, 'rm_user_settings_audit', [
            { key: { eventId: 1 }, options: { unique: true } },
            { key: { userId: 1, occurredAt: -1 } },
        ]),
        key: userSettingsAuditKey as never,
        apply: userSettingsAuditApply as never,
    });

    const accountsByTenant = new SorcReadModel<
        AccountDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'accounts-by-tenant',
        storeName: 'mongostore',
        events: accountsByTenantListen as never,
        store: makeStore<AccountDoc>(client, 'rm_accounts_by_tenant', [
            { key: { accountId: 1 }, options: { unique: true } },
            { key: { tenantId: 1 } },
        ]),
        key: accountsByTenantKey as never,
        apply: accountsByTenantApply as never,
    });

    const accountBalance = new SorcReadModel<
        AccountBalanceDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'account-balance',
        storeName: 'mongostore',
        events: accountBalanceListen as never,
        store: makeStore<AccountBalanceDoc>(client, 'rm_account_balance', [
            { key: { accountId: 1 }, options: { unique: true } },
            { key: { tenantId: 1 } },
        ]),
        key: accountBalanceKey as never,
        apply: accountBalanceApply as never,
    });

    const categoriesByTenant = new SorcReadModel<
        CategoryDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'categories-by-tenant',
        storeName: 'mongostore',
        events: categoriesByTenantListen as never,
        store: makeStore<CategoryDoc>(client, 'rm_categories_by_tenant', [
            { key: { categoryId: 1 }, options: { unique: true } },
            { key: { tenantId: 1 } },
            { key: { parentId: 1 } },
        ]),
        key: categoriesByTenantKey as never,
        apply: categoriesByTenantApply as never,
    });

    // Single transactions read model — per-transaction doc with multiple
    // secondary indexes (tenantId / accountId / categoryId / occurredOn)
    // covering the by-tenant / by-account / by-category access patterns
    // documented in [[domains-transactions]].
    const transactions = new SorcReadModel<
        TransactionDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'transactions',
        storeName: 'mongostore',
        events: transactionsListen as never,
        store: makeStore<TransactionDoc>(client, 'rm_transactions', [
            { key: { transactionId: 1 }, options: { unique: true } },
            { key: { tenantId: 1, occurredOn: -1 } },
            { key: { accountId: 1, occurredOn: -1 } },
            { key: { categoryId: 1, occurredOn: -1 } },
            { key: { templateId: 1 } },
        ]),
        key: transactionsKey as never,
        apply: transactionsApply as never,
    });

    const budgetsByTenant = new SorcReadModel<
        BudgetDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'budgets-by-tenant',
        storeName: 'mongostore',
        events: budgetsByTenantListen as never,
        store: makeStore<BudgetDoc>(client, 'rm_budgets_by_tenant', [
            { key: { categoryId: 1 }, options: { unique: true } },
            { key: { tenantId: 1 } },
            { key: { budgetId: 1 } },
        ]),
        key: budgetsByTenantKey as never,
        apply: budgetsByTenantApply as never,
    });

    const recurringTemplates = new SorcReadModel<
        RecurringTemplateDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'recurring-templates',
        storeName: 'mongostore',
        events: recurringTemplatesListen as never,
        store: makeStore<RecurringTemplateDoc>(client, 'rm_recurring_templates', [
            { key: { templateId: 1 }, options: { unique: true } },
            { key: { tenantId: 1 } },
            { key: { accountId: 1 } },
        ]),
        key: recurringTemplatesKey as never,
        apply: recurringTemplatesApply as never,
    });

    const monthlyAggregate = new SorcReadModel<
        MonthlyAggregateDoc,
        any,
        any,
        typeof sorc
    >(sorc, {
        name: 'monthly-aggregate',
        storeName: 'mongostore',
        events: monthlyAggregateListen as never,
        store: makeStore<MonthlyAggregateDoc>(client, 'rm_monthly_aggregate', [
            { key: { aggregateKey: 1 }, options: { unique: true } },
            { key: { tenantId: 1, year: -1, month: -1 } },
        ]),
        key: monthlyAggregateKey as never,
        apply: monthlyAggregateApply as never,
    });

    return {
        tenants,
        memberships,
        adminActivity,
        platformRoles,
        activity,
        usersById,
        userSettingsAudit,
        accountsByTenant,
        accountBalance,
        categoriesByTenant,
        transactions,
        budgetsByTenant,
        recurringTemplates,
        monthlyAggregate,
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

    // Read-model store reuses the shared MongoClient (same connection pool
    // as the event store and Auth.js — see src/lib/mongo.ts).
    const readModels = buildReadModels(bundle.sorc, getSharedMongoClient());

    // Subscribe read models at boot. 5s default polling per read-models pkg.
    void readModels.tenants.subscribe();
    void readModels.memberships.subscribe();
    void readModels.adminActivity.subscribe();
    void readModels.platformRoles.subscribe();
    void readModels.activity.subscribe();
    void readModels.usersById.subscribe();
    void readModels.userSettingsAudit.subscribe();
    void readModels.accountsByTenant.subscribe();
    void readModels.accountBalance.subscribe();
    void readModels.categoriesByTenant.subscribe();
    void readModels.transactions.subscribe();
    void readModels.budgetsByTenant.subscribe();
    void readModels.recurringTemplates.subscribe();
    void readModels.monthlyAggregate.subscribe();

    cache = { bundle, metrics, readModels };
    if (process.env.NODE_ENV !== 'production') {
        globalForSorc.__financesSorc = cache;
    }
}

export const sorc = cache.bundle.sorc;
export const aggregates = cache.bundle.aggregates;
export const readModels = cache.readModels;
export const metricsRegistry = cache.metrics.registry;
