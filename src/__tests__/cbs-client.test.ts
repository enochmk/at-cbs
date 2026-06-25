import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { CbsClient } from '../cbs-client';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios, true);

function createMockResponse(data: string) {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as any };
}

function createSuccessSoapResponse(resultMsg: string, body: string) {
  return `<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header />
  <soapenv:Body>
    <${resultMsg}>
      <ResultHeader>
        <CommandId>Test</CommandId>
        <Version>1</Version>
        <TransactionId />
        <SequenceId>1</SequenceId>
        <ResultCode>405000000</ResultCode>
        <ResultDesc>Operation successful.</ResultDesc>
      </ResultHeader>
      ${body}
    </${resultMsg}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

describe('CbsClient', () => {
  let client: CbsClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CbsClient({
      url: 'http://test-server:7782/services/CBSInterfaceBusinessMgrService',
      username: 'testuser',
      password: 'testpass',
    });
  });

  describe('integrationEnquiry', () => {
    it('should return typed IntegrationEnquiryResponse', async () => {
      const soapResponse = createSuccessSoapResponse(
        'IntegrationEnquiryResultMsg',
        `<IntegrationEnquiryResult>
          <BalanceRecordList>
            <BalanceRecord>
              <BalanceDesc>Account Balance</BalanceDesc>
              <Balance>100</Balance>
              <MinMeasureId>101</MinMeasureId>
              <UnitType>1</UnitType>
              <AccountType>2000</AccountType>
              <ExpireTime>20370101000000</ExpireTime>
              <AccountCredit>0</AccountCredit>
              <AccountKey>999000001050400381</AccountKey>
            </BalanceRecord>
          </BalanceRecordList>
          <SubscriberState>
            <LifeCycleState>1</LifeCycleState>
            <DPFlag>0</DPFlag>
            <FraudState>0</FraudState>
          </SubscriberState>
        </IntegrationEnquiryResult>`,
      );

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      const result = await client.integrationEnquiry('271004887');

      expect(result.ResultHeader).toBeDefined();
      expect(result.ResultHeader?.ResultCode).toBe(405000000);
      expect(result.IntegrationEnquiryResult).toBeDefined();
      expect(result.IntegrationEnquiryResult?.SubscriberState?.LifeCycleState).toBe(1);
      expect(result.IntegrationEnquiryResult?.BalanceRecordList?.BalanceRecord).toBeDefined();
    });
  });

  describe('createSubscriber', () => {
    it('should return typed NewSubscriberResponse', async () => {
      const soapResponse = createSuccessSoapResponse(
        'NewSubscriberResultMsg',
        `<NewSubscriberResult>
          <ProductOrderInfo>
            <ProductID>2018255138</ProductID>
            <ProductOrderKey>999000003002368504</ProductOrderKey>
            <EffectiveDate>20260625205116</EffectiveDate>
            <ExpireDate>20370101000000</ExpireDate>
            <AutoType>1</AutoType>
          </ProductOrderInfo>
        </NewSubscriberResult>`,
      );

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      const result = await client.createSubscriber('271004887');

      expect(result.ResultHeader).toBeDefined();
      expect(result.ResultHeader?.ResultCode).toBe(405000000);
      expect(result.NewSubscriberResult).toBeDefined();
      expect(result.NewSubscriberResult?.ProductOrderInfo).toBeDefined();
      expect((result.NewSubscriberResult?.ProductOrderInfo as any).ProductID).toBe(2018255138);
    });
  });

  describe('deleteSubscriber', () => {
    it('should return typed DeleteSubscriberResponse', async () => {
      const soapResponse = createSuccessSoapResponse(
        'DeleteSubscriberResultMsg',
        '',
      );

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      const result = await client.deleteSubscriber('271004887');

      expect(result.ResultHeader).toBeDefined();
      expect(result.ResultHeader?.ResultCode).toBe(405000000);
    });
  });

  describe('queryBasicInfo', () => {
    it('should return typed QueryBasicInfoResponse', async () => {
      const soapResponse = createSuccessSoapResponse(
        'QueryBasicInfoResultMsg',
        `<QueryBasicInfoResult>
          <Customer>
            <Name>John Doe</Name>
            <Code>123456</Code>
            <Birthday>19900101000000</Birthday>
            <Address>Accra</Address>
          </Customer>
        </QueryBasicInfoResult>`,
      );

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      const result = await client.queryBasicInfo('271004887');

      expect(result.ResultHeader).toBeDefined();
      expect(result.ResultHeader?.ResultCode).toBe(405000000);
      expect(result.QueryBasicInfoResult).toBeDefined();
      expect(result.QueryBasicInfoResult?.Customer?.Name).toBe('John Doe');
    });
  });

  describe('error handling', () => {
    it('should throw error on CBS error code', async () => {
      const soapResponse = createSuccessSoapResponse(
        'IntegrationEnquiryResultMsg',
        '<IntegrationEnquiryResult />',
      ).replace('405000000', '200000001').replace('Operation successful.', 'Subscriber not found');

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      await expect(client.integrationEnquiry('271004887')).rejects.toThrow('Subscriber not found');
    });

    it('should throw error on network failure', async () => {
      (mockedAxios.post as any).mockRejectedValueOnce(new Error('Network Error'));

      await expect(client.integrationEnquiry('271004887')).rejects.toThrow('Network Error');
    });

    it('should throw error on SOAP fault', async () => {
      const soapFault = `<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header />
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>soapenv:Server</faultcode>
      <faultstring>Invalid subscriber</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapFault));

      await expect(client.integrationEnquiry('271004887')).rejects.toThrow('Invalid subscriber');
    });
  });

  describe('normalizeMsisdn', () => {
    it('should normalize 12-digit MSISDN to 9 digits', async () => {
      const soapResponse = createSuccessSoapResponse(
        'IntegrationEnquiryResultMsg',
        '<IntegrationEnquiryResult />',
      );

      (mockedAxios.post as any).mockResolvedValueOnce(createMockResponse(soapResponse));

      await client.integrationEnquiry('233271004887');

      const calledPayload = (mockedAxios.post as any).mock.calls[0][1] as string;
      expect(calledPayload).toContain('<bus1:SubscriberNo>271004887</bus1:SubscriberNo>');
    });

    it('should throw error for invalid MSISDN length', async () => {
      await expect(client.integrationEnquiry('12345')).rejects.toThrow('MSISDN must be 9, 10, or 12 digits');
    });
  });
});
