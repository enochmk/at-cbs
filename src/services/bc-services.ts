import type {
  CbsClientOptions,
  QueryCustomerInfoOptions,
  QueryCustomerInfoKey,
  CbsMutationOutput,
  CbsOperationResponse,
  CreateCustomerOptions,
  ChangeCustomerInfoOptions,
  CreateAccountOptions,
  CreateSubscriberRequestOptions,
  ChangeSubscriberOfferingOptions,
  ChangeSubscriberPaymentModeOptions,
  ChangeAccountCreditLimitOptions,
  ChangePaymentRelationOptions,
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
import { addAmountInGhc, getXmlField, normalizeBalanceAmount } from '../utils';
import { CbsRequestDefaults } from '../types';

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number | undefined): string {
  return value === undefined ? '' : `<${name}>${xmlEscape(value)}</${name}>`;
}

function keyXml(prefix: 'Cust' | 'Acct' | 'Sub', key: QueryCustomerInfoKey): string {
  const entries = Object.entries(key).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length !== 1)
    throw createHttpError(400, `Provide exactly one ${prefix.toLowerCase()} key`);
  const [name, value] = entries[0];
  const suffix =
    name === 'primaryIdentity' ? 'PrimaryIdentity' : name[0].toUpperCase() + name.slice(1);
  const allowed =
    prefix === 'Cust'
      ? ['customerKey', 'customerCode', 'primaryIdentity']
      : prefix === 'Acct'
        ? ['accountKey', 'accountCode', 'primaryIdentity']
        : ['subscriberKey', 'primaryIdentity'];
  if (!allowed.includes(name))
    throw createHttpError(400, `Unsupported ${prefix.toLowerCase()} key`);
  const container =
    prefix === 'Cust' ? 'CustAccessCode' : prefix === 'Acct' ? 'AcctAccessCode' : 'SubAccessCode';
  return `<bcs:${container}><bcc:${suffix}>${xmlEscape(String(value))}</bcc:${suffix}></bcs:${container}>`;
}

export class BcServices extends CbsServiceBase {
  protected readonly servicePath = '/services/BcServices';

  private async createSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
    mode: 'prepaid' | 'hybrid' | 'postpaid',
  ): Promise<CreateSubscriberOutput> {
    const identity = this.normalizeMsisdn(msisdn);
    const creationId = `${identity}_${new Date().toISOString().replace(/\D/g, '')}`;
    const customerKey = creationId;
    const accountKey = creationId;
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

  async createCustomer(opts: CreateCustomerOptions): Promise<CbsMutationOutput> {
    const individual = opts.individual
      ? `<bcs:IndividualInfo>${tag('bcc:IDType', opts.individual.idType)}${tag('bcc:IDNumber', opts.individual.idNumber ?? '')}${tag('bcc:Title', opts.individual.title)}${tag('bcc:FirstName', opts.individual.firstName)}${tag('bcc:LastName', opts.individual.lastName)}${tag('bcc:Gender', opts.individual.gender)}${tag('bcc:Nationality', opts.individual.nationality)}${tag('bcc:Birthday', opts.individual.birthday)}${tag('bcc:MobilePhone', opts.individual.mobilePhone)}${tag('bcc:Email', opts.individual.email)}</bcs:IndividualInfo>`
      : '';
    const organization = opts.organization
      ? `<bcs:OrgInfo>${tag('bcc:IDType', opts.organization.idType)}${tag('bcc:IDNumber', opts.organization.idNumber)}${tag('bcc:OrgType', opts.organization.organizationType)}${tag('bcc:OrgName', opts.organization.name)}${tag('bcc:Industry', opts.organization.industry)}${tag('bcc:OrgPhoneNumber', opts.organization.phoneNumber)}${tag('bcc:OrgEmail', opts.organization.email)}</bcs:OrgInfo>`
      : '';
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:CreateCustomerRequestMsg>${this.requestHeader(opts, 'CreateCustomer', opts.messageSeq ?? randomUUID())}<CreateCustomerRequest><bcs:RegisterCustKey>${xmlEscape(opts.registerCustKey)}</bcs:RegisterCustKey><bcs:Customer><bcs:CustKey>${xmlEscape(opts.customerKey)}</bcs:CustKey><bcs:CustInfo>${tag('bcc:CustType', opts.customerType)}${tag('bcc:CustNodeType', opts.customerNodeType)}${tag('bcc:CustClass', opts.customerClass)}${tag('bcc:CustCode', opts.customerCode)}${opts.customerSegment === undefined ? '' : `<bcc:CustBasicInfo>${tag('bcc:CustSegment', opts.customerSegment)}</bcc:CustBasicInfo>`}</bcs:CustInfo>${individual}${organization}</bcs:Customer></CreateCustomerRequest></bcs:CreateCustomerRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation('createCustomer', payload, opts.customerKey);
  }

  async changeCustomerInfo(opts: ChangeCustomerInfoOptions): Promise<CbsMutationOutput> {
    const key = opts.customerKey
      ? { customerKey: opts.customerKey }
      : opts.customerCode
        ? { customerCode: opts.customerCode }
        : { primaryIdentity: opts.primaryIdentity ?? '' };
    const individual = opts.individual
      ? `<bcs:Individual>${tag('bcc:IDType', opts.individual.idType)}${tag('bcc:IDNumber', opts.individual.idNumber ?? '')}${tag('bcc:Title', opts.individual.title)}${tag('bcc:FirstName', opts.individual.firstName)}${tag('bcc:LastName', opts.individual.lastName)}${tag('bcc:Gender', opts.individual.gender)}${tag('bcc:Nationality', opts.individual.nationality)}${tag('bcc:Birthday', opts.individual.birthday)}${tag('bcc:MobilePhone', opts.individual.mobilePhone)}${tag('bcc:Email', opts.individual.email)}</bcs:Individual>`
      : '';
    const organization = opts.organization
      ? `<bcs:Organization>${tag('bcc:IDType', opts.organization.idType)}${tag('bcc:IDNumber', opts.organization.idNumber ?? '')}${tag('bcc:OrgType', opts.organization.organizationType)}${tag('bcc:OrgName', opts.organization.name)}${tag('bcc:Industry', opts.organization.industry)}${tag('bcc:OrgPhoneNumber', opts.organization.phoneNumber)}${tag('bcc:OrgEmail', opts.organization.email)}</bcs:Organization>`
      : '';
    const basic =
      opts.customerSegment === undefined
        ? ''
        : `<bcs:CustBasicInfo>${tag('bcc:CustSegment', opts.customerSegment)}</bcs:CustBasicInfo>`;
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeCustInfoRequestMsg>${this.requestHeader(opts, 'ChangeCustInfo', opts.messageSeq ?? randomUUID())}<ChangeCustInfoRequest>${keyXml('Cust', key)}<bcs:CustInfo>${basic}${individual}${organization}</bcs:CustInfo>${tag('bcs:NewCustomerKey', opts.newCustomerKey)}</ChangeCustInfoRequest></bcs:ChangeCustInfoRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation(
      'changeCustomerInfo',
      payload,
      opts.customerKey ?? opts.customerCode ?? opts.primaryIdentity ?? '',
    );
  }

  async createAccount(opts: CreateAccountOptions): Promise<CbsMutationOutput> {
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:CreateAccountRequestMsg>${this.requestHeader(opts, 'CreateAccount', opts.messageSeq ?? randomUUID())}<CreateAccountRequest><bcs:RegisterCustKey>${xmlEscape(opts.registerCustKey)}</bcs:RegisterCustKey><bcs:Account><bcs:AcctKey>${xmlEscape(opts.accountKey)}</bcs:AcctKey><bcs:AcctInfo>${tag('bcc:AcctCode', opts.accountCode)}${tag('bcc:UserCustomerKey', opts.userCustomerKey)}${tag('bcc:ParentAcctKey', opts.parentAccountKey)}<bcc:AcctBasicInfo>${tag('bcc:AcctName', opts.accountName)}</bcc:AcctBasicInfo>${tag('bcc:BillCycleType', opts.billCycleType)}${tag('bcc:AcctType', opts.accountType)}${tag('bcc:PaymentType', opts.paymentType)}${tag('bcc:AcctClass', opts.accountClass)}${tag('bcc:CurrencyID', opts.currencyId)}${tag('bcc:InitBalance', opts.initialBalance)}${opts.creditLimit === undefined ? '' : `<bcc:CreditLimit>${tag('bcc:LimitType', opts.creditLimitType ?? 'C_INITIAL_CREDIT_LIMIT')}${tag('bcc:LimitValue', opts.creditLimit)}</bcc:CreditLimit>`}${tag('bcc:AcctPayMethod', opts.accountPaymentMethod)}</bcs:AcctInfo></bcs:Account></CreateAccountRequest></bcs:CreateAccountRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation('createAccount', payload, opts.accountKey);
  }

  async createSubscriberForAccount(
    opts: CreateSubscriberRequestOptions,
  ): Promise<CbsMutationOutput> {
    if (opts.paymentMode !== 0 && opts.creditLimit === undefined) {
      throw createHttpError(400, 'creditLimit is required for postpaid and hybrid subscribers');
    }
    const customer = opts.customerKey
      ? `<bcs:RegisterCustomer OpType="1"><bcs:CustKey>${xmlEscape(opts.customerKey)}</bcs:CustKey></bcs:RegisterCustomer><bcs:UserCustomer><bcs:CustKey>${xmlEscape(opts.customerKey)}</bcs:CustKey></bcs:UserCustomer>`
      : '';
    const account = '';
    const secondary = opts.secondaryIdentity
      ? `<bcc:SubIdentity><bcc:SubIdentityType>2</bcc:SubIdentityType><bcc:SubIdentity>${xmlEscape(opts.secondaryIdentity)}</bcc:SubIdentity><bcc:PrimaryFlag>2</bcc:PrimaryFlag></bcc:SubIdentity>`
      : '';
    const payment = opts.accountKey
      ? `<bcs:AcctList><bcs:AcctKey>${xmlEscape(opts.accountKey)}</bcs:AcctKey><bcs:DEFAcctFlag>Y</bcs:DEFAcctFlag></bcs:AcctList><bcs:PayRelation><bcs:PayRelationKey>${xmlEscape(opts.accountKey)}</bcs:PayRelationKey><bcs:AcctKey>${xmlEscape(opts.accountKey)}</bcs:AcctKey><bcs:Priority>1</bcs:Priority></bcs:PayRelation>`
      : '';
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:CreateSubscriberRequestMsg>${this.requestHeader(opts, 'CreateSubscriber', opts.messageSeq ?? randomUUID())}<CreateSubscriberRequest>${customer}${account}<bcs:Subscriber><bcs:SubscriberKey>${xmlEscape(opts.subscriberKey)}</bcs:SubscriberKey><bcs:SubscriberInfo>${tag('bcc:SubClass', opts.subscriberClass)}<bcc:SubIdentity><bcc:SubIdentityType>1</bcc:SubIdentityType><bcc:SubIdentity>${xmlEscape(opts.primaryIdentity)}</bcc:SubIdentity><bcc:PrimaryFlag>1</bcc:PrimaryFlag></bcc:SubIdentity>${secondary}${tag('bcc:Status', opts.status)}</bcs:SubscriberInfo><bcs:SubPaymentMode><bcs:PaymentMode>${opts.paymentMode}</bcs:PaymentMode>${payment}</bcs:SubPaymentMode></bcs:Subscriber><bcs:PrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${xmlEscape(opts.offeringId)}</bcc:OfferingID></bcc:OfferingKey>${tag('bcc:OfferingClass', opts.offeringClass)}</bcs:PrimaryOffering></CreateSubscriberRequest></bcs:CreateSubscriberRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation('createSubscriberForAccount', payload, opts.primaryIdentity);
  }

  async changeSubscriberOffering(
    opts: ChangeSubscriberOfferingOptions,
  ): Promise<CbsMutationOutput> {
    const key = opts.subscriberKey
      ? { subscriberKey: opts.subscriberKey }
      : { primaryIdentity: opts.primaryIdentity ?? '' };
    const oldOffering =
      opts.oldOfferingId === undefined
        ? ''
        : `<bcs:OldPrimaryOffering><bcc:OfferingID>${xmlEscape(opts.oldOfferingId)}</bcc:OfferingID></bcs:OldPrimaryOffering>`;
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeSubOfferingRequestMsg>${this.requestHeader(opts, 'ChangeSubOffering', opts.messageSeq ?? randomUUID())}<ChangeSubOfferingRequest>${keyXml('Sub', key)}<bcs:PrimaryOffering>${oldOffering}<bcs:NewPrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${xmlEscape(opts.newOfferingId)}</bcc:OfferingID></bcc:OfferingKey>${tag('bcc:OfferingClass', opts.offeringClass)}</bcs:NewPrimaryOffering>${tag('bcs:EffectiveTime', opts.effectiveTime)}</bcs:PrimaryOffering></ChangeSubOfferingRequest></bcs:ChangeSubOfferingRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation(
      'changeSubscriberOffering',
      payload,
      opts.primaryIdentity ?? opts.subscriberKey ?? '',
    );
  }

  async changeSubscriberPaymentMode(
    opts: ChangeSubscriberPaymentModeOptions,
  ): Promise<CbsMutationOutput> {
    const key = opts.subscriberKey
      ? { subscriberKey: opts.subscriberKey }
      : { primaryIdentity: opts.primaryIdentity ?? '' };
    const oldOffering =
      opts.oldOfferingId === undefined
        ? ''
        : `<bcs:OldPrimaryOffering><bcc:OfferingID>${xmlEscape(opts.oldOfferingId)}</bcc:OfferingID></bcs:OldPrimaryOffering>`;
    const newOffering =
      opts.newOfferingId === undefined
        ? ''
        : `<bcs:NewPrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${xmlEscape(opts.newOfferingId)}</bcc:OfferingID></bcc:OfferingKey></bcs:NewPrimaryOffering>`;
    const account =
      opts.accountKey || opts.initialBalance !== undefined || opts.creditLimit !== undefined
        ? `<bcs:Account><bcs:AccountInfo>${tag('bcc:UserCustomerKey', opts.accountKey)}${tag('bcc:InitBalance', opts.initialBalance)}${opts.creditLimit === undefined ? '' : `<bcc:CreditLimit><bcc:LimitType>C_INITIAL_CREDIT_LIMIT</bcc:LimitType><bcc:LimitValue>${xmlEscape(opts.creditLimit)}</bcc:LimitValue></bcc:CreditLimit>`}</bcs:AccountInfo></bcs:Account>`
        : '';
    const paymentRelation = opts.paymentRelationKey
      ? `<bcs:AddPayRelation><bcs:PayRelationKey>${xmlEscape(opts.paymentRelationKey)}</bcs:PayRelationKey></bcs:AddPayRelation>`
      : '';
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeSubPaymentModeRequestMsg>${this.requestHeader(opts, 'ChangeSubPaymentMode', opts.messageSeq ?? randomUUID())}<ChangeSubPaymentModeRequest>${keyXml('Sub', key)}<bcs:OpType>1</bcs:OpType><bcs:PaymentModeChange><bcs:PrimaryOffering>${oldOffering}${newOffering}</bcs:PrimaryOffering><bcs:SubDFTAccount>${tag('bcs:AcctKey', opts.accountKey)}</bcs:SubDFTAccount><bcs:DFTPayRelation>${paymentRelation}</bcs:DFTPayRelation>${account}${tag('bcs:EffectiveTime', opts.effectiveTime)}</bcs:PaymentModeChange></ChangeSubPaymentModeRequest></bcs:ChangeSubPaymentModeRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation(
      'changeSubscriberPaymentMode',
      payload,
      opts.primaryIdentity ?? opts.subscriberKey ?? '',
    );
  }

  async changeAccountCreditLimit(
    opts: ChangeAccountCreditLimitOptions,
  ): Promise<CbsMutationOutput> {
    const key = opts.accountKey
      ? { accountKey: opts.accountKey }
      : opts.accountCode
        ? { accountCode: opts.accountCode }
        : { primaryIdentity: opts.primaryIdentity ?? '' };
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeAcctCreditLimitRequestMsg>${this.requestHeader(opts, 'ChangeAcctCreditLimit', opts.messageSeq ?? randomUUID())}<ChangeAcctCreditLimitRequest>${keyXml('Acct', key)}<bcs:AccountCredit><bcs:CreditLimitType>${xmlEscape(opts.creditLimitType ?? 'C_INITIAL_CREDIT_LIMIT')}</bcs:CreditLimitType><bcs:CommonCreditLimit><bcs:NewLimitAmount>${xmlEscape(opts.newLimitAmount)}</bcs:NewLimitAmount>${tag('bcs:EffectiveTime', opts.effectiveTime)}</bcs:CommonCreditLimit></bcs:AccountCredit></ChangeAcctCreditLimitRequest></bcs:ChangeAcctCreditLimitRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation(
      'changeAccountCreditLimit',
      payload,
      opts.accountKey ?? opts.accountCode ?? opts.primaryIdentity ?? '',
    );
  }

  async changePaymentRelation(opts: ChangePaymentRelationOptions): Promise<CbsMutationOutput> {
    const subscriber = opts.subscriberKey
      ? keyXml('Sub', { subscriberKey: opts.subscriberKey })
      : opts.primaryIdentity
        ? keyXml('Sub', { primaryIdentity: opts.primaryIdentity })
        : '';
    const customer = opts.customerKey
      ? keyXml('Cust', { customerKey: opts.customerKey })
      : opts.customerCode
        ? keyXml('Cust', { customerCode: opts.customerCode })
        : '';
    const add = opts.addPayRelation
      ? `<bcs:AddPayRelation><bcs:PayRelation><bcs:PayRelationKey>${xmlEscape(opts.addPayRelation.payRelationKey)}</bcs:PayRelationKey>${tag('bcs:AcctKey', opts.addPayRelation.accountKey)}${tag('bcs:Priority', opts.addPayRelation.priority)}${tag('bcs:OnlyPayRelFlag', opts.addPayRelation.onlyPayRelationFlag)}</bcs:PayRelation></bcs:AddPayRelation>`
      : '';
    const del = opts.deletePayRelationKey
      ? `<bcs:DelPayRelation><bcs:PayRelationKey>${xmlEscape(opts.deletePayRelationKey)}</bcs:PayRelationKey></bcs:DelPayRelation>`
      : '';
    if (!add && !del)
      throw createHttpError(400, 'Provide an addPayRelation or deletePayRelationKey change');
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangePayRelationRequestMsg>${this.requestHeader(opts, 'ChangePayRelation', opts.messageSeq ?? randomUUID())}<ChangePayRelationRequest>${subscriber}${customer}${add}${del}</ChangePayRelationRequest></bcs:ChangePayRelationRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation(
      'changePaymentRelation',
      payload,
      opts.primaryIdentity ?? opts.subscriberKey ?? opts.accountKey ?? '',
    );
  }

  private async mutation<T extends CbsOperationResponse>(
    operation: string,
    payload: string,
    subject: string,
  ): Promise<CbsMutationOutput> {
    const response = await this.transport.post(this.servicePath, payload, operation, subject);
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<T>(
      response,
      this.transport.parser,
    );
    if (resultCode !== '0')
      this.transport.throwCbsError(operation, subject, resultCode, resultDesc);
    return { metadata: resultMsg, data: { ResultCode: resultCode, ResultDesc: resultDesc } };
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
        BalanceChanges: addAmountInGhc(balanceChanges),
        FreeUnitChanges: freeUnitChanges,
      },
    };
  }

  async queryCustomerInfo(
    msisdn: string,
    opts?: QueryCustomerInfoOptions,
  ): Promise<QueryCustomerInfoOutput> {
    return this.queryCustomerInfoAccess(
      { primaryIdentity: this.normalizeMsisdn(msisdn) },
      opts,
      'queryCustomerInfo',
    );
  }

  async queryCustomerInfoByKey(
    key: QueryCustomerInfoKey,
    opts?: QueryCustomerInfoOptions,
  ): Promise<QueryCustomerInfoOutput> {
    return this.queryCustomerInfoAccess(key, opts, 'queryCustomerInfoByKey');
  }

  private async queryCustomerInfoAccess(
    access: QueryCustomerInfoKey,
    opts: QueryCustomerInfoOptions | undefined,
    operation: string,
  ): Promise<QueryCustomerInfoOutput> {
    const accessXml = this.queryCustomerInfoAccessXml(access);
    const accessValue = Object.values(access)[0];
    const messageSeq = opts?.messageSeq ?? new Date().toISOString();
    this.log('verbose', `${operation} - sending request`, { access, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
      <soapenv:Header/>
      <soapenv:Body>
          <bcs:QueryCustomerInfoRequestMsg>
            ${this.requestHeader(opts, 'QueryCustomerInfo', messageSeq, { operatorId: CbsRequestDefaults.OPERATOR_ID, accessMode: CbsRequestDefaults.ACCESS_MODE, msgLanguageCode: CbsRequestDefaults.MSG_LANGUAGE_CODE, timeType: CbsRequestDefaults.TIME_TYPE })}
            <QueryCustomerInfoRequest>
              <bcs:QueryObj>
                ${accessXml}
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
      operation,
      accessValue,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryCustomerInfoResponse>(
      response,
      this.transport.parser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError(operation, accessValue, resultCode, resultDesc);
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
          amountInGhc: normalizeBalanceAmount(
            getXmlField<number | string>(mainBalanceResult, 'TotalAmount'),
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

    this.log('verbose', `${operation} - success`, { access, messageSeq });
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

  private queryCustomerInfoAccessXml(access: QueryCustomerInfoKey): string {
    const entries = Object.entries(access).filter(
      ([, value]) => value !== undefined && value !== '',
    );
    if (entries.length !== 1) {
      throw createHttpError(400, 'Provide exactly one CBS customer info access code');
    }

    const [type, value] = entries[0];
    const escapedValue = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const tags: Record<string, string> = {
      primaryIdentity: `<bcs:SubAccessCode><bcc:PrimaryIdentity>${escapedValue}</bcc:PrimaryIdentity></bcs:SubAccessCode>`,
      subscriberKey: `<bcs:SubAccessCode><bcc:SubscriberKey>${escapedValue}</bcc:SubscriberKey></bcs:SubAccessCode>`,
      customerKey: `<bcs:CustAccessCode><bcc:CustomerKey>${escapedValue}</bcc:CustomerKey></bcs:CustAccessCode>`,
      customerCode: `<bcs:CustAccessCode><bcc:CustomerCode>${escapedValue}</bcc:CustomerCode></bcs:CustAccessCode>`,
      accountKey: `<bcs:AcctAccessCode><bcc:AccountKey>${escapedValue}</bcc:AccountKey></bcs:AcctAccessCode>`,
      accountCode: `<bcs:AcctAccessCode><bcc:AccountCode>${escapedValue}</bcc:AccountCode></bcs:AcctAccessCode>`,
    };

    const xml = tags[type];
    if (!xml) throw createHttpError(400, 'Unsupported CBS customer info access code');
    return xml;
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
        AmountList: amountList
          ? (Array.isArray(amountList) ? amountList : [amountList]).map((amount) => ({
              ...amount,
              Amount: amount.Amount,
              amountInGhc: normalizeBalanceAmount(amount.Amount),
            }))
          : [],
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
