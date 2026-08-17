import createHttpError from 'http-errors';

import type {
  AcctDeactivationOptions,
  CbsClientOptions,
  CbsRequestOptions,
  CustActivationOptions,
  CustDeactivationOptions,
} from '../types';
import { CbsRequestDefaults } from '../types';
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

  /** Subscriber lifecycle APIs are addressed by the subscriber's MSISDN. */
  protected getSubscriberPrimaryIdentity(msisdn: string): string {
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

  protected getAccountAccessCode(opts: AcctDeactivationOptions): string {
    const accessCodes = [opts.primaryIdentity, opts.accountKey, opts.accountCode].filter(
      (value) => value !== undefined && value !== '',
    );

    if (accessCodes.length !== 1) {
      throw createHttpError(
        400,
        'Provide exactly one of primaryIdentity, accountKey, or accountCode',
      );
    }

    if (opts.primaryIdentity !== undefined && opts.primaryIdentity !== '') {
      return `<bcc:PrimaryIdentity>${opts.primaryIdentity}</bcc:PrimaryIdentity>`;
    }
    if (opts.accountKey !== undefined && opts.accountKey !== '') {
      return `<bcc:AccountKey>${opts.accountKey}</bcc:AccountKey>`;
    }
    return `<bcc:AccountCode>${opts.accountCode}</bcc:AccountCode>`;
  }

  protected requestHeader(
    opts: CbsRequestOptions | undefined,
    businessCode: string,
    messageSeq: string,
    defaults: Partial<
      Pick<CbsRequestOptions, 'operatorId' | 'accessMode' | 'msgLanguageCode' | 'timeType'>
    > = {},
  ): string {
    const version = opts?.version ?? CbsRequestDefaults.VERSION;
    const beId = opts?.beId ?? CbsRequestDefaults.BE_ID;
    const operatorId = opts?.operatorId ?? defaults.operatorId;
    const accessMode = opts?.accessMode ?? defaults.accessMode;
    const msgLanguageCode = opts?.msgLanguageCode ?? defaults.msgLanguageCode;
    const timeType = opts?.timeType ?? defaults.timeType;

    return `
      <RequestHeader>
        <cbs:Version>${version}</cbs:Version>
        <cbs:BusinessCode>${businessCode}</cbs:BusinessCode>
        <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
        <cbs:OwnershipInfo>
          <cbs:BEID>${beId}</cbs:BEID>
        </cbs:OwnershipInfo>
        <cbs:AccessSecurity>
          <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
          <cbs:Password>${this.opts.password}</cbs:Password>
        </cbs:AccessSecurity>
        ${operatorId !== undefined ? `<cbs:OperatorInfo><cbs:OperatorID>${operatorId}</cbs:OperatorID></cbs:OperatorInfo>` : ''}
        ${accessMode !== undefined ? `<cbs:AccessMode>${accessMode}</cbs:AccessMode>` : ''}
        ${msgLanguageCode !== undefined ? `<cbs:MsgLanguageCode>${msgLanguageCode}</cbs:MsgLanguageCode>` : ''}
        ${timeType !== undefined ? `<cbs:TimeFormat><cbs:TimeType>${timeType}</cbs:TimeType></cbs:TimeFormat>` : ''}
        ${opts?.remoteAddress !== undefined ? `<cbs:RemoteAddress>${opts.remoteAddress}</cbs:RemoteAddress>` : ''}
        ${opts?.remark !== undefined ? `<cbs:Remark>${opts.remark}</cbs:Remark>` : ''}
      </RequestHeader>`;
  }
}
