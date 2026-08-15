import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src/cbs-client';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangeSubStatusResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangeSubStatusResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('changeSubscriberStatus sends NewStatus for CBS ChangeSubStatusRequest', async () => {
  let requestBody = '';
  const server: Server = createServer((request, response) => {
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      requestBody += chunk;
    });
    request.on('end', () => {
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

    await client.changeSubscriberStatus('270118755', { status: 'SUSPEND' });

    assert.match(requestBody, /<bcs:NewStatus>4<\/bcs:NewStatus>/);
    assert.doesNotMatch(requestBody, /<bcs:Status>/);
    assert.match(requestBody, /<bcc:PrimaryIdentity>270118755<\/bcc:PrimaryIdentity>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
