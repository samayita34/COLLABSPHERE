import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * StorageService interface defining the operations needed for S3-compatible storage.
 * This abstracts away the underlying implementation (S3, MinIO, or Local Disk).
 */
export interface StorageService {
    uploadFile(key: string, buffer: Buffer, mimeType?: string): Promise<string>;
    deleteFile(key: string): Promise<void>;
    getFileUrl(key: string): Promise<string>;
    getFileBuffer(key: string): Promise<Buffer>;
}

/**
 * Local implementation of StorageService that writes to the disk.
 * Used for development when Docker/MinIO or AWS credentials are not available.
 */
export class LocalDiskStorageService implements StorageService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(__dirname, "../../../uploads");
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async uploadFile(key: string, buffer: Buffer, mimeType?: string): Promise<string> {
        // Sanitize key to prevent path traversal
        const safeKey = key.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        const filePath = path.join(this.uploadDir, safeKey);
        
        // Ensure subdirectories exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await fs.promises.writeFile(filePath, buffer);
        return filePath;
    }

    async deleteFile(key: string): Promise<void> {
        const safeKey = key.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        const filePath = path.join(this.uploadDir, safeKey);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    async getFileUrl(key: string): Promise<string> {
        const safeKey = key.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        // Serve through the backend's static file serving, but maybe we want a dedicated endpoint for downloads?
        return `/api/files/download/${encodeURIComponent(safeKey)}`;
    }

    async getFileBuffer(key: string): Promise<Buffer> {
        const safeKey = key.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        const filePath = path.join(this.uploadDir, safeKey);
        if (!fs.existsSync(filePath)) {
            throw new Error("File not found");
        }
        return await fs.promises.readFile(filePath);
    }
}

// In a real production setup, we'd export an S3StorageService instance if env vars are set.
export const storageService: StorageService = new LocalDiskStorageService();
