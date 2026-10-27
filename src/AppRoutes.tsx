import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AskAmplifiPage } from "@/pages/AskAmplifi/AskAmplifiPage";
import { ChartsPage } from "@/pages/Charts/ChartsPage";
import { LibraryPage } from "@/pages/Library/LibraryPage";
import { ReviewPage } from "@/pages/Review/ReviewPage";
import { UploadPage } from "@/pages/Upload/UploadPage";
import { WorkspacePage } from "@/pages/Workspace/WorkspacePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/ask" element={<AskAmplifiPage />} />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Route>
    </Routes>
  );
}
