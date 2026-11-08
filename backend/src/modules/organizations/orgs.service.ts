import { organizationsRepository } from './orgs.repo';
import { OrganizationDto, OrgSettings } from '@/contracts/organization';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

export class OrganizationsService {
  async getOrganization(orgId: string): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(orgId);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      settings: {
        complianceTier: (org.settings.complianceTier as OrgSettings['complianceTier']) || 'standard',
        mfaRequired: org.settings.mfaRequired,
        ipAllowlist: (org.settings.ipAllowlist as string[]) || [],
      },
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async updateOrganization(
    orgId: string,
    data: { name: string },
    actorId: string
  ): Promise<OrganizationDto> {
    const updated = await organizationsRepository.updateName(orgId, data.name);
    if (!updated) {
      throw AppError.notFound('Organization not found');
    }

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'organization.update',
      resourceType: 'organization',
      resourceId: orgId,
      metadata: { name: data.name },
    });

    return this.getOrganization(orgId);
  }

  async getSettings(orgId: string): Promise<OrgSettings> {
    const org = await organizationsRepository.findById(orgId);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    return {
      complianceTier: (org.settings.complianceTier as OrgSettings['complianceTier']) || 'standard',
      mfaRequired: org.settings.mfaRequired,
      ipAllowlist: (org.settings.ipAllowlist as string[]) || [],
    };
  }

  async updateSettings(
    orgId: string,
    settingsUpdate: Partial<OrgSettings>,
    actorId: string
  ): Promise<OrgSettings> {
    // Validate organization existence
    const org = await organizationsRepository.findById(orgId);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    const updated = await organizationsRepository.updateSettings(orgId, settingsUpdate);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'organization.settings.update',
      resourceType: 'org_settings',
      resourceId: orgId,
      metadata: { ...settingsUpdate },
    });

    return {
      complianceTier: (updated.complianceTier as OrgSettings['complianceTier']) || 'standard',
      mfaRequired: updated.mfaRequired,
      ipAllowlist: (updated.ipAllowlist as string[]) || [],
    };
  }
}

export const organizationsService = new OrganizationsService();

