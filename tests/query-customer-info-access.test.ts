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
              <bcc:SubIdentity xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
                <bcc:SubIdentityType>1</bcc:SubIdentityType>
                <bcc:SubIdentity>271004887</bcc:SubIdentity>
                <bcc:PrimaryFlag>1</bcc:PrimaryFlag>
              </bcc:SubIdentity>
              <bcc:SubIdentity xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">
                <bcc:SubIdentityType>2</bcc:SubIdentityType>
                <bcc:SubIdentity>620031078105814</bcc:SubIdentity>
                <bcc:PrimaryFlag>2</bcc:PrimaryFlag>
              </bcc:SubIdentity>
            </bcs:SubscriberInfo>
            <bcs:SubPaymentMode>
              <bcs:PaymentMode>1</bcs:PaymentMode>
            </bcs:SubPaymentMode>
          </bcs:Subscriber>
        </bcs:QueryCustomerInfoResult>
      </bcs:QueryCustomerInfoResultMsg>
    </soapenv:Body>
    </soapenv:Envelope>`;

const subscriberBalancesResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:QueryCustomerInfoResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
        <bcs:QueryCustomerInfoResult>
          <bcs:Subscriber>
            <bcs:SubscriberInfo><bcc:Status xmlns:bcc="http://www.huawei.com/bme/cbsinterface/bccommon">2</bcc:Status></bcs:SubscriberInfo>
            <bcs:AcctList>
              <bcs:AcctKey>ACCT-1</bcs:AcctKey>
              <bcs:BalanceResult>
                <bcs:BalanceType>C_MAIN_ACCOUNT</bcs:BalanceType>
                <bcs:BalanceTypeName>PPS_MainAccount</bcs:BalanceTypeName>
                <bcs:TotalAmount>14746000</bcs:TotalAmount>
                <bcs:ReservedAmount>100000</bcs:ReservedAmount>
                <bcs:CurrencyID>1054</bcs:CurrencyID>
                <bcs:BalanceDetail>
                  <bcs:BalanceInstanceID>BAL-1</bcs:BalanceInstanceID>
                  <bcs:Amount>14746000</bcs:Amount>
                  <bcs:InitialAmount>0</bcs:InitialAmount>
                  <bcs:EffectiveTime>20260912154852</bcs:EffectiveTime>
                  <bcs:ExpireTime>20370101000000</bcs:ExpireTime>
                  <bcs:LastUpdateTime>20260913100850</bcs:LastUpdateTime>
                </bcs:BalanceDetail>
              </bcs:BalanceResult>
            </bcs:AcctList>
            <bcs:FreeUnitInfo>
              <bcs:FreeUnitItem>
                <bcs:FreeUnitType>DATA-1</bcs:FreeUnitType>
                <bcs:FreeUnitTypeName>BigTime Data</bcs:FreeUnitTypeName>
                <bcs:MeasureUnit>1106</bcs:MeasureUnit>
                <bcs:MeasureUnitName>Bytes</bcs:MeasureUnitName>
                <bcs:TotalInitialAmount>1000000</bcs:TotalInitialAmount>
                <bcs:TotalUnusedAmount>750000</bcs:TotalUnusedAmount>
                <bcs:TotalReserveAmount>25000</bcs:TotalReserveAmount>
                <bcs:FreeUnitItemDetail>
                  <bcs:FreeUnitInstanceID>FU-1</bcs:FreeUnitInstanceID>
                  <bcs:InitialAmount>1000000</bcs:InitialAmount>
                  <bcs:CurrentAmount>750000</bcs:CurrentAmount>
                  <bcs:EffectiveTime>20260913100850</bcs:EffectiveTime>
                  <bcs:ExpireTime>20370101000000</bcs:ExpireTime>
                  <bcs:UsagePriority>1</bcs:UsagePriority>
                  <bcs:RollOverFlag>N</bcs:RollOverFlag>
                  <bcs:ReserveValidTime>20260913100850</bcs:ReserveValidTime>
                  <bcs:LastUpdateTime>20260913100850</bcs:LastUpdateTime>
                </bcs:FreeUnitItemDetail>
              </bcs:FreeUnitItem>
              <bcs:FreeUnitItem>
                <bcs:FreeUnitType>VOICE-1</bcs:FreeUnitType>
                <bcs:FreeUnitTypeName>Voice Minutes</bcs:FreeUnitTypeName>
                <bcs:MeasureUnit>1003</bcs:MeasureUnit>
                <bcs:MeasureUnitName>Seconds</bcs:MeasureUnitName>
                <bcs:TotalInitialAmount>3600</bcs:TotalInitialAmount>
                <bcs:TotalUnusedAmount>1800</bcs:TotalUnusedAmount>
                <bcs:FreeUnitItemDetail>
                  <bcs:FreeUnitInstanceID>FU-2</bcs:FreeUnitInstanceID>
                  <bcs:InitialAmount>1800</bcs:InitialAmount>
                  <bcs:CurrentAmount>900</bcs:CurrentAmount>
                </bcs:FreeUnitItemDetail>
                <bcs:FreeUnitItemDetail>
                  <bcs:FreeUnitInstanceID>FU-3</bcs:FreeUnitInstanceID>
                  <bcs:InitialAmount>1800</bcs:InitialAmount>
                  <bcs:CurrentAmount>900</bcs:CurrentAmount>
                </bcs:FreeUnitItemDetail>
              </bcs:FreeUnitItem>
            </bcs:FreeUnitInfo>
          </bcs:Subscriber>
        </bcs:QueryCustomerInfoResult>
      </bcs:QueryCustomerInfoResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

const subscriberNotFoundResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:QueryCustomerInfoResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">20000003</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Subscriber does not exist</cbs:ResultDesc>
        </bcs:ResultHeader>
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
    assert.deepEqual(result.data.SubscriberIdentities, [
      { SubIdentityType: 1, SubIdentity: 271004887, PrimaryFlag: 1 },
      { SubIdentityType: 2, SubIdentity: 620031078105814, PrimaryFlag: 2 },
    ]);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('queryCustomerInfo exposes account balances and free-unit totals with details', async () => {
  const server: Server = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/xml');
    response.end(subscriberBalancesResponse);
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

    assert.equal(result.data.AcctList?.[0]?.AcctKey, 'ACCT-1');
    assert.equal(result.data.AcctList?.[0]?.BalanceResult?.[0]?.TotalAmount, 14746000);
    assert.equal(result.data.AcctList?.[0]?.BalanceResult?.[0]?.BalanceDetail?.Amount, 14746000);
    assert.equal(result.data.FreeUnits?.[0]?.FreeUnitTypeName, 'BigTime Data');
    assert.equal(result.data.FreeUnits?.[0]?.TotalInitialAmount, 1000000);
    assert.equal(result.data.FreeUnits?.[0]?.TotalUnusedAmount, 750000);
    assert.equal(result.data.FreeUnits?.[0]?.FreeUnitItemDetail?.[0]?.CurrentAmount, 750000);
    assert.equal(result.data.FreeUnits?.[1]?.FreeUnitItemDetail?.length, 2);
    assert.equal(result.data.FreeUnits?.[1]?.FreeUnitItemDetail?.[1]?.CurrentAmount, 900);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('queryCustomerInfo treats CBS result code 20000003 as a normal not-found result', async () => {
  const server: Server = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/xml');
    response.end(subscriberNotFoundResponse);
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  const logs: string[] = [];
  try {
    const client = new CbsClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      username: 'test-user',
      password: 'test-password',
      logger: {
        info: (message) => logs.push(message),
        warn: (message) => logs.push(`warn:${message}`),
      },
    });

    const result = await client.queryCustomerInfo('271004887');

    assert.deepEqual(result.data, {});
    assert.match(logs[0] ?? '', /subscriber not found/);
    assert.equal(
      logs.some((message) => message.startsWith('warn:')),
      false,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
