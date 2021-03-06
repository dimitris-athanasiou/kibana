/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/*
 * Logstash Node Pipeline View
 */
import React from 'react';
import uiRoutes from'ui/routes';
import moment from 'moment';
import { ajaxErrorHandlersProvider } from 'plugins/monitoring/lib/ajax_error_handler';
import { routeInitProvider } from 'plugins/monitoring/lib/route_init';
import { CALCULATE_DURATION_SINCE } from '../../../../common/constants';
import { formatTimestampToDuration } from '../../../../common/format_timestamp_to_duration';
import template from './index.html';
import { i18n } from '@kbn/i18n';
import { List } from 'plugins/monitoring/components/logstash/pipeline_viewer/models/list';
import { PipelineState } from 'plugins/monitoring/components/logstash/pipeline_viewer/models/pipeline_state';
import { PipelineViewer } from 'plugins/monitoring/components/logstash/pipeline_viewer';
import { Pipeline } from 'plugins/monitoring/components/logstash/pipeline_viewer/models/pipeline';
import { MonitoringViewBaseController } from '../../base_controller';
import { I18nProvider } from '@kbn/i18n/react';
import {
  EuiPageBody,
  EuiPage,
  EuiPageContent,
} from '@elastic/eui';

function getPageData($injector) {
  const $route = $injector.get('$route');
  const $http = $injector.get('$http');
  const globalState = $injector.get('globalState');
  const minIntervalSeconds = $injector.get('minIntervalSeconds');
  const Private = $injector.get('Private');

  const { ccs, cluster_uuid: clusterUuid } = globalState;
  const pipelineId = $route.current.params.id;
  const pipelineHash = $route.current.params.hash || '';
  const url = pipelineHash
    ? `../api/monitoring/v1/clusters/${clusterUuid}/logstash/pipeline/${pipelineId}/${pipelineHash}`
    : `../api/monitoring/v1/clusters/${clusterUuid}/logstash/pipeline/${pipelineId}`;
  return $http.post(url, {
    ccs
  })
    .then(response => response.data)
    .then(data => {
      data.versions = data.versions.map(version => {
        const relativeFirstSeen = formatTimestampToDuration(version.firstSeen, CALCULATE_DURATION_SINCE);
        const relativeLastSeen = formatTimestampToDuration(version.lastSeen, CALCULATE_DURATION_SINCE);

        const fudgeFactorSeconds = 2 * minIntervalSeconds;
        const isLastSeenCloseToNow = (Date.now() - version.lastSeen) <= fudgeFactorSeconds * 1000;

        return {
          ...version,
          relativeFirstSeen: i18n.translate('xpack.monitoring.logstash.pipeline.relativeFirstSeenAgoLabel', {
            defaultMessage: '{relativeFirstSeen} ago', values: { relativeFirstSeen }
          }),
          relativeLastSeen: isLastSeenCloseToNow ?
            i18n.translate('xpack.monitoring.logstash.pipeline.relativeLastSeenNowLabel', {
              defaultMessage: 'now'
            })
            : i18n.translate('xpack.monitoring.logstash.pipeline.relativeLastSeenAgoLabel', {
              defaultMessage: 'until {relativeLastSeen} ago', values: { relativeLastSeen }
            })
        };
      });

      return data;
    })
    .catch((err) => {
      const ajaxErrorHandlers = Private(ajaxErrorHandlersProvider);
      return ajaxErrorHandlers(err);
    });
}

uiRoutes.when('/logstash/pipelines/:id/:hash?', {
  template,
  resolve: {
    clusters(Private) {
      const routeInit = Private(routeInitProvider);
      return routeInit();
    },
    pageData: getPageData
  },
  controller: class extends MonitoringViewBaseController {
    constructor($injector, $scope, i18n) {
      const config = $injector.get('config');
      const dateFormat = config.get('dateFormat');

      super({
        title: i18n('xpack.monitoring.logstash.pipeline.routeTitle', {
          defaultMessage: 'Logstash - Pipeline'
        }),
        storageKey: 'logstash.pipelines',
        getPageData,
        reactNodeId: 'monitoringLogstashPipelineApp',
        $scope,
        $injector
      });

      const timeseriesTooltipXValueFormatter = xValue =>
        moment(xValue).format(dateFormat);

      $scope.$watch(() => this.data, data => {
        if (!data || !data.pipeline) {
          return;
        }
        this.pipelineState = new PipelineState(data.pipeline);
        this.renderReact(
          <I18nProvider>
            <EuiPage>
              <EuiPageBody>
                <EuiPageContent>
                  <PipelineViewer
                    pipeline={List.fromPipeline(
                      Pipeline.fromPipelineGraph(this.pipelineState.config.graph)
                    )}
                    timeseriesTooltipXValueFormatter={timeseriesTooltipXValueFormatter}
                  />
                </EuiPageContent>
              </EuiPageBody>
            </EuiPage>
          </I18nProvider>
        );
      });
    }
  }
});
