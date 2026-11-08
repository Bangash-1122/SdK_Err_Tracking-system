import { Router } from 'express';
import { membersController } from './members.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import {
  InviteMemberBodySchema,
  UpdateMemberRoleBodySchema,
} from '@/contracts/organization';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', membersController.listMembers);

router.post(
  '/',
  requireRole(['Owner', 'Administrator']),
  validateRequest({ body: InviteMemberBodySchema }),
  membersController.inviteMember
);

router.patch(
  '/:memberId/role',
  requireRole(['Owner', 'Administrator']),
  validateRequest({ body: UpdateMemberRoleBodySchema }),
  membersController.updateRole
);

router.delete(
  '/:memberId',
  requireRole(['Owner', 'Administrator']),
  membersController.removeMember
);

export const membersRoutes = router;

