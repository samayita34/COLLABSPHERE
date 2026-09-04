import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "./store";

import App from "./App";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/dashboard";
import Projects from "./pages/Projects";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import MyTasks from "./pages/MyTasks";
import Documents from "./pages/Documents";
import GoogleDocPage from "./pages/GoogleDocPage";
import Files from "./pages/Files";
import Messages from "./pages/Messages";
import ActivityLog from "./pages/ActivityLog";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import { WorkspaceProvider } from "./context/WorkspaceContext";
import { SocketProvider } from "./context/SocketContext";
import { SidebarProvider } from "./context/SidebarContext";
import "./services/apiUtils";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
        <SocketProvider>
        <SidebarProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/overview" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectWorkspace />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:id" element={<GoogleDocPage />} />
            <Route path="/projects/:projectId/documents/:id" element={<GoogleDocPage />} />
            <Route path="/files" element={<Files />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        </SidebarProvider>
        </SocketProvider>
        </WorkspaceProvider>
      </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);

