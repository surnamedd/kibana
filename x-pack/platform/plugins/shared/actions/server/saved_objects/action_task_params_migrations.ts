/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  LogMeta,
  SavedObjectMigrationMap,
  SavedObjectUnsanitizedDoc,
  SavedObjectMigrationFn,
  SavedObjectMigrationContext,
  SavedObjectReference,
} from '@kbn/core/server';
import type { EncryptedSavedObjectsPluginSetup } from '@kbn/encrypted-saved-objects-plugin/server';
import type { IsMigrationNeededPredicate } from '@kbn/encrypted-saved-objects-plugin/server';
import type { ActionTaskParams, InMemoryConnector } from '../types';
import type { RelatedSavedObjects } from '../lib/related_saved_objects';

interface ActionTaskParamsLogMeta extends LogMeta {
  migrations: { actionTaskParamDocument: SavedObjectUnsanitizedDoc<ActionTaskParams> };
}

type ActionTaskParamMigration = (
  doc: SavedObjectUnsanitizedDoc<ActionTaskParams>
) => SavedObjectUnsanitizedDoc<ActionTaskParams>;

function createEsoMigration(
  encryptedSavedObjects: EncryptedSavedObjectsPluginSetup,
  isMigrationNeededPredicate: IsMigrationNeededPredicate<ActionTaskParams, ActionTaskParams>,
  migrationFunc: ActionTaskParamMigration
) {
  return encryptedSavedObjects.createMigration<ActionTaskParams, ActionTaskParams>({
    isMigrationNeededPredicate,
    migration: migrationFunc,
    shouldMigrateIfDecryptionFails: true, // shouldMigrateIfDecryptionFails flag that applies the migration to undecrypted document if decryption fails
  });
}

export function getActionTaskParamsMigrations(
  encryptedSavedObjects: EncryptedSavedObjectsPluginSetup,
  inMemoryConnectors: InMemoryConnector[]
): SavedObjectMigrationMap {
  const migrationActionTaskParamsSixteen = createEsoMigration(
    encryptedSavedObjects,
    (doc): doc is SavedObjectUnsanitizedDoc<ActionTaskParams> => true,
    pipeMigrations(getUseSavedObjectReferencesFn(inMemoryConnectors))
  );

  const migrationActionsTaskParams800 = createEsoMigration(
    encryptedSavedObjects,
    (
      doc: SavedObjectUnsanitizedDoc<ActionTaskParams>
    ): doc is SavedObjectUnsanitizedDoc<ActionTaskParams> => true,
    (doc) => doc // no-op
  );

  return {
    '7.16.0': executeMigrationWithErrorHandling(migrationActionTaskParamsSixteen, '7.16.0'),
    '8.0.0': executeMigrationWithErrorHandling(migrationActionsTaskParams800, '8.0.0'),
  };
}

function executeMigrationWithErrorHandling(
  migrationFunc: SavedObjectMigrationFn<ActionTaskParams, ActionTaskParams>,
  version: string
) {
  return (
    doc: SavedObjectUnsanitizedDoc<ActionTaskParams>,
    context: SavedObjectMigrationContext
  ) => {
    try {
      return migrationFunc(doc, context);
    } catch (ex) {
      context.log.error<ActionTaskParamsLogMeta>(
        `encryptedSavedObject ${version} migration failed for action task param ${doc.id} with error: ${ex.message}`,
        {
          migrations: {
            actionTaskParamDocument: doc,
          },
        }
      );
      throw ex;
    }
  };
}

export function isInMemoryAction(
  doc: SavedObjectUnsanitizedDoc<ActionTaskParams>,
  inMemoryConnectors: InMemoryConnector[]
): boolean {
  return !!inMemoryConnectors.find((action) => action.id === doc.attributes.actionId);
}

function getUseSavedObjectReferencesFn(inMemoryConnectors: InMemoryConnector[]) {
  return (doc: SavedObjectUnsanitizedDoc<ActionTaskParams>) => {
    return useSavedObjectReferences(doc, inMemoryConnectors);
  };
}

function useSavedObjectReferences(
  doc: SavedObjectUnsanitizedDoc<ActionTaskParams>,
  inMemoryConnectors: InMemoryConnector[]
): SavedObjectUnsanitizedDoc<ActionTaskParams> {
  const {
    attributes: { actionId, relatedSavedObjects },
    references,
  } = doc;

  const newReferences: SavedObjectReference[] = [];
  const relatedSavedObjectRefs: RelatedSavedObjects = [];

  if (!isInMemoryAction(doc, inMemoryConnectors)) {
    newReferences.push({
      id: actionId,
      name: 'actionRef',
      type: 'action',
    });
  }

  // Add related saved objects, if any
  ((relatedSavedObjects as RelatedSavedObjects) ?? []).forEach((relatedSavedObject, index) => {
    relatedSavedObjectRefs.push({
      ...relatedSavedObject,
      id: `related_${relatedSavedObject.type}_${index}`,
    });
    newReferences.push({
      id: relatedSavedObject.id,
      name: `related_${relatedSavedObject.type}_${index}`,
      type: relatedSavedObject.type,
    });
  });

  return {
    ...doc,
    attributes: {
      ...doc.attributes,
      ...(relatedSavedObjects ? { relatedSavedObjects: relatedSavedObjectRefs } : {}),
    },
    references: [...(references ?? []), ...(newReferences ?? [])],
  };
}

function pipeMigrations(...migrations: ActionTaskParamMigration[]): ActionTaskParamMigration {
  return (doc: SavedObjectUnsanitizedDoc<ActionTaskParams>) =>
    migrations.reduce((migratedDoc, nextMigration) => nextMigration(migratedDoc), doc);
}
