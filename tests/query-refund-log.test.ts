import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <ars:QueryRefundLogResultMsg xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices">
        <ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </ResultHeader>
        <QueryRefundLogResult>
          <ars:RefundLogInfo>
            <ars:AcctKey>123</ars:AcctKey>
            <ars:RefundId>456</ars:RefundId>
            <ars:RefundTime>20261005120000</ars:RefundTime>
            <ars:RefundAmount>25000</ars:RefundAmount>
            <ars:CurrencyID>1054</ars:CurrencyID>
            <ars:CreditConsumeRule>P</ars:CreditConsumeRule>
            <ars:Reason>TEST</ars:Reason>
            <ars:OperID>99</ars:OperID>
            <ars:OperAccount>operator</ars:OperAccount>
            <ars:DeptID>77</ars:DeptID>
            <ars:DeptCode>FIN</ars:DeptCode>
            <ars:Status>F</ars:Status>
            <ars:RefundChannel>
              <ars:PaymentMethod>A</ars:PaymentMethod>
              <ars:BankInfo>
                <arc:BankCode xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">001</arc:BankCode>
                <arc:AcctNo xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">123456</arc:AcctNo>
              </ars:BankInfo>
            </ars:RefundChannel>
            <ars:Remark>Refund note</ars:Remark>
            <ars:AdditionalProperty>
              <arc:Code xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">SOURCE</arc:Code>
              <arc:Value xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">CRM</arc:Value>
            </ars:AdditionalProperty>
            <ars:RefundSerialNo>R-0001</ars:RefundSerialNo>
          </ars:RefundLogInfo>
          <ars:TotalRowNum>1</ars:TotalRowNum>
          <ars:BeginRowNum>0</ars:BeginRowNum>
          <ars:FetchRowNum>50</ars:FetchRowNum>
        </QueryRefundLogResult>
      </ars:QueryRefundLogResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('queryRefundLog serializes the request and preserves complete refund data', async () => {
  let requestPath = '';
  let requestBody = '';
  const server: Server = createServer((request, response) => {
    requestPath = request.url ?? '';
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
    const result = await client.queryRefundLog('560043149', {
      startTime: '20260101000000',
      endTime: '20261005235959',
      startRow: 0,
      pageSize: 50,
    });

    assert.equal(requestPath, '/services/ArServices');
    assert.match(requestBody, /<ars:QueryRefundLogRequestMsg>/);
    assert.match(requestBody, /<cbs:BusinessCode>QueryRefundLog<\/cbs:BusinessCode>/);
    assert.match(
      requestBody,
      /<ars:SubAccessCode>\s*<arc:PrimaryIdentity>560043149<\/arc:PrimaryIdentity>/,
    );
    assert.match(requestBody, /<ars:StartTime>20260101000000<\/ars:StartTime>/);
    assert.match(requestBody, /<ars:EndTime>20261005235959<\/ars:EndTime>/);
    assert.match(requestBody, /<ars:TotalRowNum>0<\/ars:TotalRowNum>/);
    assert.match(requestBody, /<ars:BeginRowNum>0<\/ars:BeginRowNum>/);
    assert.match(requestBody, /<ars:FetchRowNum>50<\/ars:FetchRowNum>/);

    assert.equal(result.refunds.length, 1);
    const refund = result.refunds[0];
    assert(refund);
    assert.equal(refund['ars:RefundId'], '456');
    assert.equal(refund['ars:RefundAmount'], '25000');
    assert.equal(refund['ars:RefundChannel']?.['ars:PaymentMethod'], 'A');
    assert.equal(refund['ars:RefundChannel']?.['ars:BankInfo']?.['arc:AcctNo'], '123456');
    const additionalProperty = refund['ars:AdditionalProperty'];
    assert.equal(
      Array.isArray(additionalProperty)
        ? additionalProperty[0]?.['arc:Code']
        : additionalProperty?.['arc:Code'],
      'SOURCE',
    );
    assert.equal(result.data['ars:RefundLogInfo'] !== undefined, true);
    assert.equal(result.metadata.ResultHeader?.['cbs:ResultCode'], '0');
    assert.deepEqual(result.pagination, {
      totalRows: 1,
      startRow: 0,
      pageSize: 50,
      rowsReturned: 1,
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('queryRefundLog validates CBS paging limits before sending a request', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1:1',
    username: 'test-user',
    password: 'test-password',
    rejectUnauthorized: false,
  });

  await assert.rejects(client.queryRefundLog('560043149', { pageSize: 1001 }), {
    status: 400,
  });
  await assert.rejects(client.queryRefundLog('560043149', { totalRows: 65535 }), {
    status: 400,
  });
  await assert.rejects(client.queryRefundLog('560043149', { startRow: 65535 }), {
    status: 400,
  });
});
