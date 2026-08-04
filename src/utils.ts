import { XMLParser } from 'fast-xml-parser';

export function getXmlField<T = unknown>(
  data: Record<string, unknown> | undefined,
  field: string,
): T | undefined {
  if (!data) return undefined;

  const key = Object.keys(data).find(
    (candidate) => candidate === field || candidate.endsWith(`:${field}`),
  );
  return key ? (data[key] as T) : undefined;
}

export function sanitizeXml(data: string): string {
  const validEntity = /^&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/i;
  let sanitized = '';

  for (let index = 0; index < data.length; index += 1) {
    if (data.startsWith('<![CDATA[', index)) {
      const end = data.indexOf(']]>', index + 9);
      if (end === -1) return sanitized + data.slice(index);

      sanitized += data.slice(index, end + 3);
      index = end + 2;
      continue;
    }

    if (data.startsWith('<!--', index)) {
      const end = data.indexOf('-->', index + 4);
      if (end === -1) return sanitized + data.slice(index);

      sanitized += data.slice(index, end + 3);
      index = end + 2;
      continue;
    }

    const character = data[index];
    if (character === '&') {
      const entity = data.slice(index).match(validEntity)?.[0];
      if (entity) {
        sanitized += entity;
        index += entity.length - 1;
      } else {
        sanitized += '&amp;';
      }
      continue;
    }

    if (character === '<') {
      const next = data[index + 1] ?? '';
      const startsTag = /[A-Za-z_?!/]/.test(next);
      sanitized += startsTag ? '<' : '&lt;';
      continue;
    }

    sanitized += character;
  }

  return sanitized;
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
      body['soapenv:Fault']?.faultString ?? body['soapenv:Fault']?.faultstring ?? 'CBS SOAP fault';
    throw Object.assign(new Error(String(faultMsg)), { status: 502 });
  }

  const resultMsgKey = Object.keys(body).find((k) => k.endsWith('ResultMsg'));
  if (!resultMsgKey) {
    throw Object.assign(new Error('No ResultMsg in CBS response'), { status: 502 });
  }

  const resultMsg = body[resultMsgKey] as T;
  const resultHeader = getXmlField<Record<string, unknown>>(
    resultMsg as Record<string, unknown>,
    'ResultHeader',
  );
  const resultCode: string = String(getXmlField(resultHeader, 'ResultCode') ?? '');
  const resultDesc: string = String(getXmlField(resultHeader, 'ResultDesc') ?? '');

  return { body, resultMsgKey, resultMsg, resultCode, resultDesc };
}
