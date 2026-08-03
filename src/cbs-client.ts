import axios, { type AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import createHttpError from 'http-errors';
import https from 'node:https';

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
} from './types';
import { getXmlField, parseSoapResponse } from './utils';

export class CbsClient {
  private parser: XMLParser;
  private opts: Required<CbsClientOptions>;

  private static BC_SERVICES = '/services/BcServices';
  private static AR_SERVICES = '/services/ArServices';

  constructor(options: CbsClientOptions) {
    this.opts = {
      timeout: 15000,
      rejectUnauthorized: true,
      logger: {},
      ...options,
    };
    this.parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: true,
      trimValues: true,
    });
  }

  private getUrl(service: string): string {
    return `${this.opts.baseUrl}${service}`;
  }

  private log(level: string, msg: string, ctx?: Record<string, unknown>): void {
    const fn = this.opts.logger[level as keyof typeof this.opts.logger];
    if (fn) fn(msg, ctx);
  }

  private normalizeMsisdn(msisdn: string): string {
    const digits = msisdn.replace(/\D/g, '');
    if (![9, 10, 12].includes(digits.length)) {
      throw createHttpError(400, 'MSISDN must be 9, 10, or 12 digits');
    }
    return digits.slice(-9);
  }

  async queryCustomerInfo(
    msisdn: string,
    opts?: QueryCustomerInfoOptions,
  ): Promise<QueryCustomerInfoOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? new Date().toISOString();
    this.log('verbose', 'queryCustomerInfo - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
      <soapenv:Header/>
      <soapenv:Body>
          <bcs:QueryCustomerInfoRequestMsg>
            <RequestHeader>
                <cbs:Version>1</cbs:Version>
                <cbs:BusinessCode>QueryCustomerInfo</cbs:BusinessCode>
                <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
                <cbs:OwnershipInfo>
                  <cbs:BEID>${opts?.beId ?? '101'}</cbs:BEID>
                </cbs:OwnershipInfo>
                <cbs:AccessSecurity>
                  <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                  <cbs:Password>${this.opts.password}</cbs:Password>
                </cbs:AccessSecurity>
                <cbs:OperatorInfo>
                  <cbs:OperatorID>${opts?.operatorId ?? '101'}</cbs:OperatorID>
                </cbs:OperatorInfo>
                <cbs:AccessMode>${opts?.accessMode ?? 3}</cbs:AccessMode>
                <cbs:MsgLanguageCode>${opts?.msgLanguageCode ?? 2002}</cbs:MsgLanguageCode>
                <cbs:TimeFormat>
                  <cbs:TimeType>${opts?.timeType ?? 1}</cbs:TimeType>
                </cbs:TimeFormat>
            </RequestHeader>
            <QueryCustomerInfoRequest>
              <bcs:QueryObj>
                <bcs:SubAccessCode>
                  <bcc:PrimaryIdentity>${cbsMsisdn}</bcc:PrimaryIdentity>
                </bcs:SubAccessCode>
              </bcs:QueryObj>
              <bcs:QueryMode>0</bcs:QueryMode>
              <bcs:CustomerMask>1100</bcs:CustomerMask>
              <bcs:AccountMask>11</bcs:AccountMask>
              <bcs:SubscriberMask>11111110</bcs:SubscriberMask>
              <bcs:GroupMask>00000</bcs:GroupMask>
            </QueryCustomerInfoRequest>
          </bcs:QueryCustomerInfoRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BC_SERVICES), soapPayload, {
        headers: { 'Content-Type': 'text/xml' },
        httpsAgent: new https.Agent({ rejectUnauthorized: this.opts.rejectUnauthorized }),
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'queryCustomerInfo - request failed', {
        msisdn,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<QueryCustomerInfoResponse>(
      response.data,
      this.parser,
    );

    if (resultCode !== '0') {
      this.log('warn', 'queryCustomerInfo - CBS error', {
        msisdn,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc);
    }

    const queryResult = getXmlField<Record<string, unknown>>(
      resultMsg as Record<string, unknown>,
      'QueryCustomerInfoResult',
    );
    const customer = getXmlField<Record<string, unknown>>(queryResult, 'Customer');
    const subscriber = getXmlField<Record<string, unknown>>(queryResult, 'Subscriber');
    const subscriberInfo = getXmlField<Record<string, unknown>>(subscriber, 'SubscriberInfo');
    const account = getXmlField<QueryCustomerInfoAccount>(queryResult, 'Account');
    const individualInfo = getXmlField<Record<string, unknown>>(customer, 'IndividualInfo');
    const lifecycleDetail = getXmlField<Record<string, unknown>>(subscriber, 'LifeCycleDetail');
    const subscriberAccounts = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
      subscriber,
      'AcctList',
    );
    const accountRecords = subscriberAccounts
      ? Array.isArray(subscriberAccounts)
        ? subscriberAccounts
        : [subscriberAccounts]
      : [];
    const mainBalanceResult = accountRecords
      .flatMap((acctList) => {
        const balanceResult = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
          acctList,
          'BalanceResult',
        );
        return balanceResult
          ? Array.isArray(balanceResult)
            ? balanceResult
            : [balanceResult]
          : [];
      })
      .find(
        (balance) =>
          getXmlField(balance, 'BalanceType') === 'C_MAIN_ACCOUNT' &&
          getXmlField(balance, 'BalanceTypeName') === 'PPS_MainAccount',
      );
    const mainBalance = mainBalanceResult
      ? ({
          BalanceType: 'C_MAIN_ACCOUNT',
          BalanceTypeName: 'PPS_MainAccount',
          TotalAmount: getXmlField<number | string>(mainBalanceResult, 'TotalAmount'),
          InitialAmount: getXmlField<number | string>(
            getXmlField<Record<string, unknown>>(mainBalanceResult, 'BalanceDetail'),
            'InitialAmount',
          ),
          EffectiveTime: getXmlField<string | number>(
            getXmlField<Record<string, unknown>>(mainBalanceResult, 'BalanceDetail'),
            'EffectiveTime',
          ),
          ExpireTime: getXmlField<string | number>(
            getXmlField<Record<string, unknown>>(mainBalanceResult, 'BalanceDetail'),
            'ExpireTime',
          ),
          LastUpdateTime: getXmlField<string | number>(
            getXmlField<Record<string, unknown>>(mainBalanceResult, 'BalanceDetail'),
            'LastUpdateTime',
          ),
        } satisfies QueryCustomerInfoMainBalance)
      : undefined;
    const accountInfo = getXmlField<Record<string, unknown>>(account, 'AcctInfo');
    const paymentMode = Number(getXmlField(subscriber, 'PaymentMode'));
    const currentStatusIndex = Number(getXmlField(lifecycleDetail, 'CurrentStatusIndex'));

    this.log('verbose', 'queryCustomerInfo - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        FirstActive: getXmlField<string>(subscriberInfo, 'ActivationTime'),
        PaymentMode: {
          code: paymentMode,
          label:
            (
              { 0: 'prepaid', 1: 'postpaid', 2: 'hybrid' } as Record<
                number,
                'prepaid' | 'postpaid' | 'hybrid'
              >
            )[paymentMode] ?? 'unknown',
        },
        CurrentStatusIndex: {
          code: currentStatusIndex,
          label:
            (
              {
                1: 'Idle',
                2: 'Active',
                3: 'Call Barring',
                4: 'Suspend',
                6: 'Tested',
                7: 'In stock',
                8: 'Pre-deregistration',
              } as Record<number, CurrentStatusLabel>
            )[currentStatusIndex] ?? 'Unknown',
        },
        BirthdayDate: getXmlField<string>(individualInfo, 'Birthday'),
        MainBalance: mainBalance,
        'bcs:BillCycleType': getXmlField(accountInfo, 'BillCycleType'),
        'bcs:AcctType': getXmlField(accountInfo, 'AcctType'),
        'bcs:PaymentType': getXmlField(accountInfo, 'PaymentType'),
        'bcs:AcctClass': getXmlField(accountInfo, 'AcctClass'),
        'bcs:CurrencyID': getXmlField(accountInfo, 'CurrencyID'),
        'bcs:AcctPayMethod': getXmlField(accountInfo, 'AcctPayMethod'),
        'bcs:BillCycleOpenDate': getXmlField(accountInfo, 'BillCycleOpenDate'),
        'bcs:BillCycleEndDate': getXmlField(accountInfo, 'BillCycleEndDate'),
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
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>QueryBalance</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts?.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
            </RequestHeader>
            <QueryBalanceRequest>
              <ars:QueryObj>
                <ars:SubAccessCode>
                  <arc:SubscriberKey>${cbsMsisdn}</arc:SubscriberKey>
                </ars:SubAccessCode>
              </ars:QueryObj>
            </QueryBalanceRequest>
          </ars:QueryBalanceRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.AR_SERVICES), soapPayload, {
        headers: { 'Content-Type': 'text/xml' },
        httpsAgent: new https.Agent({ rejectUnauthorized: this.opts.rejectUnauthorized }),
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'queryBalance - request failed', {
        msisdn,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<QueryBalanceResponse>(
      response.data,
      this.parser,
    );

    if (resultCode !== '0') {
      this.log('warn', 'queryBalance - CBS error', {
        msisdn,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc);
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
