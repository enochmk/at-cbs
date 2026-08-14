import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:CreateCustomerResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:CreateCustomerResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('serializes optional CBS customer fields', async () => {
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

    await client.createCustomer({
      registerCustKey: 'REG-1',
      customerKey: 'CUST-1',
      parentCustomerKey: 'PARENT-1',
      customerBasicInfo: {
        defaultWrittenLanguage: 2002,
        properties: [{ code: 'KYC_SOURCE', value: 'HTC & CRM' }],
      },
      individual: {
        idType: 'NATIONAL_ID',
        idNumber: 'ID-1',
        middleName: 'Kofi',
        homeAddressKey: 'ADDR-1',
        officePhone: '0300000000',
      },
      addressInfo: {
        addressKey: 'ADDR-1',
        address1: 'Accra & Osu',
        postCode: 'GA-001',
      },
      salesInfo: { salesId: 'SALES-1', salesChannelId: 'B2B' },
      defaultAccount: {
        paymentRelationKey: 'PAY-1',
        accountKey: 'ACCT-1',
        account: {
          accountName: 'Default account',
          contact: { firstName: 'Ama', email: 'ama@example.com' },
          creditLimit: 1000,
          creditLimitType: 'C_INITIAL_CREDIT_LIMIT',
        },
      },
    });

    assert.match(requestBody, /<bcc:ParentCustKey>PARENT-1<\/bcc:ParentCustKey>/);
    assert.match(requestBody, /<bcc:MiddleName>Kofi<\/bcc:MiddleName>/);
    assert.match(requestBody, /Accra &amp; Osu/);
    assert.match(requestBody, /<bcs:SalesInfo>/);
    assert.match(requestBody, /<bcs:DFTAccount>/);
    assert.match(requestBody, /<bcc:CreditLimit>/);
    assert.match(requestBody, /HTC &amp; CRM/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
