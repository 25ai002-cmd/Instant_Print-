import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { QRCodeDisplay } from '../components/QRCodeDisplay.tsx';
import { useCountdown } from '../hooks/useCountdown.ts';
import { usePolling } from '../hooks/usePolling.ts';
import { apiService } from '../services/api.js';
import { ShieldCheck, AlertCircle, Loader2, ArrowLeft, CreditCard, CheckCircle } from 'lucide-react';

export const PaymentScreen: React.FC = () => {
  const {
    sessionId,
    paymentInfo,
    priceBreakdown,
    setPaymentSuccess,
    setScreen,
  } = useSessionStore();

  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // 3-minute payment window
  const { formatTime } = useCountdown(180, () => {
    setScreen('failed');
  });

  // Polling check to automatically detect payment status change
  usePolling(
    async () => {
      if (!sessionId || !paymentInfo || paymentVerifying) return false;
      try {
        const session = await apiService.getSession(sessionId);
        if (session.payment?.status === 'success' || session.status === 'payment_verified' || session.status === 'printing') {
          setPaymentVerifying(true);
          await setPaymentSuccess(paymentInfo.orderId, 'demo_payment_success');
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Polling verify failed', err);
        return false;
      }
    },
    2000,
    !!sessionId && !!paymentInfo && !paymentVerifying
  );

  const handlePayNow = async () => {
    if (!sessionId || !paymentInfo) return;
    setPaymentVerifying(true);
    setLocalError(null);
    try {
      // Send verified payment payload
      await setPaymentSuccess('pay_' + Date.now(), 'sig_' + Date.now());
    } catch (err: any) {
      setPaymentVerifying(false);
      setLocalError(err.message || 'Payment processing failed');
    }
  };

  if (!paymentInfo || !priceBreakdown) {
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
        <Loader2 className="animate-spin" size={28} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
        <span>Initializing secure payment gateway...</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      padding: '24px 16px',
      alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          marginBottom: '4px',
          fontFamily: 'var(--font-heading)',
        }}>
          Payment Details
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Complete payment within <strong style={{ color: 'var(--error)' }}>{formatTime()}</strong>
        </p>
      </div>

      {/* Amount Card */}
      <div style={{
        width: '100%',
        maxWidth: '340px',
        padding: '16px 20px',
        backgroundColor: 'var(--primary-light)',
        border: '1.5px solid #bfdbfe',
        borderRadius: 'var(--radius-md)',
        marginBottom: '18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
          Total Print Cost
        </span>
        <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
          ₹{priceBreakdown.total.toFixed(2)}
        </span>
      </div>

      {/* QR Code Section */}
      <div style={{ marginBottom: '16px' }}>
        {paymentInfo.upiString ? (
          <QRCodeDisplay
            value={paymentInfo.upiString}
            size={180}
            label={`Scan to pay ₹${priceBreakdown.total.toFixed(2)}`}
          />
        ) : (
          <div style={{
            width: '180px',
            height: '180px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
          }}>
            <Loader2 className="animate-spin" size={28} color="var(--primary)" />
          </div>
        )}
      </div>

      {/* Security Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        marginBottom: '20px',
      }}>
        <ShieldCheck size={16} color="var(--success)" />
        <span>UPI / Razorpay Verified Payment</span>
      </div>

      {localError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--error-light)',
          color: 'var(--error)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          marginBottom: '16px',
          width: '100%',
        }}>
          <AlertCircle size={16} />
          <span>{localError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        width: '100%',
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* Main Pay & Print Action */}
        <button
          onClick={handlePayNow}
          disabled={paymentVerifying}
          className="btn btn-primary"
          style={{
            padding: '14px',
            fontSize: '16px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {paymentVerifying ? (
            <>
              <Loader2 className="animate-spin" size={20} /> Processing &amp; Sending to Printer...
            </>
          ) : (
            <>
              <CreditCard size={20} /> Pay ₹{priceBreakdown.total.toFixed(2)} &amp; Print Now
            </>
          )}
        </button>

        {/* Back to Settings */}
        <button
          onClick={() => setScreen('settings')}
          disabled={paymentVerifying}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back to Settings
        </button>
      </div>
    </div>
  );
};
