import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { Navbar } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { ProjectsCatalog } from './components/ProjectsCatalog.tsx';
import { DevToolsHub } from './components/DevToolsHub.tsx';
import { CollaborationPortal } from './components/CollaborationPortal.tsx';
import { TechStackFooter } from './components/TechStackFooter.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { SettingsModal, type AppTheme } from './components/SettingsModal.tsx';
import { MatrixRainCanvas } from './components/MatrixRainCanvas.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Toaster } from './components/ui/sonner.tsx';
import { getDynamicDevToolShortcuts } from './lib/devToolsConfig.ts';
import { playTerminalKeystroke } from './lib/terminalAudio.ts';
import { notify } from './lib/toast.ts';
import {
  DEFAULT_API_PRESETS,
  DEFAULT_SITE_SETTINGS,
  FLAGSHIP_PROJECTS,
} from './data/seedCatalog.ts';
import {
  subscribePublicApiPresets,
  subscribePublicProjects,
  subscribeSiteSettings,
} from './lib/firestoreData.ts';
import type { ApiPreset, DevToolId, ProjectItem, SiteSettings } from './types/hunrutech.ts';

function getRouteFromPath(): 'home' | 'admin' {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return 'admin';
  }
  return 'home';
}

const routeSlideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 40 : -40,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -40 : 40,
  }),
};

export default function App() {
  const [route, setRoute] = useState<'home' | 'admin'>(getRouteFromPath);
  const [projects, setProjects] = useState<ProjectItem[]>(FLAGSHIP_PROJECTS);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [apiPresets, setApiPresets] = useState<ApiPreset[]>(DEFAULT_API_PRESETS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  const [activeDevTool, setActiveDevTool] = useState<DevToolId>('api-tester');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'obsidian';
    return window.localStorage.getItem('hunrutech-theme') === 'matrix' ? 'matrix' : 'obsidian';
  });
  const [matrixRain, setMatrixRain] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('hunrutech-matrix-rain');
    if (saved === 'on') return true;
    if (saved === 'off') return false;
    return window.localStorage.getItem('hunrutech-theme') === 'matrix';
  });
  const [terminalSound, setTerminalSound] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('hunrutech-terminal-sound') !== 'off';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('hunrutech-theme', theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-matrix-rain', matrixRain ? 'on' : 'off');
  }, [matrixRain]);

  const handleChangeTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    try {
      const explicitRain = window.localStorage.getItem('hunrutech-matrix-rain');
      if (nextTheme === 'matrix' && explicitRain === null) {
        setMatrixRain(true);
      }
    } catch {
      // Ignore storage error
    }
  };

  const handleToggleMatrixRain = () => {
    setMatrixRain((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('hunrutech-matrix-rain', next ? 'on' : 'off');
      } catch {
        // Ignore storage error
      }
      notify.success('Matrix Rain Updated', {
        description: next
          ? 'Canvas glyph rain background enabled.'
          : 'Canvas glyph rain background disabled.',
      });
      return next;
    });
  };

  const handleToggleTerminalSound = () => {
    setTerminalSound((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('hunrutech-terminal-sound', next ? 'on' : 'off');
      } catch {
        // Ignore storage error
      }
      if (next) {
        playTerminalKeystroke('nav', true);
      }
      return next;
    });
  };

  const handleToggleThemeQuick = () => {
    const next: AppTheme = theme === 'obsidian' ? 'matrix' : 'obsidian';
    handleChangeTheme(next);
    notify.success('Theme Updated', {
      description:
        next === 'matrix'
          ? 'High-contrast Matrix/Terminal palette active.'
          : 'Default Obsidian dark palette active.',
    });
  };

  useEffect(() => {
    const onPopState = () => {
      setRoute(getRouteFromPath());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
        const shortcuts = getDynamicDevToolShortcuts(siteSettings.enabledDevTools);
        const matched = shortcuts.find((s) => s.keyCode === e.code);
        if (!matched) return;
        e.preventDefault();
        setActiveDevTool(matched.id);
        setPaletteOpen(false);
        if (window.location.pathname !== '/') {
          window.history.pushState({}, '', '/');
        }
        setRoute('home');
        setTimeout(() => {
          const el = document.getElementById('devtools');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
        notify.info(`Switched to ${matched.label}`, {
          description: `Quick shortcut ${matched.shortcutLabel}`,
        });
      }
    };
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 520);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, [siteSettings.enabledDevTools]);

  useEffect(() => {
    const unsubProj = subscribePublicProjects(
      (items) => {
        if (items.length > 0) {
          setProjects(items);
        } else {
          setProjects(FLAGSHIP_PROJECTS);
        }
        setProjectsLoading(false);
      },
      () => {
        setProjects(FLAGSHIP_PROJECTS);
        setProjectsLoading(false);
      }
    );

    const unsubPresets = subscribePublicApiPresets((items) => {
      if (items.length > 0) {
        setApiPresets(items);
      } else {
        setApiPresets(DEFAULT_API_PRESETS);
      }
    });

    const unsubSettings = subscribeSiteSettings((settings) => {
      setSiteSettings(settings);
    });

    return () => {
      unsubProj();
      unsubPresets();
      unsubSettings();
    };
  }, []);

  const navigate = (targetRoute: 'home' | 'admin', sectionId?: string) => {
    const nextPath = targetRoute === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(targetRoute);

    if (targetRoute === 'home' && sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const routeDirection = route === 'admin' ? 1 : -1;

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <div className="min-h-screen bg-transparent text-[#E6EDF3] flex flex-col relative">
          <MatrixRainCanvas enabled={matrixRain} theme={theme} />

          <Navbar
            currentRoute={route}
            onNavigate={navigate}
            announcementText={siteSettings.announcementText}
            announcementActive={siteSettings.announcementActive}
          />

          <main className="flex-1 overflow-x-clip relative z-10">
            <AnimatePresence mode="wait" initial={false} custom={routeDirection}>
              {route === 'admin' ? (
                <motion.div
                  key="admin-route"
                  layout="position"
                  custom={routeDirection}
                  variants={routeSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <AdminDashboard
                    theme={theme}
                    onChangeTheme={handleChangeTheme}
                    matrixRain={matrixRain}
                    onToggleMatrixRain={handleToggleMatrixRain}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="public-route"
                  layout="position"
                  custom={routeDirection}
                  variants={routeSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <HeroSection
                    onJumpToSection={(sectionId) => navigate('home', sectionId)}
                    onSelectDevToolTab={(tab) => setActiveDevTool(tab)}
                    onOpenCommandPalette={() => setPaletteOpen(true)}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onToggleTheme={handleToggleThemeQuick}
                    onToggleMatrixRain={handleToggleMatrixRain}
                    soundEnabled={terminalSound}
                    onToggleSound={handleToggleTerminalSound}
                  />
                  <ProjectsCatalog projects={projects} loading={projectsLoading} />
                  <DevToolsHub
                    presets={apiPresets}
                    enabledTools={siteSettings.enabledDevTools}
                    maintenanceMode={siteSettings.maintenanceMode}
                    activeTool={activeDevTool}
                    onChangeActiveTool={setActiveDevTool}
                  />
                  <CollaborationPortal />
                  <TechStackFooter
                    onOpenAdmin={() => navigate('admin')}
                    onOpenSettings={() => setSettingsOpen(true)}
                    currentTheme={theme}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            projects={projects}
            apiPresets={apiPresets}
            enabledTools={siteSettings.enabledDevTools}
            activeDevTool={activeDevTool}
            onNavigate={navigate}
            onSelectDevTool={setActiveDevTool}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleTheme={handleToggleThemeQuick}
            currentTheme={theme}
            matrixRain={matrixRain}
            onToggleMatrixRain={handleToggleMatrixRain}
          />

          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            theme={theme}
            onChangeTheme={handleChangeTheme}
            matrixRain={matrixRain}
            onToggleMatrixRain={handleToggleMatrixRain}
            terminalSound={terminalSound}
            onToggleTerminalSound={handleToggleTerminalSound}
          />

          <AnimatePresence>
            {showBackToTop && (
              <motion.button
                type="button"
                aria-label="Scroll back to top"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-5 right-5 z-30 p-2.5 rounded-md border border-white/15 bg-[#0F141C]/95 text-[#00FF66] hover:border-[#00FF66]/60 hover:-translate-y-0.5 shadow-lg transition-all duration-150 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>

          <Toaster />
        </div>
      </ErrorBoundary>
    </MotionConfig>
  );
}
