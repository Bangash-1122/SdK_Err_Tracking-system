import { analyticsRepository, AnalyticsFilter } from './analytics.repo';
import {
  DashboardStatsDto,
  ApmPerformanceDto,
  SessionHealthDto,
  AnalyticsQuery,
} from '@/contracts/analytics-billing';
import { cacheWrap } from '@/infra/redis';

const CACHE_TTL_SECONDS = 60; // 60s cache with jitter to prevent stampedes

function parseFilter(projectId: string, query: AnalyticsQuery): AnalyticsFilter {
  const startDate = new Date(query.startDate);
  const endDate = new Date(query.endDate);

  return {
    projectId,
    startDate,
    endDate,
    environment: query.environment,
    interval: query.interval,
  };
}

export class AnalyticsService {
  async getDashboardStats(projectId: string, query: AnalyticsQuery): Promise<DashboardStatsDto> {
    const filter = parseFilter(projectId, query);
    const cacheKey = `analytics:stats:${projectId}:${filter.startDate.toISOString()}:${filter.endDate.toISOString()}:${filter.environment || 'all'}:${filter.interval || '1d'}`;

    return cacheWrap(
      cacheKey,
      CACHE_TTL_SECONDS,
      () => analyticsRepository.getDashboardStats(filter),
      { tag: `project:${projectId}` }
    );
  }

  async getApmPerformance(projectId: string, query: AnalyticsQuery): Promise<ApmPerformanceDto[]> {
    const filter = parseFilter(projectId, query);
    const cacheKey = `analytics:apm:${projectId}:${filter.startDate.toISOString()}:${filter.endDate.toISOString()}:${filter.environment || 'all'}`;

    return cacheWrap(
      cacheKey,
      CACHE_TTL_SECONDS,
      () => analyticsRepository.getApmPerformance(filter),
      { tag: `project:${projectId}` }
    );
  }

  async getSessionHealth(projectId: string, query: AnalyticsQuery): Promise<SessionHealthDto> {
    const filter = parseFilter(projectId, query);
    const cacheKey = `analytics:sessions:${projectId}:${filter.startDate.toISOString()}:${filter.endDate.toISOString()}:${filter.environment || 'all'}`;

    return cacheWrap(
      cacheKey,
      CACHE_TTL_SECONDS,
      () => analyticsRepository.getSessionHealth(filter),
      { tag: `project:${projectId}` }
    );
  }
}

export const analyticsService = new AnalyticsService();

