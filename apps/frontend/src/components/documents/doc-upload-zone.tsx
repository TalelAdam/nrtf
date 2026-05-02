"use client";

import { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useUploadDocument } from '@/hooks/use-extraction';
import type { ExtractionResult, ExtractionMode } from '@/hooks/use-extraction';

interface DocUploadZoneProps {
  onResult: (result: ExtractionResult) => void;
  mode: ExtractionMode;
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const ALLOWED_EXTS = '.pdf,.jpg,.jpeg,.png,.xlsx';

export function DocUploadZone({ onResult, mode }: DocUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const { mutate, isPending, error } = useUploadDocument();

  const handleFile = useCallback(
    (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|xlsx)$/i)) {
        alert('Unsupported file type. Please upload PDF, JPEG, PNG, or XLSX.');
        return;
      }
      mutate({ file, mode }, { onSuccess: onResult });
    },
    [mutate, onResult, mode],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`upload-zone${dragging ? ' upload-zone--over' : ''}${isPending ? ' upload-zone--loading' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <UploadCloud size={40} strokeWidth={1.4} />
      <p>Drag a PDF, JPEG, PNG, or XLSX here</p>
      <label className="upload-btn">
        Browse file
        <input type="file" accept={ALLOWED_EXTS} hidden onChange={onFileChange} />
      </label>
      {isPending && (
        <span className="upload-status">
          {mode === 'ocr' ? 'Running OCR + parsing…' : 'LLM extracting…'}
        </span>
      )}
      {error && <span className="upload-error">{error.message}</span>}
    </div>
  );
}
