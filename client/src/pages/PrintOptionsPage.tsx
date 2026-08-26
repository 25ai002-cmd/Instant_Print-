import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, IndianRupee, Layers, Palette, FileStack, Copy, Check, SlidersHorizontal } from "lucide-react";
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
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

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
        // Initialize all pages selected by default
        const total = session.file.pageCount ?? 1;
        setSelectedPages(Array.from({ length: total }, (_, i) => i + 1));
      })
      .catch(() => setError("Your session expired. Please scan the QR code again."))
      .finally(() => setLoadingSession(false));
  }, [sessionId, navigate]);

  // Handle Preset Page Selections (First Page, Odd Pages, Even Pages)
  const applyPresetRange = (preset: "ALL" | "FIRST" | "ODD" | "EVEN") => {
    if (!file) return;
    const total = file.pageCount ?? 1;
    if (preset === "ALL") {
      setPageRangeMode("ALL");
      setSelectedPages(Array.from({ length: total }, (_, i) => i + 1));
      setCustomPageRange("");
    } else if (preset === "FIRST") {
      setPageRangeMode("CUSTOM");
      setSelectedPages([1]);
      setCustomPageRange("1");
    } else if (preset === "ODD") {
      setPageRangeMode("CUSTOM");
      const odds = Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
      setSelectedPages(odds);
      setCustomPageRange(odds.join(","));
    } else if (preset === "EVEN") {
      setPageRangeMode("CUSTOM");
      const evens = Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 === 0);
      setSelectedPages(evens);
      setCustomPageRange(evens.join(","));
    }
  };

  // Toggle individual page chip
  const togglePage = (pageNum: number) => {
    setPageRangeMode("CUSTOM");
    let nextPages: number[];
    if (selectedPages.includes(pageNum)) {
      nextPages = selectedPages.filter((p) => p !== pageNum);
    } else {
      nextPages = [...selectedPages, pageNum].sort((a, b) => a - b);
    }
    setSelectedPages(nextPages);
    setCustomPageRange(nextPages.join(","));
  };

  const options = useMemo(
    () => ({
      paperSize,
      copies,
      colorMode,
      sides,
      pageRangeMode,
      customPageRange: pageRangeMode === "CUSTOM" ? customPageRange : undefined,
      pagesToPrint: pageRangeMode === "ALL" ? file?.pageCount ?? 0 : selectedPages.length,
    }),
    [paperSize, copies, colorMode, sides, pageRangeMode, customPageRange, selectedPages.length, file]
  );

  // Live price recalculation whenever any option changes.
  useEffect(() => {
    if (!sessionId || !file) return;
    if (pageRangeMode === "CUSTOM" && !customPageRange.trim() && selectedPages.length === 0) {
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
    }, 300);
    return () => clearTimeout(handle);
  }, [sessionId, file, options, pageRangeMode, customPageRange, selectedPages.length]);

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

  const pagesCount = pageRangeMode === "ALL" ? file.pageCount : selectedPages.length;

  return (
    <div className="mobile-shell pb-36">
      {/* Top Header */}
      <div className="pt-2 pb-5 flex items-center justify-between border-b border-slate-100">
        <Logo />
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-ink flex items-center gap-1.5">
          <SlidersHorizontal size={14} className="text-primary" />
          Kiosk Software v2.4
        </span>
      </div>

      <div className="mt-4">
        <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">Print Settings</h1>
        <p className="text-sm text-muted truncate mt-0.5">{file.originalName}</p>
      </div>

      {/* Live Mobile Document Preview Card */}
      <DocumentPreview sessionId={sessionId!} file={file} colorMode={colorMode} selectedPagesCount={pagesCount} />

      {/* Page Selection & Range Customizer */}
      <OptionSection icon={<FileStack size={18} />} title="Page Selection & Range">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ChipButton active={pageRangeMode === "ALL"} onClick={() => applyPresetRange("ALL")}>
            Entire Document ({file.pageCount} pgs)
          </ChipButton>
          <ChipButton active={pageRangeMode === "CUSTOM" && customPageRange === "1"} onClick={() => applyPresetRange("FIRST")}>
            Page 1 Only
          </ChipButton>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <ChipButton active={pageRangeMode === "CUSTOM" && selectedPages.every((p) => p % 2 !== 0) && selectedPages.length > 0} onClick={() => applyPresetRange("ODD")}>
            Odd Pages Only
          </ChipButton>
          <ChipButton active={pageRangeMode === "CUSTOM" && selectedPages.every((p) => p % 2 === 0) && selectedPages.length > 0} onClick={() => applyPresetRange("EVEN")}>
            Even Pages Only
          </ChipButton>
        </div>

        {/* Visual Page Selection Chips */}
        {file.pageCount > 1 && file.pageCount <= 30 && (
          <div className="mt-3 p-3 rounded-control bg-slate-50 border border-slate-100">
            <span className="block text-xs font-bold text-ink mb-2">Tap pages to include/exclude:</span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: file.pageCount }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = pageRangeMode === "ALL" || selectedPages.includes(pageNum);
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => togglePage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center border ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-sm scale-105"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Range Manual Input */}
        <div className="mt-3">
          <label className="block text-xs font-bold text-muted mb-1">Or enter page range manually:</label>
          <input
            value={customPageRange}
            onChange={(e) => {
              setPageRangeMode("CUSTOM");
              setCustomPageRange(e.target.value);
            }}
            placeholder={`e.g. 1-3, 5, 8-10 (max ${file.pageCount})`}
            className="w-full rounded-control border border-slate-200 px-4 py-3 text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm bg-white"
          />
        </div>
      </OptionSection>

      {/* Paper Size */}
      <OptionSection icon={<FileStack size={18} />} title="Paper Size">
        <div className="grid grid-cols-4 gap-2">
          {PAPER_SIZES.map((size) => (
            <ChipButton key={size} active={paperSize === size} onClick={() => setPaperSize(size)}>
              {size}
            </ChipButton>
          ))}
        </div>
      </OptionSection>

      {/* Copies Counter */}
      <OptionSection icon={<Copy size={18} />} title="Number of Copies">
        <div className="flex items-center gap-4 bg-white p-2.5 rounded-control border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setCopies((c) => Math.max(1, c - 1))}
            className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-xl font-bold text-ink transition-transform flex items-center justify-center"
          >
            −
          </button>
          <span className="font-display text-xl font-extrabold w-10 text-center text-ink">{copies}</span>
          <button
            onClick={() => setCopies((c) => Math.min(99, c + 1))}
            className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-xl font-bold text-ink transition-transform flex items-center justify-center"
          >
            +
          </button>
        </div>
      </OptionSection>

      {/* Color vs B&W */}
      <OptionSection icon={<Palette size={18} />} title="Color Mode">
        <div className="grid grid-cols-2 gap-2">
          <ChipButton active={colorMode === "BW"} onClick={() => setColorMode("BW")}>
            Black &amp; White (₹2/pg)
          </ChipButton>
          <ChipButton active={colorMode === "COLOR"} onClick={() => setColorMode("COLOR")}>
            Full Color (₹10/pg)
          </ChipButton>
        </div>
      </OptionSection>

      {/* Single vs Double Sided */}
      <OptionSection icon={<Layers size={18} />} title="Sides Printing">
        <div className="grid grid-cols-2 gap-2">
          <ChipButton active={sides === "SINGLE"} onClick={() => setSides("SINGLE")}>
            Single Sided
          </ChipButton>
          <ChipButton active={sides === "DOUBLE"} onClick={() => setSides("DOUBLE")}>
            Double Sided (Save 10%)
          </ChipButton>
        </div>
      </OptionSection>

      {/* Fixed Handcrafted Floating Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-5 py-4 shadow-lg z-40">
        <div className="max-w-[560px] mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-muted text-xs font-semibold block">Total Estimated Cost</span>
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                <Check size={12} /> {pagesCount} page{pagesCount !== 1 ? "s" : ""} × {copies} copy{copies !== 1 ? "ies" : ""}
              </span>
            </div>
            <span className="font-display text-2xl font-extrabold text-ink flex items-center">
              {calculating ? (
                <Loader2 className="animate-spin text-primary" size={22} />
              ) : (
                <>
                  <IndianRupee size={22} className="mr-0.5 text-primary" />
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
      <div className="flex items-center gap-2 text-ink font-display font-bold mb-2.5 text-base">
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
      type="button"
      onClick={onClick}
      className={`rounded-control px-4 py-3 text-sm font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
        active
          ? "bg-primary text-white border-primary shadow-control scale-[1.01]"
          : "bg-white text-ink border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
