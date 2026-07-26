import React, { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Printer, FileText, Image as ImageIcon } from 'lucide-react';
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
  onConfirmPrint,
  onOpenSettings,
}) => {
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isOpen || !files.length) return;

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
  }, [isOpen, files]);

  if (!isOpen || !files.length) return null;

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 1), 0);

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
              {totalPages} Page(s)
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

        {/* Main Clean Document Cards Preview Canvas */}
        <div style={{
          flex: 1,
          padding: '24px 20px',
          overflowX: 'auto',
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: files.length <= 2 ? 'center' : 'flex-start',
          gap: '20px',
          backgroundColor: '#e2e8f0',
        }}>
          {files.map((file, fileIdx) => {
            const isImg = file.mimeType?.startsWith('image/') ||
              file.fileName.match(/\.(png|jpe?g|webp|gif|bmp)$/i);
            const imgUrl = objectUrls[fileIdx];
            const pCount = file.pageCount || 1;

            return (
              <React.Fragment key={fileIdx}>
                {Array.from({ length: pCount }).map((_, pageIdx) => (
                  <div
                    key={`${fileIdx}-${pageIdx}`}
                    style={{
                      minWidth: '240px',
                      maxWidth: '280px',
                      height: '380px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                      border: '3px solid #cbd5e1',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Real Image Preview or Rendered Document Page */}
                    {isImg && imgUrl ? (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        backgroundColor: '#f8fafc',
                        borderRadius: '4px',
                      }}>
                        <img
                          src={imgUrl}
                          alt={file.fileName}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '330px',
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        backgroundColor: '#f8fafc',
                        padding: '12px',
                        borderRadius: '4px',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #cbd5e1',
                          paddingBottom: '6px',
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6' }}>
                            DOCUMENT PAGE
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                            {pageIdx + 1}/{pCount}
                          </span>
                        </div>

                        <span style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {file.fileName}
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                          <div style={{ height: '8px', backgroundColor: '#3b82f6', borderRadius: '2px', width: '85%' }} />
                          <div style={{ height: '6px', backgroundColor: '#94a3b8', borderRadius: '2px', width: '95%' }} />
                          <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '2px', width: '90%' }} />
                          <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '2px', width: '70%' }} />

                          <div style={{
                            padding: '8px',
                            backgroundColor: '#eff6ff',
                            borderLeft: '3px solid #3b82f6',
                            borderRadius: '3px',
                            marginTop: '8px',
                          }}>
                            <div style={{ height: '6px', backgroundColor: '#3b82f6', width: '60%', marginBottom: '4px' }} />
                            <div style={{ height: '5px', backgroundColor: '#93c5fd', width: '80%' }} />
                          </div>

                          <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '2px', width: '90%' }} />
                          <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '2px', width: '60%' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
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
