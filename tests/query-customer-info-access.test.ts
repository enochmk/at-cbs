import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient, type QueryCustomerInfoKey } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:QueryCustomerInfoResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
        <bcs:QueryCustomerInfoResult />
      </bcs:QueryCustomerInfoResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

const subscriberStatusResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:QueryCustomerInfoResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
        <bcs:QueryCustomerInfoResult>
          <bcs:Subscriber>
            <bcs:SubscriberInfo>
              <bcc:Status xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">2</bcc:Status>
            </bcs:SubscriberInfo>
            <bcs:SubPaymentMode>
              <bcs:PaymentMode>1</bcs:PaymentMode>
            </bcs:SubPaymentMode>
          </bcs:Subscriber>
        </bcs:QueryCustomerInfoResult>
      </bcs:QueryCustomerInfoResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('queryCustomerInfoByKey emits the selected CBS access code', async () => {
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
      rejectUnauthorized: false,
    });

    const cases: Array<[QueryCustomerInfoKey, RegExp]> = [
      [{ primaryIdentity: '271004887' }, /<bcs:SubAccessCode>\s*<bcc:PrimaryIdentity>271004887/],
      [{ subscriberKey: 'SUB-1' }, /<bcs:SubAccessCode>\s*<bcc:SubscriberKey>SUB-1/],
      [{ customerKey: 'CUST-1' }, /<bcs:CustAccessCode>\s*<bcc:CustomerKey>CUST-1/],
      [{ customerCode: 'CUST-CODE-1' }, /<bcs:CustAccessCode>\s*<bcc:CustomerCode>CUST-CODE-1/],
      [{ accountKey: 'ACCT-1' }, /<bcs:AcctAccessCode>\s*<bcc:AccountKey>ACCT-1/],
      [{ accountCode: 'ACCT-CODE-1' }, /<bcs:AcctAccessCode>\s*<bcc:AccountCode>ACCT-CODE-1/],
    ];

    for (const [access, expected] of cases) {
      await client.queryCustomerInfoByKey(access);
      assert.match(requests.at(-1) ?? '', expected);
    }

    await client.queryCustomerInfo('271004887');
    assert.match(requests.at(-1) ?? '', /<bcs:SubAccessCode>\s*<bcc:PrimaryIdentity>271004887/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('queryCustomerInfoByKey rejects ambiguous selectors', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1',
    username: 'test-user',
    password: 'test-password',
  });

  await assert.rejects(
    client.queryCustomerInfoByKey({
      primaryIdentity: '271004887',
      customerCode: 'CUST-1',
    } as QueryCustomerInfoKey),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 400);
      assert.equal((error as Error).message, 'Provide exactly one CBS customer info access code');
      return true;
    },
  );
});

test('queryCustomerInfo maps SubscriberInfo.Status instead of LifeCycleDetail.CurrentStatusIndex', async () => {
  const server: Server = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/xml');
      response.end(subscriberStatusResponse);
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

    const result = await client.queryCustomerInfo('271004887');

    assert.deepEqual(result.data.Status, { code: 2, label: 'Active' });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
