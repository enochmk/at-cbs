import { XMLParser } from 'fast-xml-parser';

export function sanitizeXml(data: string): string {
  return data.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;').replace(/-/g, '&#45;');
}

export function parseSoapResponse<T = Record<string, unknown>>(
  xml: string,
  parser: XMLParser,
): {
  body: Record<string, any>;
  resultMsgKey: string;
  resultMsg: T;
  resultCode: string;
  resultDesc: string;
} {
  const sanitized = sanitizeXml(xml);
  const parsed = parser.parse(sanitized);

  const body = parsed?.['soapenv:Envelope']?.['soapenv:Body'];
  if (!body) {
    throw Object.assign(new Error('Missing soapenv:Body in CBS response'), { status: 502 });
  }

  if (body['soapenv:Fault']) {
    const faultMsg =
      body['soapenv:Fault']?.faultString ??
      body['soapenv:Fault']?.faultstring ??
      'CBS SOAP fault';
    throw Object.assign(new Error(String(faultMsg)), { status: 502 });
  }

  const resultMsgKey = Object.keys(body).find((k) => k.endsWith('ResultMsg'));
  if (!resultMsgKey) {
    throw Object.assign(new Error('No ResultMsg in CBS response'), { status: 502 });
  }

  const resultMsg = body[resultMsgKey] as T;
  const resultHeader = resultMsg?.ResultHeader as Record<string, unknown> | undefined;
  const resultCode: string = String(resultHeader?.ResultCode ?? '');
  const resultDesc: string = String(resultHeader?.ResultDesc ?? '');

  return { body, resultMsgKey, resultMsg, resultCode, resultDesc };
}
