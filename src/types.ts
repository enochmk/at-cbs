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

export interface QueryCustomerInfoSubscriber {
  SubscriberKey?: string | number;
  SubscriberInfo?: Record<string, unknown>;
  PaymentMode?: number | string;
  PrimaryOffering?: QueryCustomerInfoPrimaryOffering;
  LifeCycleDetail?: QueryCustomerInfoLifeCycleDetail;
  ActivationTime?: string;
  AcctList?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

export interface QueryCustomerInfoMainBalance {
  BalanceType: 'C_MAIN_ACCOUNT';
  BalanceTypeName: 'PPS_MainAccount';
  TotalAmount?: number | string;
  InitialAmount?: number | string;
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
  CurrentStatusIndex?: MappedCode<CurrentStatusLabel>;
  BirthdayDate?: string;
  MainBalance?: QueryCustomerInfoMainBalance;
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
  BalanceType?: string;
  BalanceTypeName?: string;
}

export interface AdjustAccountOutput {
  metadata: AdjustAccountResponse;
  data: AdjustAccountData;
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
} as const;
