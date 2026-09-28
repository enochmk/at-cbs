export interface CbsClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
  logger?: Logger;
}

export interface Logger {
  info?: (msg: string, ctx?: Record<string, unknown>) => void;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
  error?: (msg: string, ctx?: Record<string, unknown>) => void;
  debug?: (msg: string, ctx?: Record<string, unknown>) => void;
  verbose?: (msg: string, ctx?: Record<string, unknown>) => void;
}

export interface CbsRequestOptions {
  messageSeq?: string;
  beId?: string;
  operatorId?: string;
  accessMode?: number;
  msgLanguageCode?: number;
  timeType?: number;
  remoteAddress?: string;
  remark?: string;
  version?: number | string;
}

export interface QueryCustomerInfoOptions extends CbsRequestOptions {
  queryMode?: number | string;
  customerMask?: string;
  accountMask?: string;
  subscriberMask?: string;
  groupMask?: string;
}

export interface QueryPaymentRelationOptions extends CbsRequestOptions {
  /** Account code that pays for the subscriber. */
  payAccountCode: string;
}

export type QueryCustomerInfoKey =
  | { primaryIdentity: string }
  | { customerKey: string }
  | { customerCode: string }
  | { subscriberKey: string }
  | { accountKey: string }
  | { accountCode: string };

export type CbsEntityKey = QueryCustomerInfoKey;

export interface CbsMutationOutput {
  metadata: CbsOperationResponse;
  data: { ResultCode?: number | string; ResultDesc?: string };
}

export interface CbsProperty {
  code: string;
  value: string | number;
}

export interface CbsAddressInfo {
  addressKey: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  address5?: string;
  address6?: string;
  address7?: string;
  address8?: string;
  address9?: string;
  address10?: string;
  address11?: string;
  address12?: string;
  postCode?: string;
}

export interface CbsCustomerBasicInfo {
  defaultPassword?: string;
  defaultWrittenLanguage?: string | number;
  defaultIvrLanguage?: string | number;
  defaultBillCycleType?: string | number;
  defaultCurrencyId?: string | number;
  customerLevel?: string | number;
  customerLoyalty?: string | number;
  dunningFlag?: string | number;
  properties?: CbsProperty[];
}

export interface CbsNoticeSuppression {
  channelType: string | number;
  noticeType: string | number;
  subNoticeType?: string | number;
  templateId?: string | number;
}

export interface CbsIndividualInfo {
  idType?: string;
  idNumber?: string;
  idValidity?: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  homeAddressKey?: string;
  gender?: string;
  nationality?: string;
  birthday?: string;
  nativePlace?: string;
  maritalStatus?: string | number;
  education?: string | number;
  occupation?: string;
  salary?: string | number;
  officePhone?: string;
  homePhone?: string;
  mobilePhone?: string;
  fax?: string;
  email?: string;
  properties?: CbsProperty[];
}

export interface CbsOrganizationInfo {
  idType?: string;
  idNumber?: string;
  idValidity?: string;
  organizationType?: string | number;
  name?: string;
  shortName?: string;
  level?: string | number;
  addressKey?: string;
  size?: string | number;
  industry?: string;
  subIndustry?: string;
  phoneNumber?: string;
  faxNumber?: string;
  email?: string;
  website?: string;
  properties?: CbsProperty[];
}

export interface CbsAccountContactInfo {
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  addressKey?: string;
  officePhone?: string;
  homePhone?: string;
  mobilePhone?: string;
  email?: string;
  fax?: string;
}

export interface CbsFreeBillMedium {
  billingMediumCode: string;
  billingMediumType: string | number;
}

export interface CbsRedlistTimePeriod {
  effectiveTime: string;
  expireTime: string;
}

export interface CbsAccountInfo {
  accountCode?: string;
  userCustomerKey?: string;
  parentAccountKey?: string;
  accountName?: string;
  billLanguage?: string | number;
  dunningFlag?: string | number;
  lateFeeChargeable?: string | number;
  redlistFlag?: string | number;
  contact?: CbsAccountContactInfo;
  freeBillMedia?: CbsFreeBillMedium[];
  properties?: CbsProperty[];
  redlistTimePeriod?: CbsRedlistTimePeriod;
  billCycleType?: string | number;
  accountType?: string | number;
  paymentType?: string | number;
  accountClass?: string | number;
  currencyId?: string | number;
  initialBalance?: string | number;
  creditLimitType?: string;
  creditLimit?: string | number;
  creditLimitPlanCode?: string;
  accountPaymentMethod?: string | number;
}

export interface CbsDefaultAccount {
  paymentRelationKey: string;
  accountKey: string;
  account?: CbsAccountInfo;
}

export interface CbsSalesInfo {
  salesChannelId?: string | number;
  salesId?: string | number;
}

export interface CreateCustomerOptions extends CbsRequestOptions {
  registerCustKey: string;
  customerKey: string;
  customerCode?: string;
  customerType?: number | string;
  customerNodeType?: number | string;
  customerClass?: number | string;
  parentCustomerKey?: string;
  customerSegment?: string;
  customerBasicInfo?: CbsCustomerBasicInfo;
  noticeSuppressions?: CbsNoticeSuppression[];
  individual?: CbsIndividualInfo;
  organization?: CbsOrganizationInfo;
  defaultAccount?: CbsDefaultAccount;
  addressInfo?: CbsAddressInfo;
  salesInfo?: CbsSalesInfo;
  effectiveTime?: string;
}

export interface ChangeCustomerInfoOptions extends CbsRequestOptions {
  customerKey?: string;
  customerCode?: string;
  primaryIdentity?: string;
  customerSegment?: string;
  customerBasicInfo?: CbsCustomerBasicInfo;
  individual?: CbsIndividualInfo;
  organization?: CbsOrganizationInfo;
  addressInfo?: CbsAddressInfo;
  additionalProperties?: CbsProperty[];
  newCustomerKey?: string;
}

export interface CreateAccountOptions extends CbsRequestOptions {
  registerCustKey: string;
  accountKey: string;
  accountCode?: string;
  userCustomerKey?: string;
  parentAccountKey?: string;
  accountName?: string;
  billCycleType?: string | number;
  accountType?: string | number;
  paymentType?: string | number;
  accountClass?: string | number;
  currencyId?: string | number;
  initialBalance?: string | number;
  creditLimit?: string | number;
  creditLimitType?: string;
  accountPaymentMethod?: string | number;
}

/**
 * @deprecated Use CreateSubscriberOptions with createPrepaidSubscriber,
 * createPostpaidSubscriber, or createHybridSubscriber. This legacy shape
 * cannot create accounts in the same request.
 */
export interface CreateSubscriberRequestOptions extends CbsRequestOptions {
  customerKey?: string;
  accountKey?: string;
  subscriberKey: string;
  primaryIdentity: string;
  secondaryIdentity?: string;
  paymentMode: 0 | 1 | 2;
  offeringId: string | number;
  offeringClass?: string;
  subscriberClass?: string | number;
  status?: string | number;
  initialBalance?: string | number;
  creditLimit?: string | number;
}

export interface ChangeSubscriberOfferingOptions extends CbsRequestOptions {
  subscriberKey?: string;
  primaryIdentity?: string;
  oldOfferingId?: string | number;
  newOfferingId: string | number;
  purchaseSeq?: string | number;
  offeringClass?: string;
  effectiveMode?: string;
}

export interface ChangeSubscriberPaymentModeOptions extends CbsRequestOptions {
  subscriberKey?: string;
  primaryIdentity?: string;
  paymentMode: 0 | 1 | 2;
  oldOfferingId?: string | number;
  newOfferingId?: string | number;
  accountKey?: string;
  paymentRelationKey?: string;
  initialBalance?: string | number;
  creditLimit?: string | number;
  effectiveTime?: string;
}

export interface ChangeSubscriberIdentityOptions extends CbsRequestOptions {
  primaryIdentity: string;
  oldSubIdentity: string;
  oldSubIdentityType: 1 | 2;
  newSubIdentity: string;
}

export interface ChangeAccountCreditLimitOptions extends CbsRequestOptions {
  accountKey?: string;
  accountCode?: string;
  primaryIdentity?: string;
  creditLimitType?: string;
  newLimitAmount: string | number;
  effectiveTime?: string;
}

export interface ChangePaymentRelationOptions extends CbsRequestOptions {
  accountKey?: string;
  subscriberKey?: string;
  primaryIdentity?: string;
  customerKey?: string;
  customerCode?: string;
  addPayRelation?: {
    payRelationKey: string;
    accountKey?: string;
    priority?: number;
    onlyPayRelationFlag?: 'Y' | 'N';
    paymentLimitKey?: string;
    effectiveTimeMode?: string;
    expirationTime?: string | number;
  };
  modifyPayRelation?: {
    payRelationKey: string;
    paymentLimit?: {
      operationType?: string | number;
      paymentLimitKey?: string;
      limitValue?: string | number;
    };
  };
  paymentLimits?: CbsPaymentLimit[];
  deletePayRelationKey?: string;
}

export interface ChangeSubscriberPaymentLimitOptions extends CbsRequestOptions {
  /** Existing payment-relation key returned by QueryPaymentRelation. */
  payRelationKey: string;
  /** New payment limit in CBS units. */
  newLimit: string | number;
}

export interface CbsPaymentLimit {
  paymentLimitKey: string;
  limitCycleType?: string | number;
  limitType?: string | number;
  limitValueType?: string | number;
  limitValue?: string | number;
}

export interface QueryCustomerInfoResultHeader {
  Version?: number | string;
  ResultCode?: number | string;
  MsgLanguageCode?: number | string;
  ResultDesc?: string;
}

export interface QueryCustomerInfoIndividualInfo {
  Birthday?: string;
  [key: string]: unknown;
}

export interface QueryCustomerInfoCustomer {
  CustKey?: string | number;
  CustInfo?: Record<string, unknown>;
  IndividualInfo?: QueryCustomerInfoIndividualInfo;
  SiteInfo?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface QueryCustomerInfoPrimaryOffering {
  OfferingID?: string | number;
  PurchaseSeq?: string | number;
  OfferingKey?: Record<string, unknown>;
  BundledFlag?: string;
  OfferingClass?: string;
  Status?: number | string;
  EffectiveTime?: string | number;
  ExpirationTime?: string | number;
  ActivationMode?: string;
  ActivationTime?: string | number;
  ProductInst?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoLifeCycleDetail {
  StatusDetail?: string;
  RBlacklistStatus?: number | string;
  CurrentStatusIndex?: number | string;
  LifeCycleStatus?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoBalanceDetail {
  BalanceInstanceID?: string | number;
  Amount?: string | number;
  InitialAmount?: string | number;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  AcctBalOriginal?: Record<string, unknown>;
  LastUpdateTime?: string | number;
  [key: string]: unknown;
}

export interface QueryCustomerInfoBalanceResult {
  BalanceType?: string;
  BalanceTypeName?: string;
  TotalAmount?: string | number;
  ReservedAmount?: string | number;
  DepositFlag?: string;
  RefundFlag?: string | number;
  CurrencyID?: string | number;
  BalanceDetail?: QueryCustomerInfoBalanceDetail;
  [key: string]: unknown;
}

export interface QueryCustomerInfoAcctList {
  AcctKey?: string | number;
  BalanceResult?: QueryCustomerInfoBalanceResult[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoFreeUnitDetail {
  FreeUnitInstanceID?: string | number;
  InitialAmount?: string | number;
  CurrentAmount?: string | number;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  FreeUnitOrigin?: Record<string, unknown>;
  UsagePriority?: string | number;
  RollOverFlag?: string;
  ReserveValidTime?: string | number;
  LastUpdateTime?: string | number;
  [key: string]: unknown;
}

export interface QueryCustomerInfoFreeUnitItem {
  FreeUnitType?: string;
  FreeUnitTypeName?: string;
  MeasureUnit?: string | number;
  MeasureUnitName?: string;
  TotalInitialAmount?: string | number;
  TotalUnusedAmount?: string | number;
  TotalReserveAmount?: string | number;
  FreeUnitItemDetail?: QueryCustomerInfoFreeUnitDetail[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoFreeUnitInfo {
  FreeUnitItem?: QueryCustomerInfoFreeUnitItem[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoSubscriber {
  SubscriberKey?: string | number;
  SubscriberInfo?: {
    Status?: number | string;
    [key: string]: unknown;
  };
  PaymentMode?: number | string;
  PrimaryOffering?: QueryCustomerInfoPrimaryOffering;
  LifeCycleDetail?: QueryCustomerInfoLifeCycleDetail;
  ActivationTime?: string;
  AcctList?: QueryCustomerInfoAcctList | QueryCustomerInfoAcctList[];
  FreeUnitInfo?: QueryCustomerInfoFreeUnitInfo;
  [key: string]: unknown;
}

export interface QueryCustomerInfoSubIdentity {
  SubIdentityType?: number | string;
  SubIdentity?: number | string;
  PrimaryFlag?: number | string;
  [key: string]: unknown;
}

export interface QueryCustomerInfoMainBalance {
  BalanceType: 'C_MAIN_ACCOUNT';
  BalanceTypeName: 'PPS_MainAccount';
  TotalAmount?: number | string;
  InitialAmount?: number | string;
  amountInGhc?: number | string;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  LastUpdateTime?: string | number;
}

export interface QueryCustomerInfoAccount {
  AcctKey?: string | number;
  AcctInfo?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface QueryCustomerInfoResult {
  Customer?: QueryCustomerInfoCustomer;
  Subscriber?: QueryCustomerInfoSubscriber;
  Account?: QueryCustomerInfoAccount;
  [key: string]: unknown;
}

export interface QueryCustomerInfoResponse {
  ResultHeader?: QueryCustomerInfoResultHeader;
  QueryCustomerInfoResult?: QueryCustomerInfoResult;
  [key: string]: unknown;
}

export type PaymentModeLabel = 'prepaid' | 'postpaid' | 'hybrid' | 'unknown';

export type CurrentStatusLabel =
  | 'Idle'
  | 'Active'
  | 'Call Barring'
  | 'Suspend'
  | 'Tested'
  | 'In stock'
  | 'Pre-deregistration'
  | 'Unknown';

export interface MappedCode<T extends string> {
  code: number;
  label: T;
}

export interface QueryCustomerInfoData {
  FirstActive?: string;
  PaymentMode?: MappedCode<PaymentModeLabel>;
  /** Subscriber status returned by QueryCustomerInfo SubscriberInfo.Status. */
  Status?: MappedCode<CurrentStatusLabel>;
  SubscriberIdentities?: QueryCustomerInfoSubIdentity[];
  BirthdayDate?: string;
  MainBalance?: QueryCustomerInfoMainBalance;
  AcctList?: QueryCustomerInfoAcctList[];
  FreeUnitInfo?: QueryCustomerInfoFreeUnitInfo;
  FreeUnits?: QueryCustomerInfoFreeUnitItem[];
  PrimaryOffering?: QueryCustomerInfoPrimaryOffering;
  SupplementaryOfferings?: QueryCustomerInfoPrimaryOffering[];
  'bcs:BillCycleType'?: number | string;
  'bcs:AcctType'?: number | string;
  'bcs:PaymentType'?: number | string;
  'bcs:AcctClass'?: number | string;
  'bcs:CurrencyID'?: number | string;
  'bcs:AcctPayMethod'?: number | string;
  'bcs:BillCycleOpenDate'?: number | string;
  'bcs:BillCycleEndDate'?: number | string;
}

export interface QueryCustomerInfoOutput {
  metadata: QueryCustomerInfoResponse;
  data: QueryCustomerInfoData;
}

export interface QueryPaymentRelationPayRelation {
  'bcs:PayRelationKey'?: string | number;
  'bcs:DefaultPayFlag'?: string;
  'bcs:AcctKey'?: string | number;
  'bcs:PayObjType'?: string;
  'bcs:PayObjKey'?: string | number;
  'bcs:PayObjCode'?: string | number;
  'bcs:Priority'?: string | number;
  'bcs:OnlyPayRelFlag'?: string;
  'bcs:PaymentLimitKey'?: string | number;
  'bcs:EffectiveTime'?: string | number;
  'bcs:ExpirationTime'?: string | number;
  [key: string]: unknown;
}

export interface QueryPaymentRelationLimit {
  'bcc:LimitType'?: string | number;
  'bcc:LimitValueType'?: string | number;
  'bcc:LimitValue'?: string | number;
  [key: string]: unknown;
}

export interface QueryPaymentRelationPaymentLimit {
  'bcs:PaymentLimitKey'?: string | number;
  'bcs:PaymentLimitInfo'?: {
    'bcc:LimitCycleType'?: string | number;
    'bcc:Limit'?: QueryPaymentRelationLimit;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface QueryPaymentRelationList {
  'bcs:PayRelation'?: QueryPaymentRelationPayRelation | QueryPaymentRelationPayRelation[];
  'bcs:PaymentLimit'?: QueryPaymentRelationPaymentLimit | QueryPaymentRelationPaymentLimit[];
  [key: string]: unknown;
}

export interface QueryPaymentRelationResult {
  'bcs:PaymentRelationList'?: QueryPaymentRelationList | QueryPaymentRelationList[];
  [key: string]: unknown;
}

export interface QueryPaymentRelationResponse extends CbsOperationResponse {
  QueryPaymentRelationResult?: QueryPaymentRelationResult;
}

export interface QueryPaymentRelationOutput {
  metadata: QueryPaymentRelationResponse;
  data: QueryPaymentRelationResult;
}

export interface QueryBalanceOptions extends CbsRequestOptions {}

export interface QueryBalanceDetail {
  BalanceInstanceID?: string | number;
  Amount?: number | string;
  InitialAmount?: number | string;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  AcctBalOriginal?: Record<string, unknown>;
  LastUpdateTime?: string | number;
  [key: string]: unknown;
}

export interface QueryBalanceResultItem {
  BalanceType?: string;
  BalanceTypeName?: string;
  TotalAmount?: number | string;
  ReservedAmount?: number | string;
  DepositFlag?: string;
  RefundFlag?: number | string;
  CurrencyID?: number | string;
  BalanceDetail?: QueryBalanceDetail;
  [key: string]: unknown;
}

export interface QueryBalanceAccountCredit {
  TotalCreditAmount?: number | string;
  TotalUsageAmount?: number | string;
  TotalRemainAmount?: number | string;
  CurrencyID?: number | string;
  [key: string]: unknown;
}

export interface QueryBalanceAcctList {
  AcctKey?: string | number;
  BalanceResult?: QueryBalanceResultItem | QueryBalanceResultItem[];
  AccountCredit?: QueryBalanceAccountCredit;
  [key: string]: unknown;
}

export interface QueryBalanceResult {
  AcctList?: QueryBalanceAcctList | QueryBalanceAcctList[];
  [key: string]: unknown;
}

export interface QueryBalanceResponse {
  ResultHeader?: QueryCustomerInfoResultHeader;
  QueryBalanceResult?: QueryBalanceResult;
  [key: string]: unknown;
}

export interface QueryBalanceData {
  BalanceType?: string;
  BalanceTypeName?: string;
  TotalAmount?: number | string;
  InitialAmount?: number | string;
  amountInGhc?: number | string;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  LastUpdateTime?: string | number;
}

export interface QueryBalanceOutput {
  metadata: QueryBalanceResponse;
  data: QueryBalanceData;
}

export interface SubscribeAppendantProductOptions extends CbsRequestOptions {
  offeringId: string | number;
  bundledFlag?: string;
  offeringClass?: string;
  status?: number | string;
  effectiveMode?: string;
}

export interface SubscribeAppendantProductResponse extends CbsOperationResponse {
  ChangeSubOfferingResult?: Record<string, unknown>;
}

export interface SubscribeAppendantProductData {
  ResultCode?: number | string;
  ResultDesc?: string;
  OfferingID?: string | number;
  PurchaseSeq?: string | number;
  EffectiveTime?: string | number;
  ExpirationTime?: string | number;
  RentDeductionStatus?: string | number;
  BalanceChanges?: Record<string, unknown> | Record<string, unknown>[];
  FreeUnitChanges?: Record<string, unknown> | Record<string, unknown>[];
}

export interface SubscribeAppendantProductOutput {
  metadata: SubscribeAppendantProductResponse;
  data: SubscribeAppendantProductData;
}

export interface UnsubscribeAppendantProductOptions extends CbsRequestOptions {
  offeringId: string | number;
  purchaseSeq: string | number;
}

export interface UnsubscribeAppendantProductResponse extends CbsOperationResponse {
  ChangeSubOfferingResult?: Record<string, unknown>;
}

export interface UnsubscribeAppendantProductData {
  ResultCode?: number | string;
  ResultDesc?: string;
}

export interface UnsubscribeAppendantProductOutput {
  metadata: UnsubscribeAppendantProductResponse;
  data: UnsubscribeAppendantProductData;
}

export interface AdjustAccountOptions extends CbsRequestOptions {
  adjustmentAmt?: number | string;
  balanceType?: string;
  adjustmentType?: number | string;
  currencyId?: number | string;
  adjustmentReasonCode?: string;
  opType?: number | string;
  adjustmentSerialNo?: string;
}

export interface AdjustAccountResult {
  AdjustmentSerialNo?: string;
  AcctKey?: string;
  CustKey?: string;
  AdjustmentInfo?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AdjustAccountResponse extends CbsOperationResponse {
  AdjustmentResult?: AdjustAccountResult;
}

export interface AdjustAccountData {
  ResultCode?: number | string;
  ResultDesc?: string;
  OldBalanceAmt?: number | string;
  NewBalanceAmt?: number | string;
  amountInGhc?: number | string;
  BalanceType?: string;
  BalanceTypeName?: string;
}

export interface AdjustAccountOutput {
  metadata: AdjustAccountResponse;
  data: AdjustAccountData;
}

/** One monetary balance entry in a combined account/free-unit adjustment. */
export interface AdjustBalanceAccount {
  balanceType: string;
  adjustmentAmt: number | string;
  adjustmentType?: number | string;
  currencyId?: number | string;
  expireTime?: string;
}

/** One free-unit entry, addressable by type or a specific instance ID. */
export interface AdjustFreeUnitAdjustment {
  freeUnitType?: string;
  freeUnitInstanceId?: number | string;
  adjustmentAmt: number | string;
  adjustmentType?: number | string;
  expireTime?: string;
  offsetUnit?: number | string;
  offsetValue?: number | string;
  selectInstanceMode?: number | string;
}

/** Sends monetary and free-unit entries together in one CBS AdjustmentRequest. */
export interface AdjustBalancesOptions extends CbsRequestOptions {
  accounts: AdjustBalanceAccount[];
  adjustments: AdjustFreeUnitAdjustment[];
  adjustmentReasonCode?: string;
  opType?: number | string;
  adjustmentSerialNo?: string;
}

export interface AdjustBalancesAccountResult {
  ResultCode?: number | string;
  ResultDesc?: string;
  OldBalanceAmt?: number | string;
  NewBalanceAmt?: number | string;
  BalanceType?: string;
  BalanceTypeName?: string;
}

export interface AdjustFreeUnitData {
  ResultCode?: number | string;
  ResultDesc?: string;
  OldBalanceAmt?: number | string;
  NewBalanceAmt?: number | string;
  FreeUnitType?: string;
  FreeUnitInstanceID?: number | string;
}

export interface AdjustBalancesOutput {
  metadata: AdjustAccountResponse;
  data: {
    ResultCode?: number | string;
    ResultDesc?: string;
    accounts: AdjustBalancesAccountResult[];
    adjustments: AdjustFreeUnitData[];
  };
}

export interface QuerySubLifeCycleOptions extends CbsRequestOptions {}

export interface QuerySubLifeCycleStatus {
  StatusName?: string;
  StatusExpireTime?: string | number;
  StatusIndex?: number | string;
  [key: string]: unknown;
}

export interface QuerySubLifeCycleResult {
  CurrentStatusIndex?: number | string;
  LifeCycleStatus?: QuerySubLifeCycleStatus | QuerySubLifeCycleStatus[];
  RBlacklistStatus?: number | string;
  FraudTimes?: number | string;
  StatusDetail?: string;
  [key: string]: unknown;
}

export interface QuerySubLifeCycleResponse {
  ResultHeader?: QueryCustomerInfoResultHeader;
  QuerySubLifeCycleResult?: QuerySubLifeCycleResult;
  [key: string]: unknown;
}

export interface QuerySubLifeCycleData {
  CurrentStatusIndex?: MappedCode<CurrentStatusLabel>;
  LifeCycleStatus?: QuerySubLifeCycleStatus | QuerySubLifeCycleStatus[];
  RBlacklistStatus?: number | string;
  FraudTimes?: number | string;
  StatusDetail?: string;
}

export interface QuerySubLifeCycleOutput {
  metadata: QuerySubLifeCycleResponse;
  data: QuerySubLifeCycleData;
}

export interface SubDeactivationOptions extends CbsRequestOptions {
  opType: string;
  /** @deprecated Subscriber deactivation uses MSISDN/PrimaryIdentity. */
  subscriberKey?: string;
  effectiveTime?: string;
}

export interface CbsOperationResponse {
  ResultHeader?: QueryCustomerInfoResultHeader;
  [key: string]: unknown;
}

export interface SubDeactivationResponse extends CbsOperationResponse {}

export interface SubDeactivationOutput {
  metadata: SubDeactivationResponse;
}

export interface DeleteNumberOptions extends CbsRequestOptions {
  /** @deprecated Subscriber deletion uses MSISDN/PrimaryIdentity. */
  subscriberKey?: string;
}

export interface DeleteNumberAmount {
  Amount?: number | string;
  amountInGhc?: number | string;
  CurrencyID?: number | string;
  BalanceType?: string;
  BalanceInstanceID?: string | number;
  EffectiveTime?: string | number;
  ExpireTime?: string | number;
  [key: string]: unknown;
}

export interface DeleteNumberResult {
  AcctBalance?: {
    AcctKey?: string | number;
    AmountList?: DeleteNumberAmount | DeleteNumberAmount[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DeleteNumberResponse extends CbsOperationResponse {
  SubDeactivationResult?: DeleteNumberResult;
}

export interface DeleteNumberData {
  ResultCode?: number | string;
  ResultDesc?: string;
  AmountList?: DeleteNumberAmount[];
}

export interface DeleteNumberOutput {
  metadata: DeleteNumberResponse;
  data: DeleteNumberData;
}

export interface CreateSubscriberAccountOptions extends CbsAccountInfo {
  accountKey: string;
  accountCode?: string;
  createAccount?: boolean;
  paymentRelationKey?: string;
  paymentType?: 0 | 1;
  defaultAccount?: boolean;
  priority?: number;
  onlyPayRelationFlag?: 'Y' | 'N';
  paymentLimitKey?: string;
}

export interface CbsRegisterCustomerOptions {
  opType?: string | number;
  customerKey?: string;
  customerType?: string | number;
  customerNodeType?: string | number;
  customerClass?: string | number;
  customerCode?: string;
}

export interface CreateSubscriberOptions extends CbsRequestOptions {
  customerKey?: string;
  registerCustomerOpType?: string | number;
  registerCustomer?: CbsRegisterCustomerOptions;
  subscriberKey?: string;
  offeringId: string | number;
  paymentMode?: 0 | 1 | 2;
  status?: string | number;
  primaryIdentity?: string;
  secondaryIdentity?: string;
  subscriberClass?: string | number;
  networkType?: string | number;
  offeringClass?: string;
  accounts?: CreateSubscriberAccountOptions[];
}

/** Options for creating a standalone regular prepaid subscriber keyed by its MSISDN. */
export interface CreateStandalonePrepaidSubscriberOptions extends CbsRequestOptions {
  offeringId: string | number;
  initialBalance?: string | number;
}

export interface CreateSubscriberResponse extends CbsOperationResponse {
  CreateSubscriberResult?: Record<string, unknown>;
}

export interface CreateSubscriberData {
  ResultCode?: number | string;
  ResultDesc?: string;
}

export interface CreateSubscriberOutput {
  metadata: CreateSubscriberResponse;
  data: CreateSubscriberData;
}

export interface SubActivationOptions extends CbsRequestOptions {
  /** @deprecated Subscriber activation uses MSISDN/PrimaryIdentity. */
  subscriberKey?: string;
}

export interface SubActivationResponse extends CbsOperationResponse {}

export interface SubActivationOutput {
  metadata: SubActivationResponse;
  data: { ResultCode?: number | string; ResultDesc?: string };
}

/**
 * @deprecated Use deleteNumber, a typed subscriber creation method, and
 * subActivate explicitly so each destructive step is visible to the caller.
 */
export type PoolActivationOptions = CreateSubscriberOptions;

export interface PoolActivationOutput {
  query: QueryCustomerInfoOutput;
  deletion: DeleteNumberOutput;
  creation: CreateSubscriberOutput;
  activation: SubActivationOutput;
}

export type SubscriberStatus = 'ACTIVE' | 'CALL_BARRING' | 'SUSPEND';

export type ChangeSubscriberStatusOperation =
  | 'CUSTOMER_RESUME'
  | 'CUSTOMER_BARRING'
  | 'CUSTOMER_SUSPENSION'
  | 'ARREARS_RESUME'
  | 'ARREARS_BARRING'
  | 'ARREARS_SUSPENSION'
  | 'CREDIT_CONTROL_RESUME'
  | 'CREDIT_CONTROL_BARRING'
  | 'CREDIT_CONTROL_SUSPENSION'
  | 'OPERATOR_RESUME'
  | 'OPERATOR_BARRING'
  | 'OPERATOR_SUSPENSION';

export interface ChangeSubscriberStatusOptions extends CbsRequestOptions {
  status: SubscriberStatus;
  /** Defaults to the customer-request operation for the requested status. */
  operation?: ChangeSubscriberStatusOperation;
  /** @deprecated Subscriber status changes use MSISDN/PrimaryIdentity. */
  subscriberKey?: string;
}

export interface ChangeSubscriberStatusResponse extends CbsOperationResponse {
  ChangeSubStatusResult?: Record<string, unknown>;
}

export interface ChangeSubscriberStatusOutput {
  metadata: ChangeSubscriberStatusResponse;
  data: { ResultCode?: number | string; ResultDesc?: string; Status?: number };
}

export interface QueryXTransactionOptions extends CbsRequestOptions {
  subscriberKey?: string;
}

export interface QueryXTransactionResult {
  [key: string]: unknown;
}

export interface QueryXTransactionResponse extends CbsOperationResponse {
  QueryLastXTransactionResult?: QueryXTransactionResult;
}

export interface QueryXTransactionOutput {
  metadata: QueryXTransactionResponse;
  data: QueryXTransactionResult;
}

export interface QueryTransactionOptions extends CbsRequestOptions {
  /** CBS transaction start time, in the configured CBS time format. */
  startTime?: string;
  /** CBS transaction end time, in the configured CBS time format. */
  endTime?: string;
  /** Total matching rows from the previous response; leave at 0 for the first page. */
  totalRows?: number;
  /** Zero-based index of the first row to return; defaults to 0. */
  startRow?: number;
  /** Rows per page. CBS allows values from 1 through 1000; defaults to 50. */
  pageSize?: number;
}

export interface QueryTransactionRecord {
  'ars:AcctKey'?: string;
  'ars:AcctCode'?: string;
  'ars:CustKey'?: string;
  'ars:SubKey'?: string;
  'ars:PrimaryIdentity'?: string;
  'ars:AccountBalance'?: string;
  'ars:TransType'?: string;
  'ars:ChannelID'?: string;
  'ars:TransAmount'?: string;
  'ars:TaxAmount'?: string;
  'ars:CurrencyID'?: string;
  'ars:TransTime'?: string;
  'ars:TransID'?: string;
  'ars:SrcTransID'?: string;
  'ars:ExtTransID'?: string;
  'ars:OperID'?: string;
  'ars:OperAccount'?: string;
  'ars:DeptID'?: string;
  'ars:DeptCode'?: string;
  'ars:ReasonCode'?: string;
  'ars:Status'?: string;
  'ars:Remark'?: string;
  'ars:AdditionalProperty'?:
    | QueryTransactionAdditionalProperty
    | QueryTransactionAdditionalProperty[];
  [key: string]: unknown;
}

export interface QueryTransactionAdditionalProperty {
  'arc:Code'?: string;
  'arc:Value'?: string;
  [key: string]: unknown;
}

export interface QueryTransactionResult {
  'ars:TransactionInfo'?: QueryTransactionRecord | QueryTransactionRecord[];
  'ars:TotalRowNum'?: string | number;
  'ars:BeginRowNum'?: string | number;
  'ars:FetchRowNum'?: string | number;
  [key: string]: unknown;
}

export interface QueryTransactionResponse extends CbsOperationResponse {
  QueryTransactionResult?: QueryTransactionResult;
}

export interface QueryTransactionOutput {
  metadata: QueryTransactionResponse;
  /** Unmodified CBS query result, including namespaced fields not modeled here. */
  data: QueryTransactionResult;
  /** TransactionInfo normalized to an array, including when CBS returns one record. */
  transactions: QueryTransactionRecord[];
  /** Normalized paging values; omitted when CBS does not return a valid value. */
  pagination: {
    totalRows?: number;
    startRow: number;
    pageSize: number;
    rowsReturned: number;
  };
}

export type QueryRechargeLogInnerType = '0' | '1' | '2' | '3';
export type QueryRechargeLogResultFilter = 0 | 1;

export interface QueryRechargeLogOptions extends CbsRequestOptions {
  /** Required CBS recharge record start time, in the configured CBS time format. */
  startTime: string;
  /** Required CBS recharge record end time, in the configured CBS time format. */
  endTime: string;
  /** Total matching rows from the previous response; leave at 0 for the first page. */
  totalRows?: number;
  /** Zero-based index of the first row to return; defaults to 0. */
  startRow?: number;
  /** Rows per page. CBS allows values from 1 through 500; defaults to 50. */
  pageSize?: number;
  /** External CBS recharge transaction identifier. */
  extTransId?: string;
  /** Site-configured external recharge type. Mutually exclusive with innerRechargeType. */
  rechargeType?: string;
  /** CBS internal type: UVC voucher, cash, EVC, or cash reversal. */
  innerRechargeType?: QueryRechargeLogInnerType;
  /** 0 selects failed records; 1 selects successful records. */
  rechargeResult?: QueryRechargeLogResultFilter;
  /** CBS recharge channel identifiers to include. */
  rechargeChannelIds?: string[];
  /** Select subscriber-only records when true; false selects the default-account view. */
  subscriberLevelOnly?: boolean;
}

export interface QueryRechargeLogAdditionalProperty {
  'arc:Code'?: string;
  'arc:Value'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogCardInfo {
  'arc:CardPinNumber'?: string;
  'arc:CardSequence'?: string;
  'arc:CardType'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBankInfo {
  'arc:BankCode'?: string;
  'arc:BankBranchCode'?: string;
  'arc:AcctType'?: string;
  'arc:AcctNo'?: string;
  'arc:CreditCardType'?: string;
  'arc:AcctName'?: string;
  'arc:ExpDate'?: string;
  'arc:CVVNumber'?: string;
  'arc:CheckNo'?: string;
  'arc:CheckDate'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogLifeCycleStatus {
  'ars:StatusName'?: string;
  'ars:StatusExpireTime'?: string;
  'ars:StatusIndex'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogLifeCycleChange {
  'ars:OldLifeCycleStatus'?: QueryRechargeLogLifeCycleStatus | QueryRechargeLogLifeCycleStatus[];
  'ars:NewLifeCycleStatus'?: QueryRechargeLogLifeCycleStatus | QueryRechargeLogLifeCycleStatus[];
  'ars:ChgValidity'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBalanceChange {
  'arc:BalanceType'?: string;
  'arc:BalanceID'?: string;
  'arc:BalanceTypeName'?: string;
  'arc:OldBalanceAmt'?: string;
  'arc:NewBalanceAmt'?: string;
  'arc:CurrencyID'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogFreeUnitChange {
  'arc:FreeUnitInstanceID'?: string;
  'arc:FreeUnitType'?: string;
  'arc:FreeUnitTypeName'?: string;
  'arc:MeasureUnit'?: string;
  'arc:MeasureUnitName'?: string;
  'arc:OldAmt'?: string;
  'arc:NewAmt'?: string;
  'arc:EffectiveTime'?: string;
  'arc:ExpireTime'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBonusFreeUnit {
  'ars:FreeUnitID'?: string;
  'ars:FreeUnitType'?: string;
  'ars:FreeUnitTypeName'?: string;
  'ars:MeasureUnit'?: string;
  'ars:MeasureUnitName'?: string;
  'ars:BonusAmt'?: string;
  'ars:EffectiveTime'?: string;
  'ars:ExpireTime'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBonusBalance {
  'ars:BalanceType'?: string;
  'ars:BalanceID'?: string;
  'ars:BalanceTypeName'?: string;
  'ars:BonusAmt'?: string;
  'ars:CurrencyID'?: string;
  'ars:EffectiveTime'?: string;
  'ars:ExpireTime'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBonusOffering {
  'ars:Offeringid'?: string;
  'ars:OwnerType'?: string;
  'ars:OwnerKey'?: string;
  'ars:EffectiveTime'?: string;
  'ars:ExpireTime'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogBonus {
  'ars:FreeUnitItemList'?: QueryRechargeLogBonusFreeUnit | QueryRechargeLogBonusFreeUnit[];
  'ars:BalanceList'?: QueryRechargeLogBonusBalance | QueryRechargeLogBonusBalance[];
  'ars:Bonusofferlist'?: QueryRechargeLogBonusOffering | QueryRechargeLogBonusOffering[];
  [key: string]: unknown;
}

export interface QueryRechargeLogCreditChange {
  'arc:CreditLimitID'?: string;
  'arc:CreditLimitType'?: string;
  'arc:CreditLimitTypeName'?: string;
  'arc:OldLeftCreditAmt'?: string;
  'arc:NewLeftCreditAmt'?: string;
  'arc:MeasureUnit'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogLoanPayment {
  'ars:PaidLoanAmount'?: string;
  'ars:PaidLoanPoundage'?: string;
  'ars:PaidLoanPenalty'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogRecord {
  'ars:TradeTime'?: string;
  'ars:AcctKey'?: string;
  'ars:SubKey'?: string;
  'ars:PrimaryIdentity'?: string;
  'ars:TransID'?: string;
  'ars:ExtTransID'?: string;
  'ars:RechargeAmount'?: string;
  'ars:CurrencyID'?: string;
  'ars:OriAmount'?: string;
  'ars:OriCurrencyID'?: string;
  'ars:CurrencyRate'?: string;
  'ars:RechargeTax'?: string;
  'ars:RechargePenalty'?: string;
  'ars:RechargeType'?: string;
  'ars:ExtRechargeType'?: string;
  'ars:RechargeChannelID'?: string;
  'ars:RechargeReason'?: string;
  'ars:OperID'?: string;
  'ars:OperAccount'?: string;
  'ars:DeptID'?: string;
  'ars:DeptCode'?: string;
  'ars:ResultCode'?: string;
  'ars:ReversalFlag'?: string;
  'ars:ReversalTransId'?: string;
  'ars:ReversalReason'?: string;
  'ars:ReversalTime'?: string;
  'ars:ReversalOpID'?: string;
  'ars:ReversalOperAccount'?: string;
  'ars:ReversalDeptID'?: string;
  'ars:ReversalDeptCode'?: string;
  'ars:CardInfo'?: QueryRechargeLogCardInfo;
  'ars:BankInfo'?: QueryRechargeLogBankInfo;
  'ars:LifeCycleChgInfo'?: QueryRechargeLogLifeCycleChange;
  'ars:BalanceChgInfo'?: QueryRechargeLogBalanceChange;
  'ars:RechargeBonus'?: QueryRechargeLogBonus;
  'ars:AdditionalProperty'?:
    | QueryRechargeLogAdditionalProperty
    | QueryRechargeLogAdditionalProperty[];
  'ars:CreditChgInfo'?: QueryRechargeLogCreditChange;
  'ars:LoanPaymentList'?: QueryRechargeLogLoanPayment;
  'ars:FreeUnitChgInfo'?: QueryRechargeLogFreeUnitChange;
  'ars:Remark'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogSummary {
  'ars:CurrencyID'?: string;
  'ars:SumAmount'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogResult {
  'ars:RechargeInfo'?: QueryRechargeLogRecord | QueryRechargeLogRecord[];
  'ars:RechargeSumList'?: QueryRechargeLogSummary | QueryRechargeLogSummary[];
  'ars:TotalRowNum'?: string | number;
  'ars:BeginRowNum'?: string | number;
  'ars:FetchRowNum'?: string | number;
  [key: string]: unknown;
}

export interface QueryRechargeLogResultHeader extends QueryCustomerInfoResultHeader {
  'cbs:Version'?: string;
  'cbs:ResultCode'?: string;
  'cbs:MsgLanguageCode'?: string;
  'cbs:ResultDesc'?: string;
  [key: string]: unknown;
}

export interface QueryRechargeLogResponse extends CbsOperationResponse {
  ResultHeader?: QueryRechargeLogResultHeader;
  QueryRechargeLogResult?: QueryRechargeLogResult;
}

export interface QueryRechargeLogOutput {
  metadata: QueryRechargeLogResponse;
  /** Unmodified CBS query result, including nested and deployment-specific fields. */
  data: QueryRechargeLogResult;
  /** RechargeInfo normalized to an array, including when CBS returns one record. */
  recharges: QueryRechargeLogRecord[];
  /** Normalized paging values; omitted when CBS does not return a valid total. */
  pagination: {
    totalRows?: number;
    startRow: number;
    pageSize: number;
    rowsReturned: number;
  };
}

export interface QueryRefundLogOptions extends CbsRequestOptions {
  /** CBS refund log start time in the configured time format. */
  startTime?: string;
  /** CBS refund log end time in the configured time format. */
  endTime?: string;
  /** Total matching rows from the previous response; leave at 0 for the first page. */
  totalRows?: number;
  /** Zero-based index of the first row to return; defaults to 0. */
  startRow?: number;
  /** Rows per page. CBS allows values from 1 through 1000; defaults to 50. */
  pageSize?: number;
}

/** CBS origin of the refunded credit: PAYMENT, OVERPAYMENT, or DEPOSIT. */
export type QueryRefundLogCreditConsumeRule = 'P' | 'O' | 'D';

/** CBS refund method: debit card, credit card, cash, or check. */
export type QueryRefundLogPaymentMethod = 'D' | 'C' | 'A' | 'E';

export interface QueryRefundLogAdditionalProperty {
  'arc:Code'?: string;
  'arc:Value'?: string;
  [key: string]: unknown;
}

export interface QueryRefundLogBankInfo {
  'arc:BankCode'?: string;
  'arc:BankBranchCode'?: string;
  'arc:AcctType'?: string;
  'arc:AcctNo'?: string;
  'arc:CreditCardType'?: string;
  'arc:AcctName'?: string;
  'arc:ExpDate'?: string;
  'arc:CVVNumber'?: string;
  'arc:CheckNo'?: string;
  'arc:CheckDate'?: string;
  [key: string]: unknown;
}

export interface QueryRefundLogChannel {
  'ars:PaymentMethod'?: QueryRefundLogPaymentMethod;
  'ars:BankInfo'?: QueryRefundLogBankInfo;
  [key: string]: unknown;
}

export interface QueryRefundLogRecord {
  'ars:AcctKey'?: string;
  'ars:RefundId'?: string;
  'ars:RefundTime'?: string;
  'ars:RefundAmount'?: string;
  'ars:CurrencyID'?: string;
  'ars:CreditConsumeRule'?: QueryRefundLogCreditConsumeRule;
  'ars:Reason'?: string;
  'ars:OperID'?: string;
  'ars:OperAccount'?: string;
  'ars:DeptID'?: string;
  'ars:DeptCode'?: string;
  'ars:Status'?: string;
  'ars:RefundChannel'?: QueryRefundLogChannel;
  'ars:Remark'?: string;
  'ars:AdditionalProperty'?: QueryRefundLogAdditionalProperty | QueryRefundLogAdditionalProperty[];
  'ars:RefundSerialNo'?: string;
  [key: string]: unknown;
}

export interface QueryRefundLogResult {
  'ars:RefundLogInfo'?: QueryRefundLogRecord | QueryRefundLogRecord[];
  'ars:TotalRowNum'?: string | number;
  'ars:BeginRowNum'?: string | number;
  'ars:FetchRowNum'?: string | number;
  [key: string]: unknown;
}

export interface QueryRefundLogResultHeader extends QueryCustomerInfoResultHeader {
  'cbs:Version'?: string;
  'cbs:ResultCode'?: string;
  'cbs:MsgLanguageCode'?: string;
  'cbs:ResultDesc'?: string;
  [key: string]: unknown;
}

export interface QueryRefundLogResponse extends CbsOperationResponse {
  'ars:ResultHeader'?: QueryRefundLogResultHeader;
  'ars:QueryRefundLogResult'?: QueryRefundLogResult;
  ResultHeader?: QueryRefundLogResultHeader;
  QueryRefundLogResult?: QueryRefundLogResult;
}

export interface QueryRefundLogOutput {
  metadata: QueryRefundLogResponse;
  /** Unmodified CBS query result, including nested and deployment-specific fields. */
  data: QueryRefundLogResult;
  /** RefundLogInfo normalized to an array, including when CBS returns one record. */
  refunds: QueryRefundLogRecord[];
  /** Normalized paging values; totalRows is omitted when CBS does not return a valid total. */
  pagination: {
    totalRows?: number;
    startRow: number;
    pageSize: number;
    rowsReturned: number;
  };
}

export interface QueryCdrDetailOptions extends CbsRequestOptions {}

export interface QueryCdrDetailResult {
  [key: string]: unknown;
}

export interface QueryCdrDetailResponse extends CbsOperationResponse {
  QueryCDRDetailResult?: QueryCdrDetailResult;
}

export interface QueryCdrDetailOutput {
  metadata: QueryCdrDetailResponse;
  data: QueryCdrDetailResult;
}

export interface CustActivationOptions extends CbsRequestOptions {
  primaryIdentity?: string;
  customerKey?: string | number;
  customerCode?: string;
}

export interface AcctDeactivationOptions extends CbsRequestOptions {
  opType: string;
  primaryIdentity?: string;
  accountKey?: string;
  accountCode?: string;
  payType?: string | number;
}

export interface AcctDeactivationResponse extends CbsOperationResponse {}

export interface AcctDeactivationOutput {
  metadata: AcctDeactivationResponse;
}

export interface CustActivationResponse extends CbsOperationResponse {}

export interface CustActivationOutput {
  metadata: CustActivationResponse;
}

export interface CustDeactivationOptions extends CbsRequestOptions {
  opType: string;
  primaryIdentity?: string;
  customerKey?: string | number;
  customerCode?: string;
  effectiveTime?: string;
}

export interface CustDeactivationResponse extends CbsOperationResponse {}

export interface CustDeactivationOutput {
  metadata: CustDeactivationResponse;
}

/** Readable aliases for values returned by CBS. */
export const PaymentModeCode = {
  PREPAID: 0,
  POSTPAID: 1,
  HYBRID: 2,
} as const;

export const SubscriberStatusCode = {
  IDLE: 1,
  ACTIVE: 2,
  CALL_BARRING: 3,
  SUSPEND: 4,
  TESTED: 6,
  IN_STOCK: 7,
  PRE_DEREGISTRATION: 8,
} as const;

/** Named aliases for the defaults used by this client’s deployment. */
export const CbsRequestDefaults = {
  VERSION: 1,
  BE_ID: '101',
  OPERATOR_ID: '101',
  ACCESS_MODE: 3,
  MSG_LANGUAGE_CODE: 2002,
  TIME_TYPE: 1,
  QUERY_MODE: 0,
  CUSTOMER_MASK: '1100',
  ACCOUNT_MASK: '11',
  SUBSCRIBER_MASK: '11111110',
  GROUP_MASK: '00000',
  SUBSCRIBER_STATUS: 1,
  PAYMENT_RELATION_EXPIRATION_TIME: '20361231160000',
} as const;
