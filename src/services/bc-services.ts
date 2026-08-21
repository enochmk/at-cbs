import type {
  AcctDeactivationOptions,
  AcctDeactivationOutput,
  AcctDeactivationResponse,
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
  CreateStandalonePrepaidSubscriberOptions,
  CreateSubscriberAccountOptions,
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
  CbsAccountInfo,
  CbsAddressInfo,
  CbsCustomerBasicInfo,
  CbsIndividualInfo,
  CbsNoticeSuppression,
  CbsOrganizationInfo,
  CbsProperty,
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

function redactSoapCredentials(payload: string): string {
  return payload
    .replace(/(<(?:cbs:)?LoginSystemCode>)[^<]*(<\/)/g, '$1[REDACTED]$2')
    .replace(/(<(?:cbs:)?Password>)[^<]*(<\/)/g, '$1[REDACTED]$2');
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

function propertyXml(properties: CbsProperty[] | undefined, element: string): string {
  return (properties ?? [])
    .map(
      (property) =>
        `<${element}><bcc:Code>${xmlEscape(property.code)}</bcc:Code><bcc:Value>${xmlEscape(property.value)}</bcc:Value></${element}>`,
    )
    .join('');
}

function customerBasicInfoXml(
  info: CbsCustomerBasicInfo | undefined,
  customerSegment?: string,
): string {
  if (!info && customerSegment === undefined) return '';
  const content = `${tag('bcc:CustSegment', customerSegment)}${tag('bcc:DFTPwd', info?.defaultPassword)}${tag('bcc:DFTWrittenLang', info?.defaultWrittenLanguage)}${tag('bcc:DFTIVRLang', info?.defaultIvrLanguage)}${tag('bcc:DFTBillCycleType', info?.defaultBillCycleType)}${tag('bcc:DFTCurrencyID', info?.defaultCurrencyId)}${tag('bcc:CustLevel', info?.customerLevel)}${tag('bcc:CustLoyalty', info?.customerLoyalty)}${tag('bcc:DunningFlag', info?.dunningFlag)}${propertyXml(info?.properties, 'bcc:CustProperty')}`;
  return `<bcs:CustBasicInfo>${content}</bcs:CustBasicInfo>`;
}

function noticeSuppressionsXml(notices: CbsNoticeSuppression[] | undefined): string {
  return (notices ?? [])
    .map(
      (notice) =>
        `<bcc:NoticeSuppress>${tag('bcc:ChannelType', notice.channelType)}${tag('bcc:NoticeType', notice.noticeType)}${tag('bcc:SubNoticeType', notice.subNoticeType)}${tag('bcc:TemplateID', notice.templateId)}</bcc:NoticeSuppress>`,
    )
    .join('');
}

function individualXml(
  info: CbsIndividualInfo | undefined,
  element: 'bcs:IndividualInfo' | 'bcs:Individual',
): string {
  if (!info) return '';
  return `<${element}>${tag('bcc:IDType', info.idType)}${tag('bcc:IDNumber', info.idNumber ?? '')}${tag('bcc:IDValidity', info.idValidity)}${tag('bcc:Title', info.title)}${tag('bcc:FirstName', info.firstName)}${tag('bcc:MiddleName', info.middleName)}${tag('bcc:LastName', info.lastName)}${tag('bcc:HomeAddressKey', info.homeAddressKey)}${tag('bcc:Gender', info.gender)}${tag('bcc:Nationality', info.nationality)}${tag('bcc:Birthday', info.birthday)}${tag('bcc:NativePlace', info.nativePlace)}${tag('bcc:MaritalStatus', info.maritalStatus)}${tag('bcc:Education', info.education)}${tag('bcc:Occupation', info.occupation)}${tag('bcc:Salary', info.salary)}${tag('bcc:OfficePhone', info.officePhone)}${tag('bcc:HomePhone', info.homePhone)}${tag('bcc:MobilePhone', info.mobilePhone)}${tag('bcc:Fax', info.fax)}${tag('bcc:Email', info.email)}${propertyXml(info.properties, 'bcc:IndividualProperty')}</${element}>`;
}

function organizationXml(
  info: CbsOrganizationInfo | undefined,
  element: 'bcs:OrgInfo' | 'bcs:Organization',
): string {
  if (!info) return '';
  return `<${element}>${tag('bcc:IDType', info.idType)}${tag('bcc:IDNumber', info.idNumber)}${tag('bcc:IDValidity', info.idValidity)}${tag('bcc:OrgType', info.organizationType)}${tag('bcc:OrgName', info.name)}${tag('bcc:OrgShortName', info.shortName)}${tag('bcc:OrgLevel', info.level)}${tag('bcc:OrgAddressKey', info.addressKey)}${tag('bcc:OrgSize', info.size)}${tag('bcc:Industry', info.industry)}${tag('bcc:SubIndustry', info.subIndustry)}${tag('bcc:OrgPhoneNumber', info.phoneNumber)}${tag('bcc:OrgFaxNumber', info.faxNumber)}${tag('bcc:OrgEmail', info.email)}${tag('bcc:OrgWebSite', info.website)}${propertyXml(info.properties, 'bcc:OrgProperty')}</${element}>`;
}

function addressXml(info: CbsAddressInfo | undefined): string {
  if (!info) return '';
  return `<bcs:AddressInfo>${tag('bcc:AddressKey', info.addressKey)}${tag('bcc:Address1', info.address1)}${tag('bcc:Address2', info.address2)}${tag('bcc:Address3', info.address3)}${tag('bcc:Address4', info.address4)}${tag('bcc:Address5', info.address5)}${tag('bcc:Address6', info.address6)}${tag('bcc:Address7', info.address7)}${tag('bcc:Address8', info.address8)}${tag('bcc:Address9', info.address9)}${tag('bcc:Address10', info.address10)}${tag('bcc:Address11', info.address11)}${tag('bcc:Address12', info.address12)}${tag('bcc:PostCode', info.postCode)}</bcs:AddressInfo>`;
}

function accountInfoXml(info: CbsAccountInfo | undefined): string {
  if (!info) return '';
  const contact = info.contact
    ? `<bcc:ContactInfo>${tag('bcc:Title', info.contact.title)}${tag('bcc:FirstName', info.contact.firstName)}${tag('bcc:MiddleName', info.contact.middleName)}${tag('bcc:LastName', info.contact.lastName)}${tag('bcc:AddressKey', info.contact.addressKey)}${tag('bcc:OfficePhone', info.contact.officePhone)}${tag('bcc:HomePhone', info.contact.homePhone)}${tag('bcc:MobilePhone', info.contact.mobilePhone)}${tag('bcc:Email', info.contact.email)}${tag('bcc:Fax', info.contact.fax)}</bcc:ContactInfo>`
    : '';
  const basic = `<bcc:AcctBasicInfo>${tag('bcc:AcctName', info.accountName)}${tag('bcc:BillLang', info.billLanguage)}${tag('bcc:DunningFlag', info.dunningFlag)}${tag('bcc:LateFeeChargeable', info.lateFeeChargeable)}${tag('bcc:RedlistFlag', info.redlistFlag)}${contact}${(info.freeBillMedia ?? []).map((medium) => `<bcc:FreeBillMedium>${tag('bcc:BMCode', medium.billingMediumCode)}${tag('bcc:BMType', medium.billingMediumType)}</bcc:FreeBillMedium>`).join('')}${propertyXml(info.properties, 'bcc:AcctProperty')}${info.redlistTimePeriod ? `<bcc:RedlistTimePeriod>${tag('bcc:EffectiveTime', info.redlistTimePeriod.effectiveTime)}${tag('bcc:ExpireTime', info.redlistTimePeriod.expireTime)}</bcc:RedlistTimePeriod>` : ''}</bcc:AcctBasicInfo>`;
  const creditLimit =
    info.creditLimit === undefined
      ? ''
      : `<bcc:CreditLimit>${tag('bcc:LimitType', info.creditLimitType)}${tag('bcc:LimitValue', info.creditLimit)}${tag('bcc:LimitPlanCode', info.creditLimitPlanCode)}</bcc:CreditLimit>`;
  return `${tag('bcc:AcctCode', info.accountCode)}${tag('bcc:UserCustomerKey', info.userCustomerKey)}${tag('bcc:ParentAcctKey', info.parentAccountKey)}${basic}${tag('bcc:BillCycleType', info.billCycleType)}${tag('bcc:AcctType', info.accountType)}${tag('bcc:PaymentType', info.paymentType)}${tag('bcc:AcctClass', info.accountClass)}${tag('bcc:CurrencyID', info.currencyId)}${tag('bcc:InitBalance', info.initialBalance)}${creditLimit}${tag('bcc:AcctPayMethod', info.accountPaymentMethod)}`;
}

export class BcServices extends CbsServiceBase {
  protected readonly servicePath = '/services/BcServices';

  private async createSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
    mode: 'prepaid' | 'hybrid' | 'postpaid',
  ): Promise<CreateSubscriberOutput> {
    const identity = this.normalizeMsisdn(msisdn);
    const primaryIdentity = opts.primaryIdentity ?? identity;
    const messageSeq = opts.messageSeq ?? randomUUID();
    const accounts = this.validateSubscriberAccounts(opts.accounts, mode);
    const accountXml = accounts
      .map(
        (account) =>
          `<bcs:Account><bcs:AcctKey>${xmlEscape(account.accountKey)}</bcs:AcctKey><bcs:AcctInfo>${accountInfoXml(account)}</bcs:AcctInfo></bcs:Account>`,
      )
      .join('');
    const secondaryIdentity = opts.secondaryIdentity
      ? `<bcc:SubIdentity><bcc:SubIdentityType>2</bcc:SubIdentityType><bcc:SubIdentity>${xmlEscape(opts.secondaryIdentity)}</bcc:SubIdentity><bcc:PrimaryFlag>2</bcc:PrimaryFlag></bcc:SubIdentity>`
      : '';
    const subscriberInfo = `${tag('bcc:SubClass', opts.subscriberClass)}${tag('bcc:NetworkType', opts.networkType)}<bcc:SubIdentity><bcc:SubIdentityType>1</bcc:SubIdentityType><bcc:SubIdentity>${xmlEscape(primaryIdentity)}</bcc:SubIdentity><bcc:PrimaryFlag>1</bcc:PrimaryFlag></bcc:SubIdentity>${secondaryIdentity}<bcc:Status>${xmlEscape(opts.status)}</bcc:Status>`;
    const paymentMode = mode === 'prepaid' ? 0 : mode === 'postpaid' ? 1 : 2;
    const payment =
      accounts.length === 0
        ? ''
        : paymentMode === 2
          ? `${accounts
              .map(
                (account) =>
                  `<bcs:AcctList><bcs:AcctKey>${xmlEscape(account.accountKey)}</bcs:AcctKey><bcs:DEFAcctFlag>${account.defaultAccount ? 'Y' : 'N'}</bcs:DEFAcctFlag></bcs:AcctList>`,
              )
              .join('')}${accounts
              .map(
                (account) =>
                  `<bcs:PayRelation><bcs:PayRelationKey>${xmlEscape(account.paymentRelationKey)}</bcs:PayRelationKey><bcs:AcctKey>${xmlEscape(account.accountKey)}</bcs:AcctKey>${tag('bcs:Priority', account.priority)}${tag('bcs:OnlyPayRelFlag', account.onlyPayRelationFlag)}${tag('bcs:PaymentLimitKey', account.paymentLimitKey)}</bcs:PayRelation>`,
              )
              .join('')}`
          : `<bcs:PayRelationKey>${xmlEscape(accounts[0].paymentRelationKey)}</bcs:PayRelationKey><bcs:AcctKey>${xmlEscape(accounts[0].accountKey)}</bcs:AcctKey>`;

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
        <soapenv:Header/><soapenv:Body><bcs:CreateSubscriberRequestMsg>
          ${this.requestHeader(opts, 'CreateSubscriber', messageSeq)}
          <CreateSubscriberRequest>
            <bcs:RegisterCustomer OpType="2"><bcs:CustKey>${xmlEscape(opts.customerKey)}</bcs:CustKey></bcs:RegisterCustomer>
            ${accountXml}
            <bcs:Subscriber><bcs:SubscriberKey>${xmlEscape(opts.subscriberKey)}</bcs:SubscriberKey><bcs:SubscriberInfo>${subscriberInfo}</bcs:SubscriberInfo>
              <bcs:SubPaymentMode><bcs:PaymentMode>${paymentMode}</bcs:PaymentMode>${payment}</bcs:SubPaymentMode>
            </bcs:Subscriber>
            <bcs:PrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${xmlEscape(opts.offeringId)}</bcc:OfferingID></bcc:OfferingKey>${tag('bcc:OfferingClass', opts.offeringClass)}<bcc:Status>${xmlEscape(opts.status)}</bcc:Status></bcs:PrimaryOffering>
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

  private validateSubscriberAccounts(
    accounts: CreateSubscriberOptions['accounts'],
    mode: 'prepaid' | 'hybrid' | 'postpaid',
  ): CreateSubscriberAccountOptions[] {
    const suppliedAccounts = accounts ?? [];
    if (suppliedAccounts.length === 0 && mode !== 'hybrid') {
      return [];
    }
    const expectedCount = mode === 'hybrid' ? 2 : 1;
    if (suppliedAccounts.length !== expectedCount) {
      throw createHttpError(
        400,
        `${mode} subscriber creation requires exactly ${expectedCount} account${expectedCount === 1 ? '' : 's'}`,
      );
    }

    const accountKeys = suppliedAccounts.map((account) => account.accountKey);
    const accountCodes = suppliedAccounts.map((account) => account.accountCode);
    const relationKeys = suppliedAccounts.map((account) => account.paymentRelationKey);
    if (new Set(accountKeys).size !== accountKeys.length) {
      throw createHttpError(400, 'Subscriber account keys must be unique');
    }
    if (new Set(accountCodes).size !== accountCodes.length) {
      throw createHttpError(400, 'Subscriber account codes must be unique');
    }
    if (new Set(relationKeys).size !== relationKeys.length) {
      throw createHttpError(400, 'Subscriber payment relation keys must be unique');
    }
    if (suppliedAccounts.some((account) => account.accountKey !== account.accountCode)) {
      throw createHttpError(400, 'Each subscriber account key must match its account code');
    }

    const paymentTypes = suppliedAccounts.map((account) => account.paymentType);
    if (mode === 'prepaid' && paymentTypes[0] !== 0) {
      throw createHttpError(400, 'Prepaid subscriber accounts must use paymentType 0');
    }
    if (mode === 'postpaid' && paymentTypes[0] !== 1) {
      throw createHttpError(400, 'Postpaid subscriber accounts must use paymentType 1');
    }
    if (mode === 'hybrid' && new Set(paymentTypes).size !== 2) {
      throw createHttpError(400, 'Hybrid subscribers require one prepaid and one postpaid account');
    }
    if (
      mode === 'hybrid' &&
      suppliedAccounts.filter((account) => account.defaultAccount).length !== 1
    ) {
      throw createHttpError(400, 'Hybrid subscribers require exactly one default account');
    }
    return suppliedAccounts;
  }

  createPrepaidSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.createSubscriber(msisdn, opts, 'prepaid');
  }

  /** Creates a standalone regular prepaid subscriber using the MSISDN as every CBS entity key. */
  async createStandalonePrepaidSubscriber(
    msisdn: string,
    opts: CreateStandalonePrepaidSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    const identity = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    const secondaryIdentity = `123${identity}`;
    const initialBalance = opts.initialBalance ?? 100000000;
    const payload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:CreateSubscriberRequestMsg>
            ${this.requestHeader(opts, 'CreateSubscriber', messageSeq)}
            <CreateSubscriberRequest>
              <bcs:RegisterCustomer OpType="1">
                <bcs:CustKey>${xmlEscape(identity)}</bcs:CustKey>
                <bcs:CustInfo>
                  <bcc:CustType>1</bcc:CustType>
                  <bcc:CustNodeType>1</bcc:CustNodeType>
                  <bcc:CustClass>1</bcc:CustClass>
                  <bcc:CustCode>${xmlEscape(identity)}</bcc:CustCode>
                </bcs:CustInfo>
              </bcs:RegisterCustomer>
              <bcs:Account>
                <bcs:AcctKey>${xmlEscape(identity)}</bcs:AcctKey>
                <bcs:AcctInfo>
                  <bcc:AcctCode>${xmlEscape(identity)}</bcc:AcctCode>
                  <bcc:BillCycleType>01</bcc:BillCycleType>
                  <bcc:AcctType>1</bcc:AcctType>
                  <bcc:PaymentType>0</bcc:PaymentType>
                  <bcc:AcctClass>1</bcc:AcctClass>
                  <bcc:CurrencyID>1054</bcc:CurrencyID>
                  <bcc:InitBalance>${xmlEscape(initialBalance)}</bcc:InitBalance>
                  <bcc:AcctPayMethod>1</bcc:AcctPayMethod>
                </bcs:AcctInfo>
              </bcs:Account>
              <bcs:Subscriber>
                <bcs:SubscriberKey>${xmlEscape(identity)}</bcs:SubscriberKey>
                <bcs:SubscriberInfo>
                  <bcc:SubBasicInfo/>
                  <bcc:SubIdentity>
                    <bcc:SubIdentityType>1</bcc:SubIdentityType>
                    <bcc:SubIdentity>${xmlEscape(identity)}</bcc:SubIdentity>
                    <bcc:PrimaryFlag>1</bcc:PrimaryFlag>
                  </bcc:SubIdentity>
                  <bcc:SubIdentity>
                    <bcc:SubIdentityType>2</bcc:SubIdentityType>
                    <bcc:SubIdentity>${xmlEscape(secondaryIdentity)}</bcc:SubIdentity>
                    <bcc:PrimaryFlag>2</bcc:PrimaryFlag>
                  </bcc:SubIdentity>
                  <bcc:SubClass>2</bcc:SubClass>
                  <bcc:NetworkType>1</bcc:NetworkType>
                  <bcc:Status>1</bcc:Status>
                </bcs:SubscriberInfo>
                <bcs:SubPaymentMode>
                  <bcs:PaymentMode>0</bcs:PaymentMode>
                  <bcs:PayRelationKey>PR_${xmlEscape(identity)}</bcs:PayRelationKey>
                  <bcs:AcctKey>${xmlEscape(identity)}</bcs:AcctKey>
                </bcs:SubPaymentMode>
              </bcs:Subscriber>
              <bcs:PrimaryOffering>
                <bcc:OfferingKey>
                  <bcc:OfferingID>${xmlEscape(opts.offeringId)}</bcc:OfferingID>
                </bcc:OfferingKey>
                <bcc:BundledFlag>S</bcc:BundledFlag>
                <bcc:OfferingClass>I</bcc:OfferingClass>
                <bcc:Status>1</bcc:Status>
              </bcs:PrimaryOffering>
            </CreateSubscriberRequest>
          </bcs:CreateSubscriberRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const response = await this.transport.post(
      this.servicePath,
      payload,
      'createStandalonePrepaidSubscriber',
      msisdn,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<CreateSubscriberResponse>(
      response,
      this.transport.parser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError(
        'createStandalonePrepaidSubscriber',
        msisdn,
        resultCode,
        resultDesc,
      );
    }
    return { metadata: resultMsg, data: { ResultCode: resultCode, ResultDesc: resultDesc } };
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
    const customerInfo = `<bcs:CustInfo>${tag('bcc:CustType', opts.customerType)}${tag('bcc:CustNodeType', opts.customerNodeType)}${tag('bcc:CustClass', opts.customerClass)}${tag('bcc:CustCode', opts.customerCode)}${tag('bcc:ParentCustKey', opts.parentCustomerKey)}${customerBasicInfoXml(opts.customerBasicInfo, opts.customerSegment)}${noticeSuppressionsXml(opts.noticeSuppressions)}</bcs:CustInfo>`;
    const defaultAccount = opts.defaultAccount
      ? `<bcs:DFTAccount><bcs:PayRelationKey>${xmlEscape(opts.defaultAccount.paymentRelationKey)}</bcs:PayRelationKey><bcs:AcctKey>${xmlEscape(opts.defaultAccount.accountKey)}</bcs:AcctKey>${opts.defaultAccount.account ? `<bcs:AcctInfo>${accountInfoXml(opts.defaultAccount.account)}</bcs:AcctInfo>` : ''}</bcs:DFTAccount>`
      : '';
    const salesInfo = opts.salesInfo
      ? `<bcs:SalesInfo>${tag('bcc:SalesChannelID', opts.salesInfo.salesChannelId)}${tag('bcc:SalesID', opts.salesInfo.salesId)}</bcs:SalesInfo>`
      : '';
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:CreateCustomerRequestMsg>${this.requestHeader(opts, 'CreateCustomer', opts.messageSeq ?? randomUUID())}<CreateCustomerRequest><bcs:RegisterCustKey>${xmlEscape(opts.registerCustKey)}</bcs:RegisterCustKey><bcs:Customer><bcs:CustKey>${xmlEscape(opts.customerKey)}</bcs:CustKey>${customerInfo}${individualXml(opts.individual, 'bcs:IndividualInfo')}${organizationXml(opts.organization, 'bcs:OrgInfo')}</bcs:Customer>${defaultAccount}${addressXml(opts.addressInfo)}${salesInfo}${tag('bcs:EffectiveTime', opts.effectiveTime)}</CreateCustomerRequest></bcs:CreateCustomerRequestMsg></soapenv:Body></soapenv:Envelope>`;
    return this.mutation('createCustomer', payload, opts.customerKey);
  }

  async changeCustomerInfo(opts: ChangeCustomerInfoOptions): Promise<CbsMutationOutput> {
    const key = opts.customerKey
      ? { customerKey: opts.customerKey }
      : opts.customerCode
        ? { customerCode: opts.customerCode }
        : { primaryIdentity: opts.primaryIdentity ?? '' };
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeCustInfoRequestMsg>${this.requestHeader(opts, 'ChangeCustInfo', opts.messageSeq ?? randomUUID())}<ChangeCustInfoRequest>${keyXml('Cust', key)}<bcs:CustInfo>${customerBasicInfoXml(opts.customerBasicInfo, opts.customerSegment)}${individualXml(opts.individual, 'bcs:Individual')}${organizationXml(opts.organization, 'bcs:Organization')}</bcs:CustInfo>${addressXml(opts.addressInfo)}${propertyXml(opts.additionalProperties, 'bcs:AdditionalProperty')}${tag('bcs:NewCustomerKey', opts.newCustomerKey)}</ChangeCustInfoRequest></bcs:ChangeCustInfoRequestMsg></soapenv:Body></soapenv:Envelope>`;
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

  /** @deprecated Use the typed subscriber creation methods instead. */
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
    const effectiveMode = opts.effectiveMode ?? 'I';
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangeSubOfferingRequestMsg>${this.requestHeader(opts, 'ChangeSubOffering', opts.messageSeq ?? randomUUID())}<ChangeSubOfferingRequest>${keyXml('Sub', key)}<bcs:PrimaryOffering>${oldOffering}<bcs:NewPrimaryOffering><bcc:OfferingKey><bcc:OfferingID>${xmlEscape(opts.newOfferingId)}</bcc:OfferingID></bcc:OfferingKey>${tag('bcc:OfferingClass', opts.offeringClass)}</bcs:NewPrimaryOffering><bcs:EffectiveTime><bcc:Mode>${xmlEscape(effectiveMode)}</bcc:Mode></bcs:EffectiveTime></bcs:PrimaryOffering></ChangeSubOfferingRequest></bcs:ChangeSubOfferingRequestMsg></soapenv:Body></soapenv:Envelope>`;
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
    const account = opts.accountKey ? keyXml('Acct', { accountKey: opts.accountKey }) : '';
    const customer = opts.customerKey
      ? keyXml('Cust', { customerKey: opts.customerKey })
      : opts.customerCode
        ? keyXml('Cust', { customerCode: opts.customerCode })
        : '';
    const add = opts.addPayRelation
      ? `<bcs:AddPayRelation><bcs:PayRelation><bcs:PayRelationKey>${xmlEscape(opts.addPayRelation.payRelationKey)}</bcs:PayRelationKey>${tag('bcs:AcctKey', opts.addPayRelation.accountKey)}${tag('bcs:Priority', opts.addPayRelation.priority)}${tag('bcs:OnlyPayRelFlag', opts.addPayRelation.onlyPayRelationFlag)}<bcs:EffectiveTime><bcc:Mode>I</bcc:Mode></bcs:EffectiveTime><bcs:ExpirationTime>20361231160000</bcs:ExpirationTime></bcs:PayRelation></bcs:AddPayRelation>`
      : '';
    const del = opts.deletePayRelationKey
      ? `<bcs:DelPayRelation><bcs:PayRelationKey>${xmlEscape(opts.deletePayRelationKey)}</bcs:PayRelationKey></bcs:DelPayRelation>`
      : '';
    if (!add && !del)
      throw createHttpError(400, 'Provide an addPayRelation or deletePayRelationKey change');
    const paymentObj =
      subscriber || account || customer
        ? `<bcs:PaymentObj>${subscriber}${account}${customer}</bcs:PaymentObj>`
        : '';
    const paymentRelation = `<bcs:PaymentRelation>${add}${del}</bcs:PaymentRelation>`;
    const payload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon"><soapenv:Header/><soapenv:Body><bcs:ChangePayRelationRequestMsg>${this.requestHeader(opts, 'ChangePayRelation', opts.messageSeq ?? randomUUID())}<ChangePayRelationRequest>${paymentObj}${paymentRelation}</ChangePayRelationRequest></bcs:ChangePayRelationRequestMsg></soapenv:Body></soapenv:Envelope>`;
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
    const subscriberAccessCode = this.getSubscriberPrimaryIdentity(cbsMsisdn);

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
    const subscriberAccessCode = this.getSubscriberPrimaryIdentity(cbsMsisdn);

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
    const subscriberAccessCode = this.getSubscriberPrimaryIdentity(cbsMsisdn);
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/><soapenv:Body><bcs:SubActivationRequestMsg>
          ${this.requestHeader(opts, 'SubActivation', messageSeq)}
          <SubActivationRequest><bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode></SubActivationRequest>
        </bcs:SubActivationRequestMsg></soapenv:Body>
      </soapenv:Envelope>`;
    this.log('verbose', 'subActivate - request payload', {
      msisdn,
      selector: 'PrimaryIdentity',
      payload: redactSoapCredentials(soapPayload),
    });
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
    this.log('verbose', 'subActivate - CBS response', { msisdn, resultCode, resultDesc });
    return { metadata: resultMsg, data: { ResultCode: resultCode, ResultDesc: resultDesc } };
  }

  /** @deprecated Use the individual delete, create, and activation methods instead. */
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
      CUSTOMER_RESUME: { opType: 10, status: 'ACTIVE', cbsStatus: 2 },
      CUSTOMER_BARRING: { opType: 11, status: 'CALL_BARRING', cbsStatus: 3 },
      CUSTOMER_SUSPENSION: { opType: 12, status: 'SUSPEND', cbsStatus: 4 },
      ARREARS_RESUME: { opType: 30, status: 'ACTIVE', cbsStatus: 2 },
      ARREARS_BARRING: { opType: 31, status: 'CALL_BARRING', cbsStatus: 3 },
      ARREARS_SUSPENSION: { opType: 32, status: 'SUSPEND', cbsStatus: 4 },
      CREDIT_CONTROL_RESUME: { opType: 40, status: 'ACTIVE', cbsStatus: 2 },
      CREDIT_CONTROL_BARRING: { opType: 41, status: 'CALL_BARRING', cbsStatus: 3 },
      CREDIT_CONTROL_SUSPENSION: { opType: 42, status: 'SUSPEND', cbsStatus: 4 },
      OPERATOR_RESUME: { opType: 60, status: 'ACTIVE', cbsStatus: 2 },
      OPERATOR_BARRING: { opType: 61, status: 'CALL_BARRING', cbsStatus: 3 },
      OPERATOR_SUSPENSION: { opType: 62, status: 'SUSPEND', cbsStatus: 4 },
    } as const;
    const defaultOperation = {
      ACTIVE: 'CUSTOMER_RESUME',
      CALL_BARRING: 'CUSTOMER_BARRING',
      SUSPEND: 'CUSTOMER_SUSPENSION',
    } as const;
    const operation = opts.operation ?? defaultOperation[opts.status];
    const selected = statusMap[operation];
    if (!selected || selected.status !== opts.status) {
      throw createHttpError(400, 'Subscriber status and operation do not match');
    }

    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const messageSeq = opts.messageSeq ?? randomUUID();
    const subscriberAccessCode = this.getSubscriberPrimaryIdentity(cbsMsisdn);
    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/><soapenv:Body><bcs:ChangeSubStatusRequestMsg>
          ${this.requestHeader(opts, 'ChangeSubStatus', messageSeq)}
          <ChangeSubStatusRequest><bcs:SubAccessCode>${subscriberAccessCode}</bcs:SubAccessCode><bcs:OpType>${selected.opType}</bcs:OpType><bcs:NewStatus>${selected.cbsStatus}</bcs:NewStatus></ChangeSubStatusRequest>
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
      data: { ResultCode: resultCode, ResultDesc: resultDesc, Status: selected.cbsStatus },
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

  async acctDeactivation(opts: AcctDeactivationOptions): Promise<AcctDeactivationOutput> {
    if (!opts.opType) {
      throw createHttpError(400, 'opType is required for AcctDeactivation');
    }

    const messageSeq = opts.messageSeq ?? randomUUID();
    const accountAccessCode = this.getAccountAccessCode(opts);
    const payType = tag('bcs:PayType', opts.payType);
    this.log('verbose', 'acctDeactivation - sending request', { opts });

    const payload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon" xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bcs:AcctDeactivationRequestMsg>
            ${this.requestHeader(opts, 'AcctDeactivation', messageSeq)}
            <AcctDeactivationRequest>
              <bcs:AcctAccessCode>${accountAccessCode}${payType}</bcs:AcctAccessCode>
              <bcs:OpType>${xmlEscape(opts.opType)}</bcs:OpType>
            </AcctDeactivationRequest>
          </bcs:AcctDeactivationRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>`;

    const accessValue = opts.accountKey ?? opts.accountCode ?? opts.primaryIdentity ?? '';
    const response = await this.transport.post(
      this.servicePath,
      payload,
      'acctDeactivation',
      accessValue,
    );
    const { resultMsg, resultCode, resultDesc } = this.transport.parse<AcctDeactivationResponse>(
      response,
      this.transport.stringParser,
    );
    if (resultCode !== '0') {
      this.transport.throwCbsError('acctDeactivation', accessValue, resultCode, resultDesc);
    }

    this.log('verbose', 'acctDeactivation - success', { accessValue, messageSeq });
    return { metadata: resultMsg };
  }
}
