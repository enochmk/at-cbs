import 'dotenv/config';
import { CbsClient } from '../../src';

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env.`);
  return value;
}

export function client(): CbsClient {
  return new CbsClient({
    baseUrl: required('CBS_BASE_URL'),
    username: required('CBS_USERNAME'),
    password: required('CBS_PASSWORD'),
    rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED !== 'false',
    logger: {
      info: (message, context) => console.info('[INFO]', message, context ?? ''),
      warn: (message, context) => console.warn('[WARN]', message, context ?? ''),
      error: (message, context) => console.error('[ERROR]', message, context ?? ''),
      verbose: (message, context) => console.info('[VERBOSE]', message, context ?? ''),
    },
  });
}

export async function run(name: string, operation: () => Promise<unknown>): Promise<void> {
  try {
    console.log(`\n=== ${name} ===`);
    console.dir(await operation(), { depth: null });
  } catch (error: any) {
    console.error(`${name} failed:`, error.message);
    if (error.status) console.error('HTTP status:', error.status);
    if (error.resultCode) console.error('CBS result code:', error.resultCode);
    process.exitCode = 1;
  }
}

export async function execute<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    console.log(`\n=== ${name} ===`);
    const result = await operation();
    console.dir(result, { depth: null });
    return result;
  } catch (error: any) {
    console.error(`${name} failed:`, error.message);
    if (error.status) console.error('HTTP status:', error.status);
    if (error.resultCode) console.error('CBS result code:', error.resultCode);
    throw error;
  }
}
