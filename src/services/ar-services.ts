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
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsServiceBase } from './cbs-service-base';
import { getXmlField } from '../utils';

export class ArServices extends CbsServiceBase {
  protected readonly servicePath = '/services/ArServices';

  async adjustAccount(msisdn: string, opts?: AdjustAccountOptions): Promise<AdjustAccountOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? randomUUID();
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
        BalanceType: getXmlField(info, 'BalanceType'),
        BalanceTypeName: getXmlField(info, 'BalanceTypeName'),
      },
    };
  }

  async queryBalance(msisdn: string, opts?: QueryBalanceOptions): Promise<QueryBalanceOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? '1';
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
        EffectiveTime: getXmlField<string | number>(balanceDetail, 'EffectiveTime'),
        ExpireTime: getXmlField<string | number>(balanceDetail, 'ExpireTime'),
        LastUpdateTime: getXmlField<string | number>(balanceDetail, 'LastUpdateTime'),
      },
    };
  }
}
