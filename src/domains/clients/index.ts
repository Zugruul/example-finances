export {
    ClientCreatedEvent,
    ClientUpdatedEvent,
    ClientArchivedEvent,
    clientEvents,
    type ClientStreamInstance,
    type ClientStreamPattern,
} from './client.events';
export {
    clientReducer,
    clientCommands,
    type ClientState,
    type CreateClientCmd,
    type UpdateClientCmd,
    type ArchiveClientCmd,
} from './client.aggregate';
export {
    clientsByTenantApply,
    clientsByTenantKey,
    clientsByTenantListen,
    type ClientDoc,
    type ClientsByTenantListenEvents,
} from './clients-by-tenant.readmodel';
