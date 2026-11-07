import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { queryPersister } from "@/lib/queryPersister";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing";
import Apps from "./pages/Apps";

const Documentation = lazy(() => import("./pages/Documentation"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Transactions = lazy(() => import("./pages/Transactions"));
const ImportSMS = lazy(() => import("./pages/ImportSMS"));
const Reports = lazy(() => import("./pages/Reports"));
const Food = lazy(() => import("./pages/Food"));

const PageLoading = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
    Loading documentation...
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days — required for persistence
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
      // Keep last-good data visible when the backend is unreachable.
      placeholderData: (prev: unknown) => prev,
    },
  },
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      buster: "v1",
    }}
  >
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoading />}>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Landing />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/Documentation" element={<Suspense fallback={<PageLoading />}><Documentation /></Suspense>} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/import" element={<ImportSMS />} />
                <Route path="/inbox" element={<Navigate to="/import" replace />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/food" element={<Food />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>

  </PersistQueryClientProvider>
);

export default App;
