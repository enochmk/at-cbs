import { client, required, run } from './_client';

const c = client();
await run('CreateCustomer', () =>
  c.createCustomer({
    registerCustKey: required('CBS_REGISTER_CUSTOMER_KEY'),
    customerKey: required('CBS_CUSTOMER_KEY'),
    customerCode: process.env.CBS_CUSTOMER_CODE,
    customerType: process.env.CBS_CUSTOMER_TYPE ?? '1',
    customerNodeType: process.env.CBS_CUSTOMER_NODE_TYPE ?? '1',
    customerClass: process.env.CBS_CUSTOMER_CLASS ?? '1',
    customerSegment: process.env.CBS_CUSTOMER_SEGMENT,
    individual: process.env.CBS_CUSTOMER_FIRST_NAME
      ? {
          idType: process.env.CBS_CUSTOMER_ID_TYPE,
          idNumber: process.env.CBS_CUSTOMER_ID_NUMBER,
          firstName: process.env.CBS_CUSTOMER_FIRST_NAME,
          lastName: process.env.CBS_CUSTOMER_LAST_NAME,
          mobilePhone: process.env.CBS_CUSTOMER_MOBILE,
          email: process.env.CBS_CUSTOMER_EMAIL,
        }
      : undefined,
  }),
);
