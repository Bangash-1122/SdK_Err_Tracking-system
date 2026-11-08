import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/infra/db';
import {
  users,
  sessions,
  passwordResetTokens,
  organizations,
  orgMembers,
  orgSettings,
  subscriptions,
} from '@/db/schema';
import { Role } from '@/contracts/auth';

export class AuthRepository {
  async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return user || null;
  }

  async findUserById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  async createSignupTransaction(
    userData: { email: string; passwordHash: string; name: string },
    orgName: string
  ) {
    return db.transaction(async (tx) => {
      // 1. Create User
      const [newUser] = await tx
        .insert(users)
        .values({
          email: userData.email.toLowerCase().trim(),
          passwordHash: userData.passwordHash,
          name: userData.name.trim(),
        })
        .returning();

      // 2. Create Initial Organization
      const baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'default-org';
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: orgName.trim(),
          slug: uniqueSlug,
          plan: 'free',
        })
        .returning();

      // 3. Assign Initial User as Owner
      await tx.insert(orgMembers).values({
        orgId: newOrg.id,
        userId: newUser.id,
        role: 'Owner',
      });

      // 4. Initialize Organization Settings
      await tx.insert(orgSettings).values({
        orgId: newOrg.id,
        complianceTier: 'standard',
        mfaRequired: false,
        ipAllowlist: [],
      });

      // 5. Initialize Subscription (Free Tier)
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await tx.insert(subscriptions).values({
        organizationId: newOrg.id,
        tier: 'free',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        eventAllowance: 50000,
      });

      return { user: newUser, organization: newOrg };
    });
  }

  async findUserPrimaryOrg(userId: string) {
    const [membership] = await db
      .select({
        role: orgMembers.role,
        organization: organizations,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, userId))
      .limit(1);

    return membership || null;
  }

  async createSession(data: {
    id: string;
    userId: string;
    activeOrgId?: string | null;
    csrfSecret: string;
    expiresAt: Date;
  }) {
    const [newSession] = await db
      .insert(sessions)
      .values({
        id: data.id,
        userId: data.userId,
        activeOrgId: data.activeOrgId || null,
        csrfSecret: data.csrfSecret,
        expiresAt: data.expiresAt,
      })
      .returning();

    return newSession;
  }

  async revokeSession(sessionId: string) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const [token] = await db
      .insert(passwordResetTokens)
      .values({
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning();

    return token;
  }

  async findValidPasswordResetToken(tokenHash: string) {
    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    return record || null;
  }

  async consumePasswordResetToken(
    tokenId: string,
    userId: string,
    newPasswordHash: string
  ) {
    return db.transaction(async (tx) => {
      // 1. Update password
      await tx
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 2. Delete used token
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, tokenId));

      // 3. Revoke all active sessions for security
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, userId));
    });
  }
}

export const authRepository = new AuthRepository();

