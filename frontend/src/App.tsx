import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { LanguageProvider } from "./i18n";
import RefinementHome from "./pages/RefinementHome";
import SessionPage from "./pages/SessionPage";
import SessionResultPage from "./pages/SessionResultPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/refinement" replace />} />
            <Route path="/refinement" element={<RefinementHome />} />
            <Route path="/refinement/sessions/:sessionId" element={<SessionPage />} />
            <Route path="/refinement/sessions/:sessionId/result" element={<SessionResultPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/refinement" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
