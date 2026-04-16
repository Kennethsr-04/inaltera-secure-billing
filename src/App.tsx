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
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Perfil from "@/pages/Perfil";
import Facturacion from "@/pages/Facturacion";

import Datos from "@/pages/Datos";
import Servicios from "@/pages/Servicios";
import Papelera from "@/pages/Papelera";
import VerificarFactura from "@/pages/VerificarFactura";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LayoutProvider>
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
          </LayoutProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
