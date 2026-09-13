/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { FeedbackProvider } from "./components/ui/feedback";
import { SiteSettingsProvider } from "./hooks/useSiteSettings";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
import LogoPage from "./pages/LogoPage";
import WhatWeDoPage from "./pages/WhatWeDoPage";
import ImpactPage from "./pages/ImpactPage";
import SupportUsPage from "./pages/SupportUsPage";
import SocialConnect from "./components/SocialConnect";

import HomePage from "./pages/HomePage";

const PastEventsPage = lazy(() => import("./pages/PastEventsPage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const SponsorsPage = lazy(() => import("./pages/SponsorsPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const SeekHelpPage = lazy(() => import("./pages/SeekHelpPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const FoundersTeamPage = lazy(() => import("./pages/FoundersTeamPage"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RouteFallback() {
  return <div className="min-h-[70vh]" aria-busy="true" />;
}

export default function App() {
  function RequireAdmin({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) return null;

    return user?.role === "admin" ? (
      children
    ) : (
      <Navigate to="/" replace />
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <FeedbackProvider>
          <SiteSettingsProvider>
            <BrowserRouter>
              <ScrollToTop />

              <div className="min-h-screen selection:bg-brand-red selection:text-white">
                <Navbar />

                <main>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />

                      <Route path="/about" element={<LogoPage />} />
                      <Route path="/what-we-do" element={<WhatWeDoPage />} />
                      <Route path="/impact" element={<ImpactPage />} />
                      <Route path="/support-us" element={<SupportUsPage />} />

                      <Route path="/past-events" element={<PastEventsPage />} />
                      <Route path="/gallery" element={<GalleryPage />} />

                      <Route
                        path="/team-archive"
                        element={<Navigate to="/gallery" replace />}
                      />

                      <Route path="/sponsors" element={<SponsorsPage />} />
                      <Route path="/careers" element={<CareersPage />} />
                      <Route
                        path="/founders-team"
                        element={<FoundersTeamPage />}
                      />

                      <Route
                        path="/seek-help"
                        element={
                          <RequireAdmin>
                            <SeekHelpPage />
                          </RequireAdmin>
                        }
                      />

                      <Route path="/reviews" element={<ReviewsPage />} />
                      <Route
                        path="/reset-password"
                        element={<ResetPasswordPage />}
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </main>

                <SocialConnect />
                <Footer />
              </div>
            </BrowserRouter>
          </SiteSettingsProvider>
        </FeedbackProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}