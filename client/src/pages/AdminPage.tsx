import { useState, useEffect, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { DevBypassBar } from '../components/admin/DevBypassBar';
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RefreshCw } from 'lucide-react';

const SESSION_KEY = "admin_session_id";

function useAdminSession() {
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem(SESSION_KEY) || "");
  const session = useQuery(api.magicAuth.getSession, { sessionId });

  const saveSession = (id: string) => {
    localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId("");
  };

  const isAuthenticated = session !== undefined && session !== null;
  const isLoading = session === undefined && sessionId !== "";

  return { sessionId, session, isAuthenticated, isLoading, saveSession, clearSession };
}

export default function AdminPage() {
  const { sessionId, session, isAuthenticated, isLoading, saveSession, clearSession } = useAdminSession();
  const sendMagicLink = useAction(api.magicAuth.sendMagicLink);
  const verifyToken = useAction(api.magicAuth.verifyToken);
  const signOutMutation = useMutation(api.magicAuth.signOut);
  const bootstrapAdmin = useMutation(api.roles.bootstrapAdmin);
  const [panelOpen, setPanelOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const search = useSearch();
  const [email, setEmail] = useState("Jhonnycomelately82@gmail.com");
  const [linkSent, setLinkSent] = useState(false);
  const [magicUrl, setMagicUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Auto-verify token from URL on load — also auto-opens the panel so user sees the result
  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (!token || isAuthenticated) return;

    if (!autoOpened) {
      setPanelOpen(true);
      setAutoOpened(true);
    }

    setVerifying(true);
    setAuthError(null);
    verifyToken({ token })
      .then((result) => {
        if (result.success) {
          saveSession(result.sessionId);
          window.history.replaceState({}, "", "/admin");
          setPanelOpen(false);
        } else {
          setAuthError(result.error ?? "Verification failed");
        }
      })
      .catch((err) => setAuthError(err instanceof Error ? err.message : String(err)))
      .finally(() => setVerifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSendMagicLink = async () => {
    if (!email) return;
    setSending(true);
    setAuthError(null);
    setLinkSent(false);
    setMagicUrl(null);
    try {
      const siteUrl = window.location.origin + "/admin";
      const result = await sendMagicLink({ email, siteUrl });
      if (result.sent) {
        setLinkSent(true);
      } else {
        setMagicUrl(result.magicUrl);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (sessionId) await signOutMutation({ sessionId });
    } catch (_) {}
    clearSession();
    setLinkSent(false);
    setAuthError(null);
    setBootstrapResult(null);
  };

  const handleBootstrap = async () => {
    if (!isAuthenticated || !sessionId) return;
    setClickCount(prev => prev + 1);
    setBootstrapping(true);
    setBootstrapResult(null);
    try {
      const result = await bootstrapAdmin({ sessionId });
      setBootstrapResult(result.status);
    } catch (err) {
      setBootstrapResult("ERROR: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBootstrapping(false);
    }
  };

  const showFullPanel = panelOpen;

  return (
    <>
      <AdminDashboard />

      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className={`fixed bottom-14 right-4 z-[20000] flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-widest transition-all ${
            isAuthenticated
              ? "bg-black/90 border-2 border-green-400 text-green-400"
              : "bg-black/80 border border-gray-600/40 text-gray-500"
          }`}
          style={isAuthenticated ? { boxShadow: "0 0 8px #4ade80, 0 0 16px #4ade8055" } : {}}
        >
          <span className={`w-2 h-2 rounded-full ${isAuthenticated ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          Admin
        </button>
      )}

      {showFullPanel && (
        <div className="fixed top-24 right-4 z-[20000] p-4 bg-black/90 border border-cyan-500/30 rounded shadow-2xl w-72">
          <div className="w-full space-y-3">
            {isAuthenticated && (
              <button
                onClick={() => setPanelOpen(false)}
                className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 text-xs leading-none"
              >✕</button>
            )}
            {verifying ? (
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider animate-pulse">Verifying link...</div>
            ) : isLoading ? (
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider animate-pulse">Checking session...</div>
            ) : !isAuthenticated ? (
              <div className="space-y-2">
                <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Magic Link Login</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email"
                  className="w-full bg-black border border-cyan-900/50 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSendMagicLink}
                  disabled={sending || !email}
                  className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 py-1.5 rounded text-[10px] font-bold uppercase tracking-tighter transition-colors disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Magic Link"}
                </button>
                {linkSent && (
                  <div className="text-[10px] text-green-400 font-bold text-center animate-pulse">
                    Check your email for the sign-in link
                  </div>
                )}
                {magicUrl && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Email failed — tap link:</div>
                    <a
                      href={magicUrl}
                      className="block w-full text-center bg-green-900/40 border border-green-500/50 text-green-400 py-2 rounded text-[10px] font-bold uppercase tracking-tighter hover:bg-green-900/60 transition-colors"
                    >
                      OPEN SIGN-IN LINK
                    </a>
                  </div>
                )}
                {authError && (
                  <div className="text-[10px] text-red-400 font-mono break-all">{authError}</div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-cyan-400 font-mono space-y-1">
                <div className="text-green-500 font-bold uppercase mb-1">Logged In</div>
                <div className="truncate">Email: {session?.email}</div>
                <div>Clicks: {clickCount}</div>
                <button
                  onClick={handleSignOut}
                  className="mt-1 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 py-1 rounded text-[10px] font-bold uppercase tracking-tighter transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleBootstrap}
              disabled={!isAuthenticated || bootstrapping}
              className={`w-full py-2 rounded-full font-bold text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
              style={isAuthenticated ? {
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                color: '#fff',
                boxShadow: '0 0 12px rgba(34,197,94,0.7), 0 0 28px rgba(34,197,94,0.4)',
                border: '1px solid #4ade80',
              } : {
                background: '#1f2937',
                color: '#6b7280',
                border: '1px solid #374151',
              }}
            >
              {bootstrapping ? "Bootstrapping..." : "Bootstrap Admiral"}
            </button>
            {bootstrapResult && (
              <div className={`text-[10px] font-mono text-center px-1 py-1 rounded border ${bootstrapResult.startsWith("ERROR") ? 'text-red-400 border-red-800 bg-red-900/20' : 'text-green-400 border-green-800 bg-green-900/20'}`}>
                {bootstrapResult === "upgraded" && "✓ Admin role granted"}
                {bootstrapResult === "created_admin" && "✓ Admin created"}
                {bootstrapResult === "already_admin" && "✓ Already admin"}
                {bootstrapResult.startsWith("ERROR") && bootstrapResult}
              </div>
            )}
          </div>
        </div>
      )}

      <DevBypassBar />
    </>
  );
}

function MatrixBackground({ status }: { status: 'ok' | 'error' | 'unknown' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"\'#&_(),.;:?!\\|{}<>[]';
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops = new Array(columns).fill(1);
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const newColumns = Math.floor(width / fontSize);
      if (newColumns > drops.length) {
        drops.push(...new Array(newColumns - drops.length).fill(1));
      }
    };
    window.addEventListener('resize', handleResize);
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const textColor = status === 'error' ? '#ff3131' : '#00ff41';
      const glow = status === 'ok';
      canvas.style.opacity = '0.8';
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        if (glow && Math.random() > 0.98) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ffffff';
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#00ff41';
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        } else {
          ctx.fillStyle = textColor;
          ctx.shadowBlur = 0;
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        }
        if (drops[i] * fontSize > height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.35;
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [status]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-[0.12]"
      style={{ zIndex: 0 }}
    />
  );
}

function AdminDashboard() {
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [, setLocation] = useLocation();

  const convexPing = useQuery(api.authUtils.getIdentity);
  const convexConnected = convexPing !== undefined;
  const convexValue = convexConnected ? 'ON' : 'OFF';
  const convexStatus = convexConnected ? 'success' : 'neutral';

  const dashStats = useQuery(api.stickers.getDashboardStats);
  const storageOn = dashStats?.storageActive ?? false;
  const lastCode = dashStats?.lastCode ?? '--';

  const ensureTaxonomySeeded = useMutation(api.seedTaxonomy.ensureTaxonomySeeded);

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 200);
    if (target === 'BACK') {
      window.history.back();
    } else {
      setLocation(target);
    }
  };

  const handleSystemSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncDone(false);
    try {
      await ensureTaxonomySeeded({});
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 2500);
    } catch (_) {
      setSyncDone(false);
    } finally {
      setSyncing(false);
    }
  };

  const tiles = [
    { title: 'Uploader Pipeline', subtitle: 'Uploader', href: '/admin/uploader' },
    { title: 'Prefix Rules', subtitle: 'Mapper', href: '/admin/prefix-mapper' },
    { title: 'Sorter', subtitle: 'Reorder', href: '/admin/reorder' },
    { title: 'Diagnostics', subtitle: 'System', href: '/admin/diagnostics' },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 flex flex-col items-center relative overflow-hidden">
      <div
        onTouchStart={() => handleTapZone('/')}
        onClick={() => handleTapZone('/')}
        className={`fixed top-0 left-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/' ? 'bg-white/30' : 'bg-transparent'}`}
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />
      <div
        onTouchStart={() => handleTapZone('/admin/taxonomy')}
        onClick={() => handleTapZone('/admin/taxonomy')}
        className={`fixed top-0 right-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/admin/taxonomy' ? 'bg-white/30' : 'bg-transparent'}`}
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />
      <MatrixBackground status="ok" />
      <div className="relative z-10 flex flex-col items-center w-full pt-8">
        <div className="text-center mb-16 w-full relative">
          <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
          <h1 className="text-3xl md:text-4xl font-orbitron font-bold tracking-[0.15em] uppercase text-gray-400 relative z-10 animate-pulse" style={{ textShadow: '0 0 20px rgba(34,197,94,0.5), 0 0 40px rgba(34,197,94,0.3)' }}>
            Admin Dugout
          </h1>
        </div>
        <div className="relative flex items-center justify-center min-h-[350px] w-full max-w-[400px]">
          <div className="grid grid-cols-2 gap-16 md:gap-20">
            {tiles.map((tile) => (
              <a
                key={tile.title}
                href={tile.href}
                className="group relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center"
                style={{ transform: 'rotate(45deg)' }}
              >
                <div className="w-full h-full bg-gray-800/40 border-2 border-gray-500/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg">
                  <div style={{ transform: 'rotate(-45deg)' }} className="text-center p-2">
                    <div className="text-xs md:text-sm font-bold text-white leading-tight uppercase tracking-wider">{tile.title}</div>
                    <div className="text-[9px] md:text-[10px] text-white/40 mt-1 uppercase tracking-tighter">{tile.subtitle}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Center System Sync diamond */}
          <button
            onClick={handleSystemSync}
            disabled={syncing}
            className="absolute z-20 w-20 h-20 flex items-center justify-center"
            style={{ transform: 'rotate(45deg)' }}
          >
            <div
              className="w-full h-full flex items-center justify-center border-2 transition-all duration-300"
              style={{
                backgroundColor: syncDone ? 'rgba(34,197,94,0.25)' : 'rgba(6,182,212,0.12)',
                borderColor: syncDone ? '#22c55e' : '#06b6d4',
                boxShadow: syncDone
                  ? '0 0 18px rgba(34,197,94,0.6), 0 0 36px rgba(34,197,94,0.3)'
                  : '0 0 10px rgba(6,182,212,0.4)',
              }}
            >
              <div style={{ transform: 'rotate(-45deg)' }} className="flex flex-col items-center gap-0.5">
                <RefreshCw
                  size={14}
                  className={syncing ? 'animate-spin' : ''}
                  style={{ color: syncDone ? '#22c55e' : '#06b6d4' }}
                />
                <span
                  className="text-[7px] font-bold uppercase tracking-wider leading-none"
                  style={{ color: syncDone ? '#22c55e' : '#06b6d4' }}
                >
                  {syncDone ? 'Synced' : 'Sync'}
                </span>
              </div>
            </div>
          </button>
        </div>
        <div className="flex justify-center gap-8 mt-20 mb-12">
          <StatusIndicator label="Convex" value={convexValue} status={convexStatus} />
          <StatusIndicator label="Storage" value={storageOn ? 'ON' : 'OFF'} status={storageOn ? 'success' : 'neutral'} />
          <StatusIndicator label="Last Code" value={lastCode.length > 8 ? lastCode.slice(0, 8) : lastCode} status={lastCode !== '--' ? 'success' : 'neutral'} />
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ label, value, status }: { label: string; value: string; status: 'success' | 'warning' | 'error' | 'neutral' }) {
  const colors = {
    success: 'bg-green-900/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
    warning: 'bg-yellow-900/20 border-yellow-500 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]',
    error: 'bg-red-900/20 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
    neutral: 'bg-gray-800/20 border-gray-500 text-gray-400',
  };
  return (
    <div className="flex flex-col items-center">
      <span className="text-gray-500 uppercase tracking-[0.15em] mb-2 text-[9px] leading-none">{label}</span>
      <div className={`px-4 py-1.5 rounded border-2 text-[10px] font-bold font-mono tracking-widest uppercase transition-all duration-300 ${colors[status]}`}>
        {value}
      </div>
    </div>
  );
}
