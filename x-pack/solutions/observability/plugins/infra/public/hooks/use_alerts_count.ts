/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useRef } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { BASE_RAC_ALERTS_API_PATH } from '@kbn/rule-registry-plugin/common/constants';
import type { estypes } from '@elastic/elasticsearch';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import type { HttpSetup } from '@kbn/core/public';
import { ALERT_STATUS_ACTIVE, ALERT_STATUS_RECOVERED } from '@kbn/rule-data-utils';

import type { InfraClientCoreStart } from '../types';

interface UseAlertsCountProps {
  ruleTypeIds: string[];
  consumers?: string[];
  query?: estypes.QueryDslQueryContainer;
}

interface FetchAlertsCountParams {
  ruleTypeIds: string[];
  consumers?: string[];
  query?: estypes.QueryDslQueryContainer;
  http: HttpSetup;
  signal: AbortSignal;
}

export interface AlertsCount {
  activeAlertCount: number;
  recoveredAlertCount: number;
}

const ALERT_STATUS = 'kibana.alert.status';

export function useAlertsCount({ ruleTypeIds, consumers, query }: UseAlertsCountProps) {
  const { http } = useKibana<InfraClientCoreStart>().services;

  const abortCtrlRef = useRef(new AbortController());

  const [state, refetch] = useAsyncFn(
    () => {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = new AbortController();
      return fetchAlertsCount({
        ruleTypeIds,
        consumers,
        query,
        http,
        signal: abortCtrlRef.current.signal,
      });
    },
    [ruleTypeIds, query, http],
    { loading: true }
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { value: alertsCount, error, loading } = state;

  return {
    alertsCount,
    error,
    loading,
    refetch,
  };
}

async function fetchAlertsCount({
  ruleTypeIds,
  consumers,
  http,
  query,
  signal,
}: FetchAlertsCountParams): Promise<AlertsCount> {
  return http
    .post<estypes.SearchResponse<Record<string, unknown>>>(`${BASE_RAC_ALERTS_API_PATH}/find`, {
      signal,
      body: JSON.stringify({
        aggs: {
          count: {
            terms: { field: ALERT_STATUS },
          },
        },
        rule_type_ids: ruleTypeIds,
        consumers,
        query,
        size: 0,
      }),
    })
    .then(extractAlertsCount);
}

const extractAlertsCount = (response: estypes.SearchResponse<Record<string, unknown>>) => {
  const countAggs = response.aggregations?.count as estypes.AggregationsMultiBucketAggregateBase;

  const countBuckets = (countAggs?.buckets as estypes.AggregationsStringTermsBucketKeys[]) ?? [];

  return countBuckets.reduce(
    (counts, bucket) => {
      if (bucket.key === ALERT_STATUS_ACTIVE) {
        counts.activeAlertCount = bucket.doc_count;
      } else if (bucket.key === ALERT_STATUS_RECOVERED) {
        counts.recoveredAlertCount = bucket.doc_count;
      }

      return counts;
    },
    { activeAlertCount: 0, recoveredAlertCount: 0 }
  );
};
