import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, IndianRupee, Layers, Palette, FileStack, Copy } from "lucide-react";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { DocumentPreview } from "../components/DocumentPreview";
import { apiErrorMessage, calculatePrice, getSession } from "../services/api";
import { ColorMode, FileMeta, PageRangeMode, PaperSize, PriceBreakdown, SidesMode } from "../types";

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "Legal", "Letter"];

export function PrintOptionsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [file, setFile] = useState<FileMeta | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>("BW");
  const [sides, setSides] = useState<SidesMode>("SINGLE");
  const [pageRangeMode, setPageRangeMode] = useState<PageRangeMode>("ALL");
  const [customPageRange, setCustomPageRange] = useState("");

  const [price, setPrice] = useState<PriceBreakdown | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((session) => {
        if (!session.file) {
          navigate(`/upload/${sessionId}`, { replace: true });
          return;
        }
        setFile(session.file);
        setPaperSize(session.file.detectedPaperSize);
      })
      .catch(() => setError("Your session expired. Please scan the QR code again."))
      .finally(() => setLoadingSession(false));
  }, [sessionId, navigate]);

  const options = useMemo(
    () => ({
      paperSize,
      copies,
      colorMode,
      sides,
      pageRangeMode,
      customPageRange: pageRangeMode === "CUSTOM" ? customPageRange : undefined,
      pagesToPrint: file?.pageCount ?? 0,
    }),
    [paperSize, copies, colorMode, sides, pageRangeMode, customPageRange, file]
  );

  // Live price recalculation whenever any option changes.
  useEffect(() => {
    if (!sessionId || !file) return;
    if (pageRangeMode === "CUSTOM" && !customPageRange.trim()) {
      setPrice(null);
      return;
    }
    const handle = setTimeout(async () => {
      setCalculating(true);
      setPriceError(null);
      try {
        const { price } = await calculatePrice(sessionId, options);
        setPrice(price);
      } catch (err) {
        setPrice(null);
        setPriceError(apiErrorMessage(err, "Enter a valid page range, e.g. 1-3,5"));
      } finally {
        setCalculating(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [sessionId, file, options, pageRangeMode, customPageRange]);

  const handleContinue = async () => {
    if (!sessionId || !price) return;
    setSubmitting(true);
    navigate(`/payment/${sessionId}`);
  };

  if (loadingSession) {
    return (
      <div className="mobile-shell items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={40} />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="mobile-shell items-center justify-center text-center">
        <p className="text-danger font-medium">{error ?? "No document found."}</p>
      </div>
    );
  }

  return (
    <div className="mobile-shell pb-32">
      <div className="pt-2 pb-6">
        <Logo />
      </div>

      <h1 className="font-display text-2xl font-extrabold text-ink">Print Options</h1>
      <p className="mt-1 text-muted truncate">{file.originalName}</p>

      {/* Live Mobile Document Preview */}
      <DocumentPreview sessionId={sessionId!} file={file} />

      <OptionSection icon={<FileStack size={18} />} title="Paper Size">
        <div className="grid grid-cols-4 gap-2">
          {PAPER_SIZES.map((size) => (
            <ChipButton key={size} active={paperSize === size} onClick={() => setPaperSize(size)}>
              {size}
            </ChipButton>
          ))}
        </div>
      </OptionSection>

      <OptionSection icon={<Copy size={18} />} title="Copies">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCopies((c) => Math.max(1, c - 1))}
            className="w-11 h-11 rounded-control bg-surface-alt text-xl font-bold text-ink"
          >
            −
          </button>
          <span className="font-display text-xl font-bold w-8 text-center">{copies}</span>
          <button
            onClick={() => setCopies((c) => Math.min(99, c + 1))}
            className="w-11 h-11 rounded-control bg-surface-alt text-xl font-bold text-ink"
          >
            +
          </button>
        </div>
      </OptionSection>

      <OptionSection icon={<Palette size={18} />} title="Color">
        <div className="grid grid-cols-2 gap-2">
          <ChipButton active={colorMode === "BW"} onClick={() => setColorMode("BW")}>
            Black &amp; White
          </ChipButton>
          <ChipButton active={colorMode === "COLOR"} onClick={() => setColorMode("COLOR")}>
            Color
          </ChipButton>
        </div>
      </OptionSection>

      <OptionSection icon={<Layers size={18} />} title="Printing">
        <div className="grid grid-cols-2 gap-2">
          <ChipButton active={sides === "SINGLE"} onClick={() => setSides("SINGLE")}>
            Single Side
          </ChipButton>
          <ChipButton active={sides === "DOUBLE"} onClick={() => setSides("DOUBLE")}>
            Double Side
          </ChipButton>
        </div>
      </OptionSection>

      <OptionSection icon={<FileStack size={18} />} title="Pages">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ChipButton active={pageRangeMode === "ALL"} onClick={() => setPageRangeMode("ALL")}>
            Entire Document
          </ChipButton>
          <ChipButton active={pageRangeMode === "CUSTOM"} onClick={() => setPageRangeMode("CUSTOM")}>
            Custom Pages
          </ChipButton>
        </div>
        {pageRangeMode === "CUSTOM" && (
          <input
            value={customPageRange}
            onChange={(e) => setCustomPageRange(e.target.value)}
            placeholder={`e.g. 1-3,5 (max ${file.pageCount})`}
            className="w-full rounded-control border border-slate-200 px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      </OptionSection>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-5 py-4">
        <div className="max-w-[560px] mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted text-sm">Estimated Total</span>
            <span className="font-display text-2xl font-extrabold text-ink flex items-center">
              {calculating ? (
                <Loader2 className="animate-spin text-primary" size={20} />
              ) : (
                <>
                  <IndianRupee size={20} className="mr-0.5" />
                  {price?.total.toFixed(2) ?? "—"}
                </>
              )}
            </span>
          </div>
          {priceError && <p className="text-danger text-xs mb-2">{priceError}</p>}
          <BigButton onClick={handleContinue} disabled={!price || calculating || submitting}>
            Continue to Payment
          </BigButton>
        </div>
      </div>
    </div>
  );
}

function OptionSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 text-ink font-display font-bold mb-3">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-control px-4 py-3 text-sm font-semibold border transition-colors ${
        active ? "bg-primary text-white border-primary" : "bg-surface text-ink border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
