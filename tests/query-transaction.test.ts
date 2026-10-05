import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <ars:QueryTransactionResultMsg xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices">
        <ars:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </ars:ResultHeader>
        <ars:QueryTransactionResult>
          <ars:TransactionInfo>
            <ars:AcctKey>560043149</ars:AcctKey>
            <ars:AcctCode>ACC-560043149</ars:AcctCode>
            <ars:CustKey>CUST-560043149</ars:CustKey>
            <ars:SubKey>SUB-560043149</ars:SubKey>
            <ars:PrimaryIdentity>560043149</ars:PrimaryIdentity>
            <ars:AccountBalance>-100000</ars:AccountBalance>
            <ars:TransType>CNT</ars:TransType>
            <ars:ChannelID>3</ars:ChannelID>
            <ars:TransAmount>-100000</ars:TransAmount>
            <ars:TaxAmount>0</ars:TaxAmount>
            <ars:CurrencyID>1054</ars:CurrencyID>
            <ars:TransTime>20261005120000</ars:TransTime>
            <ars:TransID>12345</ars:TransID>
            <ars:SrcTransID>12344</ars:SrcTransID>
            <ars:ExtTransID>EXT-12345</ars:ExtTransID>
            <ars:OperID>101</ars:OperID>
            <ars:OperAccount>operator</ars:OperAccount>
            <ars:DeptID>10</ars:DeptID>
            <ars:DeptCode>DEPT-10</ars:DeptCode>
            <ars:ReasonCode>TEST</ars:ReasonCode>
            <ars:Status>N</ars:Status>
            <ars:Remark>Test transaction</ars:Remark>
            <ars:AdditionalProperty>
              <arc:Code xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">OWNERID</arc:Code>
              <arc:Value xmlns:arc="http://cbs.huawei.com/ar/wsservice/arcommon">OWNER-1</arc:Value>
            </ars:AdditionalProperty>
            <ars:UnmodeledField>preserved</ars:UnmodeledField>
          </ars:TransactionInfo>
          <ars:TotalRowNum>1</ars:TotalRowNum>
          <ars:BeginRowNum>0</ars:BeginRowNum>
          <ars:FetchRowNum>1</ars:FetchRowNum>
        </ars:QueryTransactionResult>
      </ars:QueryTransactionResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('queryTransaction searches subscriber transaction logs by MSISDN', async () => {
  let requestPath = '';
  const requestBodies: string[] = [];
  const server: Server = createServer((request, response) => {
    requestPath = request.url ?? '';
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requestBodies.push(Buffer.concat(chunks).toString());
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

    const result = await client.queryTransaction('560043149', {
      startTime: '20261001000000',
      endTime: '20261005235959',
      pageSize: 1,
    });

    assert.equal(requestPath, '/services/ArServices');
    const firstRequest = requestBodies[0] ?? '';
    assert.match(firstRequest, /<ars:QueryTransactionRequestMsg>/);
    assert.match(
      firstRequest,
      /<ars:QueryObj>\s*<ars:SubAccessCode>\s*<arc:PrimaryIdentity>560043149<\/arc:PrimaryIdentity>/,
    );
    assert.match(firstRequest, /<ars:StartTime>20261001000000<\/ars:StartTime>/);
    assert.match(firstRequest, /<ars:EndTime>20261005235959<\/ars:EndTime>/);
    assert.match(firstRequest, /<ars:TotalRowNum>0<\/ars:TotalRowNum>/);
    assert.match(firstRequest, /<ars:BeginRowNum>0<\/ars:BeginRowNum>/);
    assert.match(firstRequest, /<ars:FetchRowNum>1<\/ars:FetchRowNum>/);

    const transactionInfo = result.transactions[0];
    assert(transactionInfo);
    assert.equal(transactionInfo['ars:PrimaryIdentity'], '560043149');
    assert.equal(transactionInfo['ars:TransAmount'], '-100000');
    assert.equal(transactionInfo['ars:Remark'], 'Test transaction');
    assert.equal(transactionInfo['ars:UnmodeledField'], 'preserved');
    assert.equal(result.data['ars:TransactionInfo'] !== undefined, true);
    assert.equal(result.data['ars:TotalRowNum'], '1');
    assert.deepEqual(result.pagination, {
      totalRows: 1,
      startRow: 0,
      pageSize: 1,
      rowsReturned: 1,
    });

    await client.queryTransaction('560043149', {
      totalRows: result.pagination.totalRows,
      startRow: result.pagination.startRow + result.pagination.rowsReturned,
      pageSize: 1,
    });
    const nextRequest = requestBodies[1] ?? '';
    assert.match(nextRequest, /<ars:TotalRowNum>1<\/ars:TotalRowNum>/);
    assert.match(nextRequest, /<ars:BeginRowNum>1<\/ars:BeginRowNum>/);
    assert.match(nextRequest, /<ars:FetchRowNum>1<\/ars:FetchRowNum>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('queryTransaction rejects invalid page sizes before making a CBS request', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1:1',
    username: 'test-user',
    password: 'test-password',
  });

  await assert.rejects(client.queryTransaction('560043149', { pageSize: 1001 }), {
    status: 400,
    message: 'pageSize must be an integer from 1 to 1000',
  });
});
