import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { QRCodeDisplay } from '../components/QRCodeDisplay.tsx';
import { useCountdown } from '../hooks/useCountdown.ts';
import { usePolling } from '../hooks/usePolling.ts';
import { apiService } from '../services/api.js';
import { ShieldCheck, AlertCircle, Loader2, ArrowLeft, Printer, Lock, QrCode, CheckCircle2 } from 'lucide-react';

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
  const [selectedApp, setSelectedApp] = useState<'phonepe' | 'gpay' | 'paytm' | 'fampay'>('phonepe');
  const [showQrCode, setShowQrCode] = useState(false);

  // Auto-generate payment if paymentInfo is null when entering PaymentScreen
  React.useEffect(() => {
    if (!paymentInfo && sessionId) {
      generatePayment().catch((err) => {
        setLocalError(err.message || 'Could not initialize payment gateway.');
      });
    }
  }, [paymentInfo, sessionId, generatePayment]);

  // 3-minute payment countdown window
  const TOTAL_SECONDS = 180;
  const { seconds, formatTime } = useCountdown(TOTAL_SECONDS, () => {
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

  const handlePayNow = async (appName?: 'phonepe' | 'gpay' | 'paytm' | 'fampay') => {
    const appToUse = appName || selectedApp;
    if (!sessionId || !priceBreakdown) return;

    const amountStr = priceBreakdown.total.toFixed(2);
    let baseUpi = paymentInfo?.upiString || `upi://pay?pa=6353874452@fam&pn=PrintATM&am=${amountStr}&cu=INR&tn=PrintATM`;

    if (!baseUpi.includes('am=')) {
      baseUpi += `&am=${amountStr}`;
    } else {
      baseUpi = baseUpi.replace(/am=[\d\.]+/, `am=${amountStr}`);
    }

    const isAndroid = /android/i.test(navigator.userAgent);
    const rawParams = baseUpi.replace(/^upi:\/\/(pay\?)?/, '');

    let finalUrl = baseUpi;
    if (appToUse === 'phonepe') {
      finalUrl = isAndroid
        ? `intent://pay?${rawParams}#Intent;scheme=upi;package=com.phonepe.app;end`
        : `phonepe://pay?${rawParams}`;
    } else if (appToUse === 'gpay') {
      finalUrl = isAndroid
        ? `intent://pay?${rawParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`
        : `tez://upi/pay?${rawParams}`;
    } else if (appToUse === 'paytm') {
      finalUrl = isAndroid
        ? `intent://pay?${rawParams}#Intent;scheme=upi;package=net.one97.paytm;end`
        : `paytmmp://pay?${rawParams}`;
    } else if (appToUse === 'fampay') {
      finalUrl = isAndroid
        ? `intent://pay?${rawParams}#Intent;scheme=upi;package=com.fampay.in;end`
        : `fampay://pay?${rawParams}`;
    }

    // Trigger URL deep link
    window.location.href = finalUrl;
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
        color: '#a1a1aa',
        backgroundColor: '#09090b',
        minHeight: '100vh',
        textAlign: 'center',
      }}>
        {error || localError ? (
          <>
            <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '12px' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>
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
            <Loader2 className="animate-spin" size={36} style={{ marginBottom: '16px', color: '#ffffff' }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
              Initializing secure payment gateway...
            </span>
            <p style={{ fontSize: '13px', color: '#71717a', marginTop: '8px' }}>
              Preparing UPI payment configuration
            </p>
          </>
        )}
      </div>
    );
  }

  const progressPercent = Math.max(0, Math.min(100, (seconds / TOTAL_SECONDS) * 100));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#09090b',
      padding: '20px 16px',
      color: '#ffffff',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      {/* Outer Dark Modal Container */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#141416',
        border: '1px solid #27272a',
        borderRadius: '24px',
        padding: '24px 20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Top Shield Icon Badge */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#27272a',
          border: '1px solid #3f3f46',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          color: '#e4e4e7',
        }}>
          <ShieldCheck size={22} />
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '22px',
          fontWeight: 800,
          marginBottom: '4px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}>
          Payment Details
        </h2>
        <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
          Complete your payment before the timer ends
        </p>

        {/* Timer Pill & Progress Bar */}
        <div style={{ marginBottom: '20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#1f1f23',
            border: '1px solid #27272a',
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#f4f4f5',
          }}>
            <span>🕒 Expires in {formatTime()}</span>
          </div>

          {/* Sleek Horizontal Progress Bar */}
          <div style={{
            width: '180px',
            height: '4px',
            backgroundColor: '#27272a',
            borderRadius: '999px',
            marginTop: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#ffffff',
              transition: 'width 1s linear',
              borderRadius: '999px',
            }} />
          </div>
        </div>

        {/* Total Print Cost Card */}
        <div style={{
          width: '100%',
          backgroundColor: '#1f1f23',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#a1a1aa' }}>
              Total Print Cost
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
              ₹{priceBreakdown.total.toFixed(2)}
            </span>
          </div>

          {/* Locked Amount Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#141416',
            border: '1px solid #27272a',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#a1a1aa',
          }}>
            <Lock size={14} color="#a1a1aa" />
            <span>
              Locked amount — pre-set and <strong style={{ color: '#ffffff' }}>non-editable</strong>
            </span>
          </div>
        </div>

        {/* UPI App Selection Section */}
        <div style={{ width: '100%', marginBottom: '20px' }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '12px',
            textAlign: 'left',
          }}>
            Select your UPI app
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            {/* PhonePe */}
            <button
              onClick={() => {
                setSelectedApp('phonepe');
                handlePayNow('phonepe');
              }}
              disabled={paymentVerifying}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 12px',
                borderRadius: '14px',
                border: selectedApp === 'phonepe' ? '2px solid #ffffff' : '1px solid #27272a',
                backgroundColor: '#1f1f23',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  P
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>PhonePe</span>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedApp === 'phonepe' ? 'none' : '1.5px solid #52525b',
                backgroundColor: selectedApp === 'phonepe' ? '#ffffff' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedApp === 'phonepe' && <CheckCircle2 size={18} color="#000000" />}
              </div>
            </button>

            {/* Google Pay */}
            <button
              onClick={() => {
                setSelectedApp('gpay');
                handlePayNow('gpay');
              }}
              disabled={paymentVerifying}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 12px',
                borderRadius: '14px',
                border: selectedApp === 'gpay' ? '2px solid #ffffff' : '1px solid #27272a',
                backgroundColor: '#1f1f23',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  G
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Google Pay</span>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedApp === 'gpay' ? 'none' : '1.5px solid #52525b',
                backgroundColor: selectedApp === 'gpay' ? '#ffffff' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedApp === 'gpay' && <CheckCircle2 size={18} color="#000000" />}
              </div>
            </button>

            {/* Paytm */}
            <button
              onClick={() => {
                setSelectedApp('paytm');
                handlePayNow('paytm');
              }}
              disabled={paymentVerifying}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 12px',
                borderRadius: '14px',
                border: selectedApp === 'paytm' ? '2px solid #ffffff' : '1px solid #27272a',
                backgroundColor: '#1f1f23',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  P
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Paytm</span>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedApp === 'paytm' ? 'none' : '1.5px solid #52525b',
                backgroundColor: selectedApp === 'paytm' ? '#ffffff' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedApp === 'paytm' && <CheckCircle2 size={18} color="#000000" />}
              </div>
            </button>

            {/* FamPay */}
            <button
              onClick={() => {
                setSelectedApp('fampay');
                handlePayNow('fampay');
              }}
              disabled={paymentVerifying}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 12px',
                borderRadius: '14px',
                border: selectedApp === 'fampay' ? '2px solid #ffffff' : '1px solid #27272a',
                backgroundColor: '#1f1f23',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#eab308',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  F
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>FamPay</span>
                  <span style={{ fontSize: '10px', color: '#a1a1aa' }}>Any UPI</span>
                </div>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedApp === 'fampay' ? 'none' : '1.5px solid #52525b',
                backgroundColor: selectedApp === 'fampay' ? '#ffffff' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedApp === 'fampay' && <CheckCircle2 size={18} color="#000000" />}
              </div>
            </button>
          </div>
        </div>

        {/* Collapsible QR Code Section */}
        <div style={{
          width: '100%',
          backgroundColor: '#141416',
          border: '1px dashed #3f3f46',
          borderRadius: '14px',
          padding: '12px 14px',
          marginBottom: '20px',
        }}>
          <button
            onClick={() => setShowQrCode(!showQrCode)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <QrCode size={16} /> Or show QR code to scan on another phone {showQrCode ? '▲' : '▼'}
          </button>

          {showQrCode && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '14px' }}>
              {paymentInfo.upiString ? (
                <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px' }}>
                  <QRCodeDisplay
                    value={paymentInfo.upiString}
                    size={160}
                    label={`Scan to pay ₹${priceBreakdown.total.toFixed(2)}`}
                  />
                </div>
              ) : (
                <Loader2 className="animate-spin" size={28} color="#ffffff" />
              )}
            </div>
          )}
        </div>

        {/* Security Line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#a1a1aa',
          fontSize: '12px',
          marginBottom: '16px',
        }}>
          <span style={{ color: '#22c55e', fontSize: '10px' }}>🟢</span>
          <span>Secured by <strong>Razorpay</strong> · UPI Verified</span>
        </div>

        {localError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#451a1a',
            border: '1px solid #7f1d1d',
            color: '#fca5a5',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            width: '100%',
          }}>
            <AlertCircle size={16} />
            <span>{localError}</span>
          </div>
        )}

        {/* Primary Pay & Print Button (White Pill CTA) */}
        <button
          onClick={() => handlePayNow()}
          disabled={paymentVerifying}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '999px',
            backgroundColor: '#ffffff',
            color: '#000000',
            border: 'none',
            fontSize: '16px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2)',
            transition: 'transform 0.15s ease',
            marginBottom: '14px',
          }}
        >
          {paymentVerifying ? (
            <>
              <Loader2 className="animate-spin" size={20} color="#000000" /> Processing &amp; Printing...
            </>
          ) : (
            <>
              <Printer size={20} /> Pay ₹{priceBreakdown.total.toFixed(2)} &amp; Print Now
            </>
          )}
        </button>

        {/* Back to Settings Link */}
        <button
          onClick={() => setScreen('settings')}
          disabled={paymentVerifying}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} /> Back to Settings
        </button>
      </div>

      {/* Bottom Disclaimer */}
      <p style={{
        fontSize: '12px',
        color: '#71717a',
        marginTop: '16px',
        textAlign: 'center',
      }}>
        Do not close this window while your payment is processing.
      </p>
    </div>
  );
};
