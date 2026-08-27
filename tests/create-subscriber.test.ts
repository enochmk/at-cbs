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

test('serializes the application-owned customer and account identifiers', async () => {
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

    await client.createPrepaidSubscriber('271004887', {
      customerKey: 'CUSTOMER-1',
      subscriberKey: 'SUBSCRIBER-1',
      offeringId: '123',
      status: 1,
      accounts: [
        {
          accountKey: 'ACCOUNT-1',
          accountCode: 'ACCOUNT-1',
          paymentRelationKey: 'RELATION-1',
          paymentType: 0,
        },
      ],
    });

    assert.match(requestBody, /<bcs:RegisterCustomer OpType="2">/);
    assert.match(requestBody, /<bcs:CustKey>CUSTOMER-1<\/bcs:CustKey>/);
    assert.match(requestBody, /<bcs:SubscriberKey>SUBSCRIBER-1<\/bcs:SubscriberKey>/);
    assert.match(requestBody, /<bcs:AcctKey>ACCOUNT-1<\/bcs:AcctKey>/);
    assert.match(requestBody, /<bcc:AcctCode>ACCOUNT-1<\/bcc:AcctCode>/);
    assert.match(requestBody, /<bcs:PayRelationKey>RELATION-1<\/bcs:PayRelationKey>/);
    assert.match(requestBody, /<bcc:Status>1<\/bcc:Status>/);

    await client.createPrepaidSubscriber('271004888', {
      customerKey: 'CUSTOMER-2',
      subscriberKey: 'SUBSCRIBER-2',
      offeringId: '123',
      status: 1,
    });

    assert.doesNotMatch(requestBody, /<bcs:Account>/);
    assert.match(requestBody, /<bcs:PaymentMode>0<\/bcs:PaymentMode>/);
    assert.doesNotMatch(requestBody, /<bcs:PayRelationKey>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('serializes a standalone regular prepaid subscriber with MSISDN entity keys', async () => {
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

    await client.createStandalonePrepaidSubscriber('0271004887', {
      offeringId: '2018246521',
      messageSeq: 'standalone-test-sequence',
    });

    const registerCustomerIndex = requestBody.indexOf('<bcs:RegisterCustomer');
    const accountIndex = requestBody.indexOf('<bcs:Account>');
    const subscriberIndex = requestBody.indexOf('<bcs:Subscriber>');
    const offeringIndex = requestBody.indexOf('<bcs:PrimaryOffering>');
    assert.ok(registerCustomerIndex < accountIndex);
    assert.ok(accountIndex < subscriberIndex);
    assert.ok(subscriberIndex < offeringIndex);
    assert.match(requestBody, /<bcs:RegisterCustomer OpType="1">/);
    assert.match(requestBody, /<bcs:CustKey>271004887<\/bcs:CustKey>/);
    assert.match(requestBody, /<bcc:CustCode>271004887<\/bcc:CustCode>/);
    assert.match(requestBody, /<bcs:AcctKey>271004887<\/bcs:AcctKey>/);
    assert.match(requestBody, /<bcc:AcctCode>271004887<\/bcc:AcctCode>/);
    assert.match(requestBody, /<bcs:SubscriberKey>271004887<\/bcs:SubscriberKey>/);
    assert.match(requestBody, /<bcc:SubIdentity>123271004887<\/bcc:SubIdentity>/);
    assert.match(requestBody, /<bcs:PayRelationKey>PR_271004887<\/bcs:PayRelationKey>/);
    assert.match(requestBody, /<bcc:OfferingID>2018246521<\/bcc:OfferingID>/);
    assert.match(requestBody, /<bcc:BundledFlag>S<\/bcc:BundledFlag>/);
    assert.match(requestBody, /<bcc:InitBalance>0<\/bcc:InitBalance>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
