import { AnimatePresence, motion } from "motion/react";
import {
  Briefcase,
  Calendar,
  Handshake,
  Home,
  ImageIcon,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Star,
  User,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthModals from "./AuthModals";
import Logo from "./Logo";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const navItems = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Events", icon: Calendar, path: "/past-events" },
    { name: "Founders & Team", icon: Users, path: "/founders-team" },
    { name: "Team Archive", icon: ImageIcon, path: "/gallery" },
    { name: "Sponsors", icon: Handshake, path: "/sponsors" },
    { name: "Careers", icon: Briefcase, path: "/careers" },
    { name: "Seek Help", icon: LifeBuoy, path: "/seek-help" },
    { name: "Reviews", icon: Star, path: "/reviews" },
  ].filter((item) => item.name !== "Seek Help" || user?.role === "admin");

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path;

  const handleAuthClick = (mode: "login" | "register") => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  const handleNavigation = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav
        className="fixed left-1/2 top-4 z-50 w-[94%] max-w-7xl -translate-x-1/2 sm:top-5 lg:top-6"
        aria-label="Main navigation"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="group relative flex h-[68px] items-center justify-between overflow-hidden rounded-3xl border border-stone-200 bg-white/95 px-4 shadow-2xl backdrop-blur-xl sm:h-[76px] sm:px-6 lg:px-8"
        >
          {/* Decorative top border */}
          <div className="absolute left-0 top-0 h-1 w-full bg-brand-maroon opacity-50 transition-opacity group-hover:opacity-100" />

          {/* Brand */}
          <Link
            to="/"
            onClick={handleNavigation}
            aria-label="Ikshana Foundation home"
            className="flex min-w-0 shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80 sm:gap-3"
          >
            <Logo className="h-9 w-9 sm:h-10 sm:w-10" />

            <div className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-serif text-base font-black tracking-[0.16em] text-brand-maroon sm:text-lg sm:tracking-[0.2em] lg:text-xl">
                IKSHANA
              </span>
              <span className="mt-1 text-[6px] font-semibold uppercase tracking-[0.22em] text-brand-maroon/70 sm:text-[7px] sm:tracking-[0.28em] lg:text-[8px]">
                FOUNDATION
              </span>
            </div>
          </Link>

          {/* Desktop navigation - shown only when there is enough space */}
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="flex items-center gap-3 xl:gap-5 2xl:gap-7">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  aria-current={isActive(item.path) ? "page" : undefined}
                  className={`group flex shrink-0 items-center text-xs font-medium transition-colors lg:text-sm ${
                    isActive(item.path)
                      ? "text-brand-maroon"
                      : "text-brand-maroon/80 hover:text-brand-maroon"
                  }`}
                >
                  <span className="relative whitespace-nowrap">
                    {item.name}
                    <span
                      className={`absolute -bottom-1 left-0 h-0.5 bg-brand-maroon transition-all ${
                        isActive(item.path)
                          ? "w-full"
                          : "w-0 group-hover:w-full"
                      }`}
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop authentication */}
          <div className="hidden shrink-0 items-center gap-2 xl:gap-4 lg:flex">
            <div className="h-6 w-px bg-brand-maroon/10" />

            {user ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-brand-maroon/70">
                  <User size={16} className="text-brand-maroon" />

                  <div className="flex flex-col">
                    <span>{user.name.split(" ")[0]}</span>

                    {user.role === "admin" && (
                      <span className="mt-0.5 rounded-full bg-brand-maroon px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-widest text-white">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1 text-sm font-medium text-brand-maroon/60 transition-colors hover:text-brand-maroon"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleAuthClick("login")}
                className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-brand-maroon/70 transition-colors hover:bg-brand-maroon/5 hover:text-brand-maroon"
                aria-label="Sign In"
              >
                <LogIn size={17} />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Compact navigation for tablet/mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            {user && (
              <div className="hidden items-center sm:flex">
                <span className="text-xs font-medium text-brand-maroon/70">
                  {user.name.split(" ")[0]}
                </span>
              </div>
            )}

            {!user && (
              <button
                type="button"
                onClick={() => handleAuthClick("login")}
                className="flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-brand-maroon/70 transition-colors hover:bg-brand-maroon/5 hover:text-brand-maroon"
                aria-label="Sign In"
                title="Sign In"
              >
                <LogIn size={18} />
                <span className="hidden md:inline">Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-maroon/15 bg-white text-brand-maroon transition-all hover:bg-brand-maroon/5 hover:shadow-sm"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              title="Open menu"
            >
              {/* Ikshana-inspired menu button: logo mark instead of hamburger */}
              <Logo className="h-6 w-6" />
            </button>
          </div>
        </motion.div>
      </nav>

      {/* Mobile / tablet navigation drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[2px]"
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 z-[70] flex h-dvh w-[min(88vw,390px)] flex-col overflow-y-auto rounded-l-[2rem] border-l border-stone-200 bg-white shadow-2xl"
              aria-label="Navigation menu"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-brand-maroon/10 px-6 py-5">
                <Link
                  to="/"
                  onClick={handleNavigation}
                  className="flex items-center gap-3"
                  aria-label="Ikshana Foundation home"
                >
                  <Logo className="h-9 w-9" />

                  <div className="flex flex-col leading-none">
                    <span className="font-serif text-lg font-black tracking-[0.2em] text-brand-maroon">
                      IKSHANA
                    </span>
                    <span className="mt-1 text-[7px] font-semibold uppercase tracking-[0.28em] text-brand-maroon/70">
                      FOUNDATION
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-maroon/10 text-brand-maroon transition-colors hover:bg-brand-maroon/5"
                  aria-label="Close navigation menu"
                >
                  <X size={21} />
                </button>
              </div>

              {/* Drawer navigation */}
              <div className="flex flex-1 flex-col px-5 py-6">
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={handleNavigation}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-all ${
                          active
                            ? "bg-[#fff4ed] font-semibold text-brand-maroon"
                            : "text-stone-700 hover:bg-[#fff9f5] hover:text-brand-maroon"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            active
                              ? "bg-white text-brand-maroon shadow-sm"
                              : "bg-[#fff9f5] text-brand-maroon"
                          }`}
                        >
                          <Icon size={18} />
                        </span>

                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="my-5 h-px bg-brand-maroon/10" />

                {/* Authentication inside drawer */}
                {user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-2xl bg-[#fff9f5] px-4 py-3.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-maroon shadow-sm">
                        <User size={18} />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-800">
                          {user.name}
                        </p>

                        {user.role === "admin" && (
                          <span className="mt-1 inline-flex rounded-full bg-brand-maroon px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-stone-700 transition-colors hover:bg-[#fff9f5] hover:text-brand-maroon"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff9f5] text-brand-maroon">
                        <LogOut size={18} />
                      </span>

                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAuthClick("login")}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold text-stone-800 transition-colors hover:bg-[#fff9f5] hover:text-brand-maroon"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff9f5] text-brand-maroon">
                      <LogIn size={18} />
                    </span>

                    <span>Sign In</span>
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AuthModals
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}