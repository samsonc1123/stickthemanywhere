import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { DevBypassBar } from '../components/admin/DevBypassBar';
import { useConvexAuth, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';
type AdminStatus = 'loading' | 'denied' | 'granted';

export default function AdminPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const bootstrapAdmin = useMutation(api.roles.bootstrapAdmin);

  const [clickCount, setClickCount] = useState(0);
  const [email, setEmail] = useState("Jhonnycomelately82@gmail.com");
  const [linkSent, setLinkSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const handleSendMagicLink = async () => {
    if (!email) return;
    setSending(true);
    setAuthError(null);
    setLinkSent(false);
    try {
      const formData = new FormData();
      formData.set("email", email);
      await signIn("resend", formData);
      setLinkSent(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setLinkSent(false);
      setAuthError(null);
      setBootstrapResult(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleBootstrap = async () => {
    if (!isAuthenticated) return;
    setClickCount(prev => prev + 1);
    setBootstrapping(true);
    setBootstrapResult(null);
    try {
      const result = await bootstrapAdmin({});
      setBootstrapResult(result.status);
    } catch (err) {
      setBootstrapResult("ERROR: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <>
      <AdminDashboard />
      <div className="fixed top-24 right-4 z-[20000] flex flex-col items-end gap-2 p-4 bg-black/90 border border-cyan-500/30 rounded shadow-2xl w-72">
        <div className="w-full space-y-3">
          {authLoading ? (
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider animate-pulse">Checking auth...</div>
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
              {authError && (
                <div className="text-[10px] text-red-400 font-mono break-all">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-cyan-400 font-mono space-y-1">
              <div className="text-green-500 font-bold uppercase mb-1">Logged In</div>
              <div className="truncate">Email: {email}</div>
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
            className={`w-full py-2 rounded-full font-bold text-xs shadow-2xl transition-all ${isAuthenticated ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-500 cursor-not-allowed'} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {bootstrapping ? "Bootstrapping..." : "Bootstrap Admin Role"}
          </button>
          {bootstrapResult && (
            <div className={`text-[10px] font-mono text-center px-1 py-1 rounded border ${bootstrapResult.startsWith("ERROR") ? 'text-red-400 border-red-800 bg-red-900/20' : 'text-green-400 border-green-800 bg-green-900/20'}`}>
              {bootstrapResult === "upgraded" && "✓ Admin role granted"}
              {bootstrapResult === "already_admin" && "✓ Already admin"}
              {bootstrapResult === "user_not_found" && "⚠ User not in DB yet"}
              {bootstrapResult.startsWith("ERROR") && bootstrapResult}
            </div>
          )}
        </div>
      </div>
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
        const extra = new Array(newColumns - drops.length).fill(1);
        drops.push(...extra);
      }
    };
    window.addEventListener('resize', handleResize);
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      let textColor = '#00ff41';
      let glow = false;
      let opacity = 0.8;
      if (status === 'error') {
        textColor = '#ff3131';
      } else if (status === 'ok') {
        glow = true;
      }
      canvas.style.opacity = opacity.toString();
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        if (glow && Math.random() > 0.98) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ffffff';
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          ctx.fillStyle = '#00ff41';
          ctx.shadowBlur = 0;
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        } else {
          ctx.fillStyle = textColor;
          ctx.shadowBlur = 0;
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        }
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
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
  const [lastReservedCode, setLastReservedCode] = useState<string>('--');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 200);
    if (target === 'BACK') {
      window.history.back();
    } else {
      setLocation(target);
    }
  };

  const systemHealth = 'ok';

  useEffect(() => {
    // Supabase health checks removed
  }, []);

  async function handleSyncStorage() {
    // Storage sync logic removed
  }

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
      <MatrixBackground status={systemHealth} />
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center" style={{ transform: 'rotate(45deg)' }}>
              <div className="w-full h-full bg-black border-2 border-cyan-500/50 flex items-center justify-center shadow-2xl">
                <div style={{ transform: 'rotate(-45deg)' }} className="text-center p-1">
                  <div className="text-[9px] md:text-[10px] font-bold text-yellow-400 mb-1 leading-none uppercase tracking-tighter">Catalog</div>
                  <button onClick={handleSyncStorage} disabled={syncStatus === 'syncing'} className="px-2 py-0.5 rounded text-[8px] md:text-[9px] font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition-colors uppercase tracking-widest">
                    {syncStatus === 'syncing' ? '...' : 'Sync'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-8 mt-20 mb-12">
          <StatusIndicator label="Supabase" value="OFF" status="neutral" />
          <StatusIndicator label="Storage" value="OFF" status="neutral" />
          <StatusIndicator label="Last Code" value={lastReservedCode} status="neutral" />
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
