import createHttpError from 'http-errors';

import type { CbsClientOptions, CustActivationOptions, CustDeactivationOptions } from '../types';
import { CbsTransport } from '../cbs-transport';

export abstract class CbsServiceBase {
  protected abstract readonly servicePath: string;

  constructor(
    protected readonly opts: Required<CbsClientOptions>,
    protected readonly transport: CbsTransport,
  ) {}

  protected log(level: string, msg: string, ctx?: Record<string, unknown>): void {
    this.transport.log(level, msg, ctx);
  }

  protected normalizeMsisdn(msisdn: string): string {
    const digits = msisdn.replace(/\D/g, '');
    if (![9, 10, 12].includes(digits.length)) {
      throw createHttpError(400, 'MSISDN must be 9, 10, or 12 digits');
    }
    return digits.slice(-9);
  }

  protected getSubscriberAccessCode(msisdn: string, subscriberKey?: string): string {
    if (subscriberKey) {
      return `<bcc:SubscriberKey>${subscriberKey}</bcc:SubscriberKey>`;
    }
    return `<bcc:PrimaryIdentity>${this.normalizeMsisdn(msisdn)}</bcc:PrimaryIdentity>`;
  }

  protected getCustomerAccessCode(opts: CustActivationOptions | CustDeactivationOptions): string {
    const accessCodes = [opts.primaryIdentity, opts.customerKey, opts.customerCode].filter(
      (value) => value !== undefined && value !== '',
    );

    if (accessCodes.length !== 1) {
      throw createHttpError(
        400,
        'Provide exactly one of primaryIdentity, customerKey, or customerCode',
      );
    }

    if (opts.primaryIdentity !== undefined && opts.primaryIdentity !== '') {
      return `<bcc:PrimaryIdentity>${opts.primaryIdentity}</bcc:PrimaryIdentity>`;
    }
    if (opts.customerKey !== undefined && opts.customerKey !== '') {
      return `<bcc:CustomerKey>${opts.customerKey}</bcc:CustomerKey>`;
    }
    return `<bcc:CustomerCode>${opts.customerCode}</bcc:CustomerCode>`;
  }
}
