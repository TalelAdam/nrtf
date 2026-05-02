import { Injectable, Logger } from '@nestjs/common';

/** Document classification result */
export type DocumentKind =
  | 'native_pdf'    // PDF with selectable text (≥ 100 chars on page 0)
  | 'scanned_pdf'   // PDF with no extractable text — needs OCR
  | 'scanned_image' // JPEG / PNG / TIFF — direct OCR
  | 'excel'         // XLSX / XLS / XLSM
  | 'unknown';

export interface FileProbeResult {
  kind: DocumentKind;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  /** Page count (PDF) or sheet count (Excel) if determinable without full parse */
  pageCount?: number;
}

@Injectable()
export class FileTypeService {
  private readonly logger = new Logger(FileTypeService.name);

  /**
   * Determine the document kind from the buffer + original filename.
   * Does NOT parse the full document — just reads magic bytes and headers.
   */
  probe(buffer: Buffer, filename: string): FileProbeResult {
    const ext = this.extension(filename);
    const mime = this.guessMime(buffer, ext);
    const sizeBytes = buffer.length;

    if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)) {
      return { kind: 'excel', mimeType: mime, extension: ext, sizeBytes };
    }

    if (['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp', 'webp'].includes(ext)) {
      return { kind: 'scanned_image', mimeType: mime, extension: ext, sizeBytes };
    }

    if (ext === 'pdf' || mime === 'application/pdf') {
      // Detect if the PDF contains selectable text by looking for BT (begin text) markers
      const snippet = buffer.slice(0, Math.min(buffer.length, 65_536)).toString('latin1');
      const hasText = (snippet.match(/BT\s/g) ?? []).length > 3;
      const kind: DocumentKind = hasText ? 'native_pdf' : 'scanned_pdf';
      this.logger.debug(`PDF probed as ${kind} (BT markers: ${(snippet.match(/BT\s/g) ?? []).length})`);
      return { kind, mimeType: 'application/pdf', extension: 'pdf', sizeBytes };
    }

    this.logger.warn(`Unknown file type: filename=${filename}, ext=${ext}`);
    return { kind: 'unknown', mimeType: mime, extension: ext, sizeBytes };
  }

  private extension(filename: string): string {
    return (filename.split('.').pop() ?? '').toLowerCase().trim();
  }

  private guessMime(buffer: Buffer, ext: string): string {
    // Magic-byte sniffing for common types
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf'; // %PDF
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'application/zip'; // ZIP-based (XLSX)

    const extMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    };
    return extMap[ext] ?? 'application/octet-stream';
  }
}
