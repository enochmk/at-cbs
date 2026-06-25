import axios, { type AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import createHttpError from 'http-errors';

import type {
  CbsClientOptions,
  IntegrationEnquiryOptions,
  IntegrationEnquiryResponse,
  CreateSubscriberOptions,
  DeleteSubscriberOptions,
  DeleteSubscriberResponse,
  NewSubscriberResponse,
  QueryBasicInfoOptions,
  QueryBasicInfoResponse,
} from './types';
import { parseSoapResponse } from './utils';

export class CbsClient {
  private parser: XMLParser;
  private opts: Required<CbsClientOptions>;
  private successCode: string;

  private static BUSINESS_MGR = '/services/CBSInterfaceBusinessMgrService';
  private static ACCOUNT_MGR = '/services/CBSInterfaceAccountMgrService';

  constructor(options: CbsClientOptions) {
    this.opts = {
      timeout: 15000,
      successCode: '405000000',
      logger: {},
      ...options,
    };
    this.successCode = this.opts.successCode;
    this.parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: true,
      trimValues: true,
    });
  }

  private getUrl(service: string): string {
    return `${this.opts.baseUrl}${service}`;
  }

  private log(level: string, msg: string, ctx?: Record<string, unknown>): void {
    const fn = this.opts.logger[level as keyof typeof this.opts.logger];
    if (fn) fn(msg, ctx);
  }

  private normalizeMsisdn(msisdn: string): string {
    const digits = msisdn.replace(/\D/g, '');
    if (![9, 10, 12].includes(digits.length)) {
      throw createHttpError(400, 'MSISDN must be 9, 10, or 12 digits');
    }
    return digits.slice(-9);
  }

  async integrationEnquiry(
    msisdn: string,
    opts?: IntegrationEnquiryOptions,
  ): Promise<IntegrationEnquiryResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    this.log('verbose', 'integrationEnquiry - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:IntegrationEnquiryRequestMsg>
            <RequestHeader>
                <com:CommandId>IntegrationEnquiry</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
            </RequestHeader>
            <IntegrationEnquiryRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:QueryType>0</bus1:QueryType>
            </IntegrationEnquiryRequest>
            </bus:IntegrationEnquiryRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'IntegrationEnquiry' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'integrationEnquiry - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<IntegrationEnquiryResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'integrationEnquiry - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('verbose', 'integrationEnquiry - success', { msisdn, requestId });
    return resultMsg;
  }

  async createSubscriber(
    msisdn: string,
    opts?: CreateSubscriberOptions,
  ): Promise<NewSubscriberResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const remark = opts?.remark ?? `npm-${cbsMsisdn}`;
    this.log('verbose', 'createSubscriber - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:NewSubscriberRequestMsg>
            <RequestHeader>
                <com:CommandId>NewSubscriber</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
                <com:Remark>${remark}</com:Remark>
            </RequestHeader>
            <NewSubscriberRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:Subscriber>
                  <bus1:Lang>${opts?.lang ?? 1}</bus1:Lang>
                  <bus1:PaidMode>${opts?.paidMode ?? '0'}</bus1:PaidMode>
                  <bus1:MainProductID>${opts?.mainProductId ?? '2018254719'}</bus1:MainProductID>
                </bus1:Subscriber>
            </NewSubscriberRequest>
            </bus:NewSubscriberRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'NewSubscriber' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'createSubscriber - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<NewSubscriberResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'createSubscriber - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'createSubscriber - success', { msisdn, requestId });
    return resultMsg;
  }

  async deleteSubscriber(
    msisdn: string,
    opts?: DeleteSubscriberOptions,
  ): Promise<DeleteSubscriberResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    const remark = opts?.remark ?? `npm-${cbsMsisdn}`;
    this.log('verbose', 'deleteSubscriber - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:DeleteSubscriberRequestMsg>
            <RequestHeader>
                <com:CommandId>DeleteSubscriber</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
                <com:Remark>${remark}</com:Remark>
            </RequestHeader>
            <DeleteSubscriberRequest>
                <bus1:SubscriberNo>
                  <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                </bus1:SubscriberNo>
            </DeleteSubscriberRequest>
            </bus:DeleteSubscriberRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'DeleteSubscriber' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'deleteSubscriber - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<DeleteSubscriberResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'deleteSubscriber - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('info', 'deleteSubscriber - success', { msisdn, requestId });
    return resultMsg;
  }

  async queryBasicInfo(
    msisdn: string,
    opts?: QueryBasicInfoOptions,
  ): Promise<QueryBasicInfoResponse> {
    const cbsMsisdn = this.normalizeMsisdn(msisdn);
    const requestId = opts?.requestId ?? Date.now();
    this.log('verbose', 'queryBasicInfo - sending request', { msisdn, opts });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bus="http://www.huawei.com/bme/cbsinterface/cbs/businessmgrmsg" xmlns:com="http://www.huawei.com/bme/cbsinterface/common" xmlns:bus1="http://www.huawei.com/bme/cbsinterface/cbs/businessmgr">
      <soapenv:Header/>
      <soapenv:Body>
          <bus:QueryBasicInfoRequestMsg>
            <RequestHeader>
                <com:CommandId>QueryBasicInfo</com:CommandId>
                <com:Version>1</com:Version>
                <com:TransactionId></com:TransactionId>
                <com:SequenceId>1</com:SequenceId>
                <com:RequestType>Event</com:RequestType>
                <com:SessionEntity>
                  <com:Name>${this.opts.username}</com:Name>
                  <com:Password>${this.opts.password}</com:Password>
                  <com:RemoteAddress>${opts?.remoteAddress ?? ''}</com:RemoteAddress>
                </com:SessionEntity>
                <com:SerialNo>${requestId}</com:SerialNo>
            </RequestHeader>
            <QueryBasicInfoRequest>
                <bus1:SubscriberNo>${cbsMsisdn}</bus1:SubscriberNo>
                <bus1:QueryType>1</bus1:QueryType>
            </QueryBasicInfoRequest>
          </bus:QueryBasicInfoRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    let response: AxiosResponse<string>;
    try {
      response = await axios.post<string>(this.getUrl(CbsClient.BUSINESS_MGR), soapPayload, {
        headers: { 'Content-Type': 'text/xml', SoapAction: 'QueryBasicInfo' },
        timeout: this.opts.timeout,
      });
    } catch (err: any) {
      this.log('error', 'queryBasicInfo - request failed', {
        msisdn,
        requestId,
        error: err.message,
      });
      throw createHttpError(502, err.message ?? 'CBS request failed');
    }

    const { resultMsg, resultCode, resultDesc } = parseSoapResponse<QueryBasicInfoResponse>(response.data, this.parser);

    if (resultCode !== this.successCode) {
      this.log('warn', 'queryBasicInfo - CBS error', {
        msisdn,
        requestId,
        resultCode,
        resultDesc,
      });
      throw createHttpError(422, resultDesc || `CBS error code ${resultCode}`);
    }

    this.log('verbose', 'queryBasicInfo - success', { msisdn, requestId });
    return resultMsg;
  }
}
