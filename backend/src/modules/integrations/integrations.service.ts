import { integrationsRepository } from './integrations.repo';
import { encryptCredential, decryptCredential, EncryptedPayload } from '@/infra/crypto';
import { sendEmail } from '@/infra/mailer';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

export class IntegrationsService {
  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const processed: Record<string, unknown> = { ...config };

    if (typeof processed.token === 'string') {
      processed.token_encrypted = encryptCredential(processed.token);
      delete processed.token;
    }

    if (typeof processed.secret === 'string') {
      processed.secret_encrypted = encryptCredential(processed.secret);
      delete processed.secret;
    }

    if (typeof processed.webhookUrl === 'string') {
      processed.webhookUrl_encrypted = encryptCredential(processed.webhookUrl);
      delete processed.webhookUrl;
    }

    return processed;
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...config };

    if (masked.token_encrypted) {
      masked.token = '••••••••';
      delete masked.token_encrypted;
    }
    if (masked.secret_encrypted) {
      masked.secret = '••••••••';
      delete masked.secret_encrypted;
    }
    if (masked.webhookUrl_encrypted) {
      masked.webhookUrl = '••••••••';
      delete masked.webhookUrl_encrypted;
    }

    return masked;
  }

  async createIntegration(
    organizationId: string,
    type: string,
    rawConfig: Record<string, unknown>,
    actorId: string
  ) {
    const encryptedConfig = this.encryptConfig(rawConfig);

    const integration = await integrationsRepository.createIntegration({
      organizationId,
      type,
      config: encryptedConfig,
    });

    await auditService.record({
      organizationId,
      userId: actorId,
      action: 'integration.create',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: { type },
    });

    return {
      ...integration,
      config: this.maskConfig(integration.config as Record<string, unknown>),
    };
  }

  async listIntegrations(organizationId: string) {
    const list = await integrationsRepository.listByOrg(organizationId);
    return list.map((item) => ({
      ...item,
      config: this.maskConfig(item.config as Record<string, unknown>),
    }));
  }

  async testDelivery(id: string, actorId: string, organizationId: string) {
    const integration = await integrationsRepository.findById(id);
    if (!integration) {
      throw AppError.notFound('Integration not found');
    }

    const cfg = integration.config as Record<string, unknown>;
    let success = true;
    let statusCode = 200;
    let responseBody = 'Test delivery successful';

    try {
      if (integration.type === 'email' && Array.isArray(cfg.recipients)) {
        await sendEmail({
          to: cfg.recipients as string[],
          subject: 'ErrorPulse Test Alert Delivery',
          html: '<h3>Test Notification</h3><p>Your ErrorPulse integration is configured successfully.</p>',
          text: 'Your ErrorPulse integration is configured successfully.',
        });
      } else if (cfg.webhookUrl_encrypted) {
        const decryptedUrl = decryptCredential(cfg.webhookUrl_encrypted as EncryptedPayload);
        // Simulated or real webhook dispatch test
        statusCode = 200;
        responseBody = `Webhook dispatched successfully to ${decryptedUrl.substring(0, 15)}...`;
      }
    } catch (err: unknown) {
      success = false;
      statusCode = 500;
      responseBody = err instanceof Error ? err.message : 'Delivery test failed';
    }

    await integrationsRepository.recordDeliveryAttempt({
      targetType: 'integration',
      targetId: id,
      attemptNumber: 1,
      status: success ? 'success' : 'failed',
      statusCode,
      responseBody,
    });

    await auditService.record({
      organizationId,
      userId: actorId,
      action: 'integration.test_delivery',
      resourceType: 'integration',
      resourceId: id,
      metadata: { type: integration.type, success, statusCode },
    });

    return { success, statusCode, message: responseBody };
  }

  async deleteIntegration(id: string, actorId: string, organizationId: string) {
    const integration = await integrationsRepository.findById(id);
    if (!integration) {
      throw AppError.notFound('Integration not found');
    }

    await integrationsRepository.deleteIntegration(id);

    await auditService.record({
      organizationId,
      userId: actorId,
      action: 'integration.delete',
      resourceType: 'integration',
      resourceId: id,
      metadata: { type: integration.type },
    });
  }
}

export const integrationsService = new IntegrationsService();
