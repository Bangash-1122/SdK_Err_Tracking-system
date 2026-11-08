import { Request, Response } from 'express';
import { issuesService } from './issues.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class IssuesController {
  listIssues = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId || (req.params.projectId as string);
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required to list issues');
    }

    const { items, nextCursor } = await issuesService.listIssues(projectId, req.query);

    const envelope: ApiSuccessEnvelope<typeof items> = {
      success: true,
      data: items,
      meta: {
        requestId: req.id,
        nextCursor,
      },
    };

    res.status(200).json(envelope);
  };

  searchIssues = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required to search issues');
    }

    const query = (req.query.q as string) || (req.query.query as string) || '';
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const results = await issuesService.searchIssues(projectId, query, limit);

    const envelope: ApiSuccessEnvelope<typeof results> = {
      success: true,
      data: results,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getIssueDetail = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) {
      throw AppError.badRequest('Issue ID is required');
    }

    const projectId = req.tenant?.projectId || undefined;
    const detail = await issuesService.getIssueDetail(id, projectId);

    const envelope: ApiSuccessEnvelope<typeof detail> = {
      success: true,
      data: detail,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Issue ID and organization context are required');
    }

    const expectedVersion =
      req.body.version !== undefined
        ? Number(req.body.version)
        : req.body.optimisticVersion !== undefined
        ? Number(req.body.optimisticVersion)
        : undefined;

    const updated = await issuesService.updateIssueStatus(
      id,
      req.body.status,
      expectedVersion,
      req.user!.id,
      orgId,
      req.tenant?.projectId || undefined
    );

    const envelope: ApiSuccessEnvelope<typeof updated> = {
      success: true,
      data: updated,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  bulkTriage = async (req: Request, res: Response): Promise<void> => {
    const projectId = req.body.projectId || req.tenant?.projectId;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const result = await issuesService.bulkTriage(
      req.body.issueIds,
      req.body.status,
      req.user!.id,
      orgId,
      projectId
    );

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const issuesController = new IssuesController();
