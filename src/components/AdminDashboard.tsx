import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  Eye,
  EyeOff,
  FolderGit2,
  Inbox,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Edit3,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { notify } from '../lib/toast.ts';
import {
  checkIsAdmin,
  deleteApiPresetAdmin,
  deleteCollaborationAdmin,
  deleteProjectAdmin,
  saveApiPresetAdmin,
  saveProjectAdmin,
  saveSiteSettingsAdmin,
  seedDefaultCatalogIfEmpty,
  subscribeAllApiPresetsAdmin,
  subscribeAllProjectsAdmin,
  subscribeCollaborationsAdmin,
  subscribeSiteSettings,
  updateCollaborationAdmin,
} from '../lib/firestoreData.ts';
import { DEFAULT_SITE_SETTINGS } from '../data/seedCatalog.ts';
import type {
  ApiPreset,
  CollabStatus,
  CollaborationRecord,
  DevToolId,
  HttpMethod,
  PresetCategory,
  ProjectCategory,
  ProjectItem,
  SiteSettings,
} from '../types/hunrutech.ts';

import type { AppTheme } from './SettingsModal.tsx';
import {
  AdminSystemLogsWidget,
  type SystemLogEntry,
} from './AdminSystemLogsWidget.tsx';

type AdminTab = 'overview' | 'projects' | 'collaborations' | 'workbench';

interface AdminDashboardProps {
  theme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
  matrixRain?: boolean;
  onToggleMatrixRain?: () => void;
}

interface ServerStats {
  totalApiRuns: number;
  totalSmtpRuns: number;
  uptimeSec: number;
  rateLimits: {
    proxyRateLimitPerMin: number;
    smtpRateLimitPerMin: number;
  };
  recentExecutions: Array<{
    id: string;
    protocol: 'HTTP' | 'SMTP';
    target: string;
    status: string;
    latencyMs: number;
    timestamp: string;
  }>;
}

const ALL_DEV_TOOLS: Array<{ id: DevToolId; label: string }> = [
  { id: 'api-tester', label: 'Multi-Protocol API Tester' },
  { id: 'smtp-tester', label: 'SMTP & Email Tester' },
  { id: 'jwt-decoder', label: 'JWT Decoder' },
  { id: 'hash-base64', label: 'Base64 & Hash Generator' },
  { id: 'json-formatter', label: 'JSON Formatter' },
  { id: 'password-gen', label: 'Password Generator' },
  { id: 'qr-scanner', label: 'QR Code Scanner' },
  { id: 'syntax-visualizer', label: 'Interactive Syntax Visualizer' },
];

export function AdminDashboard({
  theme = 'obsidian',
  onChangeTheme,
  matrixRain = false,
  onToggleMatrixRain,
}: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [collabs, setCollabs] = useState<CollaborationRecord[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);

  const appendSystemLog = useCallback(
    (source: SystemLogEntry['source'], level: SystemLogEntry['level'], message: string) => {
      setSystemLogs((prev) => [
        ...prev.slice(-30),
        {
          id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toTimeString().slice(0, 8),
          source,
          level,
          message,
        },
      ]);
    },
    []
  );

  // Project Form Modal/Drawer State
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projSlug, setProjSlug] = useState('');
  const [projCategory, setProjCategory] = useState<ProjectCategory>('Software');
  const [projVersion, setProjVersion] = useState('v1.0.0');
  const [projSummary, setProjSummary] = useState('');
  const [projTech, setProjTech] = useState('TypeScript, Node.js');
  const [projRepo, setProjRepo] = useState('https://github.com/hunrutech');
  const [projDemo, setProjDemo] = useState('');
  const [projClone, setProjClone] = useState('');
  const [projImage, setProjImage] = useState('/src/assets/images/project_kali_portfolio_1795696507348.jpg');
  const [projFeatured, setProjFeatured] = useState(false);
  const [projVisible, setProjVisible] = useState(true);

  // Collaboration Filter & Review State
  const [collabFilter, setCollabFilter] = useState<'All' | CollabStatus>('All');
  const [selectedCollab, setSelectedCollab] = useState<CollaborationRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState<CollabStatus>('Pending');
  const [reviewAdminNotes, setReviewAdminNotes] = useState('');
  const [reviewPublicResponse, setReviewPublicResponse] = useState('');

  // API Preset Form State
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('Custom');
  const [presetMethod, setPresetMethod] = useState<HttpMethod>('GET');
  const [presetUrl, setPresetUrl] = useState('https://');
  const [presetHeaders, setPresetHeaders] = useState('{}');
  const [presetBody, setPresetBody] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [presetEnabled, setPresetEnabled] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const verifiedAdmin = await checkIsAdmin(currentUser.uid, currentUser.email);
        setIsAdmin(verifiedAdmin);
        if (verifiedAdmin) {
          seedDefaultCatalogIfEmpty().catch(() => {});
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin || !user) return;
    const unsubProj = subscribeAllProjectsAdmin(setProjects);
    const unsubCollab = subscribeCollaborationsAdmin(setCollabs);
    const unsubPresets = subscribeAllApiPresetsAdmin(setPresets);
    const unsubSettings = subscribeSiteSettings(setSettings);

    fetchServerStats(user);
    return () => {
      unsubProj();
      unsubCollab();
      unsubPresets();
      unsubSettings();
    };
  }, [isAdmin, user]);

  const fetchServerStats = useCallback(
    async (activeUser: User, showFeedback = false) => {
      try {
        const token = await activeUser.getIdToken();
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: ServerStats = await res.json();
          setServerStats(data);
          if (showFeedback) {
            appendSystemLog(
              'API',
              'ok',
              `Telemetry polled: ${data.totalApiRuns} API / ${data.totalSmtpRuns} SMTP runs`
            );
            notify.info('Telemetry Refreshed', {
              description: 'Live server proxy & SMTP counters updated.',
            });
          }
        }
      } catch {
        if (showFeedback) {
          appendSystemLog('API', 'err', 'GET /api/admin/stats failed');
          notify.error('Telemetry Refresh Failed', {
            description: 'Unable to reach server stats endpoint.',
          });
        }
      }
    },
    [appendSystemLog]
  );

  const refreshTelemetrySilent = useCallback(() => {
    if (user) {
      void fetchServerStats(user, false);
    }
  }, [user, fetchServerStats]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      notify.success('Signed In', { description: 'Admin session verified.' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    notify.info('Signed Out', { description: 'Admin console session closed.' });
  };

  const openNewProject = () => {
    setEditingProject(null);
    setProjTitle('');
    setProjSlug('');
    setProjCategory('Software');
    setProjVersion('v1.0.0');
    setProjSummary('');
    setProjTech('TypeScript, React');
    setProjRepo('https://github.com/hunrutech');
    setProjDemo('');
    setProjClone('');
    setProjImage('/src/assets/images/project_kali_portfolio_1795696507348.jpg');
    setProjFeatured(false);
    setProjVisible(true);
    setShowProjectForm(true);
  };

  const openEditProject = (p: ProjectItem) => {
    setEditingProject(p);
    setProjTitle(p.title);
    setProjSlug(p.slug);
    setProjCategory(p.category);
    setProjVersion(p.version);
    setProjSummary(p.summary);
    setProjTech(p.techStack.join(', '));
    setProjRepo(p.repoUrl);
    setProjDemo(p.demoUrl);
    setProjClone(p.cloneCommand);
    setProjImage(p.imageUrl);
    setProjFeatured(p.featured);
    setProjVisible(p.visible);
    setShowProjectForm(true);
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    const cleanSlug =
      (projSlug.trim() || projTitle.trim())
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '') || `tool-${Date.now()}`;
    const techList = projTech
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    await saveProjectAdmin(
      {
        id: editingProject ? editingProject.id : cleanSlug,
        slug: cleanSlug,
        title: projTitle.trim(),
        summary: projSummary.trim(),
        category: projCategory,
        version: projVersion.trim() || 'v1.0.0',
        techStack: techList.length ? techList : ['TypeScript'],
        repoUrl: projRepo.trim(),
        demoUrl: projDemo.trim(),
        cloneCommand: projClone.trim(),
        imageUrl: projImage.trim(),
        featured: projFeatured,
        visible: projVisible,
      },
      !editingProject
    );
    setShowProjectForm(false);
    appendSystemLog(
      'SYS',
      'ok',
      `${editingProject ? 'Updated' : 'Created'} catalog release: ${projTitle.trim()}`
    );
    notify.success(editingProject ? 'Project Updated' : 'Project Added to Catalog', {
      description: projTitle.trim(),
    });
  };

  const handleToggleProjectVisibility = async (p: ProjectItem) => {
    await saveProjectAdmin({ ...p, visible: !p.visible }, false);
    appendSystemLog(
      'SYS',
      'info',
      `Toggled visibility for ${p.title} -> ${!p.visible ? 'visible' : 'hidden'}`
    );
    notify.info('Visibility Updated', {
      description: `${p.title} is now ${!p.visible ? 'visible' : 'hidden'}.`,
    });
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProjectAdmin(id);
    appendSystemLog('SYS', 'warn', `Deleted catalog release: ${id}`);
    notify.success('Project Deleted');
  };

  const openCollabReview = (c: CollaborationRecord) => {
    setSelectedCollab(c);
    setReviewStatus(c.status);
    setReviewAdminNotes(c.adminNotes || '');
    setReviewPublicResponse('');
  };

  const handleUpdateCollab = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCollab) return;
    await updateCollaborationAdmin({
      collabId: selectedCollab.id,
      referenceId: selectedCollab.referenceId,
      status: reviewStatus,
      adminNotes: reviewAdminNotes,
      publicResponse: reviewPublicResponse,
    });
    appendSystemLog(
      'SYS',
      'ok',
      `Collaboration ${selectedCollab.referenceId} -> ${reviewStatus}`
    );
    setSelectedCollab(null);
    notify.success('Collaboration Status Synced', {
      description: `${selectedCollab.referenceId} updated to ${reviewStatus}.`,
    });
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    await saveSiteSettingsAdmin({
      announcementText: settings.announcementText,
      announcementActive: settings.announcementActive,
      maintenanceMode: settings.maintenanceMode,
      proxyRateLimitPerMin: Number(settings.proxyRateLimitPerMin),
      smtpRateLimitPerMin: Number(settings.smtpRateLimitPerMin),
      enabledDevTools: settings.enabledDevTools,
    });
    if (user) {
      const token = await user.getIdToken();
      await fetch('/api/admin/rate-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proxyRateLimitPerMin: Number(settings.proxyRateLimitPerMin),
          smtpRateLimitPerMin: Number(settings.smtpRateLimitPerMin),
        }),
      });
    }
    appendSystemLog(
      'API',
      'ok',
      `POST /api/admin/rate-limits -> 200 OK (proxy ${settings.proxyRateLimitPerMin}/m, smtp ${settings.smtpRateLimitPerMin}/m)`
    );
    notify.success('Tool Settings Saved', {
      description: 'Global workbench settings and rate limits updated.',
    });
  };

  const toggleDevToolSetting = (toolId: DevToolId) => {
    setSettings((prev) => {
      const exists = prev.enabledDevTools.includes(toolId);
      return {
        ...prev,
        enabledDevTools: exists
          ? prev.enabledDevTools.filter((id) => id !== toolId)
          : [...prev.enabledDevTools, toolId],
      };
    });
  };

  const openNewPreset = () => {
    setEditingPresetId(null);
    setPresetName('');
    setPresetCategory('Custom');
    setPresetMethod('GET');
    setPresetUrl('https://');
    setPresetHeaders('{}');
    setPresetBody('');
    setPresetDesc('');
    setPresetEnabled(true);
    setShowPresetForm(true);
  };

  const openEditPreset = (p: ApiPreset) => {
    setEditingPresetId(p.id);
    setPresetName(p.name);
    setPresetCategory(p.category);
    setPresetMethod(p.method);
    setPresetUrl(p.url);
    setPresetHeaders(p.headersJson);
    setPresetBody(p.bodyJson);
    setPresetDesc(p.description);
    setPresetEnabled(p.enabled);
    setShowPresetForm(true);
  };

  const handleSavePreset = async (e: FormEvent) => {
    e.preventDefault();
    const id =
      editingPresetId ||
      presetName
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '') ||
      `preset-${Date.now()}`;
    await saveApiPresetAdmin(
      {
        id,
        name: presetName.trim(),
        category: presetCategory,
        method: presetMethod,
        url: presetUrl.trim(),
        headersJson: presetHeaders,
        bodyJson: presetBody,
        description: presetDesc.trim(),
        enabled: presetEnabled,
      },
      !editingPresetId
    );
    setShowPresetForm(false);
    appendSystemLog(
      'API',
      'ok',
      `${editingPresetId ? 'Updated' : 'Created'} sandbox preset: ${presetName.trim()}`
    );
    notify.success(editingPresetId ? 'API Preset Updated' : 'API Preset Created', {
      description: presetName.trim(),
    });
  };

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center font-mono text-xs text-[#8B98A9]">
        Verifying admin session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <div className="p-8 rounded-lg border border-white/12 bg-[#0F141C] space-y-5">
          <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
            <ShieldCheck className="w-4 h-4" />
            <span>Protected Route: /admin</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            HUNRUTECH Admin Console
          </h1>
          <p className="text-sm text-[#94A3B8]">
            Sign in with an authorized Google account to manage catalog releases, collaboration
            requests, API presets, and platform rate limits.
          </p>
          {authError && (
            <p className="text-xs font-mono text-red-400">{authError}</p>
          )}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md transition-colors cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <div className="p-8 rounded-lg border border-red-500/30 bg-[#0F141C] space-y-4">
          <h1 className="font-display text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm text-[#94A3B8]">
            Signed in as <span className="font-mono text-white">{user.email}</span>, which does not
            hold administrator privileges for this console.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-medium text-white bg-[#141B26] border border-white/15 rounded-md cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const pendingCount = collabs.filter((c) => c.status === 'Pending').length;
  const activeProjectsCount = projects.filter((p) => p.visible).length;
  const filteredCollabs =
    collabFilter === 'All' ? collabs : collabs.filter((c) => c.status === collabFilter);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/8">
        <div>
          <p className="font-mono text-xs text-[#00E5FF]">Admin Console · /admin</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
            Platform Control Center
          </h1>
          <p className="text-xs text-[#8B98A9] mt-1">
            Operator: <span className="font-mono text-[#E6EDF3]">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchServerStats(user, true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#C4CEDB] bg-[#0F141C] border border-white/12 rounded-md hover:border-white/25 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#141B26] border border-white/15 rounded-md hover:border-red-400/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[#0F141C] border border-white/10 rounded-md overflow-x-auto w-fit max-w-full">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'projects', label: 'Projects & Scripts', icon: FolderGit2 },
            { id: 'collaborations', label: `Collaboration Inbox (${pendingCount})`, icon: Inbox },
            { id: 'workbench', label: 'Workbench & Settings', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
                  : 'text-[#8B98A9] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-lg border border-white/10 bg-[#0F141C] space-y-1">
              <p className="text-xs font-mono text-[#8B98A9]">API Proxy Runs</p>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">
                {serverStats?.totalApiRuns ?? 0}
              </p>
              <p className="text-[11px] text-[#00FF66]">
                Limit: {settings.proxyRateLimitPerMin} req/min
              </p>
            </div>
            <div className="p-5 rounded-lg border border-white/10 bg-[#0F141C] space-y-1">
              <p className="text-xs font-mono text-[#8B98A9]">SMTP Verifications</p>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">
                {serverStats?.totalSmtpRuns ?? 0}
              </p>
              <p className="text-[11px] text-[#00E5FF]">
                Limit: {settings.smtpRateLimitPerMin} req/min
              </p>
            </div>
            <div className="p-5 rounded-lg border border-white/10 bg-[#0F141C] space-y-1">
              <p className="text-xs font-mono text-[#8B98A9]">Active Catalog Tools</p>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">
                {activeProjectsCount} / {projects.length}
              </p>
              <p className="text-[11px] text-[#8B98A9]">Publicly listed in showcase</p>
            </div>
            <div className="p-5 rounded-lg border border-white/10 bg-[#0F141C] space-y-1">
              <p className="text-xs font-mono text-[#8B98A9]">Pending Collaborations</p>
              <p className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                {pendingCount}
              </p>
              <p className="text-[11px] text-[#8B98A9]">Total submissions: {collabs.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0F141C] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">
                Recent Workbench Executions
              </h2>
              <span className="font-mono text-xs text-[#8B98A9] tabular-nums">
                Server Uptime: {serverStats?.uptimeSec ?? 0}s
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/8 text-[#8B98A9] font-mono">
                  <tr>
                    <th className="px-5 py-2.5">Protocol</th>
                    <th className="px-5 py-2.5">Target</th>
                    <th className="px-5 py-2.5">Outcome</th>
                    <th className="px-5 py-2.5 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-mono">
                  {!serverStats || serverStats.recentExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-[#64748B]">
                        No API proxy or SMTP runs recorded in the current server process yet.
                      </td>
                    </tr>
                  ) : (
                    serverStats.recentExecutions.map((row) => (
                      <tr key={row.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-[#00E5FF]">{row.protocol}</td>
                        <td className="px-5 py-2.5 text-white truncate max-w-xs">{row.target}</td>
                        <td className="px-5 py-2.5 text-[#00FF66]">{row.status}</td>
                        <td className="px-5 py-2.5 text-right text-[#94A3B8] tabular-nums">
                          {row.latencyMs} ms
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Projects & Scripts Manager (CRUD) */}
      {activeTab === 'projects' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Catalog Releases ({projects.length})
            </h2>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  const res = await seedDefaultCatalogIfEmpty();
                  appendSystemLog(
                    'SYS',
                    'info',
                    `Seeded defaults (${res.seededProjects} projects, ${res.seededPresets} presets)`
                  );
                  notify.success('Catalog Defaults Seeded', {
                    description: `Added ${res.seededProjects} projects and ${res.seededPresets} presets.`,
                  });
                }}
                className="px-3.5 py-2 text-xs font-mono text-[#C4CEDB] bg-[#0F141C] border border-white/12 rounded-md hover:border-white/30 cursor-pointer"
              >
                Seed Flagship Defaults
              </button>
              <button
                type="button"
                onClick={openNewProject}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Project</span>
              </button>
            </div>
          </div>

          {showProjectForm && (
            <form
              onSubmit={handleSaveProject}
              className="p-6 rounded-lg border border-[#00FF66]/30 bg-[#0F141C] space-y-4"
            >
              <h3 className="font-display text-base font-semibold text-white">
                {editingProject ? `Edit: ${editingProject.title}` : 'Create Catalog Entry'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="Title (e.g. Konsole-OS)"
                  className="px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <input
                  type="text"
                  value={projSlug}
                  onChange={(e) => setProjSlug(e.target.value)}
                  placeholder="slug-id (auto if blank)"
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <select
                  value={projCategory}
                  onChange={(e) => setProjCategory(e.target.value as ProjectCategory)}
                  className="px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                >
                  <option value="Software">Software</option>
                  <option value="CLI & Automation">CLI &amp; Automation</option>
                  <option value="Web Apps">Web Apps</option>
                </select>
                <input
                  type="text"
                  required
                  value={projVersion}
                  onChange={(e) => setProjVersion(e.target.value)}
                  placeholder="v1.0.0"
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
              </div>
              <textarea
                rows={2}
                required
                value={projSummary}
                onChange={(e) => setProjSummary(e.target.value)}
                placeholder="Technical summary..."
                className="w-full p-3 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={projTech}
                  onChange={(e) => setProjTech(e.target.value)}
                  placeholder="Comma-separated tech stack (Java, Shell, Termux)"
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <input
                  type="text"
                  value={projClone}
                  onChange={(e) => setProjClone(e.target.value)}
                  placeholder="Clone / install command"
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <input
                  type="url"
                  value={projRepo}
                  onChange={(e) => setProjRepo(e.target.value)}
                  placeholder="https://github.com/..."
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <input
                  type="url"
                  value={projDemo}
                  onChange={(e) => setProjDemo(e.target.value)}
                  placeholder="https://hunrutech.pythonanywhere.com/... (optional)"
                  className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-6 text-xs text-[#C4CEDB]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projVisible}
                    onChange={(e) => setProjVisible(e.target.checked)}
                  />
                  <span>Visible on public showcase</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projFeatured}
                    onChange={(e) => setProjFeatured(e.target.checked)}
                  />
                  <span>Flagship featured release</span>
                </label>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded-md cursor-pointer"
                >
                  Save Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjectForm(false)}
                  className="px-4 py-2 text-xs text-[#C4CEDB] bg-[#141B26] rounded-md cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="rounded-lg border border-white/10 bg-[#0F141C] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/8 text-[#8B98A9] font-mono">
                  <tr>
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Version</th>
                    <th className="px-5 py-3">Visibility</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-white">{p.title}</td>
                      <td className="px-5 py-3 font-mono text-[#00E5FF]">{p.category}</td>
                      <td className="px-5 py-3 font-mono text-[#94A3B8]">{p.version}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleProjectVisibility(p)}
                          className={`inline-flex items-center gap-1.5 font-mono text-xs cursor-pointer ${
                            p.visible ? 'text-[#00FF66]' : 'text-[#64748B]'
                          }`}
                        >
                          {p.visible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditProject(p)}
                          aria-label={`Edit ${p.title}`}
                          className="p-1.5 text-[#C4CEDB] hover:text-white cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(p.id)}
                          aria-label={`Delete ${p.title}`}
                          className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Collaboration Requests Inbox */}
      {activeTab === 'collaborations' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Developer Collaboration Inbox
            </h2>
            <div className="flex items-center gap-1 p-1 bg-[#0F141C] border border-white/10 rounded-md overflow-x-auto">
              {(['All', 'Pending', 'In Review', 'Approved', 'Archived'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setCollabFilter(status)}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                    collabFilter === status
                      ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
                      : 'text-[#8B98A9] hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              {filteredCollabs.length === 0 ? (
                <div className="p-8 rounded-lg border border-white/10 bg-[#0F141C] text-xs text-[#8B98A9]">
                  No collaboration requests match the selected filter.
                </div>
              ) : (
                filteredCollabs.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-lg border bg-[#0F141C] space-y-2 cursor-pointer transition-colors ${
                      selectedCollab?.id === c.id
                        ? 'border-[#00FF66]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                    onClick={() => openCollabReview(c)}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00E5FF]">{c.referenceId}</span>
                      <span
                        className={
                          c.status === 'Approved'
                            ? 'text-[#00FF66]'
                            : c.status === 'In Review'
                            ? 'text-[#00E5FF]'
                            : c.status === 'Archived'
                            ? 'text-[#8B98A9]'
                            : 'text-amber-400'
                        }
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-white">{c.name}</h3>
                      <span className="text-xs text-[#8B98A9]">{c.collabType}</span>
                    </div>
                    <p className="text-xs text-[#94A3B8] line-clamp-2">{c.pitch}</p>
                    <p className="text-[11px] font-mono text-[#64748B]">
                      {c.techStack.join(' · ')}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-5">
              {selectedCollab ? (
                <form
                  onSubmit={handleUpdateCollab}
                  className="p-5 rounded-lg border border-white/12 bg-[#0F141C] space-y-4 sticky top-24"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#00E5FF]">
                      {selectedCollab.referenceId}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCollaborationAdmin(
                          selectedCollab.id,
                          selectedCollab.referenceId
                        );
                        appendSystemLog(
                          'SYS',
                          'warn',
                          `Removed collaboration record ${selectedCollab.referenceId}`
                        );
                        setSelectedCollab(null);
                        notify.success('Collaboration Record Removed');
                      }}
                      className="text-xs text-red-400 hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-white font-semibold text-sm">{selectedCollab.name}</p>
                    <p className="font-mono text-[#94A3B8]">Contact: {selectedCollab.contact}</p>
                    {selectedCollab.portfolioUrl && (
                      <p className="font-mono text-[#00FF66] truncate">
                        URL: {selectedCollab.portfolioUrl}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded bg-[#0A0D12] border border-white/8 text-xs text-[#E6EDF3] whitespace-pre-wrap">
                    {selectedCollab.pitch}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#C4CEDB]">Status</label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as CollabStatus)}
                      className="w-full px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Review">In Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#C4CEDB]">
                      Internal Admin Notes (Private)
                    </label>
                    <textarea
                      rows={2}
                      value={reviewAdminNotes}
                      onChange={(e) => setReviewAdminNotes(e.target.value)}
                      className="w-full p-2.5 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#C4CEDB]">
                      Public Status Note (Shown on Reference ID Tracker)
                    </label>
                    <textarea
                      rows={2}
                      value={reviewPublicResponse}
                      onChange={(e) => setReviewPublicResponse(e.target.value)}
                      placeholder="Optional note visible to the applicant..."
                      className="w-full p-2.5 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded-md cursor-pointer"
                    >
                      Update Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCollab(null)}
                      className="px-4 py-2 text-xs text-[#C4CEDB] bg-[#141B26] rounded-md cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-8 rounded-lg border border-white/10 bg-[#0F141C] text-xs text-[#64748B]">
                  Select a collaboration request to review pitch details and update its status.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Workbench & Global Settings */}
      {activeTab === 'workbench' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Global Settings & Rate Limits */}
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-5 p-6 rounded-lg border border-white/10 bg-[#0F141C] space-y-5"
          >
            <h2 className="font-display text-lg font-semibold text-white">
              Global &amp; Rate-Limit Settings
            </h2>

            {onChangeTheme && (
              <div className="space-y-2 pb-4 border-b border-white/8">
                <p className="text-xs font-medium text-[#C4CEDB]">Console Theme</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTheme('obsidian');
                      notify.success('Theme Switched', { description: 'Obsidian dark palette active.' });
                    }}
                    className={`px-3 py-2 text-xs font-mono rounded-md border text-left transition-colors cursor-pointer ${
                      theme === 'obsidian'
                        ? 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66] font-semibold'
                        : 'border-white/12 bg-[#0A0D12] text-[#8B98A9] hover:text-white'
                    }`}
                  >
                    Obsidian (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTheme('matrix');
                      notify.success('Theme Switched', {
                        description: 'High-contrast Matrix/Terminal palette active.',
                      });
                    }}
                    className={`px-3 py-2 text-xs font-mono rounded-md border text-left transition-colors cursor-pointer ${
                      theme === 'matrix'
                        ? 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66] font-semibold'
                        : 'border-white/12 bg-[#0A0D12] text-[#8B98A9] hover:text-white'
                    }`}
                  >
                    Matrix / Terminal
                  </button>
                </div>
                {onToggleMatrixRain && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#94A3B8]">Matrix Rain Canvas Background</span>
                    <button
                      type="button"
                      onClick={onToggleMatrixRain}
                      aria-pressed={matrixRain}
                      className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                        matrixRain
                          ? 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66]'
                          : 'border-white/12 bg-[#0A0D12] text-[#8B98A9] hover:text-white'
                      }`}
                    >
                      {matrixRain ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.announcementActive}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, announcementActive: e.target.checked }))
                  }
                />
                <span>Enable Top Announcement Banner</span>
              </label>
              <input
                type="text"
                value={settings.announcementText}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, announcementText: e.target.value }))
                }
                placeholder="Announcement message..."
                className="w-full px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, maintenanceMode: e.target.checked }))
                }
              />
              <span>Enable DevTools Workbench Maintenance Mode</span>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/8">
              <div className="space-y-1">
                <label className="block text-xs text-[#C4CEDB]">Proxy Rate Limit (req/min)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.proxyRateLimitPerMin}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      proxyRateLimitPerMin: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#C4CEDB]">SMTP Rate Limit (req/min)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.smtpRateLimitPerMin}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      smtpRateLimitPerMin: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/8">
              <p className="text-xs font-medium text-[#C4CEDB]">Enabled Workbench Utilities</p>
              <div className="space-y-1.5">
                {ALL_DEV_TOOLS.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={settings.enabledDevTools.includes(tool.id)}
                      onChange={() => toggleDevToolSetting(tool.id)}
                    />
                    <span>{tool.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md cursor-pointer"
            >
              Save Global Settings
            </button>
          </form>

          {/* API Presets Manager */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                API Sandbox Presets ({presets.length})
              </h2>
              <button
                type="button"
                onClick={openNewPreset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00E5FF] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Preset</span>
              </button>
            </div>

            {showPresetForm && (
              <form
                onSubmit={handleSavePreset}
                className="p-5 rounded-lg border border-[#00E5FF]/30 bg-[#0F141C] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    className="px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                  />
                  <select
                    value={presetCategory}
                    onChange={(e) => setPresetCategory(e.target.value as PresetCategory)}
                    className="px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white"
                  >
                    <option value="Daraja">Daraja</option>
                    <option value="Paystack">Paystack</option>
                    <option value="Supabase">Supabase</option>
                    <option value="Custom">Custom</option>
                  </select>
                  <select
                    value={presetMethod}
                    onChange={(e) => setPresetMethod(e.target.value as HttpMethod)}
                    className="px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <input
                  type="url"
                  required
                  value={presetUrl}
                  onChange={(e) => setPresetUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <textarea
                  rows={2}
                  value={presetHeaders}
                  onChange={(e) => setPresetHeaders(e.target.value)}
                  placeholder="Headers JSON"
                  className="w-full p-2.5 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <textarea
                  rows={2}
                  value={presetBody}
                  onChange={(e) => setPresetBody(e.target.value)}
                  placeholder="Body JSON (optional)"
                  className="w-full p-2.5 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white"
                />
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-[#E6EDF3]">
                    <input
                      type="checkbox"
                      checked={presetEnabled}
                      onChange={(e) => setPresetEnabled(e.target.checked)}
                    />
                    <span>Enabled in Workbench</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded cursor-pointer"
                    >
                      Save Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPresetForm(false)}
                      className="px-3 py-1.5 text-xs text-[#C4CEDB] bg-[#141B26] rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="rounded-lg border border-white/10 bg-[#0F141C] divide-y divide-white/8">
              {presets.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[#00FF66]">{p.method}</span>
                      <span className="text-[#00E5FF]">{p.category}</span>
                      <span className="text-white font-semibold truncate">{p.name}</span>
                    </div>
                    <p className="text-[11px] font-mono text-[#8B98A9] truncate mt-0.5">{p.url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditPreset(p)}
                      className="p-1.5 text-[#C4CEDB] hover:text-white cursor-pointer"
                      aria-label={`Edit ${p.name}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteApiPresetAdmin(p.id);
                        appendSystemLog('API', 'warn', `Deleted sandbox preset: ${p.name}`);
                        notify.success('API Preset Deleted', { description: p.name });
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-Time System Logs Floating Terminal */}
      <AdminSystemLogsWidget
        recentExecutions={serverStats?.recentExecutions}
        externalLogs={systemLogs}
        onRefreshTelemetry={refreshTelemetrySilent}
      />
    </div>
  );
}
