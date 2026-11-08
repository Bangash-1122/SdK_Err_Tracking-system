import { Router } from 'express';
import { issuesController } from './issues.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import {
  ListIssuesQuerySchema,
  UpdateIssueStatusBodySchema,
  BulkTriageIssuesBodySchema,
} from '@/contracts/issue';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  validateRequest({ query: ListIssuesQuerySchema }),
  issuesController.listIssues
);

router.get(
  '/search',
  issuesController.searchIssues
);

router.get(
  '/:id',
  issuesController.getIssueDetail
);

router.patch(
  '/:id',
  validateRequest({ body: UpdateIssueStatusBodySchema }),
  issuesController.updateStatus
);

router.post(
  '/bulk-triage',
  validateRequest({ body: BulkTriageIssuesBodySchema }),
  issuesController.bulkTriage
);

export const issuesRoutes = router;
