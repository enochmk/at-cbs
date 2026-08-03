import type {
  CbsClientOptions,
  QueryCustomerInfoOptions,
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
} from '../types';
import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';

import { CbsServiceBase } from './cbs-service-base';
import { getXmlField } from '../utils';

export class BbServices extends CbsServiceBase {
  protected readonly servicePath = '/services/BbServices';

  async queryCdrDetail(
    primaryIdentity: string,
    cdrSeq: string | number,
    opts?: QueryCdrDetailOptions,
  ): Promise<QueryCdrDetailOutput> {
    if (cdrSeq === undefined || cdrSeq === null || String(cdrSeq).trim() === '') {
      throw createHttpError(400, 'cdrSeq is required for QueryCDRDetail');
    }

    const cbsMsisdn = this.normalizeMsisdn(primaryIdentity);
    const messageSeq = opts?.messageSeq ?? randomUUID();

    this.log('verbose', 'queryCdrDetail - sending request', {
      primaryIdentity,
      cdrSeq,
      opts,
    });

    const soapPayload = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bbs="http://www.huawei.com/bme/cbsinterface/bbservices" xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
        <soapenv:Header/>
        <soapenv:Body>
          <bbs:QueryCDRDetailRequestMsg>
            <RequestHeader>
              <cbs:Version>1</cbs:Version>
              <cbs:BusinessCode>QueryCDRDetail</cbs:BusinessCode>
              <cbs:MessageSeq>${messageSeq}</cbs:MessageSeq>
              <cbs:OwnershipInfo>
                <cbs:BEID>${opts?.beId ?? '101'}</cbs:BEID>
              </cbs:OwnershipInfo>
              <cbs:AccessSecurity>
                <cbs:LoginSystemCode>${this.opts.username}</cbs:LoginSystemCode>
                <cbs:Password>${this.opts.password}</cbs:Password>
              </cbs:AccessSecurity>
              ${opts?.operatorId ? `<cbs:OperatorInfo><cbs:OperatorID>${opts.operatorId}</cbs:OperatorID></cbs:OperatorInfo>` : ''}
              ${opts?.accessMode !== undefined ? `<cbs:AccessMode>${opts.accessMode}</cbs:AccessMode>` : ''}
              ${opts?.msgLanguageCode !== undefined ? `<cbs:MsgLanguageCode>${opts.msgLanguageCode}</cbs:MsgLanguageCode>` : ''}
              ${opts?.timeType !== undefined ? `<cbs:TimeFormat><cbs:TimeType>${opts.timeType}</cbs:TimeType></cbs:TimeFormat>` : ''}
            </RequestHeader>
            <QueryCDRDetailRequest>
              <bbs:PrimaryIdentity>${cbsMsisdn}</bbs:PrimaryIdentity>
              <bbs:CdrSeq>${cdrSeq}</bbs:CdrSeq>
            </QueryCDRDetailRequest>
          </bbs:QueryCDRDetailRequestMsg>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await this.transport.post(
      this.servicePath,
      soapPayload,
      'queryCdrDetail',
      primaryIdentity,
    );

    const { resultMsg, resultCode, resultDesc } = this.transport.parse<QueryCdrDetailResponse>(
      response,
      this.transport.stringParser,
    );

    if (resultCode !== '0') {
      this.transport.throwCbsError('queryCdrDetail', primaryIdentity, resultCode, resultDesc);
    }

    const queryResult = getXmlField<QueryCdrDetailResult>(
      resultMsg as Record<string, unknown>,
      'QueryCDRDetailResult',
    );

    this.log('verbose', 'queryCdrDetail - success', { primaryIdentity, cdrSeq, messageSeq });
    return {
      metadata: resultMsg,
      data: queryResult ?? {},
    };
  }
}
