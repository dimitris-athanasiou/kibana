/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  EuiButtonEmpty,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiTitle
} from '@elastic/eui';
import { capitalize, get } from 'lodash';
import React from 'react';
import { RRRRenderResponse } from 'react-redux-request';
import styled from 'styled-components';
import {
  ERROR_EXC_STACKTRACE,
  ERROR_LOG_STACKTRACE
} from 'x-pack/plugins/apm/common/constants';
import { IUrlParams } from 'x-pack/plugins/apm/public/store/urlParams';
import { ErrorGroupAPIResponse } from 'x-pack/plugins/apm/server/lib/errors/get_error_group';
import { APMError } from 'x-pack/plugins/apm/typings/es_schemas/Error';
import { IStackframe } from 'x-pack/plugins/apm/typings/es_schemas/Stackframe';
import { Transaction } from 'x-pack/plugins/apm/typings/es_schemas/Transaction';
import {
  ERROR_EXC_HANDLED,
  REQUEST_METHOD,
  REQUEST_URL_FULL,
  TRACE_ID,
  TRANSACTION_ID,
  USER_ID
} from '../../../../../common/constants';
import { STATUS } from '../../../../constants';
import {
  borderRadius,
  colors,
  px,
  unit,
  units
} from '../../../../style/variables';
import { fromQuery, history, toQuery } from '../../../../utils/url';
import { KibanaLink, legacyEncodeURIComponent } from '../../../../utils/url';
import { DiscoverErrorButton } from '../../../shared/DiscoverButtons/DiscoverErrorButton';
import {
  getPropertyTabNames,
  PropertiesTable
} from '../../../shared/PropertiesTable';
import { Stacktrace } from '../../../shared/Stacktrace';
import { StickyProperties } from '../../../shared/StickyProperties';

const Container = styled.div`
  position: relative;
  border: 1px solid ${colors.gray4};
  border-radius: ${borderRadius};
  margin-top: ${px(units.plus)};
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: ${px(units.plus)} ${px(units.plus)} 0;
  margin-bottom: ${px(unit)};
`;

const PaddedContainer = styled.div`
  padding: ${px(units.plus)} ${px(units.plus)} 0;
`;

const EXC_STACKTRACE_TAB = 'exception_stacktrace';
const LOG_STACKTRACE_TAB = 'log_stacktrace';

interface Props {
  errorGroup: RRRRenderResponse<ErrorGroupAPIResponse>;
  urlParams: IUrlParams;
  location: any;
}

export function DetailView({ errorGroup, urlParams, location }: Props) {
  if (errorGroup.status !== STATUS.SUCCESS) {
    return null;
  }
  const { transaction, error, occurrencesCount } = errorGroup.data;

  if (!error) {
    return null;
  }

  const transactionLink = getTransactionLink(error, transaction);
  const stickyProperties = [
    {
      fieldName: '@timestamp',
      label: 'Timestamp',
      val: error['@timestamp'],
      width: '50%'
    },
    {
      fieldName: REQUEST_URL_FULL,
      label: 'URL',
      val: get(error, REQUEST_URL_FULL, 'N/A'),
      truncated: true,
      width: '50%'
    },
    {
      fieldName: REQUEST_METHOD,
      label: 'Request method',
      val: get(error, REQUEST_METHOD, 'N/A'),
      width: '25%'
    },
    {
      fieldName: ERROR_EXC_HANDLED,
      label: 'Handled',
      val: get(error, ERROR_EXC_HANDLED, 'N/A'),
      width: '25%'
    },
    {
      fieldName: TRANSACTION_ID,
      label: 'Transaction sample ID',
      val: transactionLink || 'N/A',
      width: '25%'
    },
    {
      fieldName: USER_ID,
      label: 'User ID',
      val: get(error, USER_ID, 'N/A'),
      width: '25%'
    }
  ];

  const tabs = getTabs(error);
  const currentTab = getCurrentTab(tabs, urlParams.detailTab);

  return (
    <Container>
      <HeaderContainer>
        <EuiTitle size="s">
          <h3>Error occurence</h3>
        </EuiTitle>
        <DiscoverErrorButton error={error} kuery={urlParams.kuery}>
          <EuiButtonEmpty iconType="discoverApp">
            {`View ${occurrencesCount} occurences in Discover`}
          </EuiButtonEmpty>
        </DiscoverErrorButton>
      </HeaderContainer>

      <PaddedContainer>
        <StickyProperties stickyProperties={stickyProperties} />
      </PaddedContainer>

      <EuiSpacer />

      <EuiTabs>
        {tabs.map(key => {
          return (
            <EuiTab
              onClick={() => {
                history.replace({
                  ...location,
                  search: fromQuery({
                    ...toQuery(location.search),
                    detailTab: key
                  })
                });
              }}
              isSelected={currentTab === key}
              key={key}
            >
              {capitalize(key.replace('_', ' '))}
            </EuiTab>
          );
        })}
      </EuiTabs>

      <PaddedContainer>
        <TabContent error={error} currentTab={currentTab} />
      </PaddedContainer>
    </Container>
  );
}

function getTransactionLink(error: APMError, transaction?: Transaction) {
  if (!transaction || !get(error, 'transaction.sampled')) {
    return;
  }

  const path = `/${
    transaction.context.service.name
  }/transactions/${legacyEncodeURIComponent(
    transaction.transaction.type
  )}/${legacyEncodeURIComponent(transaction.transaction.name)}`;

  return (
    <KibanaLink
      pathname={'/app/apm'}
      hash={path}
      query={{
        transactionId: transaction.transaction.id,
        traceid: get(transaction, TRACE_ID)
      }}
    >
      {transaction.transaction.id}
    </KibanaLink>
  );
}

type MaybeStackframes = IStackframe[] | undefined;

export function TabContent({
  error,
  currentTab
}: {
  error: APMError;
  currentTab?: string;
}) {
  const codeLanguage = error.context.service.name;
  const agentName = error.context.service.agent.name;
  const excStackframes: MaybeStackframes = get(error, ERROR_EXC_STACKTRACE);
  const logStackframes: MaybeStackframes = get(error, ERROR_LOG_STACKTRACE);

  switch (currentTab) {
    case LOG_STACKTRACE_TAB:
    case undefined:
      return (
        <Stacktrace stackframes={logStackframes} codeLanguage={codeLanguage} />
      );
    case EXC_STACKTRACE_TAB:
      return (
        <Stacktrace stackframes={excStackframes} codeLanguage={codeLanguage} />
      );
    default:
      const propData = error.context[currentTab] as any;
      return (
        <PropertiesTable
          propData={propData}
          propKey={currentTab}
          agentName={agentName}
        />
      );
  }
}

// Ensure the selected tab exists or use the first
export function getCurrentTab(tabs: string[] = [], selectedTab?: string) {
  return tabs.includes(selectedTab!) ? selectedTab : tabs[0];
}

export function getTabs(error: APMError) {
  const hasLogStacktrace = get(error, ERROR_LOG_STACKTRACE, []).length > 0;
  const contextKeys = Object.keys(error.context);
  return [
    ...(hasLogStacktrace ? [LOG_STACKTRACE_TAB] : []),
    EXC_STACKTRACE_TAB,
    ...getPropertyTabNames(contextKeys)
  ];
}
