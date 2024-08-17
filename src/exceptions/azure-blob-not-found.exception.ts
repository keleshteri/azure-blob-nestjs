export class AzureBlobNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AzureBlobNotFoundException';
  }
}
