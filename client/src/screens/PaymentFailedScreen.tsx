import React from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { XCircle, RefreshCw, LogOut, Printer, ArrowLeft } from 'lucide-react';

export const PaymentFailedScreen: React.FC = () => {
  const { generatePayment, triggerPrint, setScreen, cancelSession, error } = useSessionStore();

  const isPrinterError = error?.toLowerCase().includes('printer') || error?.toLowerCase().includes('offline');

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
      <div style={{
        width: '72px',
        height: '72px',
        backgroundColor: isPrinterError ? '#fef3c7' : 'var(--error-light)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isPrinterError ? '#d97706' : 'var(--error)',
        marginBottom: '24px',
      }}>
        {isPrinterError ? <Printer size={40} /> : <XCircle size={40} />}
      </div>

      <h2 style={{
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '12px',
        fontFamily: 'var(--font-heading)',
      }}>
        {isPrinterError ? 'Printer Hardware Alert' : 'Payment Failed'}
      </h2>

      <p style={{
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginBottom: '32px',
        maxWidth: '320px',
      }}>
        {error || 'The request could not be completed. Please try again.'}
      </p>

      <div style={{
        width: '100%',
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {isPrinterError ? (
          <>
            <button
              onClick={() => {
                setScreen('printing');
                triggerPrint();
              }}
              className="btn btn-primary"
            >
              <RefreshCw size={18} /> Retry Printing
            </button>

            <button
              onClick={() => setScreen('settings')}
              className="btn btn-secondary"
            >
              <ArrowLeft size={18} /> Back to Print Settings
            </button>
          </>
        ) : (
          <>
            <button
              onClick={generatePayment}
              className="btn btn-primary"
            >
              <RefreshCw size={18} /> Retry Payment
            </button>

            <button
              onClick={cancelSession}
              className="btn btn-secondary"
            >
              <LogOut size={18} /> Cancel &amp; Exit
            </button>
          </>
        )}
      </div>
    </div>
  );
};
