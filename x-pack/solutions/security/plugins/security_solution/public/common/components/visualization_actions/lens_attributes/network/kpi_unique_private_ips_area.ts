/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { DESTINATION_CHART_LABEL, SOURCE_CHART_LABEL } from '../../translations';
import type { LensAttributes, GetLensAttributes } from '../../types';
import { getDestinationIpColor, getSourceIpColor } from '../common/utils/unique_ips_palette';

const columnTimestamp = '662cd5e5-82bf-4325-a703-273f84b97e09';
const columnSourceIp = '5f317308-cfbb-4ee5-bfb9-07653184fabf';
const columnDestinationIpTimestamp = '36444b8c-7e10-4069-8298-6c1b46912be2';
const columnDestinationIp = 'ac1eb80c-ddde-46c4-a90c-400261926762';

const layerSourceIp = '38aa6532-6bf9-4c8f-b2a6-da8d32f7d0d7';
const layerDestinationIp = '72dc4b99-b07d-4dc9-958b-081d259e11fa';

export const getKpiUniquePrivateIpsAreaLensAttributes: GetLensAttributes = ({ euiTheme }) => {
  return {
    title: '[Network] Unique private IPs - area chart',
    description: '',
    visualizationType: 'lnsXY',
    state: {
      visualization: {
        legend: {
          isVisible: false,
          position: 'right',
          showSingleSeries: false,
        },
        valueLabels: 'hide',
        fittingFunction: 'None',
        yLeftExtent: {
          mode: 'full',
        },
        yRightExtent: {
          mode: 'full',
        },
        axisTitlesVisibilitySettings: {
          x: false,
          yLeft: false,
          yRight: true,
        },
        tickLabelsVisibilitySettings: {
          x: true,
          yLeft: true,
          yRight: true,
        },
        labelsOrientation: {
          x: 0,
          yLeft: 0,
          yRight: 0,
        },
        gridlinesVisibilitySettings: {
          x: true,
          yLeft: true,
          yRight: true,
        },
        preferredSeriesType: 'area',
        layers: [
          {
            layerId: layerSourceIp,
            seriesType: 'area',
            accessors: [columnSourceIp],
            layerType: 'data',
            xAccessor: columnTimestamp,
            yConfig: [
              {
                forAccessor: columnSourceIp,
                color: getSourceIpColor(euiTheme),
              },
            ],
          },
          {
            layerId: layerDestinationIp,
            seriesType: 'area',
            accessors: [columnDestinationIp],
            layerType: 'data',
            xAccessor: columnDestinationIpTimestamp,
            yConfig: [
              {
                forAccessor: columnDestinationIp,
                color: getDestinationIpColor(euiTheme),
              },
            ],
          },
        ],
      },
      query: {
        query: '',
        language: 'kuery',
      },
      filters: [],
      datasourceStates: {
        formBased: {
          layers: {
            [layerSourceIp]: {
              columns: {
                [columnTimestamp]: {
                  label: '@timestamp',
                  dataType: 'date',
                  operationType: 'date_histogram',
                  sourceField: '@timestamp',
                  isBucketed: true,
                  scale: 'interval',
                  params: {
                    interval: 'auto',
                  },
                },
                [columnSourceIp]: {
                  label: SOURCE_CHART_LABEL,
                  dataType: 'number',
                  operationType: 'unique_count',
                  scale: 'ratio',
                  sourceField: 'source.ip',
                  isBucketed: false,
                  customLabel: true,
                  filter: {
                    query:
                      '"source.ip": "10.0.0.0/8" or "source.ip": "192.168.0.0/16" or "source.ip": "172.16.0.0/12" or "source.ip": "fd00::/8"',
                    language: 'kuery',
                  },
                },
              },
              columnOrder: [columnTimestamp, columnSourceIp],
              incompleteColumns: {},
            },
            [layerDestinationIp]: {
              columns: {
                [columnDestinationIpTimestamp]: {
                  label: '@timestamp',
                  dataType: 'date',
                  operationType: 'date_histogram',
                  sourceField: '@timestamp',
                  isBucketed: true,
                  scale: 'interval',
                  params: {
                    interval: 'auto',
                  },
                },
                [columnDestinationIp]: {
                  label: DESTINATION_CHART_LABEL,
                  dataType: 'number',
                  operationType: 'unique_count',
                  scale: 'ratio',
                  sourceField: 'destination.ip',
                  isBucketed: false,
                  filter: {
                    query:
                      '"destination.ip": "10.0.0.0/8" or "destination.ip": "192.168.0.0/16" or "destination.ip": "172.16.0.0/12" or "destination.ip": "fd00::/8"',
                    language: 'kuery',
                  },
                },
              },
              columnOrder: [columnDestinationIpTimestamp, columnDestinationIp],
              incompleteColumns: {},
            },
          },
        },
      },
    },
    references: [
      {
        type: 'index-pattern',
        id: '{dataViewId}',
        name: 'indexpattern-datasource-current-indexpattern',
      },
      {
        type: 'index-pattern',
        id: '{dataViewId}',
        name: `indexpattern-datasource-layer-${layerSourceIp}`,
      },
      {
        type: 'index-pattern',
        id: '{dataViewId}',
        name: `indexpattern-datasource-layer-${layerDestinationIp}`,
      },
    ],
  } as LensAttributes;
};
