/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: List Entity Store engines
 *   version: 1
 */

import type { IKibanaResponse, Logger } from '@kbn/core/server';
import { buildSiemResponse } from '@kbn/lists-plugin/server/routes/utils';
import { transformError } from '@kbn/securitysolution-es-utils';

import { buildRouteValidationWithZod } from '@kbn/zod-helpers';
import type { EntityType } from '../../../../../../common/search_strategy';
import { LIST_ENTITIES_URL } from '../../../../../../common/entity_analytics/entity_store/constants';
import type { ListEntitiesResponse } from '../../../../../../common/api/entity_analytics/entity_store/entities/list_entities.gen';
import { ListEntitiesRequestQuery } from '../../../../../../common/api/entity_analytics/entity_store/entities/list_entities.gen';
import { APP_ID } from '../../../../../../common';
import { API_VERSIONS } from '../../../../../../common/entity_analytics/constants';

import type { EntityAnalyticsRoutesDeps } from '../../../types';

export const listEntitiesRoute = (router: EntityAnalyticsRoutesDeps['router'], logger: Logger) => {
  router.versioned
    .get({
      access: 'public',
      path: LIST_ENTITIES_URL,
      security: {
        authz: {
          requiredPrivileges: ['securitySolution', `${APP_ID}-entity-analytics`],
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.public.v1,
        validate: {
          request: {
            query: buildRouteValidationWithZod(ListEntitiesRequestQuery),
          },
        },
      },

      async (context, request, response): Promise<IKibanaResponse<ListEntitiesResponse>> => {
        const siemResponse = buildSiemResponse(response);

        try {
          const {
            page = 1,
            per_page: perPage = 10,
            sort_field: sortField = '@timestamp',
            sort_order: sortOrder = 'desc',
            entity_types: entityTypes,
            filterQuery,
          } = request.query;

          const securitySolution = await context.securitySolution;
          const entityStoreClient = securitySolution.getEntityStoreDataClient();
          const { records, total, inspect } = await entityStoreClient.searchEntities({
            entityTypes: entityTypes as EntityType[], // convert from OpenApi type to internal type
            filterQuery,
            page,
            perPage,
            sortField,
            sortOrder,
          });

          return response.ok({
            body: {
              records,
              total,
              page,
              per_page: perPage,
              inspect,
            },
          });
        } catch (e) {
          logger.error(e);
          const error = transformError(e);
          return siemResponse.error({
            statusCode: error.statusCode,
            body: error.message,
          });
        }
      }
    );
};
