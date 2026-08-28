import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CbsClient } from '../src';

const successResponse = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
      <bcs:QueryPaymentRelationResultMsg xmlns:bcs="http://www.huawei.com/bme/cbsinterface/bcservices">
        <bcs:ResultHeader>
          <cbs:ResultCode xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">0</cbs:ResultCode>
          <cbs:ResultDesc xmlns:cbs="http://www.huawei.com/bme/cbsinterface/cbscommon">Success</cbs:ResultDesc>
        </bcs:ResultHeader>
        <bcs:QueryPaymentRelationResult>
          <bcs:PaymentRelationList>
            <bcs:PayRelation>
              <bcs:PayRelationKey>PAY-ENT-274174218-PARENT</bcs:PayRelationKey>
            </bcs:PayRelation>
          </bcs:PaymentRelationList>
        </bcs:QueryPaymentRelationResult>
      </bcs:QueryPaymentRelationResultMsg>
    </soapenv:Body>
  </soapenv:Envelope>`;

test('queryPaymentRelation sends parent account code and subscriber MSISDN', async () => {
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

    const result = await client.queryPaymentRelation('0241744218', {
      payAccountCode: 'ENT00000000006',
    });

    assert.match(
      requestBody,
      /<bcs:PayAccount>\s*<bcc:AccountCode>ENT00000000006<\/bcc:AccountCode>\s*<\/bcs:PayAccount>/,
    );
    assert.match(
      requestBody,
      /<bcs:PaymentObj>\s*<bcs:SubAccessCode>\s*<bcc:PrimaryIdentity>241744218<\/bcc:PrimaryIdentity>/,
    );
    const relationList = result.data['bcs:PaymentRelationList'] as Record<string, unknown>;
    const relation = relationList['bcs:PayRelation'] as Record<string, unknown>;
    assert.equal(relation['bcs:PayRelationKey'], 'PAY-ENT-274174218-PARENT');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
