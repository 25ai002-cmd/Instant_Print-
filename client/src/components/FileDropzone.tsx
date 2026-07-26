import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface FileDropzoneProps {
  onFileAccepted: (file: File) => void;
  maxSizeMb?: number;
  loading?: boolean;
  error?: string | null;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileAccepted,
  maxSizeMb = 100,
  loading = false,
  error = null,
}) => {
  const [localError, setLocalError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      setLocalError(null);

      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setLocalError(`File is too large. Max size is ${maxSizeMb}MB.`);
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setLocalError('Unsupported file format. Please upload PDF, DOCX, PPTX, PNG, or JPG.');
        } else {
          setLocalError(rejection.errors[0]?.message || 'File upload failed');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted, maxSizeMb]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: maxSizeMb * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    disabled: loading,
  });

  const displayError = error || localError;

  return (
    <div style={{ width: '100%' }}>
      <div
        {...getRootProps()}
        style={{
          border: '2px dashed',
          borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive ? 'var(--primary-light)' : 'white',
          transition: 'var(--transition)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          outline: 'none',
        }}
      >
        <input {...getInputProps()} />
        
        {loading ? (
          <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        ) : (
          <Upload
            size={48}
            color={isDragActive ? 'var(--primary)' : 'var(--text-secondary)'}
            style={{ transition: 'var(--transition)' }}
          />
        )}

        <div>
          <p style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
            marginBottom: '4px',
          }}>
            {loading ? 'Uploading & Analyzing...' : isDragActive ? 'Drop your document here' : 'Select document to print'}
          </p>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
          }}>
            Supports PDF, DOCX, PPTX, PNG, JPG (Max {maxSizeMb}MB)
          </p>
        </div>
      </div>

      {displayError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--error-light)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid #fee2e2',
          marginTop: '16px',
          color: 'var(--error)',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
};
