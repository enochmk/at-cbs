import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <ars:QueryRechargeLogResultMsg xmlns:ars="http://www.huawei.com/bme/cbsinterface/arservices">
        <ars:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </ars:ResultHeader>
        <ars:QueryRechargeLogResult>
          <ars:RechargeInfo>
            <ars:TradeTime>20261005120000</ars:TradeTime>
            <ars:PrimaryIdentity>560043149</ars:PrimaryIdentity>
            <ars:TransID>12345</ars:TransID>
            <ars:ExtTransID>EXT-12345</ars:ExtTransID>
            <ars:RechargeAmount>10000</ars:RechargeAmount>
            <ars:CurrencyID>1054</ars:CurrencyID>
            <ars:RechargeType>1</ars:RechargeType>
            <ars:ResultCode>0</ars:ResultCode>
            <ars:ReversalFlag>0</ars:ReversalFlag>
          </ars:RechargeInfo>
          <ars:TotalRowNum>1</ars:TotalRowNum>
          <ars:BeginRowNum>0</ars:BeginRowNum>
          <ars:FetchRowNum>50</ars:FetchRowNum>
        </ars:QueryRechargeLogResult>
      </ars:QueryRechargeLogResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('queryRechargeLog serializes filters and returns normalized recharge paging', async () => {
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

    const result = await client.queryRechargeLog('560043149', {
      startTime: '20261001000000',
      endTime: '20261005235959',
      pageSize: 50,
      extTransId: 'EXT&<42',
      rechargeResult: 1,
      rechargeChannelIds: ['1', '3'],
      subscriberLevelOnly: true,
    });

    assert.equal(requestPath, '/services/ArServices');
    assert.match(requestBody, /<ars:QueryRechargeLogRequestMsg>/);
    assert.match(requestBody, /<cbs:BusinessCode>1<\/cbs:BusinessCode>/);
    assert.match(requestBody, /<cbs:TimeType>2<\/cbs:TimeType>/);
    assert.match(
      requestBody,
      /<ars:QueryObj>\s*<ars:SubAccessCode>\s*<arc:PrimaryIdentity>560043149<\/arc:PrimaryIdentity>/,
    );
    assert.match(
      requestBody,
      /<ars:RechargeChannelIDs><ars:RechargeChannelID>1<\/ars:RechargeChannelID><ars:RechargeChannelID>3<\/ars:RechargeChannelID><\/ars:RechargeChannelIDs>/,
    );
    assert.match(requestBody, /<ars:TotalRowNum>0<\/ars:TotalRowNum>/);
    assert.match(requestBody, /<ars:BeginRowNum>0<\/ars:BeginRowNum>/);
    assert.match(requestBody, /<ars:FetchRowNum>50<\/ars:FetchRowNum>/);
    assert.match(requestBody, /<ars:StartTime>20261001000000<\/ars:StartTime>/);
    assert.match(requestBody, /<ars:EndTime>20261005235959<\/ars:EndTime>/);
    assert.match(requestBody, /<ars:ExtTransID>EXT&amp;&lt;42<\/ars:ExtTransID>/);
    assert.match(requestBody, /<ars:RechargeResult>1<\/ars:RechargeResult>/);
    assert.match(
      requestBody,
      /<ars:AdditionalProperty><arc:Code>C_SUB_LOG<\/arc:Code><arc:Value>1<\/arc:Value><\/ars:AdditionalProperty>/,
    );
    const schemaFieldOrder = [
      '<ars:QueryObj>',
      '<ars:RechargeChannelIDs>',
      '<ars:TotalRowNum>',
      '<ars:BeginRowNum>',
      '<ars:FetchRowNum>',
      '<ars:StartTime>',
      '<ars:EndTime>',
      '<ars:ExtTransID>',
      '<ars:RechargeResult>',
      '<ars:AdditionalProperty>',
    ].map((field) => requestBody.indexOf(field));
    assert.deepEqual(
      schemaFieldOrder,
      [...schemaFieldOrder].sort((left, right) => left - right),
      'request fields follow the order in the CBS schema',
    );

    const recharge = result.recharges[0];
    assert(recharge);
    assert.equal(recharge['ars:PrimaryIdentity'], '560043149');
    assert.equal(recharge['ars:RechargeAmount'], '10000');
    assert.equal(result.data['ars:RechargeInfo'] !== undefined, true);
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

test('queryRechargeLog rejects incompatible filters and paging before CBS request', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1:1',
    username: 'test-user',
    password: 'test-password',
  });
  const timeRange = { startTime: '20261001000000', endTime: '20261005235959' };

  await assert.rejects(
    client.queryRechargeLog('560043149', {
      ...timeRange,
      rechargeType: 'site-type',
      innerRechargeType: '1',
    }),
    {
      status: 400,
      message: 'rechargeType and innerRechargeType cannot both be specified',
    },
  );
  await assert.rejects(client.queryRechargeLog('560043149', { ...timeRange, pageSize: 501 }), {
    status: 400,
    message: 'pageSize must be an integer from 1 to 500',
  });
});
