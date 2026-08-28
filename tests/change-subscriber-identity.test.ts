import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src/cbs-client';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangeSubIdentityResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Operation successfully.</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangeSubIdentityResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('changeSubscriberIdentity sends the CBS IMSI replacement request', async () => {
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

    const result = await client.changeSubscriberIdentity({
      primaryIdentity: '261000001',
      oldSubIdentity: '123261000001',
      oldSubIdentityType: 2,
      newSubIdentity: '124261000001',
    });

    assert.equal(result.data.ResultCode, '0');
    assert.match(requestBody, /<bcc:PrimaryIdentity>261000001<\/bcc:PrimaryIdentity>/);
    assert.match(requestBody, /<bcs:OldSubIdentity>123261000001<\/bcs:OldSubIdentity>/);
    assert.match(requestBody, /<bcs:OldSubIdentityType>2<\/bcs:OldSubIdentityType>/);
    assert.match(requestBody, /<bcs:NewSubIdentity>124261000001<\/bcs:NewSubIdentity>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
