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
  AdjustBalancesOptions,
  AdjustBalancesOutput,
  AdjustBalanceAccount,
  AdjustFreeUnitAdjustment,
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsRequestDefaults } from '../types';
import { CbsServiceBase } from './cbs-service-base';
import { getXmlField, normalizeBalanceAmount } from '../utils';

export class ArServices extends CbsServiceBase {
  protected readonly servicePath = '/services/ArServices';

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

  /** Sends account-balance and free-unit changes in one CBS AdjustmentRequest. */
  async adjustBalances(msisdn: string, opts: AdjustBalancesOptions): Promise<AdjustBalancesOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    if (!opts.accounts.length && !opts.adjustments.length) {
      throw createHttpError(400, 'At least one account or free-unit adjustment is required');
    }

    const adjustmentSerialNo = opts.adjustmentSerialNo ?? `Adj${randomUUID().replace(/-/g, '')}`;
    const opType = opts.opType ?? 1;
    const reason = opts.adjustmentReasonCode
      ? `<ars:AdjustmentReasonCode>${this.escapeXml(opts.adjustmentReasonCode)}</ars:AdjustmentReasonCode>`
      : '';
    const accountInfos = opts.accounts.map((account) => this.buildAccountAdjustmentInfo(account));
    const freeUnitInfos = opts.adjustments.map((adjustment) =>
      this.buildFreeUnitAdjustmentInfo(adjustment),
    );
    const messageSeq = opts.messageSeq ?? this.createMessageSeq();

    this.log('verbose', 'adjustBalances - sending request', {
      msisdn,
      accountCount: opts.accounts.length,
      adjustmentCount: opts.adjustments.length,
      opts,
    });
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <soapenv:Header/>
        <soapenv:Body>
          <ars:AdjustmentRequestMsg>
            ${this.requestHeader(opts, 'Adjustment', messageSeq, {
              operatorId: CbsRequestDefaults.OPERATOR_ID,
              accessMode: CbsRequestDefaults.ACCESS_MODE,
              msgLanguageCode: CbsRequestDefaults.MSG_LANGUAGE_CODE,
            })}
            <AdjustmentRequest>
              <ars:AdjustmentSerialNo>${this.escapeXml(adjustmentSerialNo)}</ars:AdjustmentSerialNo>
              <ars:AdjustmentObj><ars:SubAccessCode><arc:PrimaryIdentity>${this.escapeXml(cbsMsisdn)}</arc:PrimaryIdentity></ars:SubAccessCode></ars:AdjustmentObj>
              <ars:OpType>${this.escapeXml(opType)}</ars:OpType>
              ${[...accountInfos, ...freeUnitInfos].join('\n              ')}
              ${reason}
            </AdjustmentRequest>
          </ars:AdjustmentRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'adjustBalances',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<AdjustAccountResponse>(
      response,
      this.transport.parser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('adjustBalances', msisdn, resultCode, resultDesc);
    }

    const result = getXmlField<AdjustAccountResult>(resultMsg, 'AdjustmentResult');
    const rawAccounts = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
      result,
      'AdjustmentInfo',
    );
    const rawFreeUnits = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
      result,
      'FreeUnitAdjustmentInfo',
    );
    const accountResults = rawAccounts
      ? Array.isArray(rawAccounts)
        ? rawAccounts
        : [rawAccounts]
      : [];
    const freeUnitResults = rawFreeUnits
      ? Array.isArray(rawFreeUnits)
        ? rawFreeUnits
        : [rawFreeUnits]
      : [];

    this.log('verbose', 'adjustBalances - success', {
      msisdn,
      accountCount: opts.accounts.length,
      adjustmentCount: opts.adjustments.length,
    });
    return {
      metadata: resultMsg,
      data: {
        ResultCode: resultCode,
        ResultDesc: resultDesc,
        accounts: opts.accounts.map((account, index) => {
          const info = accountResults[index];
          return {
            ResultCode: resultCode,
            ResultDesc: resultDesc,
            OldBalanceAmt: getXmlField(info, 'OldBalanceAmt'),
            NewBalanceAmt: getXmlField(info, 'NewBalanceAmt'),
            BalanceType: getXmlField(info, 'BalanceType') ?? account.balanceType,
            BalanceTypeName: getXmlField(info, 'BalanceTypeName'),
          };
        }),
        adjustments: opts.adjustments.map((adjustment, index) => {
          const info = freeUnitResults[index];
          return {
            ResultCode: resultCode,
            ResultDesc: resultDesc,
            OldBalanceAmt: getXmlField(info, 'OldBalanceAmt'),
            NewBalanceAmt: getXmlField(info, 'NewBalanceAmt'),
            FreeUnitType: getXmlField(info, 'FreeUnitType') ?? adjustment.freeUnitType,
            FreeUnitInstanceID:
              getXmlField(info, 'FreeUnitInstanceID') ?? adjustment.freeUnitInstanceId,
          };
        }),
      },
    };
  }

  private buildAccountAdjustmentInfo(adjustment: AdjustBalanceAccount): string {
    if (!adjustment.balanceType.trim()) {
      throw createHttpError(400, 'balanceType is required');
    }

    const adjustmentType = adjustment.adjustmentType ?? 1;
    const currencyId = adjustment.currencyId ?? 1054;
    const expiration =
      adjustment.expireTime !== undefined
        ? `<arc:ExpireTime>${this.escapeXml(adjustment.expireTime)}</arc:ExpireTime>`
        : '';
    return `<ars:AdjustmentInfo>
          <arc:BalanceType>${this.escapeXml(adjustment.balanceType)}</arc:BalanceType>
          <arc:AdjustmentType>${this.escapeXml(adjustmentType)}</arc:AdjustmentType>
          <arc:AdjustmentAmt>${this.escapeXml(adjustment.adjustmentAmt)}</arc:AdjustmentAmt>
          <arc:CurrencyID>${this.escapeXml(currencyId)}</arc:CurrencyID>
          ${expiration}
        </ars:AdjustmentInfo>`;
  }

  private buildFreeUnitAdjustmentInfo(adjustment: AdjustFreeUnitAdjustment): string {
    const freeUnitType = adjustment.freeUnitType?.trim();
    const freeUnitInstanceId =
      adjustment.freeUnitInstanceId !== undefined
        ? String(adjustment.freeUnitInstanceId).trim() || undefined
        : undefined;
    if (!freeUnitType && !freeUnitInstanceId) {
      throw createHttpError(400, 'freeUnitType or freeUnitInstanceId is required');
    }
    if (
      adjustment.expireTime !== undefined &&
      (adjustment.offsetUnit !== undefined || adjustment.offsetValue !== undefined)
    ) {
      throw createHttpError(400, 'Provide expireTime or offsetUnit/offsetValue, not both');
    }
    if ((adjustment.offsetUnit === undefined) !== (adjustment.offsetValue === undefined)) {
      throw createHttpError(400, 'offsetUnit and offsetValue must be provided together');
    }

    const adjustmentType = adjustment.adjustmentType ?? 1;
    const selectInstanceMode =
      adjustment.selectInstanceMode !== undefined
        ? `<ars:SelectInstanceMode>${this.escapeXml(adjustment.selectInstanceMode)}</ars:SelectInstanceMode>`
        : freeUnitInstanceId === undefined
          ? '<ars:SelectInstanceMode>1</ars:SelectInstanceMode>'
          : '';
    const expiration =
      adjustment.expireTime !== undefined
        ? `<ars:ExpireTime>${this.escapeXml(adjustment.expireTime)}</ars:ExpireTime>`
        : adjustment.offsetUnit !== undefined && adjustment.offsetValue !== undefined
          ? `<ars:OffsetUnit>${this.escapeXml(adjustment.offsetUnit)}</ars:OffsetUnit><ars:OffsetValue>${this.escapeXml(adjustment.offsetValue)}</ars:OffsetValue>`
          : '';
    return `<ars:FreeUnitAdjustmentInfo>
          ${freeUnitType ? `<ars:FreeUnitType>${this.escapeXml(freeUnitType)}</ars:FreeUnitType>` : ''}
          ${freeUnitInstanceId ? `<ars:FreeUnitInstanceID>${this.escapeXml(freeUnitInstanceId)}</ars:FreeUnitInstanceID>` : ''}
          <ars:AdjustmentType>${this.escapeXml(adjustmentType)}</ars:AdjustmentType>
          <ars:AdjustmentAmt>${this.escapeXml(adjustment.adjustmentAmt)}</ars:AdjustmentAmt>
          ${expiration}
          ${selectInstanceMode}
        </ars:FreeUnitAdjustmentInfo>`;
  }

  private escapeXml(value: string | number): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
