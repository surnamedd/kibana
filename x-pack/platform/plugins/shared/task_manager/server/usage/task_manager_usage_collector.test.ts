/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { Subject } from 'rxjs';
import { merge } from 'lodash';
import { loggingSystemMock } from '@kbn/core/server/mocks';
import {
  Collector,
  createCollectorFetchContextMock,
  createUsageCollectionSetupMock,
} from '@kbn/usage-collection-plugin/server/mocks';
import { HealthStatus } from '../monitoring';
import type { MonitoredHealth } from '../routes/health';
import { TaskPersistence } from '../task_events';
import { registerTaskManagerUsageCollector } from './task_manager_usage_collector';
import { sleep } from '../test_utils';
import type { TaskManagerUsage } from './types';
import type { MonitoredUtilization } from '../routes/background_task_utilization';
import type { MonitoredStat } from '../monitoring/monitoring_stats_stream';
import type { BackgroundTaskUtilizationStat } from '../monitoring/background_task_utilization_statistics';

describe('registerTaskManagerUsageCollector', () => {
  let collector: Collector<unknown>;
  const logger = loggingSystemMock.createLogger();

  it('should report telemetry on the excluded task types', async () => {
    const monitoringStats$ = new Subject<MonitoredHealth>();
    const monitoringUtilization$ = new Subject<MonitoredUtilization>();
    const usageCollectionMock = createUsageCollectionSetupMock();
    const fetchContext = createCollectorFetchContextMock();
    usageCollectionMock.makeUsageCollector.mockImplementation((config) => {
      collector = new Collector(logger, config);
      return createUsageCollectionSetupMock().makeUsageCollector(config);
    });

    registerTaskManagerUsageCollector(
      usageCollectionMock,
      monitoringStats$,
      monitoringUtilization$,
      ['actions:*']
    );

    const mockHealth = getMockMonitoredHealth();
    monitoringStats$.next(mockHealth);
    const mockUtilization = getMockMonitoredUtilization();
    monitoringUtilization$.next(mockUtilization);
    await sleep(1001);

    expect(usageCollectionMock.makeUsageCollector).toBeCalled();
    const telemetry: TaskManagerUsage = (await collector.fetch(fetchContext)) as TaskManagerUsage;
    expect(telemetry.task_type_exclusion).toEqual(['actions:*']);
  });

  it('should report telemetry on background task utilization', async () => {
    const monitoringStats$ = new Subject<MonitoredHealth>();
    const monitoringUtilization$ = new Subject<MonitoredUtilization>();
    const usageCollectionMock = createUsageCollectionSetupMock();
    const fetchContext = createCollectorFetchContextMock();
    usageCollectionMock.makeUsageCollector.mockImplementation((config) => {
      collector = new Collector(logger, config);
      return createUsageCollectionSetupMock().makeUsageCollector(config);
    });

    registerTaskManagerUsageCollector(
      usageCollectionMock,
      monitoringStats$,
      monitoringUtilization$,
      ['actions:*']
    );

    const mockHealth = getMockMonitoredHealth();
    monitoringStats$.next(mockHealth);
    const mockUtilization = getMockMonitoredUtilization();
    const mockUtilizationStats =
      mockUtilization.stats as MonitoredStat<BackgroundTaskUtilizationStat>;
    monitoringUtilization$.next(mockUtilization);
    await sleep(1001);

    expect(usageCollectionMock.makeUsageCollector).toBeCalled();
    const telemetry: TaskManagerUsage = (await collector.fetch(fetchContext)) as TaskManagerUsage;
    expect(telemetry.recurring_tasks).toEqual({
      actual_service_time: mockUtilizationStats?.value.recurring.ran.service_time.actual,
      adjusted_service_time: mockUtilizationStats?.value.recurring.ran.service_time.adjusted,
    });
    expect(telemetry.adhoc_tasks).toEqual({
      actual_service_time: mockUtilizationStats?.value.adhoc.ran.service_time.actual,
      adjusted_service_time: mockUtilizationStats?.value.adhoc.ran.service_time.adjusted,
    });
  });

  it('should report telemetry on capacity', async () => {
    const monitoringStats$ = new Subject<MonitoredHealth>();
    const monitoringUtilization$ = new Subject<MonitoredUtilization>();
    const usageCollectionMock = createUsageCollectionSetupMock();
    const fetchContext = createCollectorFetchContextMock();
    usageCollectionMock.makeUsageCollector.mockImplementation((config) => {
      collector = new Collector(logger, config);
      return createUsageCollectionSetupMock().makeUsageCollector(config);
    });

    registerTaskManagerUsageCollector(
      usageCollectionMock,
      monitoringStats$,
      monitoringUtilization$,
      ['actions:*']
    );

    const mockHealth = getMockMonitoredHealth();
    monitoringStats$.next(mockHealth);
    const mockUtilization = getMockMonitoredUtilization();
    monitoringUtilization$.next(mockUtilization);
    await sleep(1001);

    expect(usageCollectionMock.makeUsageCollector).toBeCalled();
    const telemetry: TaskManagerUsage = (await collector.fetch(fetchContext)) as TaskManagerUsage;
    expect(telemetry.capacity).toEqual(10);
  });
});

function getMockMonitoredHealth(overrides = {}): MonitoredHealth {
  const stub: MonitoredHealth = {
    id: '1',
    status: HealthStatus.OK,
    timestamp: new Date().toISOString(),
    last_update: new Date().toISOString(),
    stats: {
      configuration: {
        timestamp: new Date().toISOString(),
        status: HealthStatus.OK,
        value: {
          capacity: { config: 10, as_cost: 20, as_workers: 10 },
          claim_strategy: 'update_by_query',
          poll_interval: 3000,
          request_capacity: 1000,
          monitored_aggregated_stats_refresh_rate: 5000,
          monitored_stats_running_average_window: 50,
          monitored_task_execution_thresholds: {
            default: {
              error_threshold: 90,
              warn_threshold: 80,
            },
            custom: {},
          },
        },
      },
      workload: {
        timestamp: new Date().toISOString(),
        status: HealthStatus.OK,
        value: {
          count: 4,
          cost: 8,
          task_types: {
            actions_telemetry: { count: 2, cost: 4, status: { idle: 2 } },
            alerting_telemetry: { count: 1, cost: 2, status: { idle: 1 } },
            session_cleanup: { count: 1, cost: 2, status: { idle: 1 } },
          },
          schedule: [],
          overdue: 0,
          overdue_cost: 0,
          overdue_non_recurring: 0,
          estimatedScheduleDensity: [],
          non_recurring: 20,
          non_recurring_cost: 40,
          owner_ids: 2,
          estimated_schedule_density: [],
          capacity_requirements: {
            per_minute: 150,
            per_hour: 360,
            per_day: 820,
          },
        },
      },
      runtime: {
        timestamp: new Date().toISOString(),
        status: HealthStatus.OK,
        value: {
          drift: {
            p50: 1000,
            p90: 2000,
            p95: 2500,
            p99: 3000,
          },
          drift_by_type: {},
          load: {
            p50: 1000,
            p90: 2000,
            p95: 2500,
            p99: 3000,
          },
          execution: {
            duration: {},
            duration_by_persistence: {},
            persistence: {
              [TaskPersistence.Recurring]: 10,
              [TaskPersistence.NonRecurring]: 10,
            },
            result_frequency_percent_as_number: {},
          },
          polling: {
            last_successful_poll: new Date().toISOString(),
            duration: [500, 400, 3000],
            claim_conflicts: [0, 100, 75],
            claim_mismatches: [0, 100, 75],
            result_frequency_percent_as_number: [
              'NoTasksClaimed',
              'NoTasksClaimed',
              'NoTasksClaimed',
            ],
          },
        },
      },
      capacity_estimation: {
        timestamp: new Date().toISOString(),
        status: HealthStatus.OK,
        value: {
          observed: {
            observed_kibana_instances: 10,
            max_throughput_per_minute: 10,
            max_throughput_per_minute_per_kibana: 10,
            minutes_to_drain_overdue: 10,
            avg_required_throughput_per_minute: 10,
            avg_required_throughput_per_minute_per_kibana: 10,
            avg_recurring_required_throughput_per_minute: 10,
            avg_recurring_required_throughput_per_minute_per_kibana: 10,
          },
          proposed: {
            provisioned_kibana: 10,
            min_required_kibana: 10,
            avg_recurring_required_throughput_per_minute_per_kibana: 10,
            avg_required_throughput_per_minute_per_kibana: 10,
          },
        },
      },
    },
  };
  return merge(stub, overrides) as unknown as MonitoredHealth;
}

function getMockMonitoredUtilization(overrides = {}): MonitoredUtilization {
  const stub: MonitoredUtilization = {
    process_uuid: '1',
    timestamp: new Date().toISOString(),
    last_update: new Date().toISOString(),
    stats: {
      timestamp: new Date().toISOString(),
      value: {
        load: 6,
        adhoc: {
          created: {
            counter: 5,
          },
          ran: {
            service_time: {
              actual: 3000,
              adjusted: 2500,
              task_counter: 10,
            },
          },
        },
        recurring: {
          ran: {
            service_time: {
              actual: 1000,
              adjusted: 2000,
              task_counter: 10,
            },
          },
        },
      },
    },
  };
  return merge(stub, overrides) as unknown as MonitoredUtilization;
}
