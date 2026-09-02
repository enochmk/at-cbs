import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsTransport } from '../src/cbs-transport';
import { parseSoapResponse, sanitizeXml } from '../src/utils';

const resultMessage = (resultCode: string, resultDesc: string) => `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangeSubOfferingResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">${resultCode}</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">${resultDesc}</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangeSubOfferingResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

const soapFault = (faultString: string) => `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <soapenv:Fault>
        <faultString>${faultString}</faultString>
      </soapenv:Fault>
    </soapenv:Body>
  </soapenv:Envelope>`;

function transport(baseUrl: string, timeout = 500): CbsTransport {
  return new CbsTransport({
    baseUrl,
    username: 'test-user',
    password: 'test-password',
    timeout,
    rejectUnauthorized: false,
    logger: {},
  });
}

async function withServer(
  status: number,
  body: string | ((response: import('node:http').ServerResponse) => void),
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((_request, response) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'text/xml');
    if (typeof body === 'function') body(response);
    else response.end(body);
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function assertResultDesc(status: number): Promise<void> {
  const resultDesc = 'Offering cannot be subscribed';

  await withServer(status, resultMessage('1001', resultDesc), async (baseUrl) => {
    const client = transport(baseUrl);
    const response = await client.post('/', '<request/>', 'subscribeAppendantProduct', '271000000');
    const parsed = client.parse(response, client.parser);

    assert.equal(parsed.resultCode, '1001');
    assert.equal(parsed.resultDesc, resultDesc);
    assert.throws(
      () =>
        client.throwCbsError(
          'subscribeAppendantProduct',
          '271000000',
          parsed.resultCode,
          parsed.resultDesc,
        ),
      (error: unknown) => {
        assert.equal((error as { status: number }).status, 422);
        assert.equal((error as Error).message, resultDesc);
        assert.equal((error as { resultCode: string }).resultCode, '1001');
        assert.equal((error as { operation: string }).operation, 'subscribeAppendantProduct');
        return true;
      },
    );
  });
}

test('preserves ResultDesc for HTTP 200 with a nonzero ResultCode', async () => {
  await assertResultDesc(200);
});

test('preserves ResultDesc for HTTP 500 with a SOAP ResultMsg', async () => {
  await assertResultDesc(500);
});

test('preserves faultString for HTTP 500 with a SOAP Fault', async () => {
  const faultString = 'CBS service unavailable';

  await withServer(500, soapFault(faultString), async (baseUrl) => {
    const client = transport(baseUrl);
    const response = await client.post('/', '<request/>', 'subscribeAppendantProduct', '271000000');

    assert.throws(
      () => client.parse(response, client.parser),
      (error: unknown) => {
        assert.equal((error as { status: number }).status, 502);
        assert.equal((error as Error).message, faultString);
        return true;
      },
    );
  });
});

test('turns timeout failures into a useful 502 transport error', async () => {
  await withServer(
    200,
    (response) => {
      setTimeout(() => response.end(), 100);
    },
    async (baseUrl) => {
      const client = transport(baseUrl, 10);

      await assert.rejects(
        client.post('/', '<request/>', 'subscribeAppendantProduct', '271000000'),
        (error: unknown) => {
          assert.equal((error as { status: number }).status, 502);
          assert.match((error as Error).message, /CBS service is unreachable/i);
          assert.match((error as Error).message, /timeout/i);
          assert.equal((error as { cause: { response?: unknown } }).cause.response, undefined);
          return true;
        },
      );
    },
  );
});

test('serializes concurrent CBS requests through one transport lane', async () => {
  let activeRequests = 0;
  let maximumConcurrentRequests = 0;

  await withServer(
    200,
    (response) => {
      activeRequests += 1;
      maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests);
      setTimeout(() => {
        activeRequests -= 1;
        response.end('<response/>');
      }, 20);
    },
    async (baseUrl) => {
      const client = transport(baseUrl);
      const first = client.post('/', '<request/>', 'first-operation', '271000000');
      const second = client.post('/', '<request/>', 'second-operation', '271000001');

      await Promise.all([first, second]);

      assert.equal(maximumConcurrentRequests, 1);
    },
  );
});

test('keeps readable hyphens and escapes unsafe ResultDesc characters', () => {
  const resultDesc =
    'Subscriber information verification error: Product management verification failed. <-- The offering 987865631 does not exist.';
  const parser = transport('http://127.0.0.1').parser;
  const parsed = parseSoapResponse(resultMessage('1001', resultDesc), parser);

  assert.equal(parsed.resultDesc, resultDesc);
  assert.equal(sanitizeXml(resultDesc).includes('&#45;'), false);
  assert.equal(sanitizeXml(resultDesc).includes('&lt;--'), true);
  assert.throws(
    () =>
      transport('http://127.0.0.1').throwCbsError(
        'subscribeAppendantProduct',
        '271000000',
        parsed.resultCode,
        parsed.resultDesc,
      ),
    (error: unknown) => {
      assert.equal((error as Error).message, resultDesc);
      return true;
    },
  );

  const ampersandParsed = parseSoapResponse(resultMessage('1001', 'A & B'), parser);
  assert.equal(ampersandParsed.resultDesc, 'A & B');
});

test('preserves SOAP comments and CDATA content', () => {
  const xml = `
    <!-- comment-with-hyphen -->
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <bcs:ChangeSubOfferingResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
          <bcs:ResultHeader>
            <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">1001</cbs:ResultCode>
            <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon"><![CDATA[failed-product -- unavailable & still readable]]></cbs:ResultDesc>
          </bcs:ResultHeader>
        </bcs:ChangeSubOfferingResultMsg>
      </soapenv:Body>
    </soapenv:Envelope>`;

  const parsed = parseSoapResponse(xml, transport('http://127.0.0.1').parser);
  assert.equal(parsed.resultDesc, 'failed-product -- unavailable & still readable');
});
