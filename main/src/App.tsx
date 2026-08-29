/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";

import HomePage from "./pages/HomePage";
import LogoPage from "./pages/LogoPage";
import MissionVision from "./components/MissionVision";
import About from "./components/About";
import WhatWeDoPage from "./pages/WhatWeDoPage";
import ImpactPage from "./pages/ImpactPage";
import PastEventsPage from "./pages/PastEventsPage";
import GalleryPage from "./pages/GalleryPage";
import SponsorsPage from "./pages/SponsorsPage";
import CareersPage from "./pages/CareersPage";
import SeekHelpPage from "./pages/SeekHelpPage";
import ReviewsPage from "./pages/ReviewsPage";
import SupportUsPage from "./pages/SupportUsPage";
import FoundersTeamPage from "./pages/FoundersTeamPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import SocialConnect from "./components/SocialConnect";

export default function App() {
  function RequireAdmin({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    return user?.role === 'admin' ? children : <Navigate to="/" replace />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen selection:bg-brand-red selection:text-white">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<LogoPage />} />
                <Route path="/what-we-do" element={<WhatWeDoPage />} />
                <Route path="/impact" element={<ImpactPage />} />
                <Route path="/past-events" element={<PastEventsPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/sponsors" element={<SponsorsPage />} />
                <Route path="/careers" element={<CareersPage />} />
                <Route path="/founders-team" element={<FoundersTeamPage />} />
                <Route path="/seek-help" element={<RequireAdmin><SeekHelpPage /></RequireAdmin>} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/support-us" element={<SupportUsPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Routes>
            </main>
            <SocialConnect />
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
