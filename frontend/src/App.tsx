import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { LanguageProvider } from "./i18n";
import ChooseGrid from "./pages/ChooseGrid";
import HistoryPage from "./pages/HistoryPage";
import ProductMemoryPage from "./pages/ProductMemoryPage";
import RefinementHome from "./pages/RefinementHome";
import SessionResultPage from "./pages/SessionResultPage";
import SettingsPage from "./pages/SettingsPage";
import WarRoom from "./pages/WarRoom";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RefinementHome />} />
          <Route path="/refinement" element={<RefinementHome />} />
          <Route path="/refinement/choose" element={<ChooseGrid />} />
          <Route path="/refinement/history" element={<HistoryPage />} />
          <Route path="/memory" element={<ProductMemoryPage />} />
          <Route path="/refinement/sessions/:sessionId" element={<WarRoom />} />
          <Route element={<Layout />}>
            <Route path="/refinement/sessions/:sessionId/result" element={<SessionResultPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/refinement" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
