import { client, required, run } from './_client';

const c = client();

await run('ChangeCustInfo', () =>
  c.changeCustomerInfo({
    customerKey: process.env.CBS_CUSTOMER_KEY,
    customerCode: process.env.CBS_CUSTOMER_CODE,
    customerSegment: process.env.CBS_CUSTOMER_SEGMENT,
    individual: {
      idType: process.env.CBS_CUSTOMER_ID_TYPE,
      idNumber: '',
      firstName: process.env.CBS_CUSTOMER_FIRST_NAME,
      lastName: process.env.CBS_CUSTOMER_LAST_NAME,
      mobilePhone: process.env.CBS_CUSTOMER_MOBILE,
      email: required('CBS_CUSTOMER_EMAIL'),
    },
  }),
);
