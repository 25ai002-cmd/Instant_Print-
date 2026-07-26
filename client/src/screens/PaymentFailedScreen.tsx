import React from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { XCircle, RefreshCw, LogOut } from 'lucide-react';

export const PaymentFailedScreen: React.FC = () => {
  const { generatePayment, cancelSession, error } = useSessionStore();

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
        backgroundColor: 'var(--error-light)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--error)',
        marginBottom: '24px',
      }}>
        <XCircle size={40} />
      </div>

      <h2 style={{
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '12px',
        fontFamily: 'var(--font-heading)',
      }}>
        Payment Failed
      </h2>

      <p style={{
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginBottom: '32px',
        maxWidth: '300px',
      }}>
        {error || 'The payment request timed out or was rejected by your bank. Please try again.'}
      </p>

      <div style={{
        width: '100%',
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
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
          <LogOut size={18} /> Cancel & Exit
        </button>
      </div>
    </div>
  );
};
