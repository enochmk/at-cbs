import type {
  CbsClientOptions,
  QueryCustomerInfoOptions,
  QueryCustomerInfoOutput,
  QueryCustomerInfoKey,
  CreateCustomerOptions,
  CreateAccountOptions,
  CreateSubscriberRequestOptions,
  ChangeSubscriberOfferingOptions,
  ChangeSubscriberPaymentModeOptions,
  ChangeAccountCreditLimitOptions,
  ChangePaymentRelationOptions,
  CbsMutationOutput,
  QueryBalanceOptions,
  QueryBalanceOutput,
  QuerySubLifeCycleOptions,
  QuerySubLifeCycleOutput,
  SubDeactivationOptions,
  SubDeactivationOutput,
  QueryXTransactionOptions,
  QueryXTransactionOutput,
  QueryCdrDetailOptions,
  QueryCdrDetailOutput,
  CustActivationOptions,
  CustActivationOutput,
  CustDeactivationOptions,
  CustDeactivationOutput,
  AdjustAccountOptions,
  AdjustAccountOutput,
  SubscribeAppendantProductOptions,
  SubscribeAppendantProductOutput,
  UnsubscribeAppendantProductOptions,
  UnsubscribeAppendantProductOutput,
  DeleteNumberOptions,
  DeleteNumberOutput,
  CreateSubscriberOptions,
  CreateSubscriberOutput,
  SubActivationOptions,
  SubActivationOutput,
  PoolActivationOptions,
  PoolActivationOutput,
  ChangeSubscriberStatusOptions,
  ChangeSubscriberStatusOutput,
} from './types';
import { CbsTransport } from './cbs-transport';
import { ArServices } from './services/ar-services';
import { BbServices } from './services/bb-services';
import { BcServices } from './services/bc-services';

/** Public facade for the CBS API, grouped internally by SOAP service endpoint. */
export class CbsClient {
  private readonly opts: Required<CbsClientOptions>;
  private readonly transport: CbsTransport;
  private readonly bcServices: BcServices;
  private readonly arServices: ArServices;
  private readonly bbServices: BbServices;

  constructor(options: CbsClientOptions) {
    this.opts = {
      timeout: 15000,
      // CBS deployments commonly use an internal/self-signed certificate.
      // Callers can opt into strict TLS validation with true.
      rejectUnauthorized: false,
      logger: {},
      ...options,
    };
    this.transport = new CbsTransport(this.opts);
    this.bcServices = new BcServices(this.opts, this.transport);
    this.arServices = new ArServices(this.opts, this.transport);
    this.bbServices = new BbServices(this.opts, this.transport);
  }

  queryCustomerInfo(
    msisdn: string,
    opts?: QueryCustomerInfoOptions,
  ): Promise<QueryCustomerInfoOutput> {
    return this.bcServices.queryCustomerInfo(msisdn, opts);
  }

  queryCustomerInfoByKey(
    key: QueryCustomerInfoKey,
    opts?: QueryCustomerInfoOptions,
  ): Promise<QueryCustomerInfoOutput> {
    return this.bcServices.queryCustomerInfoByKey(key, opts);
  }

  createCustomer(opts: CreateCustomerOptions): Promise<CbsMutationOutput> {
    return this.bcServices.createCustomer(opts);
  }

  createAccount(opts: CreateAccountOptions): Promise<CbsMutationOutput> {
    return this.bcServices.createAccount(opts);
  }

  createSubscriberForAccount(opts: CreateSubscriberRequestOptions): Promise<CbsMutationOutput> {
    return this.bcServices.createSubscriberForAccount(opts);
  }

  changeSubscriberOffering(opts: ChangeSubscriberOfferingOptions): Promise<CbsMutationOutput> {
    return this.bcServices.changeSubscriberOffering(opts);
  }

  changeSubscriberPaymentMode(
    opts: ChangeSubscriberPaymentModeOptions,
  ): Promise<CbsMutationOutput> {
    return this.bcServices.changeSubscriberPaymentMode(opts);
  }

  changeAccountCreditLimit(opts: ChangeAccountCreditLimitOptions): Promise<CbsMutationOutput> {
    return this.bcServices.changeAccountCreditLimit(opts);
  }

  changePaymentRelation(opts: ChangePaymentRelationOptions): Promise<CbsMutationOutput> {
    return this.bcServices.changePaymentRelation(opts);
  }

  queryBalance(msisdn: string, opts?: QueryBalanceOptions): Promise<QueryBalanceOutput> {
    return this.arServices.queryBalance(msisdn, opts);
  }

  adjustAccount(msisdn: string, opts?: AdjustAccountOptions): Promise<AdjustAccountOutput> {
    return this.arServices.adjustAccount(msisdn, opts);
  }

  subscribeAppendantProduct(
    msisdn: string,
    opts: SubscribeAppendantProductOptions,
  ): Promise<SubscribeAppendantProductOutput> {
    return this.bcServices.subscribeAppendantProduct(msisdn, opts);
  }

  unsubscribeAppendantProduct(
    msisdn: string,
    opts: UnsubscribeAppendantProductOptions,
  ): Promise<UnsubscribeAppendantProductOutput> {
    return this.bcServices.unsubscribeAppendantProduct(msisdn, opts);
  }

  querySubLifeCycle(
    msisdn: string,
    opts?: QuerySubLifeCycleOptions,
  ): Promise<QuerySubLifeCycleOutput> {
    return this.bcServices.querySubLifeCycle(msisdn, opts);
  }

  subDeactivation(msisdn: string, opts: SubDeactivationOptions): Promise<SubDeactivationOutput> {
    return this.bcServices.subDeactivation(msisdn, opts);
  }

  deleteNumber(msisdn: string, opts?: DeleteNumberOptions): Promise<DeleteNumberOutput> {
    return this.bcServices.deleteNumber(msisdn, opts);
  }

  createPrepaidSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.bcServices.createPrepaidSubscriber(msisdn, opts);
  }

  createHybridSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.bcServices.createHybridSubscriber(msisdn, opts);
  }

  createPostpaidSubscriber(
    msisdn: string,
    opts: CreateSubscriberOptions,
  ): Promise<CreateSubscriberOutput> {
    return this.bcServices.createPostpaidSubscriber(msisdn, opts);
  }

  subActivate(msisdn: string, opts?: SubActivationOptions): Promise<SubActivationOutput> {
    return this.bcServices.subActivate(msisdn, opts);
  }

  poolActivation(msisdn: string, opts: PoolActivationOptions): Promise<PoolActivationOutput> {
    return this.bcServices.poolActivation(msisdn, opts);
  }

  changeSubscriberStatus(
    msisdn: string,
    opts: ChangeSubscriberStatusOptions,
  ): Promise<ChangeSubscriberStatusOutput> {
    return this.bcServices.changeSubscriberStatus(msisdn, opts);
  }

  queryXTransaction(
    msisdn: string,
    opts?: QueryXTransactionOptions,
  ): Promise<QueryXTransactionOutput> {
    return this.bcServices.queryXTransaction(msisdn, opts);
  }

  queryCdrDetail(
    primaryIdentity: string,
    cdrSeq: string | number,
    opts?: QueryCdrDetailOptions,
  ): Promise<QueryCdrDetailOutput> {
    return this.bbServices.queryCdrDetail(primaryIdentity, cdrSeq, opts);
  }

  custActivation(opts: CustActivationOptions): Promise<CustActivationOutput> {
    return this.bcServices.custActivation(opts);
  }

  custDeactivation(opts: CustDeactivationOptions): Promise<CustDeactivationOutput> {
    return this.bcServices.custDeactivation(opts);
  }
}
