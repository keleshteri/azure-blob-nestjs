import { registerAs } from '@nestjs/config';
export interface AzureBlobStorageConfig {
  /**
   * The Azure Storage connection string.
   */
  connectionString: string;

  /**
   * Azure Storage account name.
   */
  accountName: string;

  /**
   * Azure Storage account key.
   */
  accountKey: string;

  /**
   * Azure Storage endpoint suffix.
   */
  endpointSuffix: string;

  /**
   * Azure Storage default endpoints protocol.
   */
  defaultEndpointsProtocol: string;
}
export enum AzureBlobConnectionType {
  XmlService = 'xmlService',
  ImageService = 'imageService',
}
export interface AzureBlobConfig {
  storageAccounts: Record<string, string>;
  //default is temporarily
  default: AzureBlobStorageConfig;
  xmlService: AzureBlobStorageConfig;
  imageService: AzureBlobStorageConfig;
}

function extractValue(connectionString: string, key: string): string {
  // const match = connectionString.match(new RegExp(`${key}=(.*?);`, 'i'));
  const match = connectionString.match(new RegExp(`${key}=([^;]+)(;|$)`, 'i'));
  return match ? match[1] : '';
}
function createServiceConfig(
  connectionString: string,
): AzureBlobStorageConfig | undefined {
  if (!connectionString) {
    console.warn('Connection string is undefined or empty.');
    return undefined;
  }

  const accountName = extractValue(connectionString, 'AccountName');
  if (!accountName) {
    console.warn('Account name is missing in the connection string.');
    return undefined;
  }

  return {
    connectionString,
    accountName,
    defaultEndpointsProtocol:
      extractValue(connectionString, 'DefaultEndpointsProtocol') || '',
    accountKey: extractValue(connectionString, 'AccountKey') || '',
    endpointSuffix: extractValue(connectionString, 'EndpointSuffix') || '',
  };
}

/**
 * registerAs
 */
export const AzureBlobConfiguration = registerAs(
  'azure.blob',
  (): AzureBlobConfig => {
    const xmlConnectionString =
      process.env.AZURE_BLOB_XML_CONNECTION_STRING || '';
    const imagesConnectionString =
      process.env.AZURE_BLOB_IMAGES_CONNECTION_STRING || '';
    const defaultConnectionString =
      process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING || '';

    const xmlServiceConfig = createServiceConfig(xmlConnectionString);
    const imageServiceConfig = createServiceConfig(imagesConnectionString);
    const defaultServiceConfig = createServiceConfig(defaultConnectionString);
    if (!defaultServiceConfig) {
      throw new Error('Invalid Azure Blob Storage configuration.');
    }
    // if (!xmlServiceConfig || !imageServiceConfig) {
    //   throw new Error('Invalid Azure Blob Storage configuration.');
    // }
    //xmlConnectionString: process.env.AZURE_BLOB_XML_CONNECTION_STRING,
    // imagesConnectionString: process.env.AZURE_BLOB_IMAGES_CONNECTION_STRING,

    return {
      storageAccounts: {
        [AzureBlobConnectionType.XmlService]: xmlConnectionString,
        [AzureBlobConnectionType.ImageService]: imagesConnectionString,
      },
      default: defaultServiceConfig,
      xmlService: xmlServiceConfig,
      imageService: imageServiceConfig,
    };
  },
);
