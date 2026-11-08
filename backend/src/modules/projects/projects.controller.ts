import { Request, Response } from 'express';
import { projectsService } from './projects.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { ProjectDto, RotateKeyResponse } from '@/contracts/project';
import { ProjectSettings } from '@/contracts/settings';
import { AppError } from '@/middleware/errors';

export class ProjectsController {
  createProject = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.body.organizationId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const { project, rawIngestionKey } = await projectsService.createProject(
      orgId,
      req.body,
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<ProjectDto & { rawIngestionKey: string }> = {
      success: true,
      data: {
        ...project,
        rawIngestionKey,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  listProjects = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.query.organizationId as string || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const projects = await projectsService.listProjects(orgId);

    const envelope: ApiSuccessEnvelope<ProjectDto[]> = {
      success: true,
      data: projects,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getProject = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    if (!projectId) {
      throw AppError.badRequest('Project ID is required');
    }

    const project = await projectsService.getProject(projectId);

    const envelope: ApiSuccessEnvelope<ProjectDto> = {
      success: true,
      data: project,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateProject = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const updated = await projectsService.updateProject(
      projectId,
      req.body,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<ProjectDto> = {
      success: true,
      data: updated,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  rotateKey = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const result = await projectsService.rotateKey(projectId, req.user!.id, orgId);

    const envelope: ApiSuccessEnvelope<RotateKeyResponse> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  deleteProject = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    await projectsService.deleteProject(projectId, req.user!.id, orgId);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: { message: 'Project and all associated resources deleted successfully' },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    if (!projectId) {
      throw AppError.badRequest('Project ID is required');
    }

    const settings = await projectsService.getSettings(projectId);

    const envelope: ApiSuccessEnvelope<ProjectSettings & { version: number }> = {
      success: true,
      data: settings,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const expectedVersion = req.body.version !== undefined ? Number(req.body.version) : undefined;
    const updateData = { ...req.body };
    delete updateData.version;

    const settings = await projectsService.updateSettings(
      projectId,
      updateData,
      expectedVersion,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<ProjectSettings & { version: number }> = {
      success: true,
      data: settings,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const projectsController = new ProjectsController();

