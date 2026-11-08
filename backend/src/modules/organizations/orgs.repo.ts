import { eq } from 'drizzle-orm';
import { db } from '@/infra/db';
import { organizations, orgSettings } from '@/db/schema';
import { OrgSettings, ComplianceTier } from '@/contracts/organization';

export class OrganizationsRepository {
  async findById(orgId: string) {
    const [result] = await db
      .select({
        organization: organizations,
        settings: orgSettings,
      })
      .from(organizations)
      .leftJoin(orgSettings, eq(organizations.id, orgSettings.orgId))
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!result) return null;

    return {
      ...result.organization,
      settings: result.settings || {
        complianceTier: 'standard' as ComplianceTier,
        mfaRequired: false,
        ipAllowlist: [] as string[],
        updatedAt: result.organization.updatedAt,
      },
    };
  }

  async updateName(orgId: string, name: string) {
    const [updated] = await db
      .update(organizations)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    return updated || null;
  }

  async findSettings(orgId: string) {
    const [settings] = await db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);

    return settings || null;
  }

  async updateSettings(
    orgId: string,
    settingsUpdate: Partial<OrgSettings>
  ) {
    const [updated] = await db
      .insert(orgSettings)
      .values({
        orgId,
        complianceTier: settingsUpdate.complianceTier || 'standard',
        mfaRequired: settingsUpdate.mfaRequired ?? settingsUpdate.mfaRequirement ?? false,
        ipAllowlist: settingsUpdate.ipAllowlist || [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orgSettings.orgId,
        set: {
          ...(settingsUpdate.complianceTier && { complianceTier: settingsUpdate.complianceTier }),
          ...(settingsUpdate.mfaRequired !== undefined && { mfaRequired: settingsUpdate.mfaRequired }),
          ...(settingsUpdate.mfaRequirement !== undefined && { mfaRequired: settingsUpdate.mfaRequirement }),
          ...(settingsUpdate.ipAllowlist !== undefined && { ipAllowlist: settingsUpdate.ipAllowlist }),
          updatedAt: new Date(),
        },
      })
      .returning();

    return updated;
  }
}

export const organizationsRepository = new OrganizationsRepository();

