import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// The Auth.js MongoDB adapter needs the Node runtime.
export const runtime = 'nodejs';
