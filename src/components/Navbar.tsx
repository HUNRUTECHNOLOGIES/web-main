import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  currentRoute: 'home' | 'admin';
  onNavigate: (route: 'home' | 'admin', sectionId?: string) => void;
  announcementText?: string;
  announcementActive?: boolean;
}

type NavSection = 'catalog' | 'devtools' | 'collaborate' | 'stack';

export function Navbar({
  currentRoute,
  onNavigate,
  announcementText,
  announcementActive,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection | null>(null);
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (currentRoute !== 'home') {
      setActiveSection(null);
      return;
    }

    const sectionIds: NavSection[] = ['catalog', 'devtools', 'collaborate', 'stack'];
    const handleScroll = () => {
      const scrollMarker = window.scrollY + 140;
      let matched: NavSection | null = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollMarker) {
          matched = id;
        }
      }
      setActiveSection(matched);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentRoute]);

  const handleLinkClick = (route: 'home' | 'admin', sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(route, sectionId);
  };

  const navItems: Array<{ label: string; route: 'home' | 'admin'; section?: NavSection }> = [
    { label: 'Catalog', route: 'home', section: 'catalog' },
    { label: 'DevTools', route: 'home', section: 'devtools' },
    { label: 'Collaborate', route: 'home', section: 'collaborate' },
    { label: 'Stack', route: 'home', section: 'stack' },
    { label: 'Admin', route: 'admin' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-[#0A0D12]/90 backdrop-blur-md border-b border-white/8">
      {announcementActive && announcementText && (
        <div className="bg-[#0F141C] border-b border-white/8 px-4 py-1.5 text-center text-xs text-[#C4CEDB]">
          <span className="font-mono text-[#00FF66] mr-2">NOTICE</span>
          <span>{announcementText}</span>
        </div>
      )}

      <header className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('home', 'top')}
          className="font-display text-lg font-bold tracking-tight text-white hover:text-[#00FF66] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]/60 rounded"
        >
          HUNRUTECH
        </button>

        {/* Zone 2: 5 concise single-line navigation links with active layout underline */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#8B98A9]">
          {navItems.map((item) => {
            const isActive =
              item.route === 'admin'
                ? currentRoute === 'admin'
                : currentRoute === 'home' && activeSection === item.section;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.route, item.section)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-white ${
                  item.route === 'admin' && isActive
                    ? 'text-[#00E5FF]'
                    : isActive
                    ? 'text-white'
                    : 'hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="navbar-active-underline"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full ${
                      item.route === 'admin' ? 'bg-[#00E5FF]' : 'bg-[#00FF66]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {currentRoute === 'admin' ? (
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'top')}
              className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] active:scale-[0.98] rounded-md transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Public Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'devtools')}
              className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] rounded-md transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Launch DevTools
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 text-[#C4CEDB] hover:text-white border border-white/10 rounded-md cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-white/8 bg-[#0F141C] px-6 py-4 space-y-3"
          >
            <div className="flex flex-col gap-3 text-sm text-[#C4CEDB]">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleLinkClick(item.route, item.section)}
                  className={`text-left py-1.5 ${
                    item.route === 'admin' ? 'text-[#00E5FF]' : 'hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                currentRoute === 'admin'
                  ? handleLinkClick('home', 'top')
                  : handleLinkClick('home', 'devtools')
              }
              className="w-full py-2.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded-md"
            >
              {currentRoute === 'admin' ? 'Public Portal' : 'Launch DevTools'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Scroll Reading-Progress Indicator */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none overflow-hidden"
      >
        <motion.div
          style={{ scaleX: smoothProgress, transformOrigin: '0% 50%' }}
          className="h-full w-full bg-gradient-to-r from-[#00FF66] via-[#00E5FF] to-[#00FF66]"
        />
      </div>
    </div>
  );
}
