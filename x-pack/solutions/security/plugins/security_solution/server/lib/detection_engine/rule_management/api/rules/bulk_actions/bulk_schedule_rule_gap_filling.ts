/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RulesClient, BulkOperationError } from '@kbn/alerting-plugin/server';
import type { MlAuthz } from '../../../../../machine_learning/authz';
import type { BulkManualRuleGapsFill } from '../../../../../../../common/api/detection_engine';
import type { PromisePoolError } from '../../../../../../utils/promise_pool';
import type { RuleAlertType } from '../../../../rule_schema';
import { validateBulkScheduleBackfill } from '../../../logic/bulk_actions/validations';
import { handleScheduleBackfillResults } from './utils';

interface BuildScheduleRuleGapFillingParams {
  rules: RuleAlertType[];
  isDryRun?: boolean;
  rulesClient: RulesClient;
  mlAuthz: MlAuthz;
  fillGapsPayload: BulkManualRuleGapsFill['fill_gaps'];
}

interface BulkScheduleBackfillOutcome {
  backfilled: RuleAlertType[];
  errors: Array<PromisePoolError<RuleAlertType, Error> | BulkOperationError>;
}

export const bulkScheduleRuleGapFilling = async ({
  rules,
  isDryRun,
  rulesClient,
  mlAuthz,
  fillGapsPayload,
}: BuildScheduleRuleGapFillingParams): Promise<BulkScheduleBackfillOutcome> => {
  const errors: Array<PromisePoolError<RuleAlertType, Error> | BulkOperationError> = [];
  // In the first step, we validate if it is possible to schedule backfill for the rules
  const validatedRules: RuleAlertType[] = [];
  await Promise.all(
    rules.map(async (rule) => {
      try {
        await validateBulkScheduleBackfill({
          mlAuthz,
          rule,
        });
        validatedRules.push(rule);
      } catch (error) {
        errors.push({ item: rule, error });
      }
    })
  );

  if (isDryRun || validatedRules.length === 0) {
    return {
      backfilled: validatedRules,
      errors,
    };
  }
  const { start_date: start, end_date: end } = fillGapsPayload;

  const { outcomes: bulkFillResultsList, validationErrors: bulkFillGapsValidationErrors } =
    await rulesClient.bulkFillGapsByRuleIds({
      rules: validatedRules.map(({ id, name, consumer, alertTypeId }) => ({
        id,
        name,
        consumer,
        alertTypeId,
      })),
      range: {
        start,
        end,
      },
    });

  errors.push(...bulkFillGapsValidationErrors);

  const outcomes = bulkFillResultsList.map((results) => {
    return handleScheduleBackfillResults({ results, rules: validatedRules });
  });

  // Flatten the outcomes
  const backfilledRulesDict: Record<string, RuleAlertType> = {};
  outcomes.forEach(({ backfilled, errors: outcomeErrors }) => {
    backfilled.forEach((backfilledRule) => {
      if (!backfilledRulesDict[backfilledRule.id]) {
        backfilledRulesDict[backfilledRule.id] = backfilledRule;
      }
    });
    errors.push(...outcomeErrors);
  });

  return {
    backfilled: Object.values(backfilledRulesDict),
    errors,
  };
};
