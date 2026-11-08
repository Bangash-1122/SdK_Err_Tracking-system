import { auditRepository, CreateAuditLogParams, ListAuditLogsOptions } from './audit.repo';
import { logger } from '@/middleware/logger.middleware';

export class AuditService {
  /**
   * Records an immutable security or administrative audit event.
   * Catches errors internally so audit logging failures never break primary business logic.
   */
  async record(params: CreateAuditLogParams): Promise<void> {
    try {
      await auditRepository.insert(params);
    } catch (err) {
      logger.error(
        { err, action: params.action, orgId: params.organizationId },
        'Failed to record audit log entry'
      );
    }
  }

  async listAuditLogs(orgId: string, options: ListAuditLogsOptions) {
    return auditRepository.findByOrganization(orgId, options);
  }
}

export const auditService = new AuditService();

