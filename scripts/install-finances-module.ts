/**
 * CLI: install the Finances module on every existing tenant.
 *
 * Background: phase 1 of the Modules wave introduced the
 * `tenant-modules` domain. Pre-wave tenants don't have a
 * ModuleInstalled event for Finances on their stream, which means
 * the new route guard (`requireModule('finances')`) would 404 every
 * existing Finances page.
 *
 * This script is the one-shot migration: for every tenant present in
 * `rm_tenants`, emit a `ModuleInstalled { moduleId: 'finances' }`
 * event tagged with `installedByUserId: 'cli-migration'` (the same
 * sentinel pattern used by `grant-admin.ts`).
 *
 * Idempotent: the aggregate's `installModule` command short-circuits
 * when the module is already installed on the target tenant. Safe to
 * re-run.
 *
 * Usage:
 *   pnpm admin:install-finances-module
 *
 * Output:
 *   ✓ Installed Finances on tenant 6a17a9... (Personal)
 *   · Skipped Finances on tenant 6a17b0... (Work) — already installed
 *   ...
 *   Done: N tenants processed, M installed, K skipped.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { aggregates, readModels } from '@/sorc';
import { financesModule, FINANCES_MODULE_ID } from '@/modules/finances.manifest';
import type { TenantModuleStreamInstance } from '@/domains/tenant-modules';
import type { SorcUUID } from '@event-sorcerer/core';

const CLI_ACTOR = 'cli-migration' as SorcUUID;

function moduleStream(
    tenantId: string,
    moduleId: string,
): TenantModuleStreamInstance {
    return `tenant-${tenantId}-modules-${moduleId}` as TenantModuleStreamInstance;
}

async function main(): Promise<number> {
    const tenants = (await readModels.tenants.find({})).filter(
        (t) => !t.archivedAt,
    );

    let installed = 0;
    let skipped = 0;

    for (const t of tenants) {
        const tenantId = String(t.tenantId);
        const existing = await readModels.tenantModules.findOne({
            aggregateKey: `${tenantId}|${FINANCES_MODULE_ID}`,
        });
        if (existing) {
            console.log(
                `· Skipped Finances on tenant ${tenantId} (${t.displayName}) — already ${existing.status}`,
            );
            skipped++;
            continue;
        }

        const stream = moduleStream(tenantId, FINANCES_MODULE_ID);
        try {
            await aggregates.tenantModule.execute(
                'installModule',
                {
                    tenantId: tenantId as SorcUUID,
                    moduleId: FINANCES_MODULE_ID,
                    version: financesModule.version,
                    installedByUserId: CLI_ACTOR,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
            installed++;
            console.log(
                `✓ Installed Finances on tenant ${tenantId} (${t.displayName})`,
            );
        } catch (err) {
            console.error(
                `✗ Failed to install on ${tenantId} (${t.displayName}):`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    console.log(
        `\nDone: ${tenants.length} tenants processed, ${installed} installed, ${skipped} skipped.`,
    );

    // Need to nudge MongoClient to exit so the script doesn't hang.
    // The shared MongoClient lives inside `sorc.ts`; closing the
    // adapter here is best-effort.
    try {
        // No explicit handle — Node will exit after the process tick
        // once the shared MongoClient finishes its outstanding I/O.
        // If this lingers, ctrl-C is safe.
    } catch (err) {
        void err;
    }
    return 0;
}

main()
    .then((code) => {
        // Ensure the process exits even though the shared MongoClient
        // keeps the event loop alive.
        setTimeout(() => process.exit(code), 50);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
