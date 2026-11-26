import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Loader2, Search, Send, Users } from 'lucide-react';
import { lookupCollabStatus, submitCollaborationRequest } from '../lib/firestoreData.ts';
import { notify } from '../lib/toast.ts';
import type { CollabStatusRecord, CollabType } from '../types/hunrutech.ts';

const COLLAB_TYPES: CollabType[] = [
  'Open-Source Contribution',
  'Joint Venture',
  'Client Project',
  'Security Research',
];

const SUGGESTED_STACKS = [
  'TypeScript',
  'Next.js',
  'Python',
  'Java',
  'PostgreSQL',
  'Supabase',
  'Firebase',
  'Tailwind CSS',
  'Figma',
  'Unity',
];

export function CollaborationPortal() {
  const [name, setName] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [contact, setContact] = useState('');
  const [collabType, setCollabType] = useState<CollabType>('Open-Source Contribution');
  const [selectedTags, setSelectedTags] = useState<string[]>(['TypeScript']);
  const [customTag, setCustomTag] = useState('');
  const [pitch, setPitch] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedRefId, setGeneratedRefId] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Tracker State
  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<CollabStatusRecord | null>(null);
  const [lookupNotFound, setLookupNotFound] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.length > 1 ? prev.filter((t) => t !== tag) : prev;
      }
      if (prev.length >= 12) return prev;
      return [...prev, tag];
    });
  };

  const addCustomTag = () => {
    const clean = customTag.trim();
    if (!clean || clean.length > 40) return;
    if (!selectedTags.includes(clean) && selectedTags.length < 12) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    setCustomTag('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (name.trim().length < 2) {
      setSubmitError('Please enter your name or handle (at least 2 characters).');
      return;
    }
    if (portfolioUrl.trim() && !/^https?:\/\//i.test(portfolioUrl.trim())) {
      setSubmitError('Portfolio / GitHub URL must start with https:// or http://.');
      return;
    }
    if (contact.trim().length < 3) {
      setSubmitError('Please provide an email address or Discord handle.');
      return;
    }
    if (pitch.trim().length < 10) {
      setSubmitError('Project pitch must be at least 10 characters.');
      return;
    }
    if (selectedTags.length === 0) {
      setSubmitError('Select at least one primary tech stack tag.');
      return;
    }

    setSubmitting(true);
    try {
      const refId = await submitCollaborationRequest({
        name,
        portfolioUrl,
        contact,
        collabType,
        techStack: selectedTags,
        pitch,
      });
      setGeneratedRefId(refId);
      setLookupId(refId);
      setName('');
      setPortfolioUrl('');
      setContact('');
      setPitch('');
      notify.success('Collaboration Request Submitted', {
        description: `Reference ID: ${refId}`,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? 'Could not submit collaboration request. Verify your inputs and try again.'
          : 'Submission failed.';
      setSubmitError(msg);
      notify.error('Submission Failed', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackStatus = async (e: FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupNotFound(false);
    setLookupResult(null);

    if (!lookupId.trim()) {
      setLookupError('Enter a Reference ID (for example: HNRT-A8K2M9P4).');
      return;
    }

    setLookupLoading(true);
    try {
      const record = await lookupCollabStatus(lookupId);
      if (!record) {
        setLookupNotFound(true);
        notify.warning('Reference ID Not Found', { description: lookupId.trim() });
      } else {
        setLookupResult(record);
        notify.info(`Status: ${record.status}`, { description: record.referenceId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status lookup failed.';
      setLookupError(msg);
      notify.error('Status Lookup Failed', { description: msg });
    } finally {
      setLookupLoading(false);
    }
  };

  const copyReferenceId = async () => {
    if (!generatedRefId) return;
    try {
      await navigator.clipboard.writeText(generatedRefId);
      setCopiedRef(true);
      notify.success('Reference ID Copied', { description: generatedRefId });
      setTimeout(() => setCopiedRef(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <section id="collaborate" className="border-b border-white/8 bg-[#0A0D12]">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2 max-w-2xl"
        >
          <p className="font-mono text-xs text-[#00FF66]">03. Developer Collaboration Portal</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Build With HUNRUTECH &amp; Zero One
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8]">
            Developers, UI/UX designers, and security researchers can submit proposals below and
            track review progress using their generated Reference ID.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Collaboration Submission Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.26, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 p-6 rounded-lg border border-white/10 bg-[#0F141C] space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="collab-name" className="block text-xs font-medium text-[#C4CEDB]">
                  Name or Alias *
                </label>
                <input
                  id="collab-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex / @cipher-dev"
                  className="w-full px-3.5 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="collab-contact" className="block text-xs font-medium text-[#C4CEDB]">
                  Email or Discord Handle *
                </label>
                <input
                  id="collab-contact"
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="dev@domain.com or @handle"
                  className="w-full px-3.5 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="collab-url" className="block text-xs font-medium text-[#C4CEDB]">
                  GitHub or Portfolio URL
                </label>
                <input
                  id="collab-url"
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="collab-type" className="block text-xs font-medium text-[#C4CEDB]">
                  Collaboration Type *
                </label>
                <select
                  id="collab-type"
                  value={collabType}
                  onChange={(e) => setCollabType(e.target.value as CollabType)}
                  className="w-full px-3.5 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                >
                  {COLLAB_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tech Stack Multi-Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#C4CEDB]">
                Primary Tech Stack Tags *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_STACKS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 text-xs font-mono rounded border active:scale-[0.97] transition-all duration-150 cursor-pointer ${
                        active
                          ? 'bg-[#00FF66]/15 border-[#00FF66] text-[#00FF66]'
                          : 'bg-[#0A0D12] border-white/10 text-[#8B98A9] hover:text-white hover:border-white/25'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Add custom stack tag (e.g. Rust, Godot)..."
                  className="flex-1 px-3 py-1.5 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="px-3 py-1.5 text-xs font-mono text-[#E6EDF3] bg-[#141B26] border border-white/12 rounded-md hover:border-white/30 cursor-pointer"
                >
                  Add Tag
                </button>
              </div>
              <p className="text-[11px] font-mono text-[#8B98A9]">
                Selected: {selectedTags.join(' · ')}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="collab-pitch" className="block text-xs font-medium text-[#C4CEDB]">
                Project Pitch &amp; Scope *
              </label>
              <textarea
                id="collab-pitch"
                rows={4}
                required
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="Describe the architecture, security research scope, or product roadmap you want to build with HUNRUTECH..."
                className="w-full p-3.5 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <AnimatePresence mode="wait">
              {submitError && (
                <motion.div
                  key="collab-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="p-3 rounded border border-red-500/30 bg-red-950/20 text-xs text-red-300"
                >
                  {submitError}
                </motion.div>
              )}

              {generatedRefId && (
                <motion.div
                  key={`collab-ref-${generatedRefId}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="p-4 rounded border border-[#00FF66]/40 bg-[#00FF66]/10 space-y-2"
                >
                  <p className="text-xs font-semibold text-[#00FF66]">
                    Collaboration Request Submitted
                  </p>
                  <p className="text-xs text-[#E6EDF3]">
                    Save your Reference ID to track review status:
                  </p>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#0A0D12] border border-white/15">
                    <code className="font-mono text-sm font-bold text-white">{generatedRefId}</code>
                    <button
                      type="button"
                      onClick={copyReferenceId}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00FF66] hover:text-white cursor-pointer"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRef ? 'Copied' : 'Copy ID'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] disabled:opacity-60 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]/60 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{submitting ? 'Submitting...' : 'Submit Collaboration Request'}</span>
            </button>
          </motion.form>

          {/* Right Column: Reference ID Status Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.26, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-5"
          >
            <div className="p-6 rounded-lg border border-white/10 bg-[#0F141C] space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
                  <Users className="w-4 h-4" />
                  <span>Application Status Tracker</span>
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  Track Your Request
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Enter your generated Reference ID to check live review status without exposing
                  personal contact details.
                </p>
              </div>

              <form onSubmit={handleTrackStatus} className="flex gap-2">
                <input
                  type="text"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value.toUpperCase())}
                  placeholder="HNRT-XXXXXXXX"
                  aria-label="Reference ID"
                  className="flex-1 px-3.5 py-2 text-xs font-mono uppercase bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00E5FF]"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] active:scale-[0.98] disabled:opacity-60 rounded-md transition-all duration-150 shrink-0 cursor-pointer"
                >
                  {lookupLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{lookupLoading ? 'Checking...' : 'Check Status'}</span>
                </button>
              </form>

              <AnimatePresence mode="wait">
                {lookupError && (
                  <motion.p
                    key="lookup-error"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="text-xs font-mono text-red-400"
                  >
                    {lookupError}
                  </motion.p>
                )}

                {lookupNotFound && (
                  <motion.div
                    key="lookup-not-found"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded border border-white/10 bg-[#0A0D12] text-xs text-[#94A3B8]"
                  >
                    No collaboration request found for Reference ID{' '}
                    <span className="font-mono text-white">{lookupId}</span>.
                  </motion.div>
                )}

                {lookupResult && (
                  <motion.div
                    key={`lookup-result-${lookupResult.referenceId}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded border border-white/12 bg-[#0A0D12] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#8B98A9]">
                        {lookupResult.referenceId}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          lookupResult.status === 'Approved'
                            ? 'text-[#00FF66]'
                            : lookupResult.status === 'In Review'
                            ? 'text-[#00E5FF]'
                            : lookupResult.status === 'Archived'
                            ? 'text-[#8B98A9]'
                            : 'text-amber-400'
                        }`}
                      >
                        Status: {lookupResult.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#C4CEDB]">
                      Track: <span className="text-white">{lookupResult.collabType}</span>
                    </p>
                    {lookupResult.publicResponse && (
                      <div className="pt-2 border-t border-white/8 text-xs text-[#E6EDF3]">
                        <span className="block font-mono text-[11px] text-[#00FF66] mb-1">
                          Reviewer Note
                        </span>
                        {lookupResult.publicResponse}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-5 rounded-lg border border-white/8 bg-[#0F141C] space-y-2">
              <h4 className="font-display text-sm font-semibold text-white">
                Zero One Community Standards
              </h4>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                All security research collaborations require written scope authorization. Open-source
                contributors receive repository access and attribution across the HUNRUTECH catalog.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
