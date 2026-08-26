import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Camera, AlertCircle, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (sessionId) attachSession(sessionId).catch(() => undefined);
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
      } catch (err) {
        setError(apiErrorMessage(err, "We couldn't read that file. Please try another."));
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
              <p className="font-display font-bold text-lg text-ink">Analyzing & storing document…</p>
              <div className="w-full max-w-xs h-2 rounded-full bg-surface-alt overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
                <UploadCloud className="text-primary" size={30} />
              </div>
              <div>
                <p className="font-display font-bold text-ink">Drag & drop your file here</p>
                <p className="text-sm text-muted mt-1">or use a button below</p>
              </div>
            </>
          )}
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0])}
        />

        <div className="mt-6 flex flex-col gap-3">
          <BigButton icon={<FileText size={20} />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            Browse Files
          </BigButton>
          <BigButton
            variant="secondary"
            icon={<Camera size={20} />}
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            Take a Photo
          </BigButton>
        </div>

        <p className="mt-6 text-xs text-center text-muted">
          Max file size 50MB. Password-protected files can't be printed here.
        </p>
      </div>
    </div>
  );
}
