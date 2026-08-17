import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src/cbs-client';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:ChangeSubStatusResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
      </bcs:ChangeSubStatusResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('changeSubscriberStatus uses MSISDN identity and sends NewStatus for CBS ChangeSubStatusRequest', async () => {
  let requestBody = '';
  const server: Server = createServer((request, response) => {
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      requestBody += chunk;
    });
    request.on('end', () => {
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
      logger: {},
    });

    await client.changeSubscriberStatus('270118755', {
      status: 'SUSPEND',
      subscriberKey: 'SUB-IGNORED-KEY',
    });

    assert.match(requestBody, /<bcs:OpType>12<\/bcs:OpType>/);
    assert.match(requestBody, /<bcs:NewStatus>4<\/bcs:NewStatus>/);
    assert.doesNotMatch(requestBody, /<bcs:Status>/);
    assert.match(requestBody, /<bcc:PrimaryIdentity>270118755<\/bcc:PrimaryIdentity>/);
    assert.doesNotMatch(requestBody, /<bcc:SubscriberKey>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('changeSubscriberStatus maps reason-specific operations to the target CBS status', async () => {
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
      logger: {},
    });

    const cases = [
      { operation: 'ARREARS_RESUME' as const, status: 'ACTIVE' as const, opType: 30, newStatus: 2 },
      {
        operation: 'CREDIT_CONTROL_BARRING' as const,
        status: 'CALL_BARRING' as const,
        opType: 41,
        newStatus: 3,
      },
      {
        operation: 'OPERATOR_SUSPENSION' as const,
        status: 'SUSPEND' as const,
        opType: 62,
        newStatus: 4,
      },
    ];

    for (const item of cases) {
      await client.changeSubscriberStatus('270118755', item);
      const requestBody = requests.at(-1) ?? '';
      assert.match(requestBody, new RegExp(`<bcs:OpType>${item.opType}</bcs:OpType>`));
      assert.match(requestBody, new RegExp(`<bcs:NewStatus>${item.newStatus}</bcs:NewStatus>`));
      assert.match(requestBody, /<bcc:PrimaryIdentity>270118755<\/bcc:PrimaryIdentity>/);
      assert.doesNotMatch(requestBody, /<bcc:SubscriberKey>/);
    }
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('changeSubscriberStatus rejects mismatched operation and status', async () => {
  const client = new CbsClient({
    baseUrl: 'http://127.0.0.1',
    username: 'test-user',
    password: 'test-password',
  });

  await assert.rejects(
    client.changeSubscriberStatus('270118755', {
      status: 'SUSPEND',
      operation: 'CUSTOMER_BARRING',
    }),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 400);
      assert.equal((error as Error).message, 'Subscriber status and operation do not match');
      return true;
    },
  );
});
