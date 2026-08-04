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
        // CBS can return a SOAP ResultMsg with a non-2xx HTTP status. Let the
        // operation parser inspect that body so it can expose ResultDesc.
        validateStatus: (status) => status < 600,
      });
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'CBS request failed';
      this.log('error', `${operation} - request failed`, { msisdn, error: message });
      // Keep the original AxiosError available for callers and diagnostics,
      // while presenting transport failures as a bad-gateway response.
      throw createHttpError(502, message, { cause: err });
    }
  }

  parse<T>(xml: string, parser: XMLParser) {
    return parseSoapResponse<T>(xml, parser);
  }

  throwCbsError(operation: string, msisdn: string, resultCode: string, resultDesc: string): void {
    const context = { operation, msisdn, resultCode, resultDesc };
    this.log('warn', `${operation} - CBS error`, context);
    throw createHttpError(422, resultDesc, context);
  }

  get options(): CbsTransportOptions {
    return this.opts;
  }
}
