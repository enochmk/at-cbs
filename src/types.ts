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

export interface QueryCustomerInfoOptions {
  messageSeq?: string;
  beId?: string;
  operatorId?: string;
  accessMode?: number;
  msgLanguageCode?: number;
  timeType?: number;
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
  OfferingKey?: Record<string, unknown>;
  BundledFlag?: string;
  OfferingClass?: string;
  Status?: number | string;
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

export interface QueryBalanceOptions {
  messageSeq?: string;
  beId?: string;
}

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

export interface QuerySubLifeCycleOptions {
  messageSeq?: string;
  beId?: string;
}

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

export interface SubDeactivationOptions {
  opType: string;
  messageSeq?: string;
  beId?: string;
  operatorId?: string;
  accessMode?: number;
  msgLanguageCode?: number;
  timeType?: number;
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

export interface QueryXTransactionOptions {
  messageSeq?: string;
  beId?: string;
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

export interface CustDeactivationOptions {
  opType: string;
  primaryIdentity?: string;
  customerKey?: string | number;
  customerCode?: string;
  messageSeq?: string;
  beId?: string;
  operatorId?: string;
  accessMode?: number;
  msgLanguageCode?: number;
  timeType?: number;
  effectiveTime?: string;
}

export interface CustDeactivationResponse extends CbsOperationResponse {}

export interface CustDeactivationOutput {
  metadata: CustDeactivationResponse;
}
