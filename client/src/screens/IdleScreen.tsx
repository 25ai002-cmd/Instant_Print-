import React, { useEffect, useRef, useState } from 'react';
import { QRCodeDisplay } from '../components/QRCodeDisplay.tsx';
import { useSessionStore } from '../store/sessionStore.ts';
import { Printer, RefreshCw, AlertCircle, Smartphone, CheckCircle2 } from 'lucide-react';

export const IdleScreen: React.FC = () => {
  const { initializeSession, sessionId } = useSessionStore();
  const scannedAt = useSessionStore((state) => state.scannedAt);
  const [mobileUrl, setMobileUrl] = useState('');
  const [error, setError] = useState('');
  // Guard so initializeSession is called ONLY ONCE, even in React StrictMode
  const initializedRef = useRef(false);

  useEffect(() => {
    // If session already exists in the store (kiosk-side polling keeps it alive)
    // or we already started initialization, skip
    if (initializedRef.current) return;
    initializedRef.current = true;

    const startSession = async () => {
      try {
        const data = await initializeSession();
        // Support remote mobile scan (4G/5G / external router) via configured Public URL or origin fallback
        const port = window.location.port || '80';
        let host = (data as any).publicUrl;
        if (!host) {
          host = (data.localIp && data.localIp !== 'localhost')
            ? `http://${data.localIp}:${port}`
            : window.location.origin;
        }
        const url = `${host}/?session=${data.sessionId}&machine=ATM001`;
        setMobileUrl(url);
      } catch (err) {
        console.error('Failed to initialize session for kiosk QR', err);
        setError('Could not connect to printer. Retrying...');
        // Retry after 3 seconds
        initializedRef.current = false;
        setTimeout(() => {
          if (!initializedRef.current) {
            initializedRef.current = true;
            startSession();
          }
        }, 3000);
      }
    };

    startSession();
  }, []); // Empty deps — run only once on mount

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Kiosk Background Graphics */}
      <div className="gradient-bg" />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 1,
        maxWidth: '360px',
      }}>
        {/* Machine Logo */}
        <div style={{
          width: '72px',
          height: '72px',
          backgroundColor: 'var(--primary)',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(0, 102, 204, 0.25)',
        }}>
          <Printer size={36} strokeWidth={2.5} />
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: 800,
          letterSpacing: '-1px',
          marginBottom: '6px',
          fontFamily: 'var(--font-heading)',
        }}>
          Instant Print
        </h1>

        <p style={{
          fontSize: '15px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          lineHeight: 1.4,
        }}>
          Self-service printing kiosk. Quick, private, and automatic.
        </p>

        {/* Live Device Connection Status Badge */}
        {scannedAt ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--success-light)',
            border: '1.5px solid #a7f3d0',
            borderRadius: '999px',
            color: 'var(--success)',
            fontWeight: 700,
            fontSize: '14px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            animation: 'pulseGlow 2s infinite',
          }}>
            <CheckCircle2 size={18} color="var(--success)" />
            <span>Phone Connected! Select your file on your phone.</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'var(--primary-light)',
            borderRadius: '999px',
            color: 'var(--primary)',
            fontWeight: 600,
            fontSize: '13px',
            marginBottom: '24px',
          }}>
            <Smartphone size={16} />
            <span>Scan QR code with your phone camera</span>
          </div>
        )}

        {error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--error)',
            fontSize: '14px',
            fontWeight: 500,
            padding: '12px 16px',
            background: 'var(--error-light)',
            borderRadius: 'var(--radius)',
            border: '1px solid #fee2e2',
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        ) : scannedAt ? (
          // ── Phone connected — hide QR completely, show upload-prompt panel ──
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '32px 28px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.12) 100%)',
            border: '2px solid rgba(16,185,129,0.35)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(16,185,129,0.15)',
            animation: 'pulseGlow 2.5s ease-in-out infinite',
            width: '100%',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(16,185,129,0.45)',
            }}>
              <Smartphone size={36} color="white" strokeWidth={2} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--success)',
                marginBottom: '8px',
                fontFamily: 'var(--font-heading)',
              }}>
                📱 Phone Connected!
              </p>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                maxWidth: '260px',
              }}>
                Select and upload your document on your mobile device to continue.
              </p>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(16,185,129,0.12)',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--success)',
            }}>
              <CheckCircle2 size={15} />
              Waiting for file upload…
            </div>
          </div>
        ) : mobileUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="animated-glow" style={{ borderRadius: 'var(--radius-lg)' }}>
              <QRCodeDisplay
                value={mobileUrl}
                size={220}
                label="Scan QR Code To Print"
              />
            </div>
            <a
              href={mobileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                color: 'var(--primary)',
                fontWeight: 600,
                textDecoration: 'underline',
                marginTop: '8px',
              }}
            >
              [Test: Open on this device]
            </a>
          </div>
        ) : (
          <div style={{
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--text-tertiary)',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            <RefreshCw className="animate-spin" size={28} color="var(--primary)" />
            Initializing secure printer connection...
          </div>
        )}

        <div style={{
          marginTop: '28px',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          fontWeight: 500,
        }}>
          Supports PDF, Word, PowerPoint &amp; Images
        </div>
      </div>
    </div>
  );
};
