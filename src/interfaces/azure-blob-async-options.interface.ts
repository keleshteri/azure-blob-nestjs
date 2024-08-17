import { AzureBlobOptions } from './azure-blob-options.interface';

/**
 * AzureBlobAsyncOptions
 */
export interface AzureBlobAsyncOptions {
  // useFactory: (...args: any[]) => Promise<AzureBlobConfiguration | undefined>;
  useFactory: (
    ...args: any[]
  ) => AzureBlobOptions | Promise<AzureBlobOptions>;
  inject?: any[];
}
