import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:CreateSubscriberResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:CreateSubscriberResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('uses one unique MSISDN/timestamp ID for customer and account fields', async () => {
  let requestBody = '';
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requestBody = Buffer.concat(chunks).toString();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/xml');
      response.end(successResponse);
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  try {
    const client = new CbsClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      username: 'test-user',
      password: 'test-password',
      rejectUnauthorized: false,
    });

    await client.createPrepaidSubscriber('271004887', { offeringId: '123' });

    const values = [
      ...requestBody.matchAll(/<(?:\w+:)?(?:AcctCode|AcctKey|CustKey|CustCode)>([^<]+)</g),
    ].map((match) => match[1]);
    assert.ok(values.length >= 4);
    assert.equal(new Set(values).size, 1);
    assert.match(values[0], /^271004887_\d{17}$/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
