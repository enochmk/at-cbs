import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangePayRelationResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangePayRelationResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('serializes ChangePayRelation using the R25 PaymentObj and PaymentRelation wrappers', async () => {
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

    await client.changePaymentRelation({
      primaryIdentity: '270105755',
      addPayRelation: {
        payRelationKey: 'PAY-ENT-270105755-PARENT',
        accountKey: 'ENT00000000001',
        priority: 51,
      },
    });

    assert.match(
      requestBody,
      /<ChangePayRelationRequest>\s*<bcs:PaymentObj>\s*<bcs:SubAccessCode>\s*<bcc:PrimaryIdentity>270105755<\/bcc:PrimaryIdentity>\s*<\/bcs:SubAccessCode>\s*<\/bcs:PaymentObj>/,
    );
    assert.match(
      requestBody,
      /<bcs:PaymentRelation>\s*<bcs:AddPayRelation>\s*<bcs:PayRelation>\s*<bcs:PayRelationKey>PAY-ENT-270105755-PARENT<\/bcs:PayRelationKey>\s*<bcs:AcctKey>ENT00000000001<\/bcs:AcctKey>\s*<bcs:Priority>51<\/bcs:Priority>\s*<bcs:EffectiveTime>\s*<bcc:Mode>I<\/bcc:Mode>\s*<\/bcs:EffectiveTime>\s*<bcs:ExpirationTime>20361231160000<\/bcs:ExpirationTime>/,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('changeSubscriberPaymentLimit serializes OpType 3 for an existing subscriber relation', async () => {
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

    await client.changeSubscriberPaymentLimit('0241744292', {
      payRelationKey: 'PAY-IND-274174292-PARENT',
      newLimit: 2500000,
    });

    assert.match(
      requestBody,
      /<bcs:PaymentObj>\s*<bcs:SubAccessCode>\s*<bcc:PrimaryIdentity>241744292<\/bcc:PrimaryIdentity>/,
    );
    assert.match(
      requestBody,
      /<bcs:PayRelationKey>PAY-IND-274174292-PARENT<\/bcs:PayRelationKey>\s*<bcs:PaymentLimit>\s*<bcs:OpType>3<\/bcs:OpType>\s*<bcs:LimitValue>2500000<\/bcs:LimitValue>/,
    );
    assert.doesNotMatch(requestBody, /<bcs:PaymentLimitKey>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
