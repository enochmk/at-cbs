export interface CbsClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  successCode?: string;
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

export interface ResultHeader {
  CommandId?: string;
  Version?: number;
  TransactionId?: string;
  SequenceId?: number;
  ResultCode?: string;
  ResultDesc?: string;
}

export interface BalanceRecord {
  BalanceDesc?: string;
  Balance?: number;
  MinMeasureId?: number;
  UnitType?: number;
  AccountType?: number;
  ExpireTime?: string;
  AccountCredit?: number;
  AccountKey?: string;
  ProductID?: string | null;
}

export interface SubscriberState {
  FirstActiveDate?: string | null;
  ActiveCAC?: string | null;
  ActiveStop?: string;
  SuspendStop?: string;
  DisableStop?: string;
  LifeCycleState?: number;
  DPFlag?: number;
  FraudState?: number;
  LossFlag?: number;
  POSUserState?: string | null;
  LockedFlag?: number;
  DPEndDate?: string | null;
  ETUFraudState?: number;
  Oldbalance?: number;
}

export interface BillingCycleDate {
  BillCycleOpenDate?: string;
  BillCycleEndDate?: string;
  BillCycleType?: number;
}

export interface SimpleProperty {
  Id?: string;
  Value?: string;
}

export interface Subscriber {
  Code?: string;
  BrandId?: number;
  RegistrationTime?: string;
  Lang?: number;
  SMSLang?: number;
  USSDLang?: number;
  PaidMode?: number;
  InitialCredit?: string | null;
  BelToAreaID?: string | null;
  MainProductID?: number;
  SimpleProperty?: SimpleProperty[];
  IMSI?: string;
}

export interface Product {
  Id?: number;
  ProductOrderKey?: string;
  EffectiveDate?: string;
  ExpiredDate?: string;
  Status?: number;
}

export interface Service {
  Id?: number;
  Status?: number;
  RegistrationTime?: string;
}

export interface SubscriberInfo {
  Subscriber?: Subscriber;
  Product?: Product[];
  Service?: Service[];
}

export interface SubAttachedInfo {
  LoanLateFee?: number;
  LoanDueDate?: string;
  ChgMainProductTimes?: number;
  ChgMainPackageTimes?: number;
}

export interface Customer {
  Name?: string;
  Code?: string;
  Gender?: string;
  Birthday?: string;
  Address?: string;
  Grade?: number;
  CustomerType?: number;
  CreditAmount?: number;
  CustomerState?: number;
}

export interface CumulativeItem {
  CumulateID?: number;
  CumulateBeginTime?: string;
  CumulateEndTime?: string;
  CumulativeAmt?: number;
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
  PrimaryOffering?: QueryCustomerInfoPrimaryOffering;
  billingInfo?: {
    subscriberAccounts?: Record<string, unknown> | Record<string, unknown>[];
    account?: QueryCustomerInfoAccount;
  };
}

export interface QueryCustomerInfoOutput {
  metadata: QueryCustomerInfoResponse;
  data: QueryCustomerInfoData;
}

export interface CreateSubscriberOptions {
  requestId?: number;
  remark?: string;
  remoteAddress?: string;
  lang?: number;
  paidMode?: '0' | '1' | '2';
  mainProductId?: string;
}

export interface DeleteSubscriberOptions {
  requestId?: number;
  remark?: string;
  remoteAddress?: string;
}

export interface DeleteSubscriberResult {
  ResultHeader?: ResultHeader;
}

export interface DeleteSubscriberResponse {
  ResultHeader?: ResultHeader;
  DeleteSubscriberResult?: DeleteSubscriberResult;
}

export interface ProductOrderInfo {
  ProductID?: number;
  ProductOrderKey?: string;
  EffectiveDate?: string;
  ExpireDate?: string;
  AutoType?: number;
}

export interface NewSubscriberResult {
  ProductOrderInfo?: ProductOrderInfo[];
}

export interface NewSubscriberResponse {
  ResultHeader?: ResultHeader;
  NewSubscriberResult?: NewSubscriberResult;
}

export interface SubscribeAppendantProductOptions {
  requestId?: number;
  remark?: string;
  remoteAddress?: string;
  validMode?: string;
}

export interface UnSubscribeAppendantProductOptions {
  requestId?: number;
  remark?: string;
  remoteAddress?: string;
  validMode?: string;
}

export interface SubscribeAppendantProductResult {
  ProductOrderInfo?: ProductOrderInfo[];
}

export interface SubscribeAppendantProductResponse {
  ResultHeader?: ResultHeader;
  SubscribeAppendantProductResult?: SubscribeAppendantProductResult;
}

export interface UnSubscribeAppendantProductResult {
  // response confirmation, typically empty or minimal
}

export interface UnSubscribeAppendantProductResponse {
  ResultHeader?: ResultHeader;
  UnSubscribeAppendantProductResult?: UnSubscribeAppendantProductResult;
}

export interface QueryBasicInfoOptions {
  requestId?: number;
  remoteAddress?: string;
}

export interface QueryBasicInfoCustomer {
  Name?: string;
  Code?: string;
  IdType?: string | null;
  IdCode?: string | null;
  Gender?: string;
  Birthday?: string;
  Address?: string;
  Grade?: number;
  BelToAreaID?: string | null;
  Email?: string | null;
  ZipCode?: string | null;
  RegistrationTime?: string;
  CustomerType?: number;
  Country?: string | null;
  NativePlace?: string | null;
  NationType?: string | null;
  JobType?: string | null;
  Education?: string | null;
  CreditGrade?: string | null;
  CreditAmount?: number;
  CustomerState?: number;
  MaritalStatus?: string | null;
  Skill?: string | null;
  SocialNo?: string | null;
  CustManagerID?: string | null;
}

export interface QueryBasicInfoResult {
  Customer?: QueryBasicInfoCustomer;
}

export interface QueryBasicInfoResponse {
  ResultHeader?: ResultHeader;
  QueryBasicInfoResult?: QueryBasicInfoResult;
}
