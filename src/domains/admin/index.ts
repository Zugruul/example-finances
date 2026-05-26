export {
    ImpersonationStartedEvent,
    ImpersonationEndedEvent,
    AdminActionTakenEvent,
    AdminGrantedEvent,
    AdminRemovedEvent,
    adminEvents,
    type AdminActionsStreamInstance,
    type AdminActionsStreamPattern,
    type PlatformRoleStreamInstance,
    type PlatformRoleStreamPattern,
} from './admin.events';
export type { AdminActionsState } from './admin.aggregate';
export type { AdminActivityDoc } from './admin.readmodel';
export type {
    PlatformRoleState,
    PlatformRole,
} from './platform-role.aggregate';
export type { PlatformRoleDoc } from './platform-roles.readmodel';
