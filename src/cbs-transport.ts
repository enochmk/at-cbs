import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import createHttpError from 'http-errors';
import https from 'node:https';

import type { CbsClientOptions } from './types';
import { parseSoapResponse } from './utils';

export type CbsTransportOptions = Required<CbsClientOptions>;

/** Shared HTTP, SOAP parsing, and logging boundary for CBS operations. */
export class CbsTransport {
  readonly parser: XMLParser;
  readonly stringParser: XMLParser;

  constructor(private readonly opts: CbsTransportOptions) {
    this.parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: true,
      trimValues: true,
    });
    this.stringParser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
    });
  }

  getUrl(service: string): string {
    return `${this.opts.baseUrl}${service}`;
  }

  log(level: string, msg: string, ctx?: Record<string, unknown>): void {
    const fn = this.opts.logger[level as keyof typeof this.opts.logger];
    if (fn) fn(msg, ctx);
  }

  async post(service: string, payload: string, operation: string, msisdn: string): Promise<string> {
    try {
      const response = await axios.post<string>(this.getUrl(service), payload, {
        headers: { 'Content-Type': 'text/xml' },
        httpsAgent: new https.Agent({ rejectUnauthorized: this.opts.rejectUnauthorized }),
        timeout: this.opts.timeout,
      });
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'CBS request failed';
      this.log('error', `${operation} - request failed`, { msisdn, error: message });
      throw createHttpError(502, message);
    }
  }

  parse<T>(xml: string, parser: XMLParser) {
    return parseSoapResponse<T>(xml, parser);
  }

  throwCbsError(operation: string, msisdn: string, resultCode: string, resultDesc: string): void {
    this.log('warn', `${operation} - CBS error`, { msisdn, resultCode, resultDesc });
    throw createHttpError(422, resultDesc);
  }

  get options(): CbsTransportOptions {
    return this.opts;
  }
}
