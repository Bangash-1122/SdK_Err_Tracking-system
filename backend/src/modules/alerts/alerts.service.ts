import { alertsRepository } from './alerts.repo';
import { CreateAlertRuleBody } from '@/contracts/releases-alerts';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

export class AlertsService {
  async createAlertRule(
    projectId: string,
    body: CreateAlertRuleBody,
    actorId: string,
    orgId: string
  ) {
    const rule = await alertsRepository.createAlertRule(projectId, body);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'alert_rule.create',
      resourceType: 'alert_rule',
      resourceId: rule.id,
      metadata: { name: body.name },
    });

    return rule;
  }

  async listAlertRules(projectId: string) {
    return alertsRepository.listAlertRules(projectId);
  }

  async getAlertRule(id: string) {
    const rule = await alertsRepository.findById(id);
    if (!rule) {
      throw AppError.notFound('Alert rule not found');
    }
    return rule;
  }

  async updateAlertRule(
    id: string,
    body: Partial<CreateAlertRuleBody>,
    actorId: string,
    orgId: string
  ) {
    const rule = await alertsRepository.findById(id);
    if (!rule) {
      throw AppError.notFound('Alert rule not found');
    }

    const updated = await alertsRepository.updateAlertRule(id, body);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'alert_rule.update',
      resourceType: 'alert_rule',
      resourceId: id,
      metadata: { ...body },
    });

    return updated!;
  }

  async deleteAlertRule(id: string, actorId: string, orgId: string) {
    const rule = await alertsRepository.findById(id);
    if (!rule) {
      throw AppError.notFound('Alert rule not found');
    }

    await alertsRepository.deleteAlertRule(id);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'alert_rule.delete',
      resourceType: 'alert_rule',
      resourceId: id,
      metadata: { name: rule.name },
    });
  }
}

export const alertsService = new AlertsService();
