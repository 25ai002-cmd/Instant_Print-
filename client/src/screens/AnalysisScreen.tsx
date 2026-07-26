import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { FileText, ChevronRight, RefreshCw, Image, File as FileIcon, CheckCircle2, Eye } from 'lucide-react';
import { PriceBreakdown } from '../components/PriceBreakdown.tsx';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal.tsx';

function getFileIcon(type: string) {
  if (type?.startsWith('image/')) return <Image size={20} color="var(--primary)" />;
  if (type === 'application/pdf') return <FileText size={20} color="#ef4444" />;
  return <FileIcon size={20} color="var(--primary)" />;
}

export const AnalysisScreen: React.FC = () => {
  const {
    fileName,
    fileSize,
    files,
    analysis,
    priceBreakdown,
    setScreen,
    cancelSession,
  } = useSessionStore();

  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [previewFileIdx, setPreviewFileIdx] = useState(0);

  if (!analysis || !priceBreakdown) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '24px',
        color: 'var(--text-secondary)',
      }}>
        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: '16px' }} />
        <span>Analyzing document details...</span>
      </div>
    );
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fileCount = files?.length || 1;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      padding: '24px 16px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '6px',
          fontFamily: 'var(--font-heading)',
        }}>
          {fileCount > 1 ? `${fileCount} Documents Analyzed` : 'Document Analyzed'}
        </h2>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          Combined summary for your print job.
        </p>
      </div>

      {/* File(s) list info card */}
      {files && files.length > 1 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '20px',
          maxHeight: '180px',
          overflowY: 'auto',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Uploaded Files ({files.length})
          </span>
          {files.map((file, idx) => (
            <div
              key={idx}
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
              {getFileIcon(file.mimeType)}
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {file.fileName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {formatSize(file.fileSize)}
                </span>
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-light)',
                padding: '3px 8px',
                borderRadius: '99px',
              }}>
                {file.pageCount} page{file.pageCount > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--primary-light)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
          }}>
            <FileText size={20} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
            <p style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {fileName}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {formatSize(fileSize || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Analysis summary grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <div style={{
          padding: '14px',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Pages</span>
          <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
            {analysis.pageCount}
          </p>
          {analysis.isEstimate && (
            <span style={{
              fontSize: '10px',
              color: 'var(--warning)',
              backgroundColor: 'var(--warning-light)',
              padding: '2px 6px',
              borderRadius: '99px',
              fontWeight: 600,
            }}>
              Estimate
            </span>
          )}
        </div>

        <div style={{
          padding: '14px',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Files</span>
          <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {fileCount}
          </p>
        </div>
      </div>

      {/* Instantly calculated Price Breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <PriceBreakdown breakdown={priceBreakdown} />
      </div>

      {/* Action buttons */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <button
          onClick={() => {
            setPreviewFileIdx(0);
            setIsPreviewOpen(true);
          }}
          className="btn btn-secondary"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
            backgroundColor: 'var(--primary-light)',
          }}
        >
          <Eye size={18} /> View Print Preview
        </button>

        <button
          onClick={() => setScreen('settings')}
          className="btn btn-primary"
        >
          Customize Settings <ChevronRight size={18} />
        </button>

        <button
          onClick={cancelSession}
          className="btn btn-secondary"
        >
          Cancel Print
        </button>
      </div>

      {isPreviewOpen && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setIsPreviewOpen(false)}
          files={files && files.length > 0 ? files : [{
            fileName: fileName || 'Document.pdf',
            fileSize: fileSize || 0,
            mimeType: 'application/pdf',
            pageCount: analysis?.pageCount || 1,
          }]}
          onConfirmPrint={() => setScreen('payment')}
          onOpenSettings={() => setScreen('settings')}
        />
      )}
    </div>
  );
};
