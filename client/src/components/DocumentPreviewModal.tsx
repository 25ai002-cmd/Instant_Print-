import React, { useState, useEffect, useRef } from 'react';
import { X, Settings as SettingsIcon, Printer, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import type { PrintSettings } from '../types/index.js';

export interface PreviewFileItem {
  id?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  url?: string;
  previewUrl?: string;
  fileObj?: File;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: PreviewFileItem[];
  settings?: PrintSettings;
  initialFileIndex?: number;
  onConfirmPrint?: () => void;
  onOpenSettings?: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  settings = { copies: 1, colorMode: 'bw', sides: 'single', paperSize: 'A4' },
  initialFileIndex = 0,
  onConfirmPrint,
  onOpenSettings,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(initialFileIndex);
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});
  const [isDocxRendering, setIsDocxRendering] = useState<boolean>(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !files.length) return;

    setSelectedFileIdx(Math.min(initialFileIndex, files.length - 1));

    const urls: Record<number, string> = {};
    files.forEach((file, idx) => {
      if (file.fileObj) {
        urls[idx] = URL.createObjectURL(file.fileObj);
      } else if (file.previewUrl || file.url) {
        urls[idx] = file.previewUrl || file.url || '';
      }
    });

    setObjectUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [isOpen, files, initialFileIndex]);

  const activeFile = files[selectedFileIdx] || files[0];
  const activeUrl = objectUrls[selectedFileIdx] || activeFile?.previewUrl || activeFile?.url || '';

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
  const isBwMode = settings.colorMode === 'bw';

  const isImg = activeFile?.mimeType?.startsWith('image/') ||
    activeFile?.fileName?.match(/\.(png|jpe?g|webp|gif|bmp)$/i);
  const isPdf = activeFile?.mimeType === 'application/pdf' ||
    activeFile?.fileName?.toLowerCase().endsWith('.pdf');
  const isDocx = activeFile?.mimeType?.includes('wordprocessingml') ||
    activeFile?.fileName?.toLowerCase().endsWith('.docx');

  // Render DOCX file natively using docx-preview
  useEffect(() => {
    if (isDocx && activeFile?.fileObj && docxContainerRef.current) {
      setIsDocxRendering(true);
      const targetContainer = docxContainerRef.current;
      targetContainer.innerHTML = '';

      activeFile.fileObj.arrayBuffer().then((buffer) => {
        renderAsync(buffer, targetContainer, undefined, {
          inWrapper: false,
          ignoreWidth: false,
          ignoreHeight: false,
          className: 'docx-preview-sheet',
        })
          .catch((err) => console.warn('[DOCX Preview Warning]:', err))
          .finally(() => setIsDocxRendering(false));
      }).catch(() => setIsDocxRendering(false));
    }
  }, [selectedFileIdx, activeFile, isDocx]);

  if (!isOpen || !files.length || !activeFile) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '12px',
    }}>
      <div style={{
        backgroundColor: '#f1f5f9',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
      }}>
        {/* Top Header Bar (Blue theme) */}
        <div style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: 0,
              fontFamily: 'var(--font-heading)',
              color: 'white',
            }}>
              Print Preview
            </h3>
            <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: 600 }}>
              {activeFile.fileName} ({totalPages} Page{totalPages > 1 ? 's' : ''})
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Multi-File Tab Bar if multiple files */}
        {files.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#e2e8f0',
            borderBottom: '1px solid #cbd5e1',
            overflowX: 'auto',
          }}>
            {files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFileIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '99px',
                  border: '1px solid',
                  borderColor: selectedFileIdx === idx ? '#3b82f6' : '#cbd5e1',
                  backgroundColor: selectedFileIdx === idx ? '#3b82f6' : 'white',
                  color: selectedFileIdx === idx ? 'white' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.mimeType?.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                {file.fileName}
              </button>
            ))}
          </div>
        )}

        {/* Main Document Viewer (Native PDF, DOCX Preview, or Real Image Preview) */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isPdf ? 'stretch' : 'flex-start',
          backgroundColor: '#0f172a',
          position: 'relative',
        }}>
          {isPdf && activeUrl ? (
            /* Real Native PDF Viewer Embed */
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
            }}>
              <iframe
                src={`${activeUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                title={activeFile.fileName}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '520px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>
          ) : isDocx ? (
            /* Real DOCX Word Document Rendered Preview */
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}>
              {isDocxRendering && (
                <div style={{
                  padding: '24px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}>
                  <Loader2 className="animate-spin" size={20} color="#38bdf8" />
                  Rendering Word Document Pages...
                </div>
              )}
              <div
                ref={docxContainerRef}
                style={{
                  width: '100%',
                  maxWidth: '720px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  padding: '24px',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                  filter: isBwMode ? 'grayscale(100%)' : 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                }}
              />
            </div>
          ) : isImg && activeUrl ? (
            /* Real Image Preview Sheet */
            <div style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
            }}>
              <img
                src={activeUrl}
                alt={activeFile.fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }}
              />
            </div>
          ) : (
            /* Presentation Document Card Fallback */
            <div style={{
              width: '100%',
              maxWidth: '480px',
              height: '80%',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '12px',
                marginBottom: '16px',
              }}>
                <FileText size={28} color="#3b82f6" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{activeFile.fileName}</h4>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {activeFile.mimeType || 'Document'} • {activeFile.pageCount || 1} Page(s)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar (Printer Status + Big Green PRINT Button) */}
        <div style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {/* Printer Info Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Printer size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                  DCP-L2531DW series
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  Plain Paper, {settings.paperSize || 'A4'} • {settings.colorMode === 'bw' ? 'Black & White' : 'Color'} • {settings.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}
                </div>
              </div>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Printer Settings"
              >
                <SettingsIcon size={24} />
              </button>
            )}
          </div>

          {/* Prominent Green PRINT Button */}
          <button
            onClick={() => {
              onClose();
              if (onConfirmPrint) {
                onConfirmPrint();
              }
            }}
            style={{
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '1px',
              cursor: 'pointer',
              width: '100%',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
              transition: 'transform 0.1s, background-color 0.2s',
            }}
          >
            PRINT
          </button>
        </div>
      </div>
    </div>
  );
};
