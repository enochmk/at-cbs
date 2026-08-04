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
  SubscribeAppendantProductOptions,
  SubscribeAppendantProductOutput,
  SubscribeAppendantProductResponse,
  UnsubscribeAppendantProductOptions,
  UnsubscribeAppendantProductOutput,
  UnsubscribeAppendantProductResponse,
  DeleteNumberOptions,
  DeleteNumberOutput,
  DeleteNumberResponse,
  DeleteNumberResult,
  DeleteNumberData,
  CreateSubscriberOptions,
  CreateSubscriberOutput,
  CreateSubscriberResponse,
  SubActivationOptions,
  SubActivationOutput,
  SubActivationResponse,
  PoolActivationOptions,
  PoolActivationOutput,
  ChangeSubscriberStatusOptions,
  ChangeSubscriberStatusOutput,
  ChangeSubscriberStatusResponse,
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsServiceBase } from './cbs-service-base';
import { getXmlField } from '../utils';
import { CbsRequestDefaults } from '../types';

export class BcServices extends CbsServiceBase {
  protected readonly servicePath = '/services/BcServices';

  private async createSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
    mode: 'prepaid' | 'hybrid' | 'postpaid',
  ): Promise<CreateSubscriberOutput> {
    const identity = this.normalizeMsisdn(msisdn);
    const customerKey = opts.customerKey ?? identity;
    const accountKey = opts.accountKey ?? identity;
    const subscriberKey = opts.subscriberKey ?? identity;
    const primaryIdentity = opts.primaryIdentity ?? identity;
    const secondaryIdentity = opts.secondaryIdentity ?? `123${identity}`;
    const messageSeq = opts.messageSeq ?? randomUUID();
    const postpaid = mode === 'postpaid';
    const accountInfo = postpaid
      ? `<bcc:PaymentType>1</bcc:PaymentType><bcc:CreditLimit><bcc:LimitType>C_INITIAL_CREDIT_LIMIT</bcc:LimitType><bcc:LimitValue>${opts.creditLimit ?? 10000000000}</bcc:LimitValue></bcc:CreditLimit>`
      : `<bcc:AcctCode>${accountKey}</bcc:AcctCode><bcc:BillCycleType>01</bcc:BillCycleType><bcc:AcctType>1</bcc:AcctType><bcc:PaymentType>0</bcc:PaymentType><bcc:AcctClass>1</bcc:AcctClass><bcc:CurrencyID>1054</bcc:CurrencyID><bcc:InitBalance>${opts.initialBalance ?? 100000000}</bcc:InitBalance><bcc:AcctPayMethod>1</bcc:AcctPayMethod>`;
    const customerInfo = `<bcs:CustInfo><bcc:CustType>1</bcc:CustType><bcc:CustNodeType>1</bcc:CustNodeType><bcc:CustClass>1</bcc:CustClass><bcc:CustCode>${customerKey}</bcc:CustCode></bcs:CustInfo>`;
    const subscriberInfo = postpaid
      ? `<bcc:SubIdentity><bcc:SubIdentityType>1</bcc:SubIdentityType><bcc:SubIdentity>${primaryIdentity}</bcc:SubIdentity><bcc:PrimaryFlag>1</bcc:PrimaryFlag></bcc:SubIdentity><bcc:SubClass>1</bcc:SubClass><bcc:Status>2</bcc:Status>`
      : `<bcc:SubBasicInfo/><bcc:SubIdentity><bcc:SubIdentityType>1</bcc:SubIdentityType><bcc:SubIdentity>${primaryIdentity}</bcc:SubIdentity><bcc:PrimaryFlag>1</bcc:PrimaryFlag></bcc:SubIdentity><bcc:SubIdentity><bcc:SubIdentityType>2</bcc:SubIdentityType><bcc:SubIdentity>${secondaryIdentity}</bcc:SubIdentity><bcc:PrimaryFlag>2</bcc:PrimaryFlag></bcc:SubIdentity><bcc:SubClass>2</bcc:SubClass><bcc:NetworkType>1</bcc:NetworkType><bcc:Status>1</bcc:Status>`;

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
        <soapenv:Header/><soapenv:Body><bcs:CreateSubscriberRequestMsg>
          ${this.requestHeader(opts, 'CreateSubscriber', messageSeq)}
          <CreateSubscriberRequest>
            <bcs:RegisterCustomer OpType="1"><bcs:CustKey>${customerKey}</bcs:CustKey>${customerInfo}</bcs:RegisterCustomer>
            <bcs:Account><bcs:AcctKey>${accountKey}</bcs:AcctKey><bcs:AcctInfo>${accountInfo}</bcs:AcctInfo></bcs:Account>
            <bcs:Subscriber><bcs:SubscriberKey>${subscriberKey}</bcs:SubscriberKey><bcs:SubscriberInfo>${subscriberInfo}</bcs:SubscriberInfo>
              <bcs:SubPaymentMode><bcs:PaymentMode>${postpaid ? 1 : 0}</bcs:PaymentMode><bcs:PayRelationKey>${postpaid ? accountKey : `PR_${subscriberKey}`}</bcs:PayRelationKey><bcs:AcctKey>${accountKey}</bcs:AcctKey></bcs:SubPaymentMode>
            </bcs:Subscriber>
            <bcs:PrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${opts.offeringId}</bcc:OfferingID></bcc:OfferingKey><bcc:BundledFlag>S</bcc:BundledFlag><bcc:OfferingClass>I</bcc:OfferingClass><bcc:Status>${postpaid ? 2 : 1}</bcc:Status></bcs:PrimaryOffering>
          </CreateSubscriberRequest>
        </bcs:CreateSubscriberRequestMsg></soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      `create${mode}Subscriber`,
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<CreateSubscriberResponse>(
      response,
      this.transport.parser,
    );
    if (resultCode !== '0')
      this.transport.throwCbsError(`create${mode}Subscriber`, msisdn, resultCode, resultDesc);
    return { metadata: resultMsg, data: { ResultCode: resultCode, ResultDesc: resultDesc } };
  }

  createPrepaidSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.createSubscriber(msisdn, opts, 'prepaid');
  }

  createHybridSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.createSubscriber(msisdn, opts, 'hybrid');
  }

  createPostpaidSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.createSubscriber(msisdn, opts, 'postpaid');
  }

  async unsubscribeAppendantProduct(
    msisdn: string,
    opts: UnsubscribeAppendantProductOptions,
  ): Promise<UnsubscribeAppendantProductOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    this.log('verbose', 'unsubscribeAppendantProduct - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:ChangeSubOfferingRequestMsg>
            ${this.requestHeader(opts, 'ChangeSubOffering', messageSeq)}
            <ChangeSubOfferingRequest>
              <bcs:SubAccessCode><bcc:PrimaryIdentity>${cbsMsisdn}</bcc:PrimaryIdentity></bcs:SubAccessCode>
              <bcs:SupplementaryOffering>
                <bcs:DelOffering>
                  <bcs:OfferingKey>
                    <bcc:OfferingID>${opts.offeringId}</bcc:OfferingID>
                    <bcc:PurchaseSeq>${opts.purchaseSeq}</bcc:PurchaseSeq>
                  </bcs:OfferingKey>
                </bcs:DelOffering>
              </bcs:SupplementaryOffering>
            </ChangeSubOfferingRequest>
          </bcs:ChangeSubOfferingRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'unsubscribeAppendantProduct',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } =
      this.transport.parse<UnsubscribeAppendantProductResponse>(response, this.transport.parser);
    if (resultCode !== '0') {
      this.transport.throwCbsError('unsubscribeAppendantProduct', msisdn, resultCode, resultDesc);
    }

    this.log('verbose', 'unsubscribeAppendantProduct - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        ResultCode: resultCode,
        ResultDesc: resultDesc,
      },
    };
  }

  async subscribeAppendantProduct(
    msisdn: string,
    opts: SubscribeAppendantProductOptions,
  ): Promise<SubscribeAppendantProductOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    this.log('verbose', 'subscribeAppendantProduct - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:ChangeSubOfferingRequestMsg>
            ${this.requestHeader(opts, 'ChangeSubOffering', messageSeq)}
            <ChangeSubOfferingRequest>
              <bcs:SubAccessCode><bcc:PrimaryIdentity>${cbsMsisdn}</bcc:PrimaryIdentity></bcs:SubAccessCode>
              <bcs:SupplementaryOffering>
                <bcs:AddOffering>
                  <bcc:OfferingKey><bcc:OfferingID>${opts.offeringId}</bcc:OfferingID></bcc:OfferingKey>
                  <bcc:BundledFlag>${opts.bundledFlag ?? 'S'}</bcc:BundledFlag>
                  <bcc:OfferingClass>${opts.offeringClass ?? 'I'}</bcc:OfferingClass>
                  <bcc:Status>${opts.status ?? 2}</bcc:Status>
                  <bcs:EffectiveTime><bcc:Mode>${opts.effectiveMode ?? 'I'}</bcc:Mode></bcs:EffectiveTime>
                </bcs:AddOffering>
              </bcs:SupplementaryOffering>
            </ChangeSubOfferingRequest>
          </bcs:ChangeSubOfferingRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'subscribeAppendantProduct',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } =
      this.transport.parse<SubscribeAppendantProductResponse>(response, this.transport.parser);
    if (resultCode !== '0') {
      this.transport.throwCbsError('subscribeAppendantProduct', msisdn, resultCode, resultDesc);
    }

    const result = getXmlField<Record<string, unknown>>(resultMsg, 'ChangeSubOfferingResult');
    const addOffering = getXmlField<Record<string, unknown>>(result, 'AddOffering');
    const offeringKey = getXmlField<Record<string, unknown>>(addOffering, 'OfferingKey');
    const rentDeduction = getXmlField<Record<string, unknown>>(result, 'RentDeductionResult');
    const balanceChanges = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
      rentDeduction,
      'AcctBalanceChangeList',
    );
    const freeUnitChanges = getXmlField<Record<string, unknown> | Record<string, unknown>[]>(
      rentDeduction,
      'FreeUnitChangeList',
    );

    this.log('verbose', 'subscribeAppendantProduct - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        ResultCode: resultCode,
        ResultDesc: resultDesc,
        OfferingID: getXmlField(offeringKey, 'OfferingID'),
        PurchaseSeq: getXmlField(offeringKey, 'PurchaseSeq'),
        EffectiveTime: getXmlField(addOffering, 'EffectiveTime'),
        ExpirationTime: getXmlField(addOffering, 'ExpirationTime'),
        RentDeductionStatus: getXmlField(addOffering, 'RentDeductionStatus'),
        BalanceChanges: balanceChanges,
        FreeUnitChanges: freeUnitChanges,
      },
    };
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
            ${this.requestHeader(opts, 'QueryCustomerInfo', messageSeq, { operatorId: CbsRequestDefaults.OPERATOR_ID, accessMode: CbsRequestDefaults.ACCESS_MODE, msgLanguageCode: CbsRequestDefaults.MSG_LANGUAGE_CODE, timeType: CbsRequestDefaults.TIME_TYPE })}
            <QueryCustomerInfoRequest>
              <bcs:QueryObj>
                <bcs:SubAccessCode>
                  <bcc:PrimaryIdentity>${cbsMsisdn}</bcc:PrimaryIdentity>
                </bcs:SubAccessCode>
              </bcs:QueryObj>
              <bcs:QueryMode>${opts?.queryMode ?? CbsRequestDefaults.QUERY_MODE}</bcs:QueryMode>
              <bcs:CustomerMask>${opts?.customerMask ?? CbsRequestDefaults.CUSTOMER_MASK}</bcs:CustomerMask>
              <bcs:AccountMask>${opts?.accountMask ?? CbsRequestDefaults.ACCOUNT_MASK}</bcs:AccountMask>
              <bcs:SubscriberMask>${opts?.subscriberMask ?? CbsRequestDefaults.SUBSCRIBER_MASK}</bcs:SubscriberMask>
              <bcs:GroupMask>${opts?.groupMask ?? CbsRequestDefaults.GROUP_MASK}</bcs:GroupMask>
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
    const primaryOffering = getXmlField<Record<string, unknown>>(subscriber, 'PrimaryOffering');
    const supplementaryOfferingsValue = getXmlField<
      Record<string, unknown> | Record<string, unknown>[]
    >(subscriber, 'SupplementaryOffering');
    const supplementaryOfferings = supplementaryOfferingsValue
      ? Array.isArray(supplementaryOfferingsValue)
        ? supplementaryOfferingsValue
        : [supplementaryOfferingsValue]
      : [];
    const mapOffering = (offering: Record<string, unknown>) => {
      const offeringKey = getXmlField<Record<string, unknown>>(offering, 'OfferingKey');
      return {
        ...offering,
        OfferingID: getXmlField<string | number>(offeringKey, 'OfferingID'),
        PurchaseSeq: getXmlField<string | number>(offeringKey, 'PurchaseSeq'),
        BundledFlag: getXmlField<string>(offering, 'BundledFlag'),
        OfferingClass: getXmlField<string>(offering, 'OfferingClass'),
        Status: getXmlField<number | string>(offering, 'Status'),
        EffectiveTime: getXmlField<string | number>(offering, 'EffectiveTime'),
        ExpirationTime: getXmlField<string | number>(offering, 'ExpirationTime'),
        ActivationMode: getXmlField<string>(offering, 'ActivationMode'),
        ActivationTime: getXmlField<string | number>(offering, 'ActivationTime'),
      };
    };
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
        PrimaryOffering: primaryOffering ? mapOffering(primaryOffering) : undefined,
        SupplementaryOfferings: supplementaryOfferings.map(mapOffering),
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
            ${this.requestHeader(opts, 'QuerySubLifeCycle', messageSeq)}
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
            ${this.requestHeader(opts, 'SubDeactivation', messageSeq)}
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

  async deleteNumber(msisdn: string, opts?: DeleteNumberOptions): Promise<DeleteNumberOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? randomUUID();
    const subscriberAccessCode = this.getSubscriberAccessCode(cbsMsisdn, opts?.subscriberKey);

    this.log('verbose', 'deleteNumber - sending request', { msisdn, opts });
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:SubDeactivationRequestMsg>
            ${this.requestHeader(opts, 'SubDeactivation', messageSeq)}
            <SubDeactivationRequest>
              <bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode>
              <bcs:OpType>3</bcs:OpType>
            </SubDeactivationRequest>
          </bcs:SubDeactivationRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'deleteNumber',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<DeleteNumberResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('deleteNumber', msisdn, resultCode, resultDesc);
    }

    const result = getXmlField<DeleteNumberResult>(resultMsg, 'SubDeactivationResult');
    const acctBalance = getXmlField<Record<string, unknown>>(result, 'AcctBalance');
    const amountList = getXmlField<DeleteNumberData['AmountList']>(acctBalance, 'AmountList');

    this.log('verbose', 'deleteNumber - success', { msisdn, messageSeq });
    return {
      metadata: resultMsg,
      data: {
        ResultCode: resultCode,
        ResultDesc: resultDesc,
        AmountList: amountList ? (Array.isArray(amountList) ? amountList : [amountList]) : [],
      },
    };
  }

  async subActivate(msisdn: string, opts?: SubActivationOptions): Promise<SubActivationOutput> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts?.messageSeq ?? randomUUID();
    const subscriberAccessCode = this.getSubscriberAccessCode(cbsMsisdn, opts?.subscriberKey);
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/><soapenv:Body><bcs:SubActivationRequestMsg>
          ${this.requestHeader(opts, 'SubActivation', messageSeq)}
          <SubActivationRequest><bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode></SubActivationRequest>
        </bcs:SubActivationRequestMsg></soapenv:Body>
      </soapenv:Envelope>`;
    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'subActivate',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<SubActivationResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0')
      this.transport.throwCbsError('subActivate', msisdn, resultCode, resultDesc);
    return { metadata: resultMsg, data: { ResultCode: resultCode, ResultDesc: resultDesc } };
  }

  async poolActivation(msisdn: string, opts: PoolActivationOptions): Promise<PoolActivationOutput> {
    const query = await this.queryCustomerInfo(msisdn);
    if (String(query.data['bcs:PaymentType']) !== '0') {
      throw createHttpError(400, 'Pool activation requires a prepaid subscriber');
    }
    if (String(query.data.CurrentStatusIndex?.code) !== '8') {
      throw createHttpError(400, 'Pool activation requires subscriber lifecycle status 8');
    }
    const deletion = await this.deleteNumber(msisdn, opts);
    const creation = await this.createPrepaidSubscriber(msisdn, opts);
    const activation = await this.subActivate(msisdn, opts);
    return { query, deletion, creation, activation };
  }

  async changeSubscriberStatus(
    msisdn: string,
    opts: ChangeSubscriberStatusOptions,
  ): Promise<ChangeSubscriberStatusOutput> {
    const statusMap = {
      ACTIVE: { opType: 10, status: 2 },
      CALL_BARRING: { opType: 11, status: 3 },
      SUSPEND: { opType: 12, status: 4 },
    } as const;
    const selected = statusMap[opts.status];
    if (!selected) throw createHttpError(400, 'Unsupported subscriber status');

    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    const subscriberAccessCode = this.getSubscriberAccessCode(cbsMsisdn, opts.subscriberKey);
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/><soapenv:Body><bcs:ChangeSubStatusRequestMsg>
          ${this.requestHeader(opts, 'ChangeSubStatus', messageSeq)}
          <ChangeSubStatusRequest><bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode><bcs:OpType>${selected.opType}</bcs:OpType><bcs:Status>${selected.status}</bcs:Status></ChangeSubStatusRequest>
        </bcs:ChangeSubStatusRequestMsg></soapenv:Body>
      </soapenv:Envelope>`;
    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'changeSubscriberStatus',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } =
      this.transport.parse<ChangeSubscriberStatusResponse>(response, this.transport.stringParser);
    if (resultCode !== '0')
      this.transport.throwCbsError('changeSubscriberStatus', msisdn, resultCode, resultDesc);
    return {
      metadata: resultMsg,
      data: { ResultCode: resultCode, ResultDesc: resultDesc, Status: selected.status },
    };
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
            ${this.requestHeader(opts, 'QueryLastXTransaction', messageSeq)}
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
            ${this.requestHeader(opts, 'CustActivation', messageSeq)}
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
            ${this.requestHeader(opts, 'CustDeactivation', messageSeq)}
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
