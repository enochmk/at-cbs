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
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsServiceBase } from './cbs-service-base';
import { getXmlField } from '../utils';

export class BcServices extends CbsServiceBase {
  protected readonly servicePath = '/services/BcServices';

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

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryCustomerInfo',
      msisdn,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryCustomerInfoResponse>(
      response,
      this.transport.parser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('queryCustomerInfo', msisdn, resultCode, resultDesc);
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

  async querySubLifeCycle(
    msisdn: string,
    opts?: QuerySubLifeCycleOptions,
  ): Promise<QuerySubLifeCycleOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? new Date().toISOString();
    this.log('verbose', 'querySubLifeCycle - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:QuerySubLifeCycleRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>QuerySubLifeCycle</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts?.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
            </RequestHeader>
            <QuerySubLifeCycleRequest>
              <bcs:SubAccessCode>
                <bcc:PrimaryIdentity>${cbsMsisdn}</bcc:PrimaryIdentity>
              </bcs:SubAccessCode>
            </QuerySubLifeCycleRequest>
          </bcs:QuerySubLifeCycleRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'querySubLifeCycle',
      msisdn,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QuerySubLifeCycleResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('querySubLifeCycle', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QuerySubLifeCycleResult>(
      resultMsg as Record<string, unknown>,
      'QuerySubLifeCycleResult',
    );
    const currentStatusIndex = Number(getXmlField(queryResult, 'CurrentStatusIndex'));

    this.log('verbose', 'querySubLifeCycle - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
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
        LifeCycleStatus: getXmlField<QuerySubLifeCycleResult['LifeCycleStatus']>(
          queryResult,
          'LifeCycleStatus',
        ),
        RBlacklistStatus: getXmlField(queryResult, 'RBlacklistStatus'),
        FraudTimes: getXmlField(queryResult, 'FraudTimes'),
        StatusDetail: getXmlField(queryResult, 'StatusDetail'),
      },
    };
  }

  async subDeactivation(
    msisdn: string,
    opts: SubDeactivationOptions,
  ): Promise<SubDeactivationOutput> {
    if (!opts?.opType) {
      throw createHttpError(400, 'opType is required for SubDeactivation');
    }

    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    const effectiveTime = opts.effectiveTime
      ? `<bcs:EffectiveTime>${opts.effectiveTime}</bcs:EffectiveTime>`
      : '';
    const subscriberAccessCode = this.getSubscriberAccessCode(cbsMsisdn, opts.subscriberKey);

    this.log('verbose', 'subDeactivation - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:SubDeactivationRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>SubDeactivation</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
              ${opts.operatorId ? `<cbs:OperatorInfo><cbs:OperatorID>${opts.operatorId}</cbs:OperatorID></cbs:OperatorInfo>` : ''}
              ${opts.accessMode !== undefined ? `<cbs:AccessMode>${opts.accessMode}</cbs:AccessMode>` : ''}
              ${opts.msgLanguageCode !== undefined ? `<cbs:MsgLanguageCode>${opts.msgLanguageCode}</cbs:MsgLanguageCode>` : ''}
              ${opts.timeType !== undefined ? `<cbs:TimeFormat><cbs:TimeType>${opts.timeType}</cbs:TimeType></cbs:TimeFormat>` : ''}
            </RequestHeader>
            <SubDeactivationRequest>
              <bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode>
              <bcs:OpType>${opts.opType}</bcs:OpType>
              ${effectiveTime}
            </SubDeactivationRequest>
          </bcs:SubDeactivationRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'subDeactivation',
      msisdn,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<SubDeactivationResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('subDeactivation', msisdn, resultCode, resultDesc);
    }

    this.log('verbose', 'subDeactivation - success', { msisdn, messageSeq });
    return { metadata: resultMsg };
  }

  async queryXTransaction(
    msisdn: string,
    opts?: QueryXTransactionOptions,
  ): Promise<QueryXTransactionOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? randomUUID();
    const subscriberAccessCode = this.getSubscriberAccessCode(cbsMsisdn, opts?.subscriberKey);

    this.log('verbose', 'queryXTransaction - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:QueryLastXTransactionRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>QueryLastXTransaction</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts?.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
            </RequestHeader>
            <QueryLastXTransactionRequest>
              <bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode>
            </QueryLastXTransactionRequest>
          </bcs:QueryLastXTransactionRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryXTransaction',
      msisdn,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryXTransactionResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('queryXTransaction', msisdn, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryXTransactionResult>(
      resultMsg as Record<string, unknown>,
      'QueryLastXTransactionResult',
    );

    this.log('verbose', 'queryXTransaction - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: queryResult ?? {},
    };
  }

  async custActivation(opts: CustActivationOptions): Promise<CustActivationOutput> {
    if (!opts) {
      throw createHttpError(400, 'Customer access code is required for CustActivation');
    }

    const messageSeq = opts?.messageSeq ?? randomUUID();
    const customerAccessCode = this.getCustomerAccessCode(opts);

    this.log('verbose', 'custActivation - sending request', { opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:CustActivationRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>CustActivation</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
              ${opts.operatorId ? `<cbs:OperatorInfo><cbs:OperatorID>${opts.operatorId}</cbs:OperatorID></cbs:OperatorInfo>` : ''}
              ${opts.accessMode !== undefined ? `<cbs:AccessMode>${opts.accessMode}</cbs:AccessMode>` : ''}
              ${opts.msgLanguageCode !== undefined ? `<cbs:MsgLanguageCode>${opts.msgLanguageCode}</cbs:MsgLanguageCode>` : ''}
              ${opts.timeType !== undefined ? `<cbs:TimeFormat><cbs:TimeType>${opts.timeType}</cbs:TimeType></cbs:TimeFormat>` : ''}
            </RequestHeader>
            <CustActivationRequest>
              <bcs:CustAccessCode>${customerAccessCode}</bcs:CustAccessCode>
            </CustActivationRequest>
          </bcs:CustActivationRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(this.servicePath, soapPayload, 'custActivation', '');

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<CustActivationResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('custActivation', '', resultCode, resultDesc);
    }

    this.log('verbose', 'custActivation - success', { messageSeq });
    return { metadata: resultMsg };
  }

  async custDeactivation(opts: CustDeactivationOptions): Promise<CustDeactivationOutput> {
    if (!opts?.opType) {
      throw createHttpError(400, 'opType is required for CustDeactivation');
    }

    const messageSeq = opts.messageSeq ?? randomUUID();
    const effectiveTime = opts.effectiveTime
      ? `<bcs:EffectiveTime>${opts.effectiveTime}</bcs:EffectiveTime>`
      : '';
    const customerAccessCode = this.getCustomerAccessCode(opts);

    this.log('verbose', 'custDeactivation - sending request', { opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:CustDeactivationRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>CustDeactivation</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
              ${opts.operatorId ? `<cbs:OperatorInfo><cbs:OperatorID>${opts.operatorId}</cbs:OperatorID></cbs:OperatorInfo>` : ''}
              ${opts.accessMode !== undefined ? `<cbs:AccessMode>${opts.accessMode}</cbs:AccessMode>` : ''}
              ${opts.msgLanguageCode !== undefined ? `<cbs:MsgLanguageCode>${opts.msgLanguageCode}</cbs:MsgLanguageCode>` : ''}
              ${opts.timeType !== undefined ? `<cbs:TimeFormat><cbs:TimeType>${opts.timeType}</cbs:TimeType></cbs:TimeFormat>` : ''}
            </RequestHeader>
            <CustDeactivationRequest>
              <bcs:CustAccessCode>${customerAccessCode}</bcs:CustAccessCode>
              <bcs:OpType>${opts.opType}</bcs:OpType>
              ${effectiveTime}
            </CustDeactivationRequest>
          </bcs:CustDeactivationRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'custDeactivation',
      '',
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<CustDeactivationResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('custDeactivation', '', resultCode, resultDesc);
    }

    this.log('verbose', 'custDeactivation - success', { messageSeq });
    return { metadata: resultMsg };
  }
}
