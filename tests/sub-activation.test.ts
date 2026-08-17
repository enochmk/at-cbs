import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src/cbs-client';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:SubActivationResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Operation successfully.</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:SubActivationResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('subActivate uses PrimaryIdentity and the CBS request defaults', async () => {
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

    await client.subActivate('0261180254', {
      subscriberKey: 'SUB-IGNORED-KEY',
      operatorId: '101',
      accessMode: 3,
      msgLanguageCode: 2002,
      timeType: 1,
    });

    assert.match(requestBody, /<cbs:BusinessCode>SubActivation<\/cbs:BusinessCode>/);
    assert.match(requestBody, /<cbs:OperatorID>101<\/cbs:OperatorID>/);
    assert.match(requestBody, /<cbs:AccessMode>3<\/cbs:AccessMode>/);
    assert.match(requestBody, /<cbs:MsgLanguageCode>2002<\/cbs:MsgLanguageCode>/);
    assert.match(requestBody, /<cbs:TimeType>1<\/cbs:TimeType>/);
    assert.match(requestBody, /<bcc:PrimaryIdentity>261180254<\/bcc:PrimaryIdentity>/);
    assert.doesNotMatch(requestBody, /<bcc:SubscriberKey>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
