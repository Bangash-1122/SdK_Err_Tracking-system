import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import { orgMembers, users } from '@/db/schema';
import { Role } from '@/contracts/auth';

export class MembersRepository {
  async listMembers(orgId: string) {
    return db
      .select({
        id: orgMembers.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: orgMembers.role,
        createdAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId));
  }

  async findMemberById(memberId: string) {
    const [result] = await db
      .select({
        id: orgMembers.id,
        orgId: orgMembers.orgId,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: orgMembers.role,
        createdAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.id, memberId))
      .limit(1);

    return result || null;
  }

  async findMembership(orgId: string, userId: string) {
    const [result] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1);

    return result || null;
  }

  async countOwners(orgId: string): Promise<number> {
    const [res] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'Owner')));

    return res ? Number(res.count) : 0;
  }

  async addMember(data: { orgId: string; userId: string; role: Role }) {
    const [newMember] = await db
      .insert(orgMembers)
      .values({
        orgId: data.orgId,
        userId: data.userId,
        role: data.role,
      })
      .returning();

    return newMember;
  }

  async updateMemberRole(memberId: string, role: Role) {
    const [updated] = await db
      .update(orgMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(orgMembers.id, memberId))
      .returning();

    return updated || null;
  }

  async removeMember(memberId: string) {
    await db.delete(orgMembers).where(eq(orgMembers.id, memberId));
  }

  async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    return user || null;
  }

  async createPlaceholderUser(email: string, name: string, passwordHash: string) {
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
      })
      .returning();

    return newUser;
  }
}

export const membersRepository = new MembersRepository();

