import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AzureBlobAdapterService } from './azure-blob.service';
import { AzureBlobAsyncOptions } from './interfaces/azure-blob-async-options.interface';
import { AzureBlobConfiguration } from './interfaces/azure-blob-configuration.interface';

@Module({
  // imports: [],
  // providers: [AzureBlobAdapterService],
  // exports: [AzureBlobAdapterService],
})
export class AzureBlobModule {
  static forRoot(config: AzureBlobConfiguration): DynamicModule {
    const providers = [
      {
        provide: 'AZURE_BLOB_CONFIGURATION',
        useValue: config,
      },
      AzureBlobAdapterService,
    ];

    return {
      module: AzureBlobModule,
      providers: providers,
      exports: providers,
    };
  }

  static forRootAsync(options: AzureBlobAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'AZURE_BLOB_CONFIGURATION',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      AzureBlobAdapterService,
    ];

    return {
      module: AzureBlobModule,
      providers: providers,
      exports: providers,
    };
  }
}
