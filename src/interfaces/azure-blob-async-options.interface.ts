import { AzureBlobConfiguration } from './azure-blob-configuration.interface';

/**
 * AzureBlobAsyncOptions
 */
export interface AzureBlobAsyncOptions {
  // useFactory: (...args: any[]) => Promise<AzureBlobConfiguration | undefined>;
  useFactory: (
    ...args: any[]
  ) => AzureBlobConfiguration | Promise<AzureBlobConfiguration>;
  inject?: any[];
}
