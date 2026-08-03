import axios, { type AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import createHttpError from 'http-errors';
import https from 'node:https';

import type {
  CbsClientOptions,
  CreateSubscriberOptions,
  DeleteSubscriberOptions,
  DeleteSubscriberResponse,
  NewSubscriberResponse,
  QueryBasicInfoOptions,
  QueryBasicInfoResponse,
  SubscribeAppendantProductOptions,
  SubscribeAppendantProductResponse,
  UnSubscribeAppendantProductOptions,
  UnSubscribeAppendantProductResponse,
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
  private successCode: string;

  private static BUSINESS_MGR = '/services/CBSInterfaceBusinessMgrService';
  private static BC_SERVICES = '/services/BcServices';
  private static AR_SERVICES = '/services/ArServices';

  constructor(options: CbsClientOptions) {
    this.opts = {
      timeout: 15000,
      successCode: '405000000',
      rejectUnauthorized: true,
      logger: {},
      ...options,
    };
    this.successCode = this.opts.successCode;
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

  async createSubscriber(
    msisdn: string,
    opts?: CreateSubscriberOptions,
  ): Promise<NewSubscriberResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const remark = opts?.remark ?? `npm-${cbsMsisdn}`;
    this.log('verbose', 'createSubscriber - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:NewSubscriberRequestMsg>
            <RequestHeader>
                <com:CommandId>NewSubscriber</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
                <com:Remark>${remark}</com:Remark>
            </RequestHeader>
            <NewSubscriberRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:Subscriber>
                  <bus1:Lang>${opts?.lang ?? 1}</bus1:Lang>
                  <bus1:PaidMode>${opts?.paidMode ?? '0'}</bus1:PaidMode>
                  <bus1:MainProductID>${opts?.mainProductId ?? '2018254719'}</bus1:MainProductID>
                </bus1:Subscriber>
            </NewSubscriberRequest>
            </bus:NewSubscriberRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'NewSubscriber' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'createSubscriber - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<NewSubscriberResponse>(
      response.data,
      this.parser,
    );

    if (resultCode !== this.successCode) {
      this.log('warn', 'createSubscriber - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'createSubscriber - success', { msisdn, requestId });
    return resultMsg;
  }

  async deleteSubscriber(
    msisdn: string,
    opts?: DeleteSubscriberOptions,
  ): Promise<DeleteSubscriberResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const remark = opts?.remark ?? `npm-${cbsMsisdn}`;
    this.log('verbose', 'deleteSubscriber - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:DeleteSubscriberRequestMsg>
            <RequestHeader>
                <com:CommandId>DeleteSubscriber</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
                <com:Remark>${remark}</com:Remark>
            </RequestHeader>
            <DeleteSubscriberRequest>
                <bus1:SubscriberNo>
                  <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                </bus1:SubscriberNo>
            </DeleteSubscriberRequest>
            </bus:DeleteSubscriberRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'DeleteSubscriber' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'deleteSubscriber - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<DeleteSubscriberResponse>(
      response.data,
      this.parser,
    );

    if (resultCode !== this.successCode) {
      this.log('warn', 'deleteSubscriber - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'deleteSubscriber - success', { msisdn, requestId });
    return resultMsg;
  }

  async queryBasicInfo(
    msisdn: string,
    opts?: QueryBasicInfoOptions,
  ): Promise<QueryBasicInfoResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    this.log('verbose', 'queryBasicInfo - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:QueryBasicInfoRequestMsg>
            <RequestHeader>
                <com:CommandId>QueryBasicInfo</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
            </RequestHeader>
            <QueryBasicInfoRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:QueryType>1</bus1:QueryType>
            </QueryBasicInfoRequest>
          </bus:QueryBasicInfoRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'QueryBasicInfo' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'queryBasicInfo - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<QueryBasicInfoResponse>(
      response.data,
      this.parser,
    );

    if (resultCode !== this.successCode) {
      this.log('warn', 'queryBasicInfo - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('verbose', 'queryBasicInfo - success', { msisdn, requestId });
    return resultMsg;
  }

  async subscribeAppendantProduct(
    msisdn: string,
    productId: string,
    opts?: SubscribeAppendantProductOptions,
  ): Promise<SubscribeAppendantProductResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const validMode = opts?.validMode ?? '4050000';
    this.log('verbose', 'subscribeAppendantProduct - sending request', { msisdn, productId, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:SubscribeAppendantProductRequestMsg>
            <RequestHeader>
                <com:CommandId>SubscribeAppendantProduct</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
            </RequestHeader>
            <SubscribeAppendantProductRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:Product>
                  <bus1:Id>${productId}</bus1:Id>
                  <bus1:ValidMode>${validMode}</bus1:ValidMode>
                </bus1:Product>
            </SubscribeAppendantProductRequest>
            </bus:SubscribeAppendantProductRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'SubscribeAppendantProduct' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'subscribeAppendantProduct - request failed', {
        msisdn,
        productId,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } =
      parseSoapResponse<SubscribeAppendantProductResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'subscribeAppendantProduct - CBS error', {
        msisdn,
        productId,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'subscribeAppendantProduct - success', { msisdn, productId, requestId });
    return resultMsg;
  }

  async unSubscribeAppendantProduct(
    msisdn: string,
    productId: string,
    opts?: UnSubscribeAppendantProductOptions,
  ): Promise<UnSubscribeAppendantProductResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const validMode = opts?.validMode ?? '4050000';
    this.log('verbose', 'unSubscribeAppendantProduct - sending request', {
      msisdn,
      productId,
      opts,
    });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:UnSubscribeAppendantProductRequestMsg>
            <RequestHeader>
                <com:CommandId>UnSubscribeAppendantProduct</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
            </RequestHeader>
            <UnSubscribeAppendantProductRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:Product>
                  <bus1:ProductID>${productId}</bus1:ProductID>
                  <bus1:ValidMode>${validMode}</bus1:ValidMode>
                </bus1:Product>
            </UnSubscribeAppendantProductRequest>
            </bus:UnSubscribeAppendantProductRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'UnSubscribeAppendantProduct' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'unSubscribeAppendantProduct - request failed', {
        msisdn,
        productId,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } =
      parseSoapResponse<UnSubscribeAppendantProductResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'unSubscribeAppendantProduct - CBS error', {
        msisdn,
        productId,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'unSubscribeAppendantProduct - success', { msisdn, productId, requestId });
    return resultMsg;
  }
}
