import React from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { PrinterAnimation } from '../components/PrinterAnimation.tsx';
import { usePolling } from '../hooks/usePolling.ts';
import { AlertTriangle, Clock } from 'lucide-react';

export const PrintingScreen: React.FC = () => {
  const { printJob, pollPrintJob } = useSessionStore();

  // Poll print job status every 1.5 seconds
  usePolling(
    async () => {
      const isDone = await pollPrintJob();
      return isDone;
    },
    1500,
    true
  );

  const progress = printJob?.progress || 0;
  const printedPages = printJob?.printedPages || 0;
  const totalPages = printJob?.totalPages || 1;

  // Calculate estimated time remaining
  const secondsLeft = Math.max(
    0,
    Math.round(((100 - progress) / 100) * (printJob?.estimatedSeconds || 10))
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      padding: '40px 16px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          marginBottom: '4px',
          fontFamily: 'var(--font-heading)',
        }}>
          Printing Document
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Session ID verified. Processing page queue.
        </p>
      </div>

      {/* Animation & progress */}
      <PrinterAnimation progress={progress} />

      {/* Status Indicators */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        marginTop: '16px',
      }}>
        {/* Pages tracker */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pages Printed</span>
          <span style={{ fontWeight: 700 }}>
            {printedPages} of {totalPages}
          </span>
        </div>

        {/* Estimated time tracker */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
        }}>
          <span style={{
            color: 'var(--text-secondary)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Clock size={16} /> Estimated Time Remaining
          </span>
          <span style={{ fontWeight: 700 }}>
            {secondsLeft > 0 ? `${secondsLeft}s` : 'Finishing...'}
          </span>
        </div>

        {/* Warning banner */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--warning-light)',
          color: 'var(--warning)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          lineHeight: 1.4,
          fontWeight: 500,
        }}>
          <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>
            <strong>Please do not refresh or navigate away.</strong> The kiosk is preparing your pages.
          </span>
        </div>
      </div>
    </div>
  );
};
