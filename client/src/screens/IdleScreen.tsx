import React, { useEffect, useRef, useState } from 'react';
import { QRCodeDisplay } from '../components/QRCodeDisplay.tsx';
import { useSessionStore } from '../store/sessionStore.ts';
import { Printer, RefreshCw, AlertCircle, Smartphone, CheckCircle2 } from 'lucide-react';

export const IdleScreen: React.FC = () => {
  const { initializeSession, sessionId } = useSessionStore();
  const scannedAt = useSessionStore((state) => state.scannedAt);
  const [mobileUrl, setMobileUrl] = useState('');
  const [error, setError] = useState('');
  const [customPublicUrl, setCustomPublicUrl] = useState<string>(
    () => localStorage.getItem('kiosk_public_url') || ''
  );
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configInput, setConfigInput] = useState<string>(customPublicUrl);

  // Guard so initializeSession is called ONLY ONCE, even in React StrictMode
  const initializedRef = useRef(false);

  const startSession = async () => {
    try {
      const data = await initializeSession();

      // Determine public cloud host URL so mobile phones on cellular data (4G/5G) can connect without LAN Wi-Fi
      const storedPublicUrl = localStorage.getItem('kiosk_public_url');
      const envPublicUrl = (import.meta as any).env?.VITE_PUBLIC_URL;
      const serverPublicUrl = (data as any).publicUrl;
      const isCloudOrigin = window.location.hostname !== 'localhost' && !window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/);

      let host = storedPublicUrl || envPublicUrl || serverPublicUrl;

      if (!host && isCloudOrigin) {
        host = window.location.origin;
      }

      if (!host) {
        const port = window.location.port || '80';
        host = (data.localIp && data.localIp !== 'localhost')
          ? `http://${data.localIp}:${port}`
          : window.location.origin;
      }

      // Ensure protocol
      if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
        host = `https://${host}`;
      }

      const url = `${host}/?session=${data.sessionId}&machine=ATM001`;
      setMobileUrl(url);
    } catch (err) {
      console.error('Failed to initialize session for kiosk QR', err);
      setError('Could not connect to printer. Retrying...');
      initializedRef.current = false;
      setTimeout(() => {
        if (!initializedRef.current) {
          initializedRef.current = true;
          startSession();
        }
      }, 3000);
    }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    startSession();
  }, []);

  const handleSavePublicUrl = (urlToSave: string) => {
    const trimmed = urlToSave.trim();
    if (trimmed) {
      localStorage.setItem('kiosk_public_url', trimmed);
      setCustomPublicUrl(trimmed);
    } else {
      localStorage.removeItem('kiosk_public_url');
      setCustomPublicUrl('');
    }
    setShowConfigModal(false);
    initializedRef.current = false;
    startSession();
  };

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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            Supports PDF, Word, PowerPoint &amp; Images
          </span>

          {/* Operator Public URL Config Trigger */}
          <button
            onClick={() => {
              setConfigInput(customPublicUrl);
              setShowConfigModal(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginTop: '4px',
              opacity: 0.7,
            }}
          >
            ⚙️ {customPublicUrl ? `QR Target: ${customPublicUrl}` : 'Set Public Cloud URL (4G/5G Scans)'}
          </button>
        </div>
      </div>

      {/* Config Public URL Modal */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
              🌐 Configure Kiosk Public Cloud URL
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              Enter your public deployed Render URL or Tunnel domain (e.g. <code>https://instant-print-kiosk.onrender.com</code>) so mobile phones on cellular data (4G/5G) can scan and upload without needing to connect to the local Wi-Fi router.
            </p>

            <input
              type="text"
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              placeholder="https://instant-print-kiosk.onrender.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid var(--border)',
                fontSize: '14px',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePublicUrl(configInput)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                Save &amp; Update QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
