import { WatcherSourceError } from '@petrify/core';

const VALID_DRIVE_ID = /^[a-zA-Z0-9_-]+$/;

export function validateDriveId(id: string): void {
  if (!id || !VALID_DRIVE_ID.test(id)) {
    throw new WatcherSourceError(`Invalid Google Drive ID: ${id}`);
  }
}
