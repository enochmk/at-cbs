import type {
  CbsClientOptions,
  QueryCustomerInfoOptions,
  QueryCustomerInfoOutput,
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
      rejectUnauthorized: true,
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

  queryBalance(msisdn: string, opts?: QueryBalanceOptions): Promise<QueryBalanceOutput> {
    return this.arServices.queryBalance(msisdn, opts);
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
