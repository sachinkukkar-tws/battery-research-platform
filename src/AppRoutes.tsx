import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AskAmplifiPage } from "@/pages/AskAmplifi/AskAmplifiPage";
import { ExplorerPage } from "@/pages/Explorer/ExplorerPage";
import { PapersPage } from "@/pages/Papers/PapersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/explore" element={<ExplorerPage />} />
        <Route path="/papers/:paperId?" element={<PapersPage />} />
        <Route path="/ask" element={<AskAmplifiPage />} />
        <Route path="*" element={<Navigate to="/explore" replace />} />
      </Route>
    </Routes>
  );
}
