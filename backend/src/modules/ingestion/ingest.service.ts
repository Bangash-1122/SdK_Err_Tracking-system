import { ingestRepository } from './ingest.repo';
import { scrubPii, computeFingerprint } from './fingerprint';
import { IngestEventPayload } from '@/contracts/event';
import { AppError } from '@/middleware/errors';

export interface ProcessEventResult {
  status: 'accepted' | 'ignored' | 'sampled_out';
  eventId?: string;
  issueId?: string;
  isNewIssue?: boolean;
  isRegression?: boolean;
  reason?: string;
}

export class IngestService {
  async authenticateApiKey(rawKey: string | undefined): Promise<{ projectId: string; keyPrefix: string }> {
    if (!rawKey || rawKey.trim() === '') {
      throw AppError.unauthorized('Missing required SDK ingestion API key');
    }

    const keyData = await ingestRepository.validateProjectKey(rawKey.trim());
    if (!keyData) {
      throw AppError.unauthorized('Invalid or inactive ingestion API key');
    }

    return keyData;
  }

  async processEvent(
    projectId: string,
    rawPayload: IngestEventPayload,
    clientIp?: string
  ): Promise<ProcessEventResult> {
    const settings = await ingestRepository.getProjectSettings(projectId);

    // Section D: Ignored Errors Filter
    const ignoredPatterns = (settings?.ignoredErrors as string[]) || [];
    const errorText = `${rawPayload.exception?.type || ''} ${rawPayload.exception?.value || ''} ${rawPayload.message || ''}`.trim();

    if (ignoredPatterns.length > 0 && errorText) {
      const isIgnored = ignoredPatterns.some((pattern) =>
        errorText.toLowerCase().includes(pattern.toLowerCase())
      );
      if (isIgnored) {
        return { status: 'ignored', reason: 'matched_ignored_errors' };
      }
    }

    // Section C: Error Sample Rate Evaluation
    const sampleRate = settings ? Number(settings.errorSampleRate) : 1.0;
    if (sampleRate < 1.0 && Math.random() > sampleRate) {
      return { status: 'sampled_out', reason: 'rate_sampled' };
    }

    // Section E: Sensitive Data Scrubbing
    const sensitiveFields = (settings?.sensitiveDataScrubbingFields as string[]) || undefined;

    const scrubbedPayload: IngestEventPayload = {
      ...rawPayload,
      breadcrumbs: (scrubPii(rawPayload.breadcrumbs, sensitiveFields) as typeof rawPayload.breadcrumbs) || [],
      extra: (scrubPii(rawPayload.extra, sensitiveFields) as typeof rawPayload.extra) || undefined,
      request: (scrubPii(rawPayload.request, sensitiveFields) as typeof rawPayload.request) || null,
      user: rawPayload.user
        ? {
            ...((scrubPii(rawPayload.user, sensitiveFields) as typeof rawPayload.user) || {}),
            ip_address: rawPayload.user.ip_address || clientIp,
          }
        : clientIp
        ? { ip_address: clientIp }
        : null,
    };

    // Deterministic SHA-256 Fingerprint
    const fingerprint = computeFingerprint(scrubbedPayload);

    // Severity mapping
    const levelToSeverity: Record<string, string> = {
      fatal: 'critical',
      error: 'high',
      warning: 'medium',
      info: 'low',
      debug: 'info',
    };
    const severity = levelToSeverity[scrubbedPayload.level] || 'high';

    const type = scrubbedPayload.exception?.type?.trim() || 'Error';
    const title = scrubbedPayload.exception?.value?.trim() || scrubbedPayload.message?.trim() || 'Unknown Error';

    const regressionEnabled = settings?.regressionDetectionEnabled ?? true;

    const result = await ingestRepository.recordIngestTransaction({
      projectId,
      fingerprint,
      title,
      type,
      severity,
      payload: scrubbedPayload,
      regressionDetectionEnabled: regressionEnabled,
    });

    return {
      status: 'accepted',
      eventId: result.eventId,
      issueId: result.issueId,
      isNewIssue: result.isNewIssue,
      isRegression: result.isRegression,
    };
  }

  getSdkHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'sdk-ingestion',
      version: '1.0.0',
    };
  }
}

export const ingestService = new IngestService();
