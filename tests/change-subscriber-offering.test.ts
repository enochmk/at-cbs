import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src/cbs-client';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangeSubOfferingResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangeSubOfferingResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('changeSubscriberOffering sends CBS EffectiveTime for the postpaid service-class change', async () => {
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

    await client.changeSubscriberOffering({
      primaryIdentity: '270118755',
      oldOfferingId: '2018105068',
      newOfferingId: '2018105071',
    });

    assert.match(requestBody, /<bcc:PrimaryIdentity>270118755<\/bcc:PrimaryIdentity>/);
    assert.match(requestBody, /<bcc:OfferingID>2018105068<\/bcc:OfferingID>/);
    assert.match(requestBody, /<bcc:OfferingID>2018105071<\/bcc:OfferingID>/);
    assert.match(requestBody, /<bcs:EffectiveTime><bcc:Mode>I<\/bcc:Mode><\/bcs:EffectiveTime>/);
    assert.ok(
      requestBody.indexOf('<bcs:EffectiveTime>') > requestBody.indexOf('<bcs:NewPrimaryOffering>'),
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
