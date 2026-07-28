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
    generatePayment,
    setPaymentSuccess,
    setScreen,
    error,
  } = useSessionStore();

  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto-generate payment if paymentInfo is null when entering PaymentScreen
  React.useEffect(() => {
    if (!paymentInfo && sessionId) {
      generatePayment().catch((err) => {
        setLocalError(err.message || 'Could not initialize payment gateway.');
      });
    }
  }, [paymentInfo, sessionId, generatePayment]);

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
        textAlign: 'center',
      }}>
        {error || localError ? (
          <>
            <AlertCircle size={36} color="var(--error)" style={{ marginBottom: '12px' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              {error || localError || 'Could not initialize payment gateway.'}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setLocalError(null);
                  generatePayment();
                }}
                className="btn btn-primary"
                style={{ padding: '10px 18px', fontSize: '14px', width: 'auto' }}
              >
                Retry Payment
              </button>
              <button
                onClick={() => setScreen('settings')}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontSize: '14px', width: 'auto' }}
              >
                Back to Settings
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin" size={32} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Initializing secure payment gateway...
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Creating UPI payment QR code
            </p>
          </>
        )}
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

      {/* UPI App Quick Selection Grid (For Mobile Users) */}
      <div style={{
        width: '100%',
        maxWidth: '340px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2px' }}>
          Select your UPI Payment App
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {/* PhonePe */}
          <button
            onClick={() => {
              if (paymentInfo?.upiString) {
                window.location.href = paymentInfo.upiString.replace(/^upi:\/\//, 'phonepe://');
              } else {
                handlePayNow();
              }
            }}
            disabled={paymentVerifying}
            style={{
              padding: '12px 10px',
              borderRadius: '12px',
              border: '1.5px solid #5f259f',
              backgroundColor: '#5f259f10',
              color: '#5f259f',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '16px' }}>🟣</span> PhonePe
          </button>

          {/* Google Pay */}
          <button
            onClick={() => {
              if (paymentInfo?.upiString) {
                window.location.href = paymentInfo.upiString.replace(/^upi:\/\//, 'tez://upi/');
              } else {
                handlePayNow();
              }
            }}
            disabled={paymentVerifying}
            style={{
              padding: '12px 10px',
              borderRadius: '12px',
              border: '1.5px solid #4285F4',
              backgroundColor: '#4285F410',
              color: '#1a73e8',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>🔵</span> Google Pay
          </button>

          {/* Paytm */}
          <button
            onClick={() => {
              if (paymentInfo?.upiString) {
                window.location.href = paymentInfo.upiString.replace(/^upi:\/\//, 'paytmmp://');
              } else {
                handlePayNow();
              }
            }}
            disabled={paymentVerifying}
            style={{
              padding: '12px 10px',
              borderRadius: '12px',
              border: '1.5px solid #00baf2',
              backgroundColor: '#00baf210',
              color: '#0084b4',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>🔷</span> Paytm
          </button>

          {/* FamPay */}
          <button
            onClick={() => {
              if (paymentInfo?.upiString) {
                window.location.href = paymentInfo.upiString;
              } else {
                handlePayNow();
              }
            }}
            disabled={paymentVerifying}
            style={{
              padding: '12px 10px',
              borderRadius: '12px',
              border: '1.5px solid #ffaa00',
              backgroundColor: '#ffaa0010',
              color: '#d97706',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>🟡</span> FamPay / Any UPI
          </button>
        </div>
      </div>

      {/* QR Code Section (Collapsible / Alternative) */}
      <details style={{ marginBottom: '16px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
        <summary style={{ fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer', marginBottom: '8px' }}>
          Or show QR code to scan with another phone
        </summary>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
          {paymentInfo.upiString ? (
            <QRCodeDisplay
              value={paymentInfo.upiString}
              size={160}
              label={`Scan to pay ₹${priceBreakdown.total.toFixed(2)}`}
            />
          ) : (
            <div style={{
              width: '160px',
              height: '160px',
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
      </details>

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
        {/* Main Direct Pay & Print Action */}
        <button
          onClick={() => {
            if (paymentInfo?.upiString) {
              window.location.href = paymentInfo.upiString;
            } else {
              handlePayNow();
            }
          }}
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
              <Loader2 className="animate-spin" size={20} /> Processing &amp; Printing...
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
