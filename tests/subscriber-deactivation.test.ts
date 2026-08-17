import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:SubDeactivationResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:SubDeactivationResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('subscriber deactivation operations use MSISDN/PrimaryIdentity', async () => {
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requests.push(Buffer.concat(chunks).toString());
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
      logger: {},
    });

    await client.subDeactivation('0261180254', {
      opType: '3',
      subscriberKey: 'SUB-IGNORED-KEY',
    });
    await client.deleteNumber('0261180254', { subscriberKey: 'SUB-IGNORED-KEY' });

    for (const requestBody of requests) {
      assert.match(requestBody, /<bcc:PrimaryIdentity>261180254<\/bcc:PrimaryIdentity>/);
      assert.doesNotMatch(requestBody, /<bcc:SubscriberKey>/);
    }
    assert.match(requests[0] ?? '', /<bcs:OpType>3<\/bcs:OpType>/);
    assert.match(requests[1] ?? '', /<bcs:OpType>3<\/bcs:OpType>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
