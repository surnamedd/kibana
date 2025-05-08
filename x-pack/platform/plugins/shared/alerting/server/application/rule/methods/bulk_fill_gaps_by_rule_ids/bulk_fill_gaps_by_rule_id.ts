/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { chunk } from 'lodash';
import type { BulkOperationError, RulesClientContext } from '../../../../rules_client';
import type {
  ScheduleBackfillResults,
  ScheduleBackfillParams,
} from '../../../backfill/methods/schedule/types';
import { scheduleBackfill } from '../../../backfill/methods/schedule';
import { findGaps } from '../find_gaps';
import { MAX_SCHEDULE_BACKFILL_BULK_SIZE } from '../../../../../common/constants';
import type { BulkFillGapsByRuleIdsParams, BulkFillGapsByRuleIdsResult } from './types';
import { ruleAuditEvent, RuleAuditAction } from '../../../../rules_client/common/audit_events';
import { RULE_SAVED_OBJECT_TYPE } from '../../../../saved_objects';
import { AlertingAuthorizationEntity, WriteOperations } from '../../../../authorization';

export const bulkFillGapsByRuleIds = async (
  context: RulesClientContext,
  { rules, range }: BulkFillGapsByRuleIdsParams
): Promise<BulkFillGapsByRuleIdsResult> => {
  const outcomes: ScheduleBackfillResults[] = [];
  const { validatedRules, errors: validationErrors } = await validateRuleAccess(context, rules);

  for (const rulesChunk of chunk(validatedRules, MAX_SCHEDULE_BACKFILL_BULK_SIZE)) {
    const results = await bulkFillGapsByRuleIdsImpl(context, { rules: rulesChunk, range });
    outcomes.push(...results);
  }

  const eventLogClient = await context.getEventLogClient();
  await eventLogClient.refreshIndex();
  return { outcomes, validationErrors };
};

const validateRuleAccess = async (
  context: RulesClientContext,
  rules: BulkFillGapsByRuleIdsParams['rules']
) => {
  const errors: BulkOperationError[] = [];
  const validatedRules: BulkFillGapsByRuleIdsParams['rules'] = [];
  for (const rule of rules) {
    const { id, name, alertTypeId, consumer } = rule;
    try {
      // Make sure user has access to this rule
      await context.authorization.ensureAuthorized({
        ruleTypeId: alertTypeId,
        consumer,
        operation: WriteOperations.FillGaps,
        entity: AlertingAuthorizationEntity.Rule,
      });
      validatedRules.push(rule);
    } catch (error) {
      context.auditLogger?.log(
        ruleAuditEvent({
          action: RuleAuditAction.FILL_GAPS,
          savedObject: { type: RULE_SAVED_OBJECT_TYPE, id, name },
          error,
        })
      );
      errors.push({
        message: error?.message ?? 'Error validating user access to the rule',
        rule: {
          id,
          name,
        },
      });
    }
  }

  return { validatedRules, errors };
};

const bulkFillGapsByRuleIdsImpl = async (
  context: RulesClientContext,
  { rules, range }: BulkFillGapsByRuleIdsParams
): Promise<ScheduleBackfillResults[]> => {
  const outcomes: ScheduleBackfillResults[] = [];

  let rulesToBackfill = rules.map(({ id, name }) => {
    return {
      id,
      name,
      gapPagination: {
        page: 1,
      },
    };
  });

  while (rulesToBackfill.length > 0) {
    // We stagger the processing of the rule gaps by fetching 100 at a time. If a rule has more gaps, then the rule is added to
    // nextRunRules to be processed in the next iteration
    const { payloads, nextRunRules } = await getBackfillSchedulePayload(context, {
      rules: rulesToBackfill,
      // Since the gaps of a rule are paginated, we process them 100 at a time
      maxGapPageSize: 100,
      range,
    });

    rulesToBackfill = nextRunRules;

    // Perform actual schedule using the rulesClient
    const results = await scheduleBackfill(context, payloads);
    outcomes.push(results);
  }

  return outcomes;
};

interface GetBackfillSchedulePayloadParams {
  rules: Array<
    Pick<BulkFillGapsByRuleIdsParams['rules'][0], 'id' | 'name'> & {
      gapPagination: { page: number };
    }
  >;
  range: BulkFillGapsByRuleIdsParams['range'];
  maxGapPageSize: number;
}

interface GetBackfillSchedulePayloadResult {
  payloads: ScheduleBackfillParams;
  nextRunRules: GetBackfillSchedulePayloadParams['rules'];
}

const getBackfillSchedulePayload = async (
  context: RulesClientContext,
  { rules, maxGapPageSize, range }: GetBackfillSchedulePayloadParams
): Promise<GetBackfillSchedulePayloadResult> => {
  const nextRunRules: GetBackfillSchedulePayloadResult['nextRunRules'] = [];
  const { start, end } = range;
  const payloads = await Promise.all(
    rules.map(async ({ id: ruleId, name: ruleName, gapPagination: { page } }) => {
      const response = await findGaps(context, {
        ruleId,
        start,
        end,
        page,
        statuses: ['partially_filled', 'unfilled'],
        perPage: maxGapPageSize,
        sortField: '@timestamp',
        sortOrder: 'asc',
      });

      if (response.data.length >= maxGapPageSize) {
        nextRunRules.push({
          id: ruleId,
          name: ruleName,
          gapPagination: {
            page: page + 1,
          },
        });
      }

      const backfillRequestPayload: ScheduleBackfillParams[0] = {
        ruleId,
        ranges: response.data.flatMap((gap) => {
          const state = gap.getState();
          return state.unfilledIntervals.map(({ gte, lte }) => {
            return {
              start: gte,
              end: lte,
            };
          });
        }),
      };

      context.auditLogger?.log(
        ruleAuditEvent({
          action: RuleAuditAction.FILL_GAPS,
          savedObject: { type: RULE_SAVED_OBJECT_TYPE, id: ruleId, name: ruleName },
        })
      );

      return backfillRequestPayload;
    })
  );

  return {
    payloads,
    nextRunRules,
  };
};
