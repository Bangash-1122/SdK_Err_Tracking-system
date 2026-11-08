import { membersRepository } from './members.repo';
import { InviteMemberBody } from '@/contracts/organization';
import { Role } from '@/contracts/auth';
import { auditService } from '@/modules/audit/audit.service';
import { sendEmail } from '@/infra/mailer';
import { hashPassword, generateRandomHex64 } from '@/infra/crypto';
import { AppError } from '@/middleware/errors';

export class MembersService {
  async listMembers(orgId: string) {
    const list = await membersRepository.listMembers(orgId);
    return list.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
      role: m.role as Role,
      createdAt: m.createdAt,
    }));
  }

  async inviteMember(
    orgId: string,
    body: InviteMemberBody,
    actorId: string
  ) {
    const email = body.email.toLowerCase().trim();

    // Check if user exists
    let user = await membersRepository.findUserByEmail(email);

    if (user) {
      // Check if already a member of this organization
      const existingMembership = await membersRepository.findMembership(orgId, user.id);
      if (existingMembership) {
        throw AppError.conflict('User is already a member of this organization');
      }
    } else {
      // Create invited user placeholder with secure random password
      const randomPass = generateRandomHex64();
      const passwordHash = await hashPassword(randomPass);
      const displayName = email.split('@')[0] || 'Team Member';

      user = await membersRepository.createPlaceholderUser(
        email,
        displayName,
        passwordHash
      );
    }

    const member = await membersRepository.addMember({
      orgId,
      userId: user.id,
      role: body.role,
    });

    // Dispatch invitation email
    await sendEmail({
      to: email,
      subject: 'You have been invited to ErrorPulse',
      html: `
        <h2>Team Invitation</h2>
        <p>You have been invited to collaborate as <strong>${body.role}</strong>.</p>
        <p>Log in to your ErrorPulse dashboard to access your projects and observability stream.</p>
      `,
      text: `You have been invited to ErrorPulse as a ${body.role}. Please log in to your account.`,
    });

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'member.invite',
      resourceType: 'member',
      resourceId: member.id,
      metadata: { email, role: body.role, memberId: member.id },
    });

    return {
      id: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role as Role,
      createdAt: member.createdAt,
    };
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    newRole: Role,
    actorId: string
  ) {
    const member = await membersRepository.findMemberById(memberId);
    if (!member) {
      throw AppError.notFound('Member not found');
    }

    if (member.orgId !== orgId) {
      throw AppError.forbidden('Member does not belong to this organization');
    }

    // Last-Owner protection
    if (member.role === 'Owner' && newRole !== 'Owner') {
      const ownerCount = await membersRepository.countOwners(orgId);
      if (ownerCount <= 1) {
        throw AppError.forbidden(
          'Cannot demote the last Owner of the organization. Promote another member to Owner first.'
        );
      }
    }

    const updated = await membersRepository.updateMemberRole(memberId, newRole);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'member.role_update',
      resourceType: 'member',
      resourceId: memberId,
      metadata: { previousRole: member.role, newRole },
    });

    return {
      id: updated!.id,
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: updated!.role as Role,
    };
  }

  async removeMember(
    orgId: string,
    memberId: string,
    actorId: string
  ) {
    const member = await membersRepository.findMemberById(memberId);
    if (!member) {
      throw AppError.notFound('Member not found');
    }

    if (member.orgId !== orgId) {
      throw AppError.forbidden('Member does not belong to this organization');
    }

    // Last-Owner protection
    if (member.role === 'Owner') {
      const ownerCount = await membersRepository.countOwners(orgId);
      if (ownerCount <= 1) {
        throw AppError.forbidden(
          'Cannot remove the last Owner of the organization. Transfer ownership or assign another Owner first.'
        );
      }
    }

    await membersRepository.removeMember(memberId);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'member.remove',
      resourceType: 'member',
      resourceId: memberId,
      metadata: { removedUserId: member.userId, email: member.email, role: member.role },
    });
  }
}

export const membersService = new MembersService();
