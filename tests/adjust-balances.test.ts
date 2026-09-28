import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <ars:AdjustmentResultMsg xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices" xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">
        <ars:ResultHeader xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">
          <cbs:ResultCode>0</cbs:ResultCode>
          <cbs:ResultDesc>Success</cbs:ResultDesc>
        </ars:ResultHeader>
        <ars:AdjustmentResult>
          <ars:AdjustmentInfo>
            <arc:BalanceType>C_BONUS_FUND</arc:BalanceType>
            <arc:OldBalanceAmt>100</arc:OldBalanceAmt>
            <arc:NewBalanceAmt>200</arc:NewBalanceAmt>
          </ars:AdjustmentInfo>
          <ars:FreeUnitAdjustmentInfo>
            <ars:FreeUnitInstanceID>135200000011313842</ars:FreeUnitInstanceID>
            <ars:OldBalanceAmt>0</ars:OldBalanceAmt>
            <ars:NewBalanceAmt>50</ars:NewBalanceAmt>
          </ars:FreeUnitAdjustmentInfo>
        </ars:AdjustmentResult>
      </ars:AdjustmentResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('serializes monetary and free-unit changes in one CBS adjustment request', async () => {
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
      username: '102',
      password: 'test-password',
      rejectUnauthorized: false,
    });
    const result = await client.adjustBalances('0271004887', {
      adjustmentSerialNo: 'MOVE-1',
      accounts: [
        {
          balanceType: 'C_BONUS_FUND',
          adjustmentAmt: 100,
          expireTime: '20260922000000',
        },
      ],
      adjustments: [
        {
          freeUnitInstanceId: '135200000011313842',
          adjustmentAmt: '50',
          expireTime: '20370101000000',
        },
      ],
    });

    assert.equal(result.data.accounts.length, 1);
    assert.equal(result.data.accounts[0]?.NewBalanceAmt, 200);
    assert.equal(result.data.adjustments.length, 1);
    assert.equal(result.data.adjustments[0]?.FreeUnitInstanceID, '135200000011313842');
    assert.equal(
      (requestBody.match(/<ars:AdjustmentSerialNo>MOVE-1<\/ars:AdjustmentSerialNo>/g) ?? []).length,
      1,
    );
    assert.equal((requestBody.match(/<ars:OpType>1<\/ars:OpType>/g) ?? []).length, 1);
    assert.equal((requestBody.match(/<ars:AdjustmentInfo>/g) ?? []).length, 1);
    assert.equal((requestBody.match(/<ars:FreeUnitAdjustmentInfo>/g) ?? []).length, 1);
    assert.ok(
      requestBody.indexOf('<ars:AdjustmentInfo>') <
        requestBody.indexOf('<ars:FreeUnitAdjustmentInfo>'),
    );
    assert.match(requestBody, /<arc:BalanceType>C_BONUS_FUND<\/arc:BalanceType>/);
    assert.match(
      requestBody,
      /<ars:FreeUnitInstanceID>135200000011313842<\/ars:FreeUnitInstanceID>/,
    );
    assert.doesNotMatch(requestBody, /<ars:SelectInstanceMode>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('rejects a combined adjustment with no account or free-unit entries', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1:1',
    username: '102',
    password: 'test-password',
    rejectUnauthorized: false,
  });

  await assert.rejects(
    client.adjustBalances('0271004887', { accounts: [], adjustments: [] }),
    /At least one account or free-unit adjustment is required/,
  );
});
