import { issuesRepository } from './issues.repo';
import {
  ListIssuesQuery,
  IssueStatus,
  IssueSeverity,
} from '@/contracts/issue';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

export class IssuesService {
  async listIssues(projectId: string, query: ListIssuesQuery) {
    const search = query.search || query.query || query.searchQuery;

    return issuesRepository.listIssues({
      projectId,
      status: query.status,
      severity: query.severity,
      search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async searchIssues(projectId: string, query: string, limit: number = 20) {
    if (!query || query.trim() === '') {
      return [];
    }

    return issuesRepository.searchIssues(projectId, query.trim(), limit);
  }

  async getIssueDetail(issueId: string, projectId?: string) {
    const data = await issuesRepository.findIssueWithLatestEvent(issueId, projectId);
    if (!data) {
      throw AppError.notFound('Issue not found');
    }

    const { issue, latestEvent } = data;

    return {
      id: issue.id,
      projectId: issue.projectId,
      title: issue.title,
      type: issue.type,
      culprit: latestEvent?.request
        ? (latestEvent.request as Record<string, unknown>).url
        : issue.type,
      status: issue.status as IssueStatus,
      severity: issue.severity as IssueSeverity,
      count: issue.count,
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      version: issue.version,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      latestEvent: latestEvent
        ? {
            id: latestEvent.id,
            timestamp: latestEvent.timestamp,
            environment: latestEvent.environment,
            release: latestEvent.release,
            stacktrace: latestEvent.stacktrace,
            breadcrumbs: latestEvent.breadcrumbs,
            tags: latestEvent.tags,
            extra: latestEvent.extra,
            user: latestEvent.user,
            request: latestEvent.request,
            sdk: latestEvent.sdk,
          }
        : null,
    };
  }

  async updateIssueStatus(
    issueId: string,
    status: IssueStatus,
    expectedVersion: number | undefined,
    actorId: string,
    orgId: string,
    projectId?: string
  ) {
    const existing = await issuesRepository.findIssueById(issueId, projectId);
    if (!existing) {
      throw AppError.notFound('Issue not found');
    }

    const updated = await issuesRepository.updateStatusOptimistic(
      issueId,
      status,
      expectedVersion,
      projectId
    );

    if (!updated) {
      throw AppError.conflict(
        'Optimistic lock failure: Issue was modified concurrently by another action. Please reload.'
      );
    }

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'issue.status_update',
      resourceType: 'issue',
      resourceId: issueId,
      metadata: {
        previousStatus: existing.status,
        newStatus: status,
        version: updated.version,
      },
    });

    return updated;
  }

  async bulkTriage(
    issueIds: string[],
    status: IssueStatus,
    actorId: string,
    orgId: string,
    projectId: string
  ) {
    const updated = await issuesRepository.bulkUpdateStatus(issueIds, status, projectId);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'issue.bulk_triage',
      resourceType: 'issue',
      metadata: {
        updatedCount: updated.length,
        status,
        issueIds,
      },
    });

    return { updatedCount: updated.length };
  }
}

export const issuesService = new IssuesService();
