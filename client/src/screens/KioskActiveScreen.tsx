import React from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { Smartphone, FileText, CheckCircle2, ShieldCheck, RefreshCw, XCircle } from 'lucide-react';

export const KioskActiveScreen: React.FC = () => {
  const {
    currentScreen,
    fileName,
    fileSize,
    analysis,
    cancelSession,
  } = useSessionStore();

  const getStepStatus = () => {
    switch (currentScreen) {
      case 'upload':
        return { title: 'Uploading Document', desc: 'Select document on your phone...' };
      case 'analysis':
        return { title: 'Document Analyzed', desc: 'Viewing page summary on your phone...' };
      case 'settings':
        return { title: 'Configuring Print Settings', desc: 'Selecting pages, copies & color on your phone...' };
      case 'payment':
        return { title: 'Awaiting Payment', desc: 'Proceeding to payment on your phone...' };
      default:
        return { title: 'Phone Connected', desc: 'Follow instructions on your phone...' };
    }
  };

  const status = getStepStatus();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      {/* Phone Connected Icon */}
      <div style={{
        width: '84px',
        height: '84px',
        borderRadius: '50%',
        backgroundColor: 'var(--success-light)',
        border: '3px solid #a7f3d0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: '0 12px 32px rgba(16, 185, 129, 0.25)',
        animation: 'pulseGlow 2.5s ease-in-out infinite',
      }}>
        <Smartphone size={44} color="var(--success)" strokeWidth={2} />
      </div>

      <h1 style={{
        fontSize: '28px',
        fontWeight: 800,
        marginBottom: '8px',
        fontFamily: 'var(--font-heading)',
        color: 'var(--text-primary)',
      }}>
        Follow Steps on Your Mobile Screen
      </h1>

      <p style={{
        fontSize: '16px',
        color: 'var(--text-secondary)',
        marginBottom: '32px',
        maxWidth: '380px',
        lineHeight: 1.5,
      }}>
        Your phone is connected to this kiosk. Please select document options and payment on your mobile device.
      </p>

      {/* Current Step Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
        marginBottom: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          backgroundColor: 'var(--primary-light)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--primary)',
        }}>
          <RefreshCw className="animate-spin" size={20} />
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, display: 'block' }}>
              {status.title}
            </span>
            <span style={{ fontSize: '12px', opacity: 0.85 }}>
              {status.desc}
            </span>
          </div>
        </div>

        {/* Uploaded File Info if available */}
        {fileName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            textAlign: 'left',
          }}>
            <FileText size={24} color="var(--primary)" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {fileName}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {analysis ? `${analysis.pageCount} pages detected` : 'File received'}
              </span>
            </div>
            <CheckCircle2 size={18} color="var(--success)" />
          </div>
        )}
      </div>

      {/* Cancel button in case user abandons kiosk */}
      <button
        onClick={cancelSession}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <XCircle size={15} /> Cancel &amp; Restart Kiosk
      </button>
    </div>
  );
};
