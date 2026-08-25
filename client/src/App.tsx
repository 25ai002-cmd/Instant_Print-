import { Route, Routes } from "react-router-dom";
import { KioskDisplay } from "./pages/KioskDisplay";
import { MobileUpload } from "./pages/MobileUpload";
import { PrintOptionsPage } from "./pages/PrintOptionsPage";
import { PaymentScreen } from "./pages/PaymentScreen";
import { PrintingScreen } from "./pages/PrintingScreen";
import { PrintComplete } from "./pages/PrintComplete";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<KioskDisplay />} />
      <Route path="/upload/:sessionId" element={<MobileUpload />} />
      <Route path="/options/:sessionId" element={<PrintOptionsPage />} />
      <Route path="/payment/:sessionId" element={<PaymentScreen />} />
      <Route path="/printing/:sessionId" element={<PrintingScreen />} />
      <Route path="/complete/:sessionId" element={<PrintComplete />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
