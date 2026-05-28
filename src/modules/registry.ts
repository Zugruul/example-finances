import { financesModule, FINANCES_MODULE_ID } from './finances.manifest';
import {
    psychologistModule,
    PSYCHOLOGIST_MODULE_ID,
} from './psychologist.manifest';
import {
    communicationModule,
    COMMUNICATION_MODULE_ID,
} from './communication.manifest';
import type { ModuleManifest } from './types';

/**
 * Catalog of every known module. The `/modules` page renders one
 * card per entry; the route guard (requireModule) and the sidebar
 * builder look up manifests here by id.
 *
 * Adding a module: define its manifest in a sibling file, import +
 * spread it into MODULES here, then ship.
 */
export const MODULES: Record<string, ModuleManifest> = {
    [FINANCES_MODULE_ID]: financesModule,
    [PSYCHOLOGIST_MODULE_ID]: psychologistModule,
    [COMMUNICATION_MODULE_ID]: communicationModule,
};

export function getModule(id: string): ModuleManifest | undefined {
    return MODULES[id];
}

export function listModules(): ModuleManifest[] {
    return Object.values(MODULES);
}

export { FINANCES_MODULE_ID } from './finances.manifest';
export { PSYCHOLOGIST_MODULE_ID } from './psychologist.manifest';
export { COMMUNICATION_MODULE_ID } from './communication.manifest';
export type { ModuleManifest, ModulePage } from './types';
