import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import {
  DEFAULT_API_PRESETS,
  DEFAULT_SITE_SETTINGS,
  FLAGSHIP_PROJECTS,
} from '../data/seedCatalog.ts';
import type {
  ApiPreset,
  CollabStatus,
  CollabStatusRecord,
  CollabType,
  CollaborationRecord,
  ProjectItem,
  SiteSettings,
} from '../types/hunrutech.ts';

export function subscribePublicProjects(
  onData: (items: ProjectItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  const q = query(collection(db, path), where('visible', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectItem, 'id'>) }));
      items.sort((a, b) => Number(b.featured) - Number(a.featured));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllProjectsAdmin(
  onData: (items: ProjectItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectItem, 'id'>) }));
      items.sort((a, b) => Number(b.featured) - Number(a.featured));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePublicApiPresets(
  onData: (items: ApiPreset[]) => void
): Unsubscribe {
  const path = 'apiPresets';
  const q = query(collection(db, path), where('enabled', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApiPreset, 'id'>) }));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllApiPresetsAdmin(
  onData: (items: ApiPreset[]) => void
): Unsubscribe {
  const path = 'apiPresets';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApiPreset, 'id'>) }));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

const NEW_DEV_TOOLS_ROLLOUT_MS = Date.parse('2026-11-26T13:18:00Z');
const SYNTAX_VISUALIZER_ROLLOUT_MS = Date.parse('2026-11-26T14:15:00Z');

export function subscribeSiteSettings(
  onData: (settings: SiteSettings) => void
): Unsubscribe {
  const ref = doc(db, 'siteSettings', 'global');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SiteSettings & {
          updatedAt?: { toMillis?: () => number };
        };
        const updatedAtMs = data.updatedAt?.toMillis?.() ?? 0;
        const enabled = Array.isArray(data.enabledDevTools) ? [...data.enabledDevTools] : [];
        if (updatedAtMs > 0 && updatedAtMs < NEW_DEV_TOOLS_ROLLOUT_MS) {
          if (!enabled.includes('password-gen')) enabled.push('password-gen');
          if (!enabled.includes('qr-scanner')) enabled.push('qr-scanner');
        }
        if (updatedAtMs > 0 && updatedAtMs < SYNTAX_VISUALIZER_ROLLOUT_MS) {
          if (!enabled.includes('syntax-visualizer')) enabled.push('syntax-visualizer');
        }
        onData({ ...data, enabledDevTools: enabled });
      } else {
        onData({ ...DEFAULT_SITE_SETTINGS });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'siteSettings/global');
    }
  );
}

export function subscribeCollaborationsAdmin(
  onData: (items: CollaborationRecord[]) => void
): Unsubscribe {
  const path = 'collaborations';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CollaborationRecord, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function generateReferenceId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 8; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  return `HNRT-${token}`;
}

export async function submitCollaborationRequest(payload: {
  name: string;
  portfolioUrl: string;
  contact: string;
  collabType: CollabType;
  techStack: string[];
  pitch: string;
}): Promise<string> {
  const referenceId = generateReferenceId();
  const collabId = `${referenceId.toLowerCase()}-${Date.now().toString(36)}`;
  const batch = writeBatch(db);

  const collabRef = doc(db, 'collaborations', collabId);
  const statusRef = doc(db, 'collabStatuses', referenceId);

  batch.set(collabRef, {
    referenceId,
    name: payload.name.trim(),
    portfolioUrl: payload.portfolioUrl.trim(),
    contact: payload.contact.trim(),
    collabType: payload.collabType,
    techStack: payload.techStack,
    pitch: payload.pitch.trim(),
    status: 'Pending',
    adminNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(statusRef, {
    referenceId,
    collabType: payload.collabType,
    status: 'Pending',
    publicResponse: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return referenceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `collaborations/${collabId}`);
  }
}

export async function lookupCollabStatus(referenceId: string): Promise<CollabStatusRecord | null> {
  const normalized = referenceId.trim().toUpperCase();
  if (!/^HNRT-[A-Z0-9]{6,14}$/.test(normalized)) {
    throw new Error('Invalid Reference ID format. Expected format: HNRT-XXXXXXXX');
  }
  const path = `collabStatuses/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'collabStatuses', normalized));
    if (!snap.exists()) return null;
    return snap.data() as CollabStatusRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateCollaborationAdmin(params: {
  collabId: string;
  referenceId: string;
  status: CollabStatus;
  adminNotes: string;
  publicResponse: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'collaborations', params.collabId), {
    status: params.status,
    adminNotes: params.adminNotes,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'collabStatuses', params.referenceId), {
    status: params.status,
    publicResponse: params.publicResponse,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `collaborations/${params.collabId}`);
  }
}

export async function deleteCollaborationAdmin(collabId: string, referenceId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'collaborations', collabId));
  batch.delete(doc(db, 'collabStatuses', referenceId));
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `collaborations/${collabId}`);
  }
}

export async function saveProjectAdmin(
  project: Omit<ProjectItem, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const docId = project.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const ref = doc(db, 'projects', docId);
  try {
    if (isNew) {
      await setDoc(ref, {
        slug: project.slug,
        title: project.title,
        summary: project.summary,
        category: project.category,
        version: project.version,
        techStack: project.techStack,
        repoUrl: project.repoUrl,
        demoUrl: project.demoUrl,
        cloneCommand: project.cloneCommand,
        imageUrl: project.imageUrl,
        featured: project.featured,
        visible: project.visible,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        slug: project.slug,
        title: project.title,
        summary: project.summary,
        category: project.category,
        version: project.version,
        techStack: project.techStack,
        repoUrl: project.repoUrl,
        demoUrl: project.demoUrl,
        cloneCommand: project.cloneCommand,
        imageUrl: project.imageUrl,
        featured: project.featured,
        visible: project.visible,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `projects/${docId}`);
  }
}

export async function deleteProjectAdmin(projectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
  }
}

export async function saveApiPresetAdmin(
  preset: Omit<ApiPreset, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const docId = preset.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const ref = doc(db, 'apiPresets', docId);
  try {
    if (isNew) {
      await setDoc(ref, {
        name: preset.name,
        category: preset.category,
        method: preset.method,
        url: preset.url,
        headersJson: preset.headersJson,
        bodyJson: preset.bodyJson,
        description: preset.description,
        enabled: preset.enabled,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: preset.name,
        category: preset.category,
        method: preset.method,
        url: preset.url,
        headersJson: preset.headersJson,
        bodyJson: preset.bodyJson,
        description: preset.description,
        enabled: preset.enabled,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `apiPresets/${docId}`);
  }
}

export async function deleteApiPresetAdmin(presetId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'apiPresets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `apiPresets/${presetId}`);
  }
}

export async function saveSiteSettingsAdmin(settings: Omit<SiteSettings, 'updatedAt'>): Promise<void> {
  try {
    await setDoc(doc(db, 'siteSettings', 'global'), {
      announcementText: settings.announcementText,
      announcementActive: settings.announcementActive,
      maintenanceMode: settings.maintenanceMode,
      proxyRateLimitPerMin: settings.proxyRateLimitPerMin,
      smtpRateLimitPerMin: settings.smtpRateLimitPerMin,
      enabledDevTools: settings.enabledDevTools,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'siteSettings/global');
  }
}

export async function seedDefaultCatalogIfEmpty(): Promise<{ seededProjects: number; seededPresets: number }> {
  let seededProjects = 0;
  let seededPresets = 0;

  try {
    const existingProjects = await getDocs(collection(db, 'projects'));
    if (existingProjects.empty) {
      const batch = writeBatch(db);
      for (const proj of FLAGSHIP_PROJECTS) {
        batch.set(doc(db, 'projects', proj.id), {
          slug: proj.slug,
          title: proj.title,
          summary: proj.summary,
          category: proj.category,
          version: proj.version,
          techStack: proj.techStack,
          repoUrl: proj.repoUrl,
          demoUrl: proj.demoUrl,
          cloneCommand: proj.cloneCommand,
          imageUrl: proj.imageUrl,
          featured: proj.featured,
          visible: proj.visible,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seededProjects++;
      }
      await batch.commit();
    }

    const existingPresets = await getDocs(collection(db, 'apiPresets'));
    if (existingPresets.empty) {
      const batch = writeBatch(db);
      for (const preset of DEFAULT_API_PRESETS) {
        batch.set(doc(db, 'apiPresets', preset.id), {
          name: preset.name,
          category: preset.category,
          method: preset.method,
          url: preset.url,
          headersJson: preset.headersJson,
          bodyJson: preset.bodyJson,
          description: preset.description,
          enabled: preset.enabled,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seededPresets++;
      }
      await batch.commit();
    }

    const settingsSnap = await getDoc(doc(db, 'siteSettings', 'global'));
    if (!settingsSnap.exists()) {
      await setDoc(doc(db, 'siteSettings', 'global'), {
        ...DEFAULT_SITE_SETTINGS,
        updatedAt: serverTimestamp(),
      });
    }

    return { seededProjects, seededPresets };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'projects/seed');
  }
}

export async function checkIsAdmin(uid: string, email: string | null): Promise<boolean> {
  if (email === 'atomzentwo@gmail.com') return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}
