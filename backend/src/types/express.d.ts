import { Logger } from 'pino';
import { Role } from '@/contracts/auth';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface RequestSession {
  id: string;
  activeOrgId?: string | null;
  csrfSecret: string;
}

export interface RequestTenant {
  orgId: string;
  role: Role;
  projectId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: RequestUser;
      session?: RequestSession;
      tenant?: RequestTenant;
      log?: Logger;
    }
  }
}
