import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:AcctDeactivationResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:AcctDeactivationResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('serializes account deregistration by account code', async () => {
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

    await client.acctDeactivation({
      accountCode: 'ACCOUNT-1',
      opType: '2',
    });

    assert.match(requestBody, /<bcs:AcctDeactivationRequestMsg>/);
    assert.match(requestBody, /<bcc:AccountCode>ACCOUNT-1<\/bcc:AccountCode>/);
    assert.match(requestBody, /<bcs:OpType>2<\/bcs:OpType>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
