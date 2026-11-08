import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import { events, issues, userSessions } from '@/db/schema';
import {
  DashboardStatsDto,
  ApmPerformanceDto,
  SessionHealthDto,
} from '@/contracts/analytics-billing';

export interface AnalyticsFilter {
  projectId: string;
  startDate: Date;
  endDate: Date;
  environment?: string;
  interval?: '1m' | '5m' | '1h' | '1d';
}

export class AnalyticsRepository {
  async getDashboardStats(filter: AnalyticsFilter): Promise<DashboardStatsDto> {
    const { projectId, startDate, endDate, environment } = filter;

    const eventConditions = [
      eq(events.projectId, projectId),
      gte(events.timestamp, startDate),
      lte(events.timestamp, endDate),
    ];
    if (environment) {
      eventConditions.push(eq(events.environment, environment));
    }

    // 1. Total events in date window
    const [eventCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(...eventConditions));
    const totalEvents = eventCountRes ? Number(eventCountRes.count) : 0;

    // 2. Unresolved issues count
    const [unresolvedRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.status, 'unresolved')));
    const unresolvedIssues = unresolvedRes ? Number(unresolvedRes.count) : 0;

    // 3. Affected users sum
    const [affectedUsersRes] = await db
      .select({ count: sql<number>`coalesce(sum(${issues.userCount}), 0)::int` })
      .from(issues)
      .where(eq(issues.projectId, projectId));
    const affectedUsers = affectedUsersRes ? Number(affectedUsersRes.count) : 0;

    // 4. Timeseries crash histogram
    const truncUnit = filter.interval === '1h' ? 'hour' : 'day';
    const timeseriesRows = await db
      .select({
        bucket: sql<string>`date_trunc(${truncUnit}, ${events.timestamp})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(...eventConditions))
      .groupBy(sql`date_trunc(${truncUnit}, ${events.timestamp})`)
      .orderBy(sql`date_trunc(${truncUnit}, ${events.timestamp})`);

    const timeseries = timeseriesRows.map((r) => ({
      timestamp: r.bucket,
      count: Number(r.count),
    }));

    // 5. APM p95 latency and error rate from userSessions
    const sessionConditions = [
      eq(userSessions.projectId, projectId),
      gte(userSessions.startedAt, startDate),
      lte(userSessions.startedAt, endDate),
    ];
    if (environment) {
      sessionConditions.push(eq(userSessions.environment, environment));
    }

    const [sessionStats] = await db
      .select({
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${userSessions.durationMs}), 0)::float`,
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${userSessions.status} != 'ok')::int`,
      })
      .from(userSessions)
      .where(and(...sessionConditions));

    const totalSessions = sessionStats ? Number(sessionStats.total) : 0;
    const errorSessions = sessionStats ? Number(sessionStats.errors) : 0;
    const errorRate = totalSessions > 0 ? (errorSessions / totalSessions) * 100 : 0;
    const p95LatencyMs = sessionStats ? Number(sessionStats.p95) : 0;

    return {
      totalEvents,
      unresolvedIssues,
      affectedUsers,
      p95LatencyMs,
      errorRate: Number(errorRate.toFixed(2)),
      timeseries,
    };
  }

  async getApmPerformance(filter: AnalyticsFilter): Promise<ApmPerformanceDto[]> {
    const { projectId, startDate, endDate, environment } = filter;

    const conditions = [
      eq(userSessions.projectId, projectId),
      gte(userSessions.startedAt, startDate),
      lte(userSessions.startedAt, endDate),
    ];
    if (environment) {
      conditions.push(eq(userSessions.environment, environment));
    }

    const rows = await db
      .select({
        transactionName: sql<string>`coalesce(${userSessions.release}, 'default')`,
        callCount: sql<number>`count(*)::int`,
        p50Ms: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${userSessions.durationMs}), 0)::float`,
        p95Ms: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${userSessions.durationMs}), 0)::float`,
        p99Ms: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${userSessions.durationMs}), 0)::float`,
        errorCount: sql<number>`count(*) filter (where ${userSessions.status} != 'ok')::int`,
      })
      .from(userSessions)
      .where(and(...conditions))
      .groupBy(sql`coalesce(${userSessions.release}, 'default')`)
      .limit(50);

    return rows.map((r) => {
      const calls = Number(r.callCount);
      const errors = Number(r.errorCount);
      const errorPercentage = calls > 0 ? (errors / calls) * 100 : 0;

      return {
        transactionName: r.transactionName,
        callCount: calls,
        p50Ms: Number(r.p50Ms.toFixed(2)),
        p95Ms: Number(r.p95Ms.toFixed(2)),
        p99Ms: Number(r.p99Ms.toFixed(2)),
        errorPercentage: Number(errorPercentage.toFixed(2)),
      };
    });
  }

  async getSessionHealth(filter: AnalyticsFilter): Promise<SessionHealthDto> {
    const { projectId, startDate, endDate, environment } = filter;

    const conditions = [
      eq(userSessions.projectId, projectId),
      gte(userSessions.startedAt, startDate),
      lte(userSessions.startedAt, endDate),
    ];
    if (environment) {
      conditions.push(eq(userSessions.environment, environment));
    }

    const [stats] = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        crashedSessions: sql<number>`count(*) filter (where ${userSessions.status} = 'crashed')::int`,
        totalUsers: sql<number>`count(distinct ${userSessions.distinctId})::int`,
        crashedUsers: sql<number>`count(distinct ${userSessions.distinctId}) filter (where ${userSessions.status} = 'crashed')::int`,
      })
      .from(userSessions)
      .where(and(...conditions));

    const totalSessions = stats ? Number(stats.totalSessions) : 0;
    const crashedSessions = stats ? Number(stats.crashedSessions) : 0;
    const totalUsers = stats ? Number(stats.totalUsers) : 0;
    const crashedUsers = stats ? Number(stats.crashedUsers) : 0;

    const crashFreeSessionRate =
      totalSessions > 0 ? ((totalSessions - crashedSessions) / totalSessions) * 100 : 100;
    const crashFreeUserRate =
      totalUsers > 0 ? ((totalUsers - crashedUsers) / totalUsers) * 100 : 100;

    return {
      totalSessions,
      crashedSessions,
      crashFreeSessionRate: Number(crashFreeSessionRate.toFixed(2)),
      crashFreeUserRate: Number(crashFreeUserRate.toFixed(2)),
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();

