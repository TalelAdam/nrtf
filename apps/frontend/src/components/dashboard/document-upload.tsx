"use client";

import { FileUp, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type UploadStatus = "Pending" | "Uploading" | "Done" | "Error";

type UploadEntry = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  message?: string;
};

const UPLOAD_ENDPOINT =
  process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT || "/api/v1/documents/upload";

const ACCEPTED_FILE_TYPES = ".pdf,.xls,.xlsx,.csv,image/*";

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function makeEntry(file: File): UploadEntry {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    progress: 0,
    status: "Pending",
  };
}

export function DocumentUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (fileList: FileList | File[]) => {
    const nextFiles = Array.from(fileList).map(makeEntry);
    setFiles((current) => [...current, ...nextFiles]);
  };

  const updateFile = (id: string, patch: Partial<UploadEntry>) => {
    setFiles((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const uploadFile = (entry: UploadEntry) => {
    return new Promise<void>((resolve) => {
      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append("filename", entry.file.name);

      const request = new XMLHttpRequest();
      request.open("POST", UPLOAD_ENDPOINT);

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        updateFile(entry.id, {
          progress: Math.round((event.loaded / event.total) * 100),
          status: "Uploading",
        });
      };

      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          updateFile(entry.id, {
            progress: 100,
            status: "Done",
            message: undefined,
          });
        } else {
          updateFile(entry.id, {
            status: "Error",
            message: `HTTP ${request.status}: upload rejected`,
          });
        }

        resolve();
      };

      request.onerror = () => {
        updateFile(entry.id, {
          status: "Error",
          message: "Network error while uploading",
        });
        resolve();
      };

      updateFile(entry.id, { progress: 0, status: "Uploading", message: undefined });
      request.send(formData);
    });
  };

  const uploadAll = async () => {
    const pending = files.filter(
      (entry) => entry.status === "Pending" || entry.status === "Error",
    );

    for (const entry of pending) {
      await uploadFile(entry);
    }
  };

  const hasUploadableFiles = files.some(
    (entry) => entry.status === "Pending" || entry.status === "Error",
  );

  return (
    <div className="upload-card">
      <h2>Document Intake</h2>
      <p>Endpoint: {UPLOAD_ENDPOINT}</p>

      <div
        className={`drop-zone${isDragging ? " dragging" : ""}`}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <div>
          <UploadCloud color="#00e5ff" size={38} strokeWidth={1.5} />
          <strong>Drop files to stage upload</strong>
          <small>PDF, Excel, CSV, Images</small>
          <button
            className="browse-button"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <FileUp size={16} strokeWidth={1.8} />
            Browse Files
          </button>
          <input
            accept={ACCEPTED_FILE_TYPES}
            hidden
            multiple
            onChange={(event) => {
              if (event.target.files) {
                addFiles(event.target.files);
              }

              event.target.value = "";
            }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>

      {files.length > 0 ? (
        <div className="file-list" aria-live="polite">
          {files.map((entry) => (
            <div className="file-row" key={entry.id}>
              <div>
                <div className="file-name">{entry.file.name}</div>
                <div className="file-size">{formatFileSize(entry.file.size)}</div>
              </div>
              <span
                className={`status-badge status-${entry.status.toLowerCase()}`}
              >
                {entry.status}
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${entry.progress}%` }}
                />
              </div>
              {entry.message ? (
                <div className="file-message">{entry.message}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <button
        className="upload-button"
        disabled={!hasUploadableFiles}
        onClick={uploadAll}
        type="button"
      >
        Upload All
      </button>
    </div>
  );
}
