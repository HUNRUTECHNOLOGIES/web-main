import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Pause,
  Play,
  QrCode,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { notify } from '../../lib/toast.ts';

interface QrScannerToolProps {
  onLoadApiEndpoint: (url: string) => void;
  onLoadApiConfigJson: (config: {
    url: string;
    method?: string;
    headersJson?: string;
    bodyJson?: string;
  }) => void;
  onOpenJsonFormatter: (jsonText: string) => void;
  onOpenJwtDecoder: (token: string) => void;
}

interface ScannedEntry {
  id: string;
  raw: string;
  timestamp: string;
  source: 'Camera' | 'Image File';
}

type DecodedKind =
  | { type: 'url'; url: string }
  | { type: 'json'; formatted: string; hasApiFields: boolean; parsed: Record<string, unknown> }
  | { type: 'jwt'; token: string }
  | { type: 'wifi'; fields: Array<{ label: string; value: string }> }
  | { type: 'env'; entries: Array<{ key: string; value: string }> }
  | { type: 'text'; value: string };

function classifyDecodedPayload(raw: string): DecodedKind {
  const trimmed = raw.trim();

  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return { type: 'url', url: trimmed };
  }

  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { type: 'jwt', token: trimmed };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const formatted = JSON.stringify(parsed, null, 2);
      const isObj = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      const hasApiFields =
        isObj &&
        typeof (parsed as Record<string, unknown>).url === 'string' &&
        /^https?:\/\//i.test(String((parsed as Record<string, unknown>).url));
      return {
        type: 'json',
        formatted,
        hasApiFields,
        parsed: isObj ? (parsed as Record<string, unknown>) : {},
      };
    } catch {
      // Not valid JSON, continue checking other formats
    }
  }

  if (trimmed.startsWith('WIFI:')) {
    const body = trimmed.slice(5);
    const fields: Array<{ label: string; value: string }> = [];
    const pairs = body.split(';').filter(Boolean);
    for (const pair of pairs) {
      const idx = pair.indexOf(':');
      if (idx > 0) {
        const key = pair.slice(0, idx);
        const val = pair.slice(idx + 1);
        const label =
          key === 'S'
            ? 'SSID'
            : key === 'T'
            ? 'Security'
            : key === 'P'
            ? 'Passphrase'
            : key === 'H'
            ? 'Hidden'
            : key;
        fields.push({ label, value: val });
      }
    }
    if (fields.length > 0) return { type: 'wifi', fields };
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length >= 2 && lines.every((l) => /^[A-Z0-9_]+\s*=/.test(l))) {
    const entries = lines.map((l) => {
      const eqIdx = l.indexOf('=');
      return { key: l.slice(0, eqIdx).trim(), value: l.slice(eqIdx + 1).trim() };
    });
    return { type: 'env', entries };
  }

  return { type: 'text', value: trimmed };
}

export function QrScannerTool({
  onLoadApiEndpoint,
  onLoadApiConfigJson,
  onOpenJsonFormatter,
  onOpenJwtDecoder,
}: QrScannerToolProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [resolution, setResolution] = useState<string>('');
  const [decodedRaw, setDecodedRaw] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<ScannedEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = cameraPaused;
  }, [cameraPaused]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraPaused(false);
    setResolution('');
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const recordDecodedResult = useCallback((rawText: string, source: 'Camera' | 'Image File') => {
    const clean = rawText.trim();
    if (!clean) return;
    setDecodedRaw(clean);
    setScanHistory((prev) => {
      const next: ScannedEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        raw: clean,
        timestamp: new Date().toTimeString().slice(0, 8),
        source,
      };
      const deduped = prev.filter((item) => item.raw !== clean);
      return [next, ...deduped].slice(0, 5);
    });
    notify.success('QR Payload Decoded', {
      description: clean.length > 72 ? `${clean.slice(0, 72)}...` : clean,
    });
  }, []);

  const startCamera = async (deviceIdOverride?: string) => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera API is unavailable in this browser context. Use Upload QR Image below instead.'
      );
      return;
    }

    stopCamera();

    try {
      const targetId = deviceIdOverride ?? selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: targetId
          ? { deviceId: { exact: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (videoRef.current.videoWidth > 0) {
          setResolution(`${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
        }
      }

      setCameraActive(true);
      setCameraPaused(false);

      // Enumerate available video devices once permission has been granted
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        const activeTrack = stream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings()?.deviceId;
        if (activeDeviceId) {
          setSelectedDeviceId(activeDeviceId);
        }
      } catch {
        // Device enumeration optional
      }

      let lastFrameCheck = 0;
      const tick = (now: number) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!streamRef.current) return;

        if (!pausedRef.current && video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA) {
          if (now - lastFrameCheck >= 80) {
            lastFrameCheck = now;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                setResolution(`${w}x${h}`);
              }
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
                if (code && code.data) {
                  const isDuplicateBurst =
                    lastScanRef.current.text === code.data &&
                    Date.now() - lastScanRef.current.at < 2500;
                  if (!isDuplicateBurst) {
                    lastScanRef.current = { text: code.data, at: Date.now() };
                    recordDecodedResult(code.data, 'Camera');
                  }
                }
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      const message = err instanceof Error ? err.message : 'Camera access failed.';
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
        setCameraError(
          'Camera permission was denied. Allow camera access in browser settings or upload a QR image.'
        );
      } else {
        setCameraError(
          `Could not initialize camera (${message}). You can still decode QR codes via Upload QR Image.`
        );
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setCameraError('Unable to initialize canvas decoder context.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          recordDecodedResult(code.data, 'Image File');
        } else {
          setCameraError('No readable QR code was detected in the selected image.');
          notify.error('No QR Code Detected', {
            description: 'Try a sharper or higher-contrast QR image.',
          });
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setCameraError('Selected file could not be loaded as an image.');
    };
    img.src = objectUrl;
  };

  const decodedKind = useMemo(
    () => (decodedRaw ? classifyDecodedPayload(decodedRaw) : null),
    [decodedRaw]
  );

  const handleCopyDecoded = async () => {
    if (!decodedRaw) return;
    try {
      await navigator.clipboard.writeText(decodedRaw);
      setCopied(true);
      notify.success('Decoded Payload Copied');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  return (
    <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Camera Viewfinder & Controls */}
      <div className="lg:col-span-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={() => startCamera()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] rounded-md transition-all duration-150 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Start Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-md transition-colors cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5 text-red-400" />
                  <span>Stop Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPaused((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#C4CEDB] bg-[#0A0D12] hover:bg-[#141B26] border border-white/15 rounded-md transition-colors cursor-pointer"
                >
                  {cameraPaused ? <Play className="w-3.5 h-3.5 text-[#00FF66]" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{cameraPaused ? 'Resume' : 'Pause'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono text-[#00E5FF] bg-[#0A0D12] hover:bg-[#141B26] border border-[#00E5FF]/30 rounded-md transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload QR Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {devices.length > 1 && cameraActive && (
            <select
              aria-label="Select camera device"
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                void startCamera(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-[#E6EDF3] max-w-[200px]"
            >
              {devices.map((d, idx) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Camera Viewport */}
        <div className="relative aspect-video w-full rounded-md border border-white/12 bg-[#0A0D12] overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {!cameraActive ? (
            <div className="p-6 text-center space-y-2.5 max-w-sm">
              <QrCode className="w-10 h-10 text-[#00FF66] mx-auto" />
              <p className="text-sm font-medium text-white">Camera Scanner Ready</p>
              <p className="text-xs text-[#8B98A9] leading-relaxed">
                Click Start Camera to scan API endpoint URLs, JSON configurations, JWT tokens, or
                environment strings directly in your browser.
              </p>
            </div>
          ) : (
            /* Corner Reticle Overlay */
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52">
                <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#00FF66]" />
                <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#00FF66]" />
                <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#00FF66]" />
                <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#00FF66]" />
              </div>
              <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] font-mono text-[#E6EDF3] bg-[#0A0D12]/80 px-2.5 py-1 rounded border border-white/10 tabular-nums">
                <span>{cameraPaused ? 'Paused' : 'Scanning frame stream'}</span>
                {resolution && <span>{resolution}</span>}
              </div>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="p-3 rounded border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300">
            {cameraError}
          </div>
        )}
      </div>

      {/* Right: Decoded Output & Workbench Actions */}
      <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
        <div className="rounded-md border border-white/10 bg-[#0A0D12] overflow-hidden flex-1 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-white/8 bg-[#121822]">
            <span className="font-mono text-xs text-[#C4CEDB]">
              Decoded Configuration / Endpoint
            </span>
            {decodedKind && (
              <span className="font-mono text-[11px] text-[#00E5FF]">
                Type: {decodedKind.type.toUpperCase()}
              </span>
            )}
          </div>

          <div className="p-4 flex-1 space-y-4">
            {!decodedKind ? (
              <p className="text-xs font-mono text-[#64748B] leading-relaxed">
                No QR payload decoded yet. Point your camera at a QR code or upload a QR image
                file to inspect its contents and dispatch endpoints straight into the Workbench.
              </p>
            ) : (
              <>
                {decodedKind.type === 'wifi' && (
                  <div className="space-y-1.5 p-3 rounded border border-white/10 bg-[#0F141C] font-mono text-xs">
                    {decodedKind.fields.map((f) => (
                      <div key={f.label} className="flex items-center justify-between gap-4">
                        <span className="text-[#8B98A9]">{f.label}</span>
                        <span className="text-[#00FF66] break-all">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {decodedKind.type === 'env' && (
                  <div className="space-y-1.5 p-3 rounded border border-white/10 bg-[#0F141C] font-mono text-xs">
                    {decodedKind.entries.map((entry) => (
                      <div key={entry.key} className="flex items-center justify-between gap-4">
                        <span className="text-[#00E5FF]">{entry.key}</span>
                        <span className="text-[#E6EDF3] break-all">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <pre className="p-3.5 rounded border border-white/10 bg-[#0F141C] font-mono text-xs text-[#00FF66] max-h-48 overflow-auto whitespace-pre-wrap break-all">
                  {decodedKind.type === 'json' ? decodedKind.formatted : decodedRaw}
                </pre>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyDecoded}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Payload'}</span>
                  </button>

                  {decodedKind.type === 'url' && (
                    <button
                      type="button"
                      onClick={() => onLoadApiEndpoint(decodedKind.url)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] rounded-md font-semibold transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Load in API Tester</span>
                    </button>
                  )}

                  {decodedKind.type === 'json' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenJsonFormatter(decodedKind.formatted)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono text-white bg-[#141B26] hover:bg-[#1C2636] border border-white/15 rounded-md transition-colors cursor-pointer"
                      >
                        <span>Open in JSON Formatter</span>
                      </button>
                      {decodedKind.hasApiFields && (
                        <button
                          type="button"
                          onClick={() => {
                            const obj = decodedKind.parsed;
                            onLoadApiConfigJson({
                              url: String(obj.url || ''),
                              method: typeof obj.method === 'string' ? obj.method : undefined,
                              headersJson: obj.headers
                                ? JSON.stringify(obj.headers, null, 2)
                                : undefined,
                              bodyJson: obj.body
                                ? typeof obj.body === 'string'
                                  ? obj.body
                                  : JSON.stringify(obj.body, null, 2)
                                : undefined,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] rounded-md font-semibold transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Load Config in API Tester</span>
                        </button>
                      )}
                    </>
                  )}

                  {decodedKind.type === 'jwt' && (
                    <button
                      type="button"
                      onClick={() => onOpenJwtDecoder(decodedKind.token)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] rounded-md font-semibold transition-colors cursor-pointer"
                    >
                      <span>Open in JWT Decoder</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Session Scans */}
        {scanHistory.length > 0 && (
          <div className="rounded-md border border-white/10 bg-[#0A0D12] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8B98A9]">
              <span>Recent Scans ({scanHistory.length})</span>
              <button
                type="button"
                onClick={() => setScanHistory([])}
                className="inline-flex items-center gap-1 text-[#8B98A9] hover:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
            <div className="space-y-1">
              {scanHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDecodedRaw(item.raw)}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded bg-[#0F141C] hover:bg-[#141B26] border border-white/8 text-left text-[11px] font-mono transition-colors cursor-pointer"
                >
                  <span className="text-[#E6EDF3] truncate">{item.raw}</span>
                  <span className="text-[#64748B] shrink-0 tabular-nums">
                    {item.source} · {item.timestamp}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
