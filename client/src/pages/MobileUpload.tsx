import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Camera, AlertCircle, Loader2, Smartphone, QrCode } from "lucide-react";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { attachSession, apiErrorMessage, uploadFile } from "../services/api";

const ACCEPTED = ".pdf,.docx,.pptx,.doc,.ppt,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.txt,.rtf,.csv";

export function MobileUpload() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let clientToken = sessionStorage.getItem("printatm_client_token");
    if (!clientToken) {
      clientToken = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("printatm_client_token", clientToken);
    }

    attachSession(sessionId, clientToken).catch((err: any) => {
      const status = err?.response?.status || err?.status;
      if (status === 409) {
        setIsBusy(true);
      } else if (status === 404) {
        setIsExpired(true);
      }
    });
  }, [sessionId]);

  const doUpload = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      setError(null);
      setUploading(true);
      setProgress(0);
      try {
        await uploadFile(sessionId, file, setProgress);
        // Seamless transition to options page — backend handles DB persistence
        navigate(`/options/${sessionId}`);
      } catch (err: any) {
        const status = err?.response?.status || err?.status;
        if (status === 404) {
          setIsExpired(true);
        } else {
          setError(apiErrorMessage(err, "We couldn't read that file. Please try another."));
        }
        setUploading(false);
      }
    },
    [sessionId, navigate]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  if (isExpired) {
    return (
      <div className="mobile-shell text-center py-10 px-4">
        <div className="pt-2 pb-6 flex justify-center">
          <Logo />
        </div>

        <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
          <QrCode size={40} />
        </div>

        <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">
          Session Expired or Kiosk Reset
        </h1>

        <p className="mt-2 text-sm text-muted max-w-xs mx-auto leading-relaxed">
          This upload QR code is from a previous session that has ended or was reset by the kiosk screen.
        </p>

        <div className="mt-6 p-4 rounded-control bg-primary/5 border border-primary/20 text-xs font-semibold text-slate-700 leading-normal">
          📲 Please scan the new QR code displayed live on the PrintATM kiosk monitor screen to start a fresh upload.
        </div>

        <button
          onClick={() => {
            const isAndroid = /android/i.test(navigator.userAgent);
            if (isAndroid) {
              window.location.href = "intent://com.google.ar.lens/v1#Intent;scheme=googlelens;package=com.google.ar.lens;end";
            } else {
              window.location.href = "/";
            }
          }}
          className="mt-6 w-full py-3.5 px-6 rounded-control bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Camera size={18} /> Open Camera / Scan Kiosk QR Code
        </button>
      </div>
    );
  }

  if (isBusy) {
    return (
      <div className="mobile-shell text-center py-10 px-4">
        <div className="pt-2 pb-6 flex justify-center">
          <Logo />
        </div>

        <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4 shadow-sm">
          <Smartphone size={40} />
        </div>

        <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">
          Kiosk Currently Busy
        </h1>

        <p className="mt-2 text-sm text-muted max-w-xs mx-auto leading-relaxed">
          Another customer is currently using this PrintATM kiosk. For security, only one phone can connect at a time.
        </p>

        <div className="mt-8 p-4 rounded-control bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
          ⏳ Please wait for the current customer to finish, or scan the new QR code when available.
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell">
      <div className="pt-2 pb-6">
        <Logo />
      </div>

      <div className="flex-1 flex flex-col">
        <h1 className="font-display text-2xl font-extrabold text-ink">Upload your document</h1>
        <p className="mt-1 text-muted">PDF, Word, PowerPoint, or a photo of your document.</p>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-control bg-danger/5 border border-danger/20 px-4 py-3 text-danger text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          animate={{ borderColor: dragActive ? "#2563EB" : "#CBD5E1", scale: dragActive ? 1.01 : 1 }}
          className="mt-6 flex-1 min-h-[280px] flex flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed bg-surface px-6 py-10 text-center"
        >
          {uploading ? (
            <>
              <Loader2 className="text-primary animate-spin" size={48} />
              <p className="font-display font-bold text-lg text-ink">Analyzing &amp; storing document…</p>
              <div className="w-full max-w-xs h-2 rounded-full bg-surface-alt overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted font-semibold">{progress}% uploaded</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center shadow-soft">
                <UploadCloud size={32} />
              </div>
              <div>
                <p className="font-display font-bold text-ink">Choose a file to print</p>
                <p className="text-xs text-muted mt-1">Tap a button below or drag file here</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doUpload(f);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doUpload(f);
                }}
              />

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2">
                <BigButton onClick={() => fileInputRef.current?.click()} icon={<FileText size={20} />} variant="primary">
                  Browse Files
                </BigButton>
                <BigButton onClick={() => cameraInputRef.current?.click()} icon={<Camera size={20} />} variant="secondary">
                  Take Photo
                </BigButton>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
