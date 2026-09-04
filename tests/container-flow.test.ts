import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const resultResponse = (operation: string) => `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:${operation}ResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:${operation}ResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

async function withServer(run: (client: CbsClient, requests: string[]) => Promise<void>) {
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      requests.push(body);
      const operation = body.includes('CreateCustomerRequestMsg')
        ? 'CreateCustomer'
        : body.includes('CreateSubscriberRequestMsg')
          ? 'CreateSubscriber'
          : 'ChangePayRelation';
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/xml');
      response.end(resultResponse(operation));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  try {
    await run(
      new CbsClient({
        baseUrl: `http://127.0.0.1:${address.port}`,
        username: 'test-user',
        password: 'test-password',
        rejectUnauthorized: false,
      }),
      requests,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('serializes the configurable customer and container subscriber flow', async () => {
  await withServer(async (client, requests) => {
    await client.createCustomer({
      registerCustKey: 'MK-CUSTOMER',
      customerKey: 'MK-CUSTOMER',
      customerCode: 'MK-CUSTOMER',
      customerType: 2,
      organization: { idType: '1', idNumber: 'MK-CUSTOMER', shortName: 'MK' },
      defaultAccount: {
        paymentRelationKey: 'MK-MAIN',
        accountKey: 'MK-MAIN',
        account: {
          accountCode: 'MK-MAIN',
          billCycleType: '01',
          accountType: 1,
          paymentType: 1,
          creditLimitType: 'C_BILL_CYCLE_INITIAL_CREDIT',
          creditLimit: -1,
        },
      },
    });

    await client.createSubscriber('270118755', {
      paymentMode: 0,
      registerCustomer: {
        opType: 1,
        customerKey: 'PREPAID-CUSTOMER',
        customerType: 1,
        customerNodeType: 1,
        customerClass: 1,
        customerCode: 'PREPAID-CUSTOMER',
      },
      offeringId: 'PREPAID-OFFERING',
      subscriberKey: 'PREPAID-SUBSCRIBER',
      accounts: [
        {
          accountKey: 'PREPAID-ACCOUNT',
          paymentType: 0,
          initialBalance: 30_000_000,
        },
      ],
    });

    await client.createSubscriber('261180254', {
      customerKey: 'MK-CUSTOMER',
      paymentMode: 1,
      offeringId: 'POSTPAID-OFFERING',
      accounts: [
        {
          accountKey: 'POSTPAID-ACCOUNT',
          paymentRelationKey: 'POSTPAID-ACCOUNT',
          paymentType: 1,
          creditLimitType: 'C_BILL_CYCLE_INITIAL_CREDIT',
          creditLimit: 0,
        },
      ],
    });

    await client.createSubscriber('270105755', {
      customerKey: 'MK-CUSTOMER',
      paymentMode: 2,
      offeringId: 'HYBRID-OFFERING',
      accounts: [
        {
          accountKey: 'HYBRID-PREPAID',
          paymentRelationKey: 'HYBRID-PREPAID-RELATION',
          paymentType: 0,
          defaultAccount: true,
          priority: 50,
        },
        {
          accountKey: 'MK-MAIN',
          createAccount: false,
          paymentRelationKey: 'HYBRID-POSTPAID-RELATION',
          paymentType: 1,
          defaultAccount: false,
          priority: 55,
        },
      ],
    });

    await client.changePaymentRelation({
      primaryIdentity: '261180254',
      addPayRelation: {
        payRelationKey: 'POSTPAID-MAIN-RELATION',
        accountKey: 'MK-MAIN',
        priority: 55,
        paymentLimitKey: 'POSTPAID-MAIN-RELATION',
        expirationTime: '20370101000000',
      },
      paymentLimits: [
        {
          paymentLimitKey: 'POSTPAID-MAIN-RELATION',
          limitCycleType: 'B',
          limitType: 'M',
          limitValueType: 'A',
          limitValue: 20_000_000,
        },
      ],
    });

    await client.changePaymentRelation({
      primaryIdentity: '270105755',
      modifyPayRelation: {
        payRelationKey: 'HYBRID-POSTPAID-RELATION',
        paymentLimit: {
          operationType: 1,
          paymentLimitKey: 'HYBRID-POSTPAID-RELATION',
          limitValue: 50_000_000,
        },
      },
      paymentLimits: [
        {
          paymentLimitKey: 'HYBRID-POSTPAID-RELATION',
          limitCycleType: 'B',
          limitType: 'M',
          limitValueType: 'A',
          limitValue: 50_000_000,
        },
      ],
    });

    const [customer, prepaid, postpaid, hybrid, postpaidLimit, hybridLimit] = requests;
    assert.match(customer, /<bcc:OrgShortName>MK<\/bcc:OrgShortName>/);
    assert.match(customer, /<bcc:LimitValue>-1<\/bcc:LimitValue>/);

    assert.match(prepaid, /<bcs:RegisterCustomer OpType="1">/);
    assert.match(prepaid, /<bcs:PaymentMode>0<\/bcs:PaymentMode>/);
    assert.match(prepaid, /<bcc:InitBalance>30000000<\/bcc:InitBalance>/);
    assert.doesNotMatch(prepaid, /<bcs:PayRelationKey>/);

    assert.match(postpaid, /<bcs:RegisterCustomer OpType="2">/);
    assert.match(postpaid, /<bcc:LimitValue>0<\/bcc:LimitValue>/);
    assert.match(postpaid, /<bcs:PayRelationKey>POSTPAID-ACCOUNT<\/bcs:PayRelationKey>/);

    assert.match(hybrid, /<bcs:PaymentMode>2<\/bcs:PaymentMode>/);
    assert.match(
      hybrid,
      /<bcs:AcctKey>HYBRID-PREPAID<\/bcs:AcctKey><bcs:DEFAcctFlag>Y<\/bcs:DEFAcctFlag>/,
    );
    assert.match(
      hybrid,
      /<bcs:AcctKey>MK-MAIN<\/bcs:AcctKey><bcs:DEFAcctFlag>N<\/bcs:DEFAcctFlag>/,
    );

    assert.match(postpaidLimit, /<bcs:AddPayRelation>/);
    assert.match(
      postpaidLimit,
      /<bcs:PaymentLimitKey>POSTPAID-MAIN-RELATION<\/bcs:PaymentLimitKey>/,
    );
    assert.match(postpaidLimit, /<bcc:LimitValue>20000000<\/bcc:LimitValue>/);

    assert.match(hybridLimit, /<bcs:ModPayRelation>/);
    assert.match(hybridLimit, /<bcs:OpType>1<\/bcs:OpType>/);
    assert.match(hybridLimit, /<bcc:LimitValue>50000000<\/bcc:LimitValue>/);
  });
});
