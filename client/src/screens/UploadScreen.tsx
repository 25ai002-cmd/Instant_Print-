import React, { useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { UploadCloud, FileText, AlertCircle, Loader2, X, Image, File as FileIcon, Plus, Eye } from 'lucide-react';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal.tsx';

interface UploadScreenProps {
  isMobile?: boolean;
  onCancel?: () => void;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const MAX_SIZE_MB = 100;

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image size={24} color="var(--primary)" />;
  if (type === 'application/pdf') return <FileText size={24} color="#ef4444" />;
  return <FileIcon size={24} color="var(--primary)" />;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ isMobile = false, onCancel }) => {
  const { uploadFile, loading, error, cancelSession } = useSessionStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `"${file.name}" exceeds ${MAX_SIZE_MB}MB limit.`;
    }
    const acceptedMimes = Object.keys(ACCEPTED_TYPES);
    if (!acceptedMimes.includes(file.type)) {
      const ext = file.name.toLowerCase().split('.').pop();
      const allExts = Object.values(ACCEPTED_TYPES).flat();
      if (!allExts.includes(`.${ext}`)) {
        return `"${file.name}" has an unsupported format. Please use PDF, DOCX, PPTX, PNG, JPG, or WEBP.`;
      }
    }
    return null;
  };

  const handleFiles = (files: FileList | null) => {
    setLocalError(null);
    if (!files || files.length === 0) return;

    const validNewFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const err = validateFile(file);
      if (err) {
        setLocalError(err);
        return;
      }
      validNewFiles.push(file);
    }

    setSelectedFiles((prev) => [...prev, ...validNewFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLocalError(null);
    try {
      await uploadFile(selectedFiles);
    } catch (e: any) {
      console.error('Upload failed', e);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSession();
    } catch (_) {}
    onCancel?.();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const displayError = error || localError;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      padding: isMobile ? '20px 16px' : '24px 16px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          backgroundColor: 'var(--primary-light)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
          margin: '0 auto 12px auto',
        }}>
          <UploadCloud size={28} />
        </div>

        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          marginBottom: '6px',
          fontFamily: 'var(--font-heading)',
        }}>
          Select Documents to Print
        </h2>

        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          maxWidth: '300px',
          margin: '0 auto',
        }}>
          Upload single or multiple PDFs, Word docs, PowerPoint, or image files.
        </p>
      </div>

      {/* Upload Drop Zone / Select Button */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '24px 16px',
          textAlign: 'center',
          backgroundColor: isDragOver ? 'var(--primary-light)' : 'white',
          cursor: 'pointer',
          transition: 'var(--transition)',
          marginBottom: '16px',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
          }}>
            <Plus size={24} />
          </div>

          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>
            Tap to Choose Files (PDFs, Images, Docs)
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Supports selecting multiple files at once
          </span>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '20px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Selected Files ({selectedFiles.length})
          </span>

          {selectedFiles.map((file, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {getFileIcon(file.type)}
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {formatSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex(index);
                }}
                style={{
                  border: 'none',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
                title="Preview File"
              >
                <Eye size={13} /> Preview
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-tertiary)',
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error alert */}
      {displayError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          backgroundColor: 'var(--error-light)',
          border: '1px solid #fee2e2',
          borderRadius: 'var(--radius-md)',
          color: 'var(--error)',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '16px',
        }}>
          <AlertCircle size={16} />
          <span>{displayError}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {selectedFiles.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Uploading {selectedFiles.length} File(s)...
              </>
            ) : (
              `Upload ${selectedFiles.length} File(s)`
            )}
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          Cancel
        </button>
      </div>

      {previewIndex !== null && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewIndex(null)}
          files={selectedFiles.map((f) => ({
            fileName: f.name,
            fileSize: f.size,
            mimeType: f.type,
            fileObj: f,
          }))}
          initialFileIndex={previewIndex}
        />
      )}
    </div>
  );
};
