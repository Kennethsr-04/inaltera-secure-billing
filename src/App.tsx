import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import Login from "@/pages/Login";

// Lazy load non-critical routes to keep initial bundle small (better mobile perf)
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Facturacion = lazy(() => import("@/pages/Facturacion"));
const Datos = lazy(() => import("@/pages/Datos"));
const Servicios = lazy(() => import("@/pages/Servicios"));
const Papelera = lazy(() => import("@/pages/Papelera"));
const VerificarFactura = lazy(() => import("@/pages/VerificarFactura"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LayoutProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro-cuenta" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Perfil />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/facturacion"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Facturacion />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/registro" element={<Navigate to="/facturacion" replace />} />
            <Route
              path="/datos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Datos />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/servicios"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Servicios />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/papelera"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Papelera />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/verificar" element={<VerificarFactura />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </LayoutProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
