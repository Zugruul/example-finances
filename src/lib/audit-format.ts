/**
 * Human-readable formatters for audit cards. Pure: takes the persisted
 * event shape, returns `{ title, detail?, domain }` so the UI can render
 * something a member would understand without seeing UUIDs.
 *
 * Identity / name lookups are passed in as `Maps` so the page can do one
 * batched read of the account / category / user read models and not
 * re-query per event.
 */

export type AuditDomain =
    | 'accounts'
    | 'transactions'
    | 'categories'
    | 'budgets'
    | 'recurring-templates'
    | 'tenants'
    | 'users'
    | 'other';

export interface AuditCard {
    uuid: string;
    publishedAt: string; // ISO
    name: string;
    domain: AuditDomain;
    title: string;
    detail?: string;
    accountId?: string;
    categoryId?: string;
    actorUserId?: string;
    actorEmail?: string;
    stream: string;
}

export interface AuditCtx {
    accounts: Map<string, { displayName: string; currency: string }>;
    categories: Map<string, { displayName: string }>;
    users: Map<string, { email: string }>;
}

function fmtMinor(amount: number, currency: string): string {
    if (!Number.isFinite(amount)) return String(amount);
    const major = amount / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
        }).format(major);
    } catch {
        return `${major.toFixed(2)} ${currency}`;
    }
}

function accountName(id: string | undefined, ctx: AuditCtx): string {
    if (!id) return 'unknown account';
    return ctx.accounts.get(String(id))?.displayName ?? 'unknown account';
}

function categoryName(id: string | undefined, ctx: AuditCtx): string {
    if (!id) return undefined as unknown as string;
    return ctx.categories.get(String(id))?.displayName ?? 'unknown category';
}

function streamDomain(stream: string): AuditDomain {
    const head = stream.split('-')[0];
    switch (head) {
        case 'account':
            return 'accounts';
        case 'transaction':
            return 'transactions';
        case 'category':
            return 'categories';
        case 'budget':
            return 'budgets';
        case 'template':
        case 'recurring':
            return 'recurring-templates';
        case 'tenant':
            return 'tenants';
        case 'user':
            return 'users';
        default:
            return 'other';
    }
}

interface RawEvent {
    uuid: string;
    name: string;
    version: string;
    stream: string;
    publishedAt: string | Date;
    payload: Record<string, any>;
}

export function formatAuditEvent(
    ev: RawEvent,
    ctx: AuditCtx,
): AuditCard {
    const p = ev.payload ?? {};
    const domain = streamDomain(ev.stream);
    const publishedAt =
        typeof ev.publishedAt === 'string'
            ? ev.publishedAt
            : new Date(ev.publishedAt).toISOString();
    const actorUserId = String(
        p.recordedByUserId ??
            p.updatedByUserId ??
            p.deletedByUserId ??
            p.createdByUserId ??
            p.archivedByUserId ??
            p.removedByUserId ??
            p.changedByUserId ??
            p.addedByUserId ??
            '',
    );
    const actorEmail = actorUserId
        ? ctx.users.get(actorUserId)?.email
        : undefined;
    const card: AuditCard = {
        uuid: ev.uuid,
        publishedAt,
        name: ev.name,
        domain,
        stream: ev.stream,
        accountId: p.accountId ? String(p.accountId) : undefined,
        categoryId: p.categoryId ? String(p.categoryId) : undefined,
        actorUserId: actorUserId || undefined,
        actorEmail,
        title: ev.name,
    };

    const acct = (id?: string) => accountName(id, ctx);
    const cat = (id?: string) => categoryName(id, ctx);
    const currencyOf = (id?: string) =>
        ctx.accounts.get(String(id ?? ''))?.currency ?? 'USD';

    switch (ev.name) {
        // ---------- transactions ----------
        case 'TransactionRecorded': {
            const cur = p.currency ?? currencyOf(p.accountId);
            const money = fmtMinor(p.amount, cur);
            const verb =
                p.transactionType === 'income'
                    ? 'Recorded income'
                    : p.transactionType === 'expense'
                      ? 'Recorded expense'
                      : p.transferDirection === 'debit'
                        ? 'Transferred out'
                        : 'Transferred in';
            const catLbl = cat(p.categoryId);
            const desc = p.description ? ` — ${p.description}` : '';
            const catSuffix = catLbl ? ` · ${catLbl}` : '';
            card.title = `${verb} ${money} on ${acct(p.accountId)}${catSuffix}`;
            card.detail = `${p.occurredOn}${desc}`;
            return card;
        }
        case 'TransactionUpdated': {
            const cur = currencyOf(p.accountId);
            const fields: string[] = [];
            if (p.amount !== undefined && p.amount !== p.priorAmount) {
                fields.push(
                    `amount ${fmtMinor(p.priorAmount, cur)} → ${fmtMinor(
                        p.amount,
                        cur,
                    )}`,
                );
            }
            if (
                p.categoryId !== undefined &&
                String(p.categoryId) !== String(p.priorCategoryId ?? '')
            ) {
                fields.push(
                    `category ${cat(p.priorCategoryId) ?? '—'} → ${cat(p.categoryId) ?? '—'}`,
                );
            }
            if (
                p.occurredOn !== undefined &&
                p.occurredOn !== p.priorOccurredOn
            ) {
                fields.push(`date ${p.priorOccurredOn} → ${p.occurredOn}`);
            }
            if (p.description !== undefined) {
                fields.push(`description "${p.description}"`);
            }
            card.title = `Edited transaction on ${acct(p.accountId)}`;
            card.detail = fields.length
                ? fields.join(' · ')
                : 'no field changes';
            return card;
        }
        case 'TransactionDeleted': {
            const cur = currencyOf(p.accountId);
            card.title = `Deleted ${
                p.transactionType === 'transfer' ? 'transfer leg' : p.transactionType
            } of ${fmtMinor(p.amount, cur)} on ${acct(p.accountId)}`;
            card.detail = p.occurredOn ?? undefined;
            return card;
        }

        // ---------- accounts ----------
        case 'AccountCreated': {
            card.title = `Opened account ${p.name ?? p.displayName ?? ''} (${p.currency})`;
            card.accountId = String(p.accountId);
            return card;
        }
        case 'AccountRenamed': {
            card.title = `Renamed account to "${p.name ?? p.displayName}"`;
            return card;
        }
        case 'AccountTypeChanged': {
            card.title = `Changed account type to ${p.type}`;
            return card;
        }
        case 'AccountClosed': {
            card.title = `Closed account ${acct(p.accountId)}`;
            return card;
        }
        case 'AccountArchived': {
            card.title = `Archived account ${acct(p.accountId)}`;
            return card;
        }

        // ---------- categories ----------
        case 'CategoryCreated': {
            card.title = `Created category "${p.name ?? p.displayName}" (${p.type})`;
            return card;
        }
        case 'CategoryRenamed': {
            card.title = `Renamed category to "${p.name ?? p.displayName}"`;
            return card;
        }
        case 'CategoryReparented': {
            const parent = p.parentCategoryId
                ? cat(p.parentCategoryId)
                : 'top-level';
            card.title = `Moved category under ${parent}`;
            return card;
        }
        case 'CategoryColorChanged': {
            card.title = `Changed category color${p.color ? ` to ${p.color}` : ''}`;
            return card;
        }
        case 'CategoryArchived': {
            card.title = `Archived a category`;
            return card;
        }

        // ---------- budgets ----------
        case 'BudgetCreated': {
            const money = fmtMinor(p.monthlyAmount, p.currency ?? 'USD');
            card.title = `Set monthly budget of ${money} for ${cat(p.categoryId)}`;
            card.detail = `rollover: ${p.rolloverPolicy}`;
            return card;
        }
        case 'BudgetUpdated': {
            const fields: string[] = [];
            if (p.monthlyAmount !== undefined)
                fields.push(
                    `monthly → ${fmtMinor(p.monthlyAmount, currencyOf(p.accountId) ?? 'USD')}`,
                );
            if (p.rolloverPolicy !== undefined)
                fields.push(`rollover → ${p.rolloverPolicy}`);
            card.title = `Updated budget for ${cat(p.categoryId)}`;
            card.detail = fields.join(' · ') || 'no field changes';
            return card;
        }
        case 'BudgetArchived': {
            card.title = `Archived budget for ${cat(p.categoryId)}`;
            return card;
        }

        // ---------- recurring templates ----------
        case 'TemplateCreated': {
            const money = fmtMinor(p.amount, currencyOf(p.accountId));
            card.title = `Created recurring ${p.transactionType} of ${money} on ${acct(p.accountId)}`;
            card.detail = `starts ${p.startsOn}`;
            return card;
        }
        case 'TemplateUpdated': {
            card.title = `Updated recurring template`;
            return card;
        }
        case 'TemplateArchived': {
            card.title = `Archived recurring template`;
            return card;
        }
        case 'TemplateMaterialized': {
            card.title = `Materialized recurring transaction for ${p.materializedOn}`;
            return card;
        }

        // ---------- members ----------
        case 'MemberInvited': {
            const who = p.invitedEmail ?? p.email ?? 'a member';
            card.title = `Invited ${who} as ${p.role}`;
            card.actorUserId = p.invitedByUserId
                ? String(p.invitedByUserId)
                : card.actorUserId;
            card.actorEmail = card.actorUserId
                ? ctx.users.get(card.actorUserId)?.email
                : card.actorEmail;
            return card;
        }
        case 'InvitationAccepted': {
            const userId = p.userId ? String(p.userId) : undefined;
            const who = userId
                ? (ctx.users.get(userId)?.email ?? 'a user')
                : 'a user';
            card.title = `${who} joined the workspace`;
            return card;
        }
        case 'MemberRoleChanged': {
            card.title = `Changed member role to ${p.role}`;
            return card;
        }
        case 'MemberRemoved': {
            card.title = `Removed a member`;
            return card;
        }

        // ---------- tenants ----------
        case 'TenantCreated': {
            card.title = `Created workspace "${p.displayName ?? p.name}"`;
            return card;
        }
        case 'TenantRenamed': {
            card.title = `Renamed workspace to "${p.displayName ?? p.name}"`;
            return card;
        }
        case 'TenantArchived': {
            card.title = `Archived workspace`;
            return card;
        }
        case 'InvitationAccepted': {
            card.title = `Accepted invitation`;
            return card;
        }

        default:
            card.title = ev.name;
            return card;
    }
}

export const AUDIT_DOMAINS: { value: AuditDomain | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'accounts', label: 'Accounts' },
    { value: 'categories', label: 'Categories' },
    { value: 'budgets', label: 'Budgets' },
    { value: 'recurring-templates', label: 'Recurring' },
    { value: 'tenants', label: 'Workspace' },
];
