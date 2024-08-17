import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  BlobDownloadResponseParsed,
  BlobServiceClient,
  BlockBlobUploadResponse,
  ContainerListBlobsOptions,
  RestError,
} from '@azure/storage-blob';
import { AzureBlobConfiguration } from './interfaces/azure-blob-configuration.interface';
import { Readable } from 'stream';
import path from 'path';
import * as fs from 'fs';
import { IAzureBlobAdapterService } from './interfaces';
import { AzureBlobNotFoundException } from './exceptions';
@Injectable()
export class AzureBlobAdapterService implements IAzureBlobAdapterService {
  //Logger
  private readonly logger = new Logger(AzureBlobAdapterService.name);
  // private blobServiceClient: BlobServiceClient;
  private blobServiceClients = new Map<string, BlobServiceClient>();

  constructor(
    @Inject('AZURE_BLOB_CONFIGURATION')
    private config: AzureBlobConfiguration,
  ) {
    this.initializeBlobServiceClient(this.config.defaultConnectionString);
  }
  /**
   * getBlobServiceInstance
   * @returns
   */
  private initializeBlobServiceClient(connectionString: string) {
    try {
      const client = BlobServiceClient.fromConnectionString(connectionString);
      this.blobServiceClients.set(connectionString, client);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to get Blob Service instance: ${error.message}`,
        );
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * getBlobServiceClient
   * @param connectionString
   * @returns
   */
  private getBlobServiceClient(connectionString: string): BlobServiceClient {
    if (!this.blobServiceClients.has(connectionString)) {
      this.initializeBlobServiceClient(connectionString);
    }
    return this.blobServiceClients.get(connectionString);
  }

  /**
   * handleBlobError
   * @param error
   * @param action
   */
  private handleBlobError(error: unknown, action: string) {
    const errorMessage = `Failed to ${action}: ${(error as Error).message}`;
    this.logger.error(errorMessage);
    throw new BadRequestException(errorMessage);
  }
  /**
   * listContainers
   * @returns
   */
  async listContainers(connectionString?: string): Promise<string[]> {
    try {
      const client = this.getBlobServiceClient(
        connectionString || this.config.defaultConnectionString,
      );
      const containers: string[] = [];

      for await (const container of client.listContainers()) {
        containers.push(container.name);
      }
      return containers;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to list containers: ${error.message}`,
        );
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * uploadBlobStream
   */
  async uploadBlobStream(
    readableStream: Readable,
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<void> {
    try {
      const client = this.getBlobServiceClient(
        connectionString || this.config.defaultConnectionString,
      );
      const containerClient = client.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadStream(readableStream);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to upload stream to blob: ${error.message}`,
        );
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * uploadBlob
   */
  async uploadBlob(
    contentData: string | Buffer,
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<{ url: string; blobUploadResponse: BlockBlobUploadResponse }> {
    try {
      const client = this.getBlobServiceClient(
        connectionString || this.config.defaultConnectionString,
      );
      const containerClient = client.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const blobUploadResponse: BlockBlobUploadResponse =
        await blockBlobClient.upload(
          contentData,
          typeof contentData === 'string'
            ? contentData.length
            : contentData.byteLength,
        );
      this.logger.log(
        'Blob was uploaded successfully. requestId: ',
        blobUploadResponse.requestId,
      );

      this.logger.log(
        `Upload completed for ${blobName} container ${containerName}`,
      );
      return { url: blockBlobClient.url, blobUploadResponse };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to upload stream to blob: ${error.message}`,
        );
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
        throw new InternalServerErrorException('An unknown error occurred');
      }
    }
  }

  /**
   *
   * @param containerName
   * @returns
   */

  async listBlobsInContainer(
    containerName: string,
    includeMetadata?: boolean,
    connectionString?: string,
  ): Promise<
    {
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
      metadata?: { [propertyName: string]: string };
    }[]
  > {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const files: {
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
      metadata?: { [propertyName: string]: string };
    }[] = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      if (includeMetadata) {
        const blobClient = containerClient.getBlobClient(blob.name);
        const blobProperties = await blobClient.getProperties();

        files.push({
          name: blob.name,
          createdOn: blobProperties.createdOn,
          lastModified: blobProperties.lastModified,
          metadata: blobProperties.metadata,
        });
      } else {
        files.push({
          name: blob.name,
          createdOn: blob.properties.createdOn,
          lastModified: blob.properties.lastModified,
        });
      }
    }

    return files;
  }

  /**
   * listBlobNamesInContainer
   * @param containerName
   * @returns
   */
  async listBlobNamesInContainer(
    containerName: string,
    connectionString?: string,
  ): Promise<string[]> {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );

    const containerClient = client.getContainerClient(containerName);
    const files: string[] = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      files.push(blob.name);
    }
    return files;
  }

  /**
   * listBlobsWithPagination
   * @param containerName
   */
  async listBlobsWithPagination(
    containerName: string,
    includeMetadata?: boolean,
    connectionString?: string,
  ): Promise<
    {
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
    }[]
  > {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const files: {
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
    }[] = [];

    // Options for filtering and pagination
    const listOptions: ContainerListBlobsOptions = {
      includeCopy: false,
      includeDeleted: false,
      includeDeletedWithVersions: false,
      includeLegalHold: false,
      includeMetadata: includeMetadata || false, // Default to false if not provided
      includeSnapshots: false,
      includeTags: true,
      // includeUncommittedBlobs: false,
      includeVersions: false,
      prefix: '', // Filter by blob name prefix
    };

    // page size
    const maxPageSize = 100;
    let i = 1;
    let marker = undefined;
    while (true) {
      const iterator = containerClient
        .listBlobsFlat(listOptions)
        .byPage({ maxPageSize, continuationToken: marker });
      const response = await iterator.next();
      if (response.done || !response.value.segment.blobItems) {
        break;
      }

      // Promise.all to fetch blob
      const fetchBlobPropertiesPromises = response.value.segment.blobItems.map(
        async (blob) => {
          const blobClient = containerClient.getBlobClient(blob.name);
          const blobProperties = await blobClient.getProperties();
          return {
            name: blob.name,
            createdOn: blobProperties.createdOn,
            lastModified: blobProperties.lastModified,
          };
        },
      );

      const fetchedBlobProperties = await Promise.all(
        fetchBlobPropertiesPromises,
      );
      files.push(...fetchedBlobProperties);

      this.logger.log(
        `Flat listing: ${i} - ${i + fetchedBlobProperties.length - 1}`,
      );
      i += fetchedBlobProperties.length;

      marker = response.value.continuationToken;
    }

    return files;
  }

  /**
   * addMetadataToBlob
   * @param containerName
   * @param blobName
   * @param metadata
   * @returns
   */
  async addMetadataToBlob(
    containerName: string,
    blobName: string,
    metadata: { [key: string]: string },
    connectionString?: string,
  ): Promise<void> {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    // Get the current metadata of the blob
    const currentMetadata = await blobClient.getProperties();

    // Merge the new metadata with the existing metadata
    const newMetadata = { ...currentMetadata.metadata, ...metadata };
    this.logger.log(newMetadata);
    // Set the updated metadata on the blob
    await blobClient.setMetadata(newMetadata);

    this.logger.log(`Metadata added/updated for blob "${blobName}"`);
  }

  /**
   * downloadBlob
   * @param containerClient
   * @param blobName
   */
  async downloadBlob(
    containerName: string,
    blobName: string,
    localPath: string,
    connectionString?: string,
  ) {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    //create FilePath
    const fileNameWithPath = path.join(localPath, blobName);
    //create FileDir
    const blobFileDir = path.dirname(fileNameWithPath);
    //check if FileDir exists
    if (!fs.existsSync(blobFileDir)) {
      fs.mkdirSync(blobFileDir, { recursive: true });
    }
    try {
      await blobClient.downloadToFile(fileNameWithPath);
      this.logger.log(`downloadBlobToFile: download of ${blobName} success`);
      return fileNameWithPath;
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.logger.warn(`Blob "${blobName}" not found.`);
        return null;
      } else {
        this.logger.error('Error occurred while downloading the blob.');
        throw error;
      }
    }
  }
  /**
   * downloadBlobStream
   * @param containerClient
   * @param blobName
   */
  async downloadBlobStream(
    containerName: string,
    blobName: string,
    localPath: string,
    connectionString?: string,
  ): Promise<boolean> {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    //create FilePath
    const fileNameWithPath = path.join(localPath, blobName);
    //create FileDir
    const blobFileDir = path.dirname(fileNameWithPath);
    //check if FileDir exists
    if (!fs.existsSync(blobFileDir)) {
      fs.mkdirSync(blobFileDir, { recursive: true });
    }
    // writableStream
    const writableStream = fs.createWriteStream(fileNameWithPath, {
      encoding: 'utf-8',
      autoClose: true,
    });
    const downloadResponse: any = await blobClient.download();
    if (downloadResponse.status === 200) {
      downloadResponse.readableStreamBody.pipe(writableStream);
      this.logger.log(
        `downloadBlobAsStream: download of ${blobName} succeeded`,
      );
      return true;
    } else if (downloadResponse.status === 404) {
      this.logger.warn(`Blob "${blobName}" not found.`);
      return false;
    } else {
      this.logger.error('Error occurred while downloading the blob.');
      throw new Error('Failed to download the blob.');
    }
  }
  /**
   * downloadBlobString
   * @param containerClient
   * @param blobName
   */
  async downloadBlobString(
    containerName: string,
    blobName: string,
    connectionString?: string,
  ) {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    try {
      const exists = await blobClient.exists();
      if (!exists) {
        const errorMessage = `Azure: Blob ${blobName} does not exist in container ${containerName}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      const downloadResponse: BlobDownloadResponseParsed =
        await blobClient.download();

      if (downloadResponse.readableStreamBody) {
        const downloaded: any = await this.streamToBuffer(
          downloadResponse.readableStreamBody,
        );
        // const chunks: Buffer[] = [];

        // for await (const chunk of downloadResponse.readableStreamBody) {
        //   if (chunk instanceof Buffer) {
        //     chunks.push(chunk);
        //   } else {
        //     chunks.push(Buffer.from(chunk));
        //   }
        // }
        // const downloaded: Buffer = Buffer.concat(chunks);
        // this.logger.log('Downloaded blob content:', downloaded.toString());
        this.logger.log(
          ` downloadBlobString: download of ${blobName} success size ${downloaded.length}`,
        );
        return downloaded.toString();
      } else {
        this.logger.error('Error occurred while downloading the blob.');
        throw new Error('Failed to download the blob.');
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.logger.warn(`File not found -${blobName} on ${containerName}.`);
        return null;
      } else {
        this.logger.error(`Error loading blob "${blobName}":`, error);
        throw error;
      }
    }
  }
  /**
   * getWithUrl
   */
  async getWithUrl(
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<string> {
    const client = this.getBlobServiceClient(
      connectionString || this.config.defaultConnectionString,
    );
    const containerClient = client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    try {
      const exists = await blobClient.exists();
      if (!exists) {
        const errorMessage = `Azure: Blob ${blobName} does not exist in container ${containerName}`;
        this.logger.warn(errorMessage);
        return null;
      }
      const url = blobClient.url;
      this.logger.log(`Blob URL: ${url}`);
      return url;
    } catch (error: any) {
      return null;
    }
  }
  /**
   * Moves a blob from one container to another.
   *
   * @param sourceContainerName - The name of the source container.
   * @param sourceBlobName - The name of the source blob.
   * @param destinationContainerName - The name of the destination container.
   * @param destinationBlobName - The name of the destination blob.
   * @param metadata - Optional metadata to be added to the destination blob.
   * @param sourceConnectionString - Optional connection string for the source container.
   * @param destinationConnectionString - Optional connection string for the destination container.
   * @returns A Promise that resolves when the blob is successfully moved.
   * @throws BadRequestException if the input parameters are invalid or if the blob move fails.
   */
  async moveBlob(
    sourceContainerName: string,
    sourceBlobName: string,
    destinationContainerName: string,
    destinationBlobName: string,
    metadata?: { [key: string]: string },
    sourceConnectionString?: string,
    destinationConnectionString?: string,
  ): Promise<void> {
    const MAX_HEADER_SIZE = 8 * 1024;
    try {
      if (
        !sourceContainerName ||
        !sourceBlobName ||
        !destinationContainerName ||
        !destinationBlobName
      ) {
        throw new BadRequestException(
          'Invalid input parameters for moving blob.',
        );
      }
      // If the source and destination are the same, no need to move
      if (
        sourceContainerName === destinationContainerName &&
        sourceBlobName === destinationBlobName &&
        sourceConnectionString === destinationConnectionString
      ) {
        this.logger.log(
          `Source and destination are the same. No need to move the blob.`,
        );
        return;
      }
      const sourceClient = this.getBlobServiceClient(
        sourceConnectionString || this.config.defaultConnectionString,
      );
      const destinationClient = this.getBlobServiceClient(
        destinationConnectionString || this.config.defaultConnectionString,
      );
      this.logger.log(
        `Attempting to move ${sourceBlobName} from container ${sourceContainerName} to ${destinationBlobName} in container ${destinationContainerName}`,
      );

      // Get the source and destination blob clients
      const sourceBlobClient = sourceClient
        .getContainerClient(sourceContainerName)
        .getBlobClient(sourceBlobName);
      const destinationBlobClient = destinationClient
        .getContainerClient(destinationContainerName)
        .getBlobClient(destinationBlobName);

      this.logger.log(
        `Moving from ${sourceBlobClient.url} to ${destinationBlobClient.url}`,
      );

      // Get the source blob properties
      const sourceBlobProperties = await sourceBlobClient.getProperties();
      // Check if the metadata is too large
      if (metadata) {
        const metadataSize = JSON.stringify(metadata).length;
        if (metadataSize > MAX_HEADER_SIZE) {
          this.logger.error(
            `Metadata size is too large: ${metadataSize} bytes. Maximum allowed size is 8KB.`,
          );
          metadata = null;
        }
      }
      //Check sourceBlobProperties if the metadata is too large
      if (sourceBlobProperties.metadata) {
        const metadataSize = JSON.stringify(
          sourceBlobProperties.metadata,
        ).length;
        if (metadataSize > MAX_HEADER_SIZE) {
          this.logger.error(
            `Metadata size is too large: ${metadataSize} bytes. Maximum allowed size is 8KB.`,
          );
          metadata = null;
          sourceBlobProperties.metadata = {};
        }
      }

      await destinationBlobClient.beginCopyFromURL(sourceBlobClient.url, {
        metadata: {
          ...sourceBlobProperties.metadata,
          ...metadata,
        },
      });
      // Delete the source blob
      await sourceBlobClient.deleteIfExists();
      this.logger.log(
        `Blob "${sourceBlobName}" moved to "${destinationBlobName}"`,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error instanceof RestError) {
          // 404 error
          if (error.statusCode === 404) {
            throw new AzureBlobNotFoundException(
              `Blob "${sourceBlobName}" not found in container "${sourceContainerName}"`,
            );
          }
        }
        throw new BadRequestException(`Failed to move blob: ${error.message}`);
      } else {
        // Handle non-Error objects
        this.logger.error('An unknown error occurred', error);
      }
    }
  }

  /**
   * streamToBuffer
   * @param readableStream
   * @returns
   */
  async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }
}
