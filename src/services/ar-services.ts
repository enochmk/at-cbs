import type {
  CbsClientOptions,
  QueryCustomerInfoOptions,
  QueryCustomerInfoOutput,
  QueryCustomerInfoResponse,
  QueryCustomerInfoAccount,
  QueryCustomerInfoMainBalance,
  CurrentStatusLabel,
  QueryBalanceOptions,
  QueryBalanceOutput,
  QueryBalanceResponse,
  QueryBalanceResult,
  QueryBalanceAcctList,
  QuerySubLifeCycleOptions,
  QuerySubLifeCycleOutput,
  QuerySubLifeCycleResponse,
  QuerySubLifeCycleResult,
  SubDeactivationOptions,
  SubDeactivationOutput,
  SubDeactivationResponse,
  QueryXTransactionOptions,
  QueryXTransactionOutput,
  QueryXTransactionResponse,
  QueryXTransactionResult,
  QueryCdrDetailOptions,
  QueryCdrDetailOutput,
  QueryCdrDetailResponse,
  QueryCdrDetailResult,
  CustActivationOptions,
  CustActivationOutput,
  CustActivationResponse,
  CustDeactivationOptions,
  CustDeactivationOutput,
  CustDeactivationResponse,
  AdjustAccountOptions,
  AdjustAccountOutput,
  AdjustAccountResponse,
  AdjustAccountResult,
  QueryTransactionOptions,
  QueryTransactionRecord,
  QueryTransactionOutput,
  QueryTransactionResponse,
  QueryTransactionResult,
  QueryRechargeLogOptions,
  QueryRechargeLogOutput,
  QueryRechargeLogRecord,
  QueryRechargeLogResponse,
  QueryRechargeLogResult,
  QueryRefundLogOptions,
  QueryRefundLogOutput,
  QueryRefundLogRecord,
  QueryRefundLogResponse,
  QueryRefundLogResult,
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsServiceBase } from './cbs-service-base';
import { getXmlField, normalizeBalanceAmount } from '../utils';

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parseOptionalNonNegativeInteger(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export class ArServices extends CbsServiceBase {
  protected readonly servicePath = '/services/ArServices';

  async queryRechargeLog(
    msisdn: string,
    opts: QueryRechargeLogOptions,
  ): Promise<QueryRechargeLogOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    if (!opts?.startTime?.trim() || !opts?.endTime?.trim()) {
      throw createHttpError(400, 'startTime and endTime are required for QueryRechargeLog');
    }
    if (opts.rechargeType !== undefined && opts.innerRechargeType !== undefined) {
      throw createHttpError(400, 'rechargeType and innerRechargeType cannot both be specified');
    }
    if (
      opts.innerRechargeType !== undefined &&
      !['0', '1', '2', '3'].includes(opts.innerRechargeType)
    ) {
      throw createHttpError(400, 'innerRechargeType must be one of 0, 1, 2, or 3');
    }
    if (opts.rechargeResult !== undefined && ![0, 1].includes(opts.rechargeResult)) {
      throw createHttpError(400, 'rechargeResult must be 0 (failed) or 1 (successful)');
    }

    const startRow = opts.startRow ?? 0;
    const pageSize = opts.pageSize ?? 50;
    const totalRows = opts.totalRows ?? 0;
    if (!Number.isSafeInteger(totalRows) || totalRows < 0 || totalRows >= 65535) {
      throw createHttpError(400, 'totalRows must be an integer from 0 to 65534');
    }
    if (!Number.isSafeInteger(startRow) || startRow < 0 || startRow >= 65535) {
      throw createHttpError(400, 'startRow must be an integer from 0 to 65534');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) {
      throw createHttpError(400, 'pageSize must be an integer from 1 to 500');
    }
    const channelIds = opts.rechargeChannelIds ?? [];
    if (channelIds.some((channelId) => !channelId.trim())) {
      throw createHttpError(400, 'rechargeChannelIds cannot contain an empty value');
    }

    const messageSeq = this.createMessageSeq();
    this.log('verbose', 'queryRechargeLog - sending request', { msisdn, opts });

    const rechargeChannelIds =
      channelIds.length > 0
        ? `<ars:RechargeChannelIDs>${channelIds
            .map(
              (channelId) =>
                `<ars:RechargeChannelID>${escapeXmlText(channelId)}</ars:RechargeChannelID>`,
            )
            .join('')}</ars:RechargeChannelIDs>`
        : '';
    const optionalFilters = [
      opts.extTransId !== undefined
        ? `<ars:ExtTransID>${escapeXmlText(opts.extTransId)}</ars:ExtTransID>`
        : '',
      opts.rechargeType !== undefined
        ? `<ars:RechargeType>${escapeXmlText(opts.rechargeType)}</ars:RechargeType>`
        : '',
      opts.innerRechargeType !== undefined
        ? `<ars:InnerRechargeType>${opts.innerRechargeType}</ars:InnerRechargeType>`
        : '',
      opts.rechargeResult !== undefined
        ? `<ars:RechargeResult>${opts.rechargeResult}</ars:RechargeResult>`
        : '',
      opts.subscriberLevelOnly !== undefined
        ? `<ars:AdditionalProperty><arc:Code>C_SUB_LOG</arc:Code><arc:Value>${opts.subscriberLevelOnly ? 1 : 0}</arc:Value></ars:AdditionalProperty>`
        : '',
    ].join('');
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:QueryRechargeLogRequestMsg>
            ${this.requestHeader(opts, '1', messageSeq, { timeType: 2 })}
            <QueryRechargeLogRequest>
              <ars:QueryObj>
                <ars:SubAccessCode>
                  <arc:PrimaryIdentity>${cbsMsisdn}</arc:PrimaryIdentity>
                </ars:SubAccessCode>
              </ars:QueryObj>
              ${rechargeChannelIds}
              <ars:TotalRowNum>${totalRows}</ars:TotalRowNum>
              <ars:BeginRowNum>${startRow}</ars:BeginRowNum>
              <ars:FetchRowNum>${pageSize}</ars:FetchRowNum>
              <ars:StartTime>${escapeXmlText(opts.startTime)}</ars:StartTime>
              <ars:EndTime>${escapeXmlText(opts.endTime)}</ars:EndTime>
              ${optionalFilters}
            </QueryRechargeLogRequest>
          </ars:QueryRechargeLogRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryRechargeLog',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryRechargeLogResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('queryRechargeLog', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryRechargeLogResult>(
      resultMsg as Record<string, unknown>,
      'QueryRechargeLogResult',
    );
    const recordResult = getXmlField<QueryRechargeLogRecord | QueryRechargeLogRecord[]>(
      queryResult as Record<string, unknown> | undefined,
      'RechargeInfo',
    );
    const recharges =
      recordResult === undefined ? [] : Array.isArray(recordResult) ? recordResult : [recordResult];
    const returnedResult = queryResult ?? {};

    this.log('verbose', 'queryRechargeLog - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: returnedResult,
      recharges,
      pagination: {
        totalRows: parseOptionalNonNegativeInteger(
          getXmlField<string | number>(returnedResult, 'TotalRowNum'),
        ),
        startRow,
        pageSize,
        rowsReturned: recharges.length,
      },
    };
  }

  async queryRefundLog(
    msisdn: string,
    opts?: QueryRefundLogOptions,
  ): Promise<QueryRefundLogOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const startRow = opts?.startRow ?? 0;
    const pageSize = opts?.pageSize ?? 50;
    const totalRows = opts?.totalRows ?? 0;

    if (!Number.isSafeInteger(totalRows) || totalRows < 0 || totalRows >= 65535) {
      throw createHttpError(400, 'totalRows must be an integer from 0 to 65534');
    }
    if (!Number.isSafeInteger(startRow) || startRow < 0 || startRow >= 65535) {
      throw createHttpError(400, 'startRow must be an integer from 0 to 65534');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw createHttpError(400, 'pageSize must be an integer from 1 to 1000');
    }

    const messageSeq = this.createMessageSeq();
    this.log('verbose', 'queryRefundLog - sending request', { msisdn, opts });
    const optionalTimes = [
      opts?.startTime !== undefined
        ? `<ars:StartTime>${escapeXmlText(opts.startTime)}</ars:StartTime>`
        : '',
      opts?.endTime !== undefined
        ? `<ars:EndTime>${escapeXmlText(opts.endTime)}</ars:EndTime>`
        : '',
    ].join('');
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:QueryRefundLogRequestMsg>
            ${this.requestHeader(opts, 'QueryRefundLog', messageSeq)}
            <QueryRefundLogRequest>
              <ars:QueryObj>
                <ars:SubAccessCode>
                  <arc:PrimaryIdentity>${cbsMsisdn}</arc:PrimaryIdentity>
                </ars:SubAccessCode>
              </ars:QueryObj>
              ${optionalTimes}
              <ars:TotalRowNum>${totalRows}</ars:TotalRowNum>
              <ars:BeginRowNum>${startRow}</ars:BeginRowNum>
              <ars:FetchRowNum>${pageSize}</ars:FetchRowNum>
            </QueryRefundLogRequest>
          </ars:QueryRefundLogRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryRefundLog',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryRefundLogResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('queryRefundLog', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryRefundLogResult>(
      resultMsg as Record<string, unknown>,
      'QueryRefundLogResult',
    );
    const recordResult = getXmlField<QueryRefundLogRecord | QueryRefundLogRecord[]>(
      queryResult as Record<string, unknown> | undefined,
      'RefundLogInfo',
    );
    const refunds =
      recordResult === undefined ? [] : Array.isArray(recordResult) ? recordResult : [recordResult];
    const returnedResult = queryResult ?? {};

    this.log('verbose', 'queryRefundLog - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: returnedResult,
      refunds,
      pagination: {
        totalRows: parseOptionalNonNegativeInteger(
          getXmlField<string | number>(returnedResult, 'TotalRowNum'),
        ),
        startRow,
        pageSize,
        rowsReturned: refunds.length,
      },
    };
  }

  async queryTransaction(
    msisdn: string,
    opts?: QueryTransactionOptions,
  ): Promise<QueryTransactionOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const startRow = opts?.startRow ?? 0;
    const pageSize = opts?.pageSize ?? 50;
    const totalRows = opts?.totalRows ?? 0;

    if (!Number.isSafeInteger(totalRows) || totalRows < 0) {
      throw createHttpError(400, 'totalRows must be a non-negative integer');
    }
    if (!Number.isSafeInteger(startRow) || startRow < 0) {
      throw createHttpError(400, 'startRow must be a non-negative integer');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw createHttpError(400, 'pageSize must be an integer from 1 to 1000');
    }

    const messageSeq = this.createMessageSeq();
    this.log('verbose', 'queryTransaction - sending request', { msisdn, opts });

    const optionalTimes = [
      opts?.startTime !== undefined
        ? `<ars:StartTime>${escapeXmlText(opts.startTime)}</ars:StartTime>`
        : '',
      opts?.endTime !== undefined
        ? `<ars:EndTime>${escapeXmlText(opts.endTime)}</ars:EndTime>`
        : '',
    ].join('');
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:QueryTransactionRequestMsg>
            ${this.requestHeader(opts, 'QueryTransaction', messageSeq)}
            <QueryTransactionRequest>
              <ars:QueryObj>
                <ars:SubAccessCode>
                  <arc:PrimaryIdentity>${cbsMsisdn}</arc:PrimaryIdentity>
                </ars:SubAccessCode>
              </ars:QueryObj>
              ${optionalTimes}
              <ars:TotalRowNum>${totalRows}</ars:TotalRowNum>
              <ars:BeginRowNum>${startRow}</ars:BeginRowNum>
              <ars:FetchRowNum>${pageSize}</ars:FetchRowNum>
            </QueryTransactionRequest>
          </ars:QueryTransactionRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryTransaction',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryTransactionResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('queryTransaction', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryTransactionResult>(
      resultMsg as Record<string, unknown>,
      'QueryTransactionResult',
    );
    const recordResult = getXmlField<QueryTransactionRecord | QueryTransactionRecord[]>(
      queryResult as Record<string, unknown> | undefined,
      'TransactionInfo',
    );
    const transactions =
      recordResult === undefined ? [] : Array.isArray(recordResult) ? recordResult : [recordResult];
    const returnedResult = queryResult ?? {};

    this.log('verbose', 'queryTransaction - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: returnedResult,
      transactions,
      pagination: {
        totalRows: parseOptionalNonNegativeInteger(
          getXmlField<string | number>(returnedResult, 'TotalRowNum'),
        ),
        startRow,
        pageSize,
        rowsReturned: transactions.length,
      },
    };
  }

  async adjustAccount(msisdn: string, opts?: AdjustAccountOptions): Promise<AdjustAccountOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = this.createMessageSeq();
    const adjustmentSerialNo = opts?.adjustmentSerialNo ?? `Adj${randomUUID().replace(/-/g, '')}`;
    const adjustmentAmt = opts?.adjustmentAmt ?? 500000;
    const balanceType = opts?.balanceType ?? 'C_MAIN_ACCOUNT';
    const adjustmentType = opts?.adjustmentType ?? 2;
    const currencyId = opts?.currencyId ?? 1054;
    const adjustmentReasonCode = opts?.adjustmentReasonCode ?? 'DNTREQ';
    const opType = opts?.opType ?? 2;

    this.log('verbose', 'adjustAccount - sending request', { msisdn, opts });
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:AdjustmentRequestMsg>
            ${this.requestHeader(opts, 'Adjustment', messageSeq)}
            <AdjustmentRequest>
              <ars:AdjustmentSerialNo>${adjustmentSerialNo}</ars:AdjustmentSerialNo>
              <ars:AdjustmentObj><ars:SubAccessCode><arc:PrimaryIdentity>${cbsMsisdn}</arc:PrimaryIdentity></ars:SubAccessCode></ars:AdjustmentObj>
              <ars:OpType>${opType}</ars:OpType>
              <ars:AdjustmentInfo>
                <arc:BalanceType>${balanceType}</arc:BalanceType>
                <arc:AdjustmentType>${adjustmentType}</arc:AdjustmentType>
                <arc:AdjustmentAmt>${adjustmentAmt}</arc:AdjustmentAmt>
                <arc:CurrencyID>${currencyId}</arc:CurrencyID>
              </ars:AdjustmentInfo>
              <ars:AdjustmentReasonCode>${adjustmentReasonCode}</ars:AdjustmentReasonCode>
            </AdjustmentRequest>
          </ars:AdjustmentRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'adjustAccount',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<AdjustAccountResponse>(
      response,
      this.transport.parser,
    );
    if (resultCode !== '0')
      this.transport.throwCbsError('adjustAccount', msisdn, resultCode, resultDesc);

    const result = getXmlField<AdjustAccountResult>(resultMsg, 'AdjustmentResult');
    const info = getXmlField<Record<string, unknown>>(result, 'AdjustmentInfo');
    this.log('verbose', 'adjustAccount - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        ResultCode: resultCode,
        ResultDesc: resultDesc,
        OldBalanceAmt: getXmlField(info, 'OldBalanceAmt'),
        NewBalanceAmt: getXmlField(info, 'NewBalanceAmt'),
        amountInGhc: normalizeBalanceAmount(getXmlField(info, 'NewBalanceAmt')),
        BalanceType: getXmlField(info, 'BalanceType'),
        BalanceTypeName: getXmlField(info, 'BalanceTypeName'),
      },
    };
  }

  async queryBalance(msisdn: string, opts?: QueryBalanceOptions): Promise<QueryBalanceOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = this.createMessageSeq();
    this.log('verbose', 'queryBalance - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:QueryBalanceRequestMsg>
            ${this.requestHeader(opts, 'QueryBalance', messageSeq)}
            <QueryBalanceRequest>
              <ars:QueryObj>
                <ars:SubAccessCode>
                  <arc:PrimaryIdentity>${cbsMsisdn}</arc:PrimaryIdentity>
                </ars:SubAccessCode>
              </ars:QueryObj>
            </QueryBalanceRequest>
          </ars:QueryBalanceRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryBalance',
      msisdn,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryBalanceResponse>(
      response,
      this.transport.parser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('queryBalance', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryBalanceResult>(
      resultMsg as Record<string, unknown>,
      'QueryBalanceResult',
    );
    const accountLists = getXmlField<QueryBalanceResult['AcctList']>(
      queryResult as Record<string, unknown> | undefined,
      'AcctList',
    );
    const accountListRecords = accountLists
      ? Array.isArray(accountLists)
        ? accountLists
        : [accountLists]
      : [];
    const balanceResult = accountListRecords
      .flatMap((accountList) => {
        const balances = getXmlField<QueryBalanceAcctList['BalanceResult']>(
          accountList,
          'BalanceResult',
        );
        return balances ? (Array.isArray(balances) ? balances : [balances]) : [];
      })
      .find(
        (balance) =>
          getXmlField(balance, 'BalanceType') === 'C_MAIN_ACCOUNT' &&
          getXmlField(balance, 'BalanceTypeName') === 'PPS_MainAccount',
      );
    const balanceDetail = getXmlField<Record<string, unknown>>(balanceResult, 'BalanceDetail');

    this.log('verbose', 'queryBalance - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        BalanceType: getXmlField<string>(balanceResult, 'BalanceType'),
        BalanceTypeName: getXmlField<string>(balanceResult, 'BalanceTypeName'),
        TotalAmount: getXmlField<number | string>(balanceResult, 'TotalAmount'),
        InitialAmount: getXmlField<number | string>(balanceDetail, 'InitialAmount'),
        amountInGhc: normalizeBalanceAmount(
          getXmlField<number | string>(balanceResult, 'TotalAmount'),
        ),
        EffectiveTime: getXmlField<string | number>(balanceDetail, 'EffectiveTime'),
        ExpireTime: getXmlField<string | number>(balanceDetail, 'ExpireTime'),
        LastUpdateTime: getXmlField<string | number>(balanceDetail, 'LastUpdateTime'),
      },
    };
  }
}
