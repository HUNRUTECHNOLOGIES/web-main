import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, GitBranch, Search, Terminal, X, Maximize2 } from 'lucide-react';
import { CopyableCodeBlock } from './CopyableCodeBlock.tsx';
import type { ProjectCategory, ProjectItem } from '../types/hunrutech.ts';

interface ProjectsCatalogProps {
  projects: ProjectItem[];
  loading: boolean;
}

const CATEGORIES: Array<'All' | ProjectCategory> = [
  'All',
  'Software',
  'CLI & Automation',
  'Web Apps',
];

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function ProjectsCatalog({ projects, loading }: ProjectsCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProjectCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [inspectedProject, setInspectedProject] = useState<ProjectItem | null>(null);

  useEffect(() => {
    if (!inspectedProject) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectedProject(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedProject]);

  const filtered = projects.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.techStack.some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });


  return (
    <section id="catalog" className="border-b border-white/8 bg-[#0A0D12]">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 space-y-10">
        {/* Section Header + Filter Controls */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <p className="font-mono text-xs text-[#00FF66]">01. Software &amp; Script Catalog</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Flagship Tools, CLI Scripts &amp; Web Systems
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8]">
              Production releases, Termux mobile environments, and authorized security utilities
              maintained across the HUNRUTECH ecosystem.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Animated Segmented Category Filter */}
            <div
              role="tablist"
              aria-label="Filter projects by category"
              className="flex items-center gap-1 p-1 bg-[#0F141C] border border-white/10 rounded-md overflow-x-auto"
            >
              {CATEGORIES.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(category)}
                    className={`relative px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? 'text-[#0A0D12] font-semibold' : 'text-[#8B98A9] hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="catalog-tab-active"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 bg-[#00FF66] rounded"
                      />
                    )}
                    <span className="relative z-10">{category}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools or stack..."
                aria-label="Search catalog"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#0F141C] border border-white/10 rounded-md text-white placeholder-[#64748B] focus:outline-none focus:border-[#00FF66]/60 transition-colors"
              />
            </div>
          </div>
        </motion.div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-96 rounded-lg border border-white/8 bg-[#0F141C] animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 rounded-lg border border-white/10 bg-[#0F141C] text-center space-y-3">
            <p className="text-sm text-[#C4CEDB]">No tools matched your filter criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-medium text-[#0A0D12] bg-[#00FF66] rounded-md cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project, index) => {
              const imgFailed = brokenImages[project.id] || !project.imageUrl;
              const hasRepo = isSafeHttpUrl(project.repoUrl);
              const hasDemo = isSafeHttpUrl(project.demoUrl);

              return (
                <motion.article
                  key={project.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08 }}
                  transition={{
                    duration: 0.24,
                    delay: Math.min(index * 0.05, 0.2),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="group rounded-lg border border-white/10 bg-[#0F141C] overflow-hidden flex flex-col justify-between transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5"
                >
                  <div>
                    {/* Visual Preview Slot (4:3) */}
                    <div
                      onClick={() => setInspectedProject(project)}
                      className="relative aspect-[4/3] w-full bg-[#141B26] border-b border-white/8 overflow-hidden cursor-pointer"
                    >
                      {!imgFailed ? (
                        <img
                          src={project.imageUrl}
                          alt={project.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [project.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#0F141C] to-[#17202E]">
                          <Terminal className="w-8 h-8 text-[#00FF66] mb-2" />
                          <span className="font-mono text-xs text-[#94A3B8]">{project.title}</span>
                        </div>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono text-[#8B98A9]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#00E5FF]">{project.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{project.version}</span>
                          {project.featured && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#00FF66]">Flagship</span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedProject(project)}
                          aria-label={`Inspect ${project.title} specs`}
                          className="text-[#8B98A9] hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3
                        onClick={() => setInspectedProject(project)}
                        className="font-display text-xl font-bold text-white leading-snug cursor-pointer group-hover:text-[#00FF66] transition-colors"
                      >
                        {project.title}
                      </h3>

                      <p className="text-sm text-[#94A3B8] leading-relaxed">{project.summary}</p>

                      <div className="pt-1 text-xs font-mono text-[#C4CEDB]">
                        {project.techStack.join(' · ')}
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-5 pb-5 pt-2 space-y-3">
                    {project.cloneCommand && (
                      <CopyableCodeBlock
                        command={project.cloneCommand}
                        projectTitle={project.title}
                        variant="compact"
                      />
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      {hasRepo && (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E6EDF3] bg-[#141B26] hover:bg-[#1C2636] border border-white/10 rounded transition-colors whitespace-nowrap"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-[#00FF66]" />
                          <span>Repository</span>
                        </a>
                      )}
                      {hasDemo && (
                        <a
                          href={project.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00E5FF] hover:text-white bg-[#0A0D12] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 rounded transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Live Demo</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setInspectedProject(project)}
                        className="ml-auto text-xs font-mono text-[#8B98A9] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Specs
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick-Inspect Project Specs Modal */}
      <AnimatePresence>
        {inspectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setInspectedProject(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={inspectedProject.title}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-lg border border-white/15 bg-[#0F141C] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121822]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#8B98A9]">
                  <span className="text-[#00E5FF]">{inspectedProject.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{inspectedProject.version}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedProject(null)}
                  aria-label="Close project details"
                  className="p-1.5 text-[#8B98A9] hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {inspectedProject.imageUrl && !brokenImages[inspectedProject.id] && (
                  <div className="aspect-[16/9] w-full rounded-md overflow-hidden border border-white/10 bg-[#0A0D12]">
                    <img
                      src={inspectedProject.imageUrl}
                      alt={inspectedProject.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-display text-2xl font-bold text-white">
                    {inspectedProject.title}
                  </h3>
                  <p className="text-sm text-[#B5C0CE] leading-relaxed">
                    {inspectedProject.summary}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-mono text-[#8B98A9]">Technology Stack</p>
                  <p className="text-xs font-mono text-[#00FF66]">
                    {inspectedProject.techStack.join(' · ')}
                  </p>
                </div>

                {inspectedProject.cloneCommand && (
                  <CopyableCodeBlock
                    command={inspectedProject.cloneCommand}
                    label="Install & Setup Command"
                    language="bash"
                    projectTitle={inspectedProject.title}
                    variant="expanded"
                  />
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/8">
                  {isSafeHttpUrl(inspectedProject.repoUrl) && (
                    <a
                      href={inspectedProject.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Open Repository</span>
                    </a>
                  )}
                  {isSafeHttpUrl(inspectedProject.demoUrl) && (
                    <a
                      href={inspectedProject.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#00E5FF] bg-[#0A0D12] border border-[#00E5FF]/35 hover:border-[#00E5FF] rounded-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Launch Live Demo</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
