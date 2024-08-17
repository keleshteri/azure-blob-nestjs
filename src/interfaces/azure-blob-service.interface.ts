import { BlockBlobUploadResponse } from '@azure/storage-blob';
import { Readable } from 'node:stream';

/**
 * IAzureBlobAdapterService
 */
export interface IAzureBlobAdapterService {
  listContainers(connectionString?: string): Promise<string[]>;
  uploadBlobStream(
    readableStream: Readable,
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<void>;
  uploadBlob(
    contentData: string | Buffer,
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<{ url: string; blobUploadResponse: BlockBlobUploadResponse }>;
  listBlobsInContainer(
    containerName: string,
    includeMetadata?: boolean,
    connectionString?: string,
  ): Promise<
    Array<{
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
      metadata?: { [propertyName: string]: string };
    }>
  >;
  listBlobNamesInContainer(
    containerName: string,
    connectionString?: string,
  ): Promise<string[]>;
  listBlobsWithPagination(
    containerName: string,
    includeMetadata?: boolean,
    connectionString?: string,
  ): Promise<
    Array<{
      name: string;
      createdOn: Date | undefined;
      lastModified: Date | undefined;
    }>
  >;
  addMetadataToBlob(
    containerName: string,
    blobName: string,
    metadata: { [key: string]: string },
    connectionString?: string,
  ): Promise<void>;
  downloadBlob(
    containerName: string,
    blobName: string,
    localPath: string,
    connectionString?: string,
  ): Promise<string>;
  downloadBlobStream(
    containerName: string,
    blobName: string,
    localPath: string,
    connectionString?: string,
  ): Promise<boolean>;
  downloadBlobString(
    containerName: string,
    blobName: string,
    connectionString?: string,
  ): Promise<string | null>;
  streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer>;
}
