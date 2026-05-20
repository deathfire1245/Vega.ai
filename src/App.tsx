/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, ChevronRight, Menu, X, Eye, EyeOff, Plus, Check, 
  ChevronLeft, Upload, Palette, Send, Calendar, Layout, 
  BarChart2, Settings, LogOut, Clock, Globe, Briefcase, 
  Image as LucideImage, Video, FileText, Sparkles, Download, 
  RefreshCcw, GripVertical, AlertCircle, Zap, Lock as LockIcon,
  MoreVertical, Trash2, Archive, ArrowLeft, MoreHorizontal,
  Play, Search, File, PanelTop, Library, TrendingUp, TrendingDown,
  Bell, User, ShieldAlert, CheckCircle2, CreditCard
} from "lucide-react";
import { useState, useEffect, FormEvent, DragEvent, useMemo } from "react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell 
} from 'recharts';
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, limit, updateDoc } from "firebase/firestore";
import { useBrandBrain } from "./hooks/useBrandBrain";
import { generateContentPack } from "./services/groqService";

type AppView = 'landing' | 'auth' | 'onboarding' | 'dashboard' | 'new-campaign';
const tier = 'creator';

interface CampaignContent {
  id: string;
  type: 'tweet' | 'linkedin' | 'reel' | 'meme' | 'email' | 'image';
  platform: string;
  body: string;
  subject?: string;
  scheduledAt?: string;
}

interface Campaign {
  id: string;
  name: string;
  platforms: string[];
  status: 'draft' | 'active' | 'completed' | 'archived';
  progress: number;
  contentCount: number;
  duration: string;
  createdAt: string;
  brief: string;
  content: CampaignContent[];
}

interface Asset {
  id: string;
  type: 'image' | 'video' | 'upload';
  name: string;
  campaign?: string;
  date: string;
  url: string;
  format?: string;
  style?: string;
  size?: string; // e.g. "2MB"
}

interface GalleryItem {
  id: string;
  source: 'VEGA' | 'COMMUNITY';
  style: string;
  prompt: string;
  color: string;
}

const MOCK_GALLERY: GalleryItem[] = [
  { id: 'g1', source: 'VEGA', style: 'BOLD & LOUD', prompt: 'Brutalist poster of a neon mountain range with high contrast typography.', color: 'bg-black/90' },
  { id: 'g2', source: 'COMMUNITY', style: 'DARK & MOODY', prompt: 'Cinematic silhouette of a lone figure in a rainy cyberpunk alley.', color: 'bg-deep-red/90' },
  { id: 'g3', source: 'VEGA', style: 'CLEAN & MINIMAL', prompt: 'Product photography of a glass bottle on a white sand dune.', color: 'bg-ivory' },
  { id: 'g4', source: 'COMMUNITY', style: 'BRIGHT & ENERGETIC', prompt: 'Fast light trails in a futuristic urban tunnel, 8k resolution.', color: 'bg-amber/90' },
  { id: 'g5', source: 'VEGA', style: 'LUXURY', prompt: 'Golden silk fabric flowing in a dark void, soft lighting.', color: 'bg-grey-900' },
  { id: 'g6', source: 'VEGA', style: 'PLAYFUL', prompt: '3D isometric clay world with vibrant rounded shapes.', color: 'bg-burnt/60' },
  { id: 'g7', source: 'COMMUNITY', style: 'BOLD & LOUD', prompt: 'Giant floating letters in a desert of red sand.', color: 'bg-deep-red/80' },
  { id: 'g8', source: 'VEGA', style: 'CLEAN & MINIMAL', prompt: 'Single black sphere on a perfectly smooth grey plane.', color: 'bg-black/20' },
  { id: 'g9', source: 'COMMUNITY', style: 'DARK & MOODY', prompt: 'Abandoned space station interior with red alarm lights.', color: 'bg-black' },
  { id: 'g10', source: 'VEGA', style: 'BRIGHT & ENERGETIC', prompt: 'Explosion of abstract chromatic shapes on a yellow background.', color: 'bg-amber/80' },
];

const MOCK_ASSETS: Asset[] = [
  { id: 'a1', type: 'image', name: 'NEON MOUNTAIN', campaign: 'X-1 PROJECT LAUNCH', date: 'MAY 06 2026', url: 'bg-black/80', style: 'BOLD & LOUD', size: '2.4MB' },
  { id: 'a2', type: 'image', name: 'CYBERPUNK GRID', campaign: 'X-1 PROJECT LAUNCH', date: 'MAY 07 2026', url: 'bg-deep-red/80', style: 'DARK & MOODY', size: '1.8MB' },
  { id: 'a3', type: 'video', name: 'PRODUCT REVEAL', campaign: 'MANIFESTO FILMS', date: 'MAY 01 2026', url: 'bg-black', size: '12.5MB' },
  { id: 'a4', type: 'upload', name: 'BRAND_LOGO_V2', date: 'APR 15 2026', url: 'bg-ivory', format: 'PNG', size: '0.5MB' },
  { id: 'a5', type: 'image', name: 'SUMMER VIBE 01', campaign: 'SUMMER DROP 26', date: 'MAY 08 2026', url: 'bg-amber/80', style: 'VIBRANT', size: '3.1MB' },
  { id: 'a6', type: 'video', name: 'STREET WEAR TEASER', campaign: 'SUMMER DROP 26', date: 'MAY 09 2026', url: 'bg-black', size: '18.2MB' },
  { id: 'a7', type: 'image', name: 'ABSTRACT FLUX', campaign: 'X-1 PROJECT LAUNCH', date: 'MAY 10 2026', url: 'bg-burnt/80', style: 'MODERN', size: '2.9MB' },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'X-1 PROJECT LAUNCH',
    platforms: ['x', 'linkedin'],
    status: 'active',
    progress: 45,
    contentCount: 8,
    duration: '7',
    createdAt: 'MAY 06 2026',
    brief: 'Launch our new decentralized brand asset manager to the tech ecosystem.',
    content: [
      { id: '1', type: 'tweet', platform: 'x', body: 'The future of market speed is here. Meet X-1. ✦', scheduledAt: 'Day 3 - 09:00 AM' },
      { id: '2', type: 'linkedin', platform: 'linkedin', body: 'Today we redefine the brand lifecycle. Introducing the X-1 Project.', scheduledAt: 'Day 3 - 08:00 AM' }
    ]
  },
  {
    id: 'c2',
    name: 'SUMMER DROP 26',
    platforms: ['instagram', 'tiktok'],
    status: 'draft',
    progress: 0,
    contentCount: 12,
    duration: '14',
    createdAt: 'MAY 08 2026',
    brief: 'A high-energy visual campaign for the upcoming summer collection.',
    content: []
  },
  {
    id: 'c3',
    name: 'MANIFESTO FILMS',
    platforms: ['linkedin', 'x'],
    status: 'completed',
    progress: 100,
    contentCount: 4,
    duration: '2',
    createdAt: 'APR 20 2026',
    brief: 'Document our core mission and vision through short cinematic films.',
    content: []
  },
  {
    id: 'c4',
    name: 'OLD BRAND BRAIN #1',
    platforms: ['x'],
    status: 'archived',
    progress: 100,
    contentCount: 5,
    duration: '5',
    createdAt: 'MAR 15 2026',
    brief: 'Initial experiments with the Vega engine.',
    content: []
  }
];

export default function App() {
  const { user, loading } = useAuth();
  const { brandBrain, isLoading: isBrandLoading, refresh: refreshBrand } = useBrandBrain();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<AppView>('landing');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [gallery, setGallery] = useState<GalleryItem[]>(MOCK_GALLERY);
  const [remixesToday, setRemixesToday] = useState(0);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [dashboardTab, setDashboardTab] = useState('Dashboard');

  useEffect(() => {
    if (!loading && !isBrandLoading) {
      if (user) {
        if (!brandBrain && view !== 'onboarding') {
          setView('onboarding');
        } else if (brandBrain && (view === 'landing' || view === 'auth' || view === 'onboarding')) {
          setView('dashboard');
        }
      } else {
        if (view !== 'landing' && view !== 'auth') {
          setView('landing');
        }
      }
    }
  }, [user, loading, isBrandLoading, brandBrain, view]);

  const handleAuthSuccess = (mode: 'signup' | 'login') => {
    if (mode === 'signup' || !brandBrain) {
      setView('onboarding');
    } else {
      setView('dashboard');
    }
  };

  const addCampaign = (campaign: Campaign) => {
    setCampaigns(prev => [campaign, ...prev]);
    setDashboardTab('Workstation');
    setView('dashboard');
  };

  if (view === 'auth') {
    return (
      <SignUpView 
        initialMode={authMode}
        onBack={() => setView('landing')} 
        onSuccess={handleAuthSuccess}
      />
    );
  }

  if (view === 'onboarding') {
    return (
      <OnboardingFlow 
        onComplete={async (data) => {
          setOnboardingData(data);
          await refreshBrand();
          setView('dashboard');
        }} 
        onBack={async () => {
          await signOut(auth);
          setView('landing');
        }} 
      />
    );
  }

  if (view === 'new-campaign') {
    return (
      <NewCampaignFlow 
        gallery={gallery}
        onCancel={() => setView('dashboard')}
        onComplete={addCampaign}
        setView={setView}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <DashboardPlaceholder 
        campaigns={campaigns}
        setCampaigns={setCampaigns}
        assets={assets}
        setAssets={setAssets}
        gallery={gallery}
        setGallery={setGallery}
        remixesToday={remixesToday}
        setRemixesToday={setRemixesToday}
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        onNewCampaign={() => setView('new-campaign')}
        onLogout={async () => {
          await signOut(auth);
          setView('landing');
        }}
        activeTab={dashboardTab}
        setActiveTab={setDashboardTab}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ivory selection:bg-amber selection:text-black overflow-x-hidden transition-colors duration-500">
      {/* 1. NAVBAR */}
      <nav className="fixed top-0 left-0 w-full bg-ivory z-50 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#" className="h-8 md:h-10 flex items-center">
            <img 
              src="/logo.png" 
              alt="VEGA AI" 
              className="h-[250px] w-[200px] pl-0 -ml-[35px] object-contain"
              referrerPolicy="no-referrer"
            />
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            {["Features", "How It Works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-semibold uppercase tracking-widest hover:text-burnt transition-colors"
              >
                {item}
              </a>
            ))}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setAuthMode('login'); setView('auth'); }}
                className="text-sm font-bold uppercase tracking-widest hover:text-burnt transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => { setAuthMode('signup'); setView('auth'); }}
                className="bg-deep-red text-ivory px-6 py-3 font-bold uppercase text-xs tracking-widest hover:bg-black transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-black"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Overlay */}
        {isMenuOpen && (
          <div className="md:hidden bg-ivory border-b-2 border-black p-6 absolute top-20 left-0 w-full flex flex-col gap-6">
            {["Features", "How It Works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-xl font-display uppercase tracking-widest"
                onClick={() => setIsMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <button 
              onClick={() => { setView('auth'); setAuthMode('signup'); setIsMenuOpen(false); }}
              className="bg-deep-red text-ivory px-6 py-4 font-bold uppercase text-sm tracking-widest w-full"
            >
              Get Started
            </button>
          </div>
        )}
      </nav>

      <main className="pt-20">
        {/* 2. HERO */}
        <section className="relative min-h-[90vh] flex flex-col justify-center px-6 py-20 max-w-[1440px] mx-auto">
          {/* Geometric Accent Block */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-amber -z-10 opacity-80" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <h1 className="text-[12vw] sm:text-[10vw] lg:text-[7vw] xl:text-[8vw] leading-[0.85] font-display tracking-tighter mb-8">
                <span className="block stagger-fade-in">ONE SENTENCE.</span>
                <span className="block stagger-fade-in delay-100 text-deep-red">ENTIRE</span>
                <span className="block stagger-fade-in delay-200">WORKSPACE.</span>
              </h1>
              
              <div className="max-w-xl stagger-fade-in delay-300">
                <p className="text-xl md:text-2xl font-medium mb-10 leading-snug">
                  Describe your product. Vega AI builds your tweets, reels, emails, memes and posters — then schedules, tracks and gets smarter.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => { setAuthMode('signup'); setView('auth'); }}
                    className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-sm tracking-widest hover:bg-black transition-colors shadow-hard"
                  >
                    Get Started
                  </button>
                  <button className="border-2 border-black text-black px-10 py-5 font-bold uppercase text-sm tracking-widest hover:bg-black hover:text-ivory transition-all">
                    See How It Works
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center lg:justify-end stagger-fade-in delay-300 relative">
              <div className="relative border-4 border-black shadow-hard-lg overflow-hidden z-10">
                <img 
                  src="/image.png" 
                  alt="Vega Works" 
                  className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* TILE 1: Top-Left */}
              <div 
                className="absolute -top-10 -left-6 md:-left-12 z-20 bg-amber border-2 border-black p-4 shadow-[3px_3px_0px_#0A0A0A] -rotate-3 float"
                style={{ animationDelay: '0.2s' }}
              >
                <p className="text-[10px] md:text-sm font-bold leading-tight">
                  🔥 just generated my entire<br/>week of content in 2 min
                </p>
                <p className="text-[8px] md:text-[10px] font-bold uppercase mt-2 opacity-60">— @sara.builds</p>
              </div>

              {/* TILE 2: Top-Right */}
              <div 
                className="absolute -top-16 -right-4 md:-right-8 z-20 bg-ivory border-2 border-black p-4 shadow-[3px_3px_0px_#0A0A0A] rotate-2 float"
                style={{ animationDelay: '1.2s' }}
              >
                <div className="flex flex-col items-center">
                  <span className="text-4xl md:text-5xl font-display leading-none">10x</span>
                  <p className="text-[8px] md:text-[10px] font-bold uppercase text-center mt-1">faster than doing<br/>it manually</p>
                </div>
              </div>

              {/* TILE 3: Middle-Left */}
              <div 
                className="absolute top-1/2 -left-10 md:-left-20 -translate-y-1/2 z-20 bg-black text-ivory border-2 border-black p-4 shadow-[3px_3px_0px_#0A0A0A] -rotate-2 float hidden md:block"
                style={{ animationDelay: '0.8s' }}
              >
                <p className="text-sm font-bold leading-tight">
                  Brand Brain actually<br/>sounds like ME now 👀
                </p>
                <p className="text-[10px] font-bold uppercase mt-2 opacity-60 text-ivory/60">— @foundermode</p>
              </div>

              {/* TILE 4: Bottom-Right */}
              <div 
                className="absolute -bottom-10 -right-6 md:-right-12 z-20 bg-deep-red text-ivory border-2 border-black p-4 shadow-[3px_3px_0px_#0A0A0A] rotate-3 float"
                style={{ animationDelay: '1.5s' }}
              >
                <p className="text-[10px] md:text-sm font-bold leading-tight">
                  THIS is the ad it<br/>built for my store.
                </p>
                <p className="text-[8px] md:text-[10px] font-bold uppercase mt-2 opacity-60 text-ivory/60">— @ecom.ravi</p>
              </div>

              {/* TILE 5: Bottom-Left */}
              <div 
                className="absolute -bottom-16 left-0 md:-left-8 z-20 bg-ivory border-2 border-black p-4 shadow-[3px_3px_0px_#0A0A0A] -rotate-1 float hidden md:block"
                style={{ animationDelay: '0.5s' }}
              >
                <p className="text-sm font-bold leading-tight">
                  ⚡ One sentence.<br/>Full workspace. Insane.
                </p>
                <p className="text-[10px] font-bold uppercase mt-2 opacity-60">— @techwithtj</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MARQUEE / TICKER */}
        <section className="bg-black py-6 border-y-2 border-black overflow-hidden relative">
          <div className="marquee-content flex gap-8 py-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-8 items-center text-ivory font-display text-4xl uppercase tracking-widest leading-none">
                <span className="text-amber">✦</span>
                <span>TWEETS</span>
                <span className="text-amber">✦</span>
                <span>LINKEDIN</span>
                <span className="text-amber">✦</span>
                <span>REEL SCRIPTS</span>
                <span className="text-amber">✦</span>
                <span>EMAIL COPY</span>
                <span className="text-amber">✦</span>
                <span>MEMES</span>
                <span className="text-amber">✦</span>
                <span>POSTERS</span>
                <span className="text-amber">✦</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. HOW IT WORKS */}
        <section id="how-it-works" className="py-24 border-b-2 border-black px-6">
          <div className="max-w-[1440px] mx-auto">
            <h2 className="text-7xl font-display mb-20 tracking-tighter">HOW IT WORKS</h2>
            <div className="grid grid-cols-1 md:grid-cols-3">
              {[
                { num: "01", title: "Describe Your Product", desc: "Just one sentence. That's all we need to understand your value prop." },
                { num: "02", title: "Vega Builds Your Workspace", desc: "Our engine generates 30+ pieces of content across all channels in seconds." },
                { num: "03", title: "Review, Approve & Deliver", desc: "Approve completed content in one click. Receive it instantly in your Discord or Telegram." }
              ].map((step, idx) => (
                <div key={idx} className={`py-12 ${idx !== 2 ? 'md:border-r-2 border-black' : ''} md:px-8 first:pl-0 last:pr-0 border-b-2 md:border-b-0 border-black last:border-b-0`}>
                  <span className="text-8xl font-display text-amber block mb-4">{step.num}</span>
                  <h3 className="text-2xl font-bold mb-4 tracking-tight">{step.title}</h3>
                  <p className="text-lg opacity-80">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. FEATURES GRID */}
        <section id="features" className="py-24 px-6 max-w-[1440px] mx-auto">
          <h2 className="text-7xl font-display mb-20 tracking-tighter">FEATURES</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-2 border-l-2 border-black">
            {[
              { title: "Full Workspace Generation", desc: "Multi-channel content strategy created in less time than it takes to brew coffee." },
              { title: "Brand Brain", desc: "We analyze your past wins to mimic your exact brand voice and tone perfectly." },
              { title: "Auto Scheduling", desc: "Set it and forget it. Vega knows exactly when to post for maximum reach." },
              { title: "Meme & Viral Content", desc: "Current trend monitoring to generate highly sharable, viral-ready content daily." }
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="p-12 border-r-2 border-b-2 border-black group hover:bg-amber/10 transition-colors relative transition-all duration-300 active:scale-[0.98]"
              >
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-burnt opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-3xl font-display mb-6 group-hover:text-deep-red transition-colors">{feature.title}</h3>
                <p className="text-lg opacity-80 leading-relaxed">{feature.desc}</p>
                <div className="mt-8 flex items-center gap-2 font-bold uppercase text-xs tracking-widest opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                  Learn More <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 8. CTA SECTION */}
        <section className="bg-amber py-32 px-6 border-y-2 border-black">
          <div className="max-w-[1440px] mx-auto flex flex-col items-center text-center">
            <h2 className="text-[10vw] sm:text-[8vw] lg:text-[7vw] font-display leading-[0.85] tracking-tighter mb-12 max-w-4xl">
              READY TO SCALE YOUR BRAND?
            </h2>
            <div className="flex justify-center">
              <button 
                onClick={() => { setAuthMode('signup'); setView('auth'); }}
                className="bg-deep-red text-ivory px-16 py-6 font-bold uppercase text-sm tracking-[0.3em] hover:bg-black transition-colors shadow-hard whitespace-nowrap"
              >
                GET STARTED
              </button>
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] opacity-60">
              Join thousands of creators using Vega to build the future of brand intelligence.
            </p>
          </div>
        </section>
      </main>

      {/* 9. FOOTER */}
      <footer className="bg-ivory border-t-2 border-black py-12 px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 -mt-[1px] h-[56px]">
          <a href="#" className="h-10 flex items-center overflow-hidden">
            <img 
              src="/logo.png" 
              alt="VEGA AI" 
              className="h-[250px] w-[200px] pl-[23px] -ml-[37px] object-contain"
              referrerPolicy="no-referrer"
            />
          </a>
          
          <div className="flex flex-wrap justify-center gap-10">
            {["Terms", "Privacy", "Cookies", "Twitter", "LinkedIn"].map((link) => (
              <a key={link} href="#" className="text-[10px] font-bold uppercase tracking-[0.2em] hover:text-burnt">
                {link}
              </a>
            ))}
          </div>
          
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
            © 2025 Vega AI — Built for the bold.
          </div>
        </div>
      </footer>
    </div>
  );
}

function SignUpView({ onBack, onSuccess, initialMode = 'signup' }: { onBack: () => void, onSuccess: (mode: 'signup' | 'login') => void, initialMode?: 'signup' | 'login' }) {
  const [viewMode, setViewMode] = useState<'signup' | 'login'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setIsSubmitting(true);
      setError(null);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Store user in Firestore if new
      try {
        await setDoc(doc(db, 'users', user.uid), {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      onSuccess('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (viewMode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        // Store user in Firestore
        try {
          await setDoc(doc(db, 'users', user.uid), {
            userId: user.uid,
            email: user.email,
            displayName: fullName || '',
            brandName: brandName || '',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
        
        onSuccess('signup');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-ivory flex flex-col selection:bg-amber selection:text-black"
    >
      <nav className="fixed top-0 left-0 w-full bg-ivory z-50 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
          <button onClick={onBack} className="h-8 md:h-10 flex items-center">
            <img 
              src="/logo.png" 
              alt="VEGA AI" 
              className="h-[250px] w-[200px] pl-0 -ml-[35px] object-contain"
              referrerPolicy="no-referrer"
            />
          </button>
          <button 
            onClick={onBack}
            className="text-sm font-bold uppercase tracking-widest hover:text-burnt transition-colors flex items-center gap-2"
          >
            <X size={18} /> Close
          </button>
        </div>
      </nav>

      <main className="flex-grow pt-20 flex flex-col lg:flex-row">
        {/* LEFT: FORM */}
        <div className="lg:w-1/2 p-6 md:p-20 flex flex-col justify-center border-r-2 border-black">
          <div className="max-w-md w-full mx-auto text-left">
            <h1 className="text-6xl md:text-8xl font-display mb-12 tracking-tighter">
              {viewMode === 'signup' ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
            </h1>
            
            {error && (
              <div className="bg-deep-red/10 border-2 border-deep-red p-4 mb-8 text-deep-red font-bold uppercase text-[10px] tracking-widest flex items-center gap-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form className="space-y-8" onSubmit={handleSubmit}>
              {viewMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="MAX MUSTERMANN"
                      className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Brand name</label>
                    <input 
                      type="text" 
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="VEGA WORKS"
                      className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Work Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="YOU@BRAND.COM"
                  className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="pt-6 space-y-4">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-6 font-bold uppercase text-sm tracking-[0.3em] transition-all shadow-hard-lg ${isSubmitting ? 'bg-black/20 cursor-not-allowed' : 'bg-deep-red text-ivory hover:bg-black'}`}
                >
                  {isSubmitting ? 'PROCESSING...' : (viewMode === 'signup' ? 'START BUILDING' : 'LOGIN TO VEGA')}
                </button>

                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full border-2 border-black py-6 font-bold uppercase text-sm tracking-[0.3em] hover:bg-black hover:text-ivory transition-all shadow-hard flex items-center justify-center gap-3"
                >
                  <Globe size={20} /> CONTINUE WITH GOOGLE
                </button>
              </div>

              <div className="text-center space-y-4">
                <button 
                  type="button"
                  onClick={() => setViewMode(viewMode === 'signup' ? 'login' : 'signup')}
                  className="text-[10px] font-bold uppercase tracking-[0.1em] hover:text-burnt"
                >
                  {viewMode === 'signup' 
                    ? "Already have an account? Login" 
                    : "Don't have an account? Sign Up"}
                </button>

                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/40 leading-relaxed">
                  {viewMode === 'signup' 
                    ? "By signing up, you agree to our Terms of Service and Privacy Policy. No credit card required."
                    : "Forgot your password? Reset it here."}
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT: VIDEO CONTENT */}
        <div className="lg:w-1/2 bg-burnt relative hidden lg:flex flex-col items-center justify-center p-20 text-center overflow-hidden">
           {/* Background geometric accents */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-[40px] border-black/5 rotate-12" />
           
           <div className="relative z-10 flex flex-col items-center">
             {/* Video Container */}
             <div className="w-[380px] h-[570px] bg-black border-4 border-black shadow-hard-lg mb-12 relative group overflow-hidden">
               <video 
                 src="/example-ad.mp4" 
                 autoPlay 
                 muted 
                 loop 
                 playsInline
                 className="w-full h-full object-cover transition-all duration-700"
               />
               {/* Typographic Overlay */}
               <div className="absolute bottom-0 left-0 w-full p-6 bg-black text-ivory text-left translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                  <p className="text-xs font-bold uppercase tracking-widest">AI Generated Ad</p>
                  <p className="text-xl font-display leading-[0.9] mt-2">10X CONVERSION RATE.</p>
               </div>
             </div>

             <div className="max-w-md">
               <h2 className="text-5xl font-display text-ivory leading-[0.9] tracking-tighter mb-6 uppercase">
                 JOIN 5,000+ AGENTS OF SCALE.
               </h2>
               <p className="text-ivory/60 font-bold uppercase text-xs tracking-[0.3em]">
                 The future of marketing is automated.<br/>Are you ready?
               </p>
             </div>
           </div>
           
           {/* Draggable-style Floating Badges */}
           <div className="absolute top-10 left-10 bg-amber border-2 border-black p-4 shadow-hard -rotate-3 z-30">
              <p className="text-xs font-bold uppercase tracking-widest text-black">10x Speed</p>
           </div>
           <div className="absolute bottom-10 right-10 bg-ivory border-2 border-black p-4 shadow-hard rotate-6 z-30">
              <p className="text-xs font-bold uppercase tracking-widest text-black">Brand Aligned</p>
           </div>
        </div>
      </main>
    </motion.div>
  );
}

function OnboardingFlow({ onComplete, onBack }: { onComplete: (data: any) => void, onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState('');
  const [data, setData] = useState({
    brandName: '',
    tagline: '',
    description: '',
    audience: '',
    tone: 'bold',
    platforms: [] as string[],
    logo: null as File | null,
    colors: ['#0A0A0A', '#FFFFFF']
  });

  const nextStep = () => setStep(s => Math.min(s + 1, 7));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  
  const handleLaunch = async () => {
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    setSaveError(null);
    const uid = auth.currentUser.uid;

    try {
      // Path as per user request: users/{uid}/brandBrain/current
      const docRef = doc(db, "users", uid, "brandBrain", "current");
      await setDoc(docRef, {
        brandName: data.brandName,
        brandDescription: data.description,
        tone: [data.tone],
        targetAudience: data.audience,
        contentPillars: [], // Not currently in onboarding UI, so default to empty
        discordConnected: true,
        discordUserId: discordUsername,
        discordUsername: discordUsername
      }, { merge: true });
      onComplete(data);
    } catch (err: any) {
      console.error("Failed to save brand brain:", err);
      // Using context-specific error handling if possible, or just raw message
      setSaveError(err.message || "Failed to save your Brand Brain. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const tones = [
    { id: 'bold', label: 'Bold & Direct' },
    { id: 'minimal', label: 'Minimalist' },
    { id: 'funny', label: 'Witty & Fun' },
    { id: 'professional', label: 'Professional' }
  ];

  const platforms = [
    { id: 'x', label: 'Twitter / X' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' }
  ];

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <nav className="fixed top-0 left-0 w-full bg-ivory z-40 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="h-10 flex items-center overflow-hidden">
             <img src="/logo.png" alt="VEGA AI" className="h-[250px] w-[200px] pl-0 -ml-[35px] object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((it) => (
                <div key={it} className={`h-1 w-8 ${it <= step ? 'bg-deep-red' : 'bg-black/10'} transition-colors`} />
              ))}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest ml-4 hidden md:inline">Step {step}/7</span>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-20 flex items-center justify-center p-6 bg-ivory relative overflow-hidden">
        {/* Background purely aesthetic geometric block */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] border-[1px] border-black/5 rotate-45 -z-0" />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-2xl w-full z-10"
          >
            {step === 1 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">WHAT'S YOUR IDENTITY?</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Brand Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={data.brandName}
                      onChange={e => setData({...data, brandName: e.target.value})}
                      placeholder="VEGA WORKS"
                      className="w-full bg-ivory border-2 border-black p-6 font-bold uppercase text-lg tracking-widest focus:bg-white focus:outline-none shadow-hard"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Tagline (Optional)</label>
                    <input 
                      type="text" 
                      value={data.tagline}
                      onChange={e => setData({...data, tagline: e.target.value})}
                      placeholder="THE FUTURE OF SCALE"
                      className="w-full bg-ivory border-2 border-black p-6 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">WHAT DO YOU SELL?</h2>
                <div className="space-y-6">
                  <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Product or Service Description</label>
                  <textarea 
                    autoFocus
                    rows={4}
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                    placeholder="E.G. WE BUILD SUSTAINABLE SNEAKERS FOR URBAN EXPLORERS..."
                    className="w-full bg-ivory border-2 border-black p-6 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard resize-none"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">WHO ARE THEY?</h2>
                <div className="space-y-6">
                  <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Target Audience (Age, Vibe, Interests)</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={data.audience}
                    onChange={e => setData({...data, audience: e.target.value})}
                    placeholder="GEN Z, CREATIVES, TOKYO BASED..."
                    className="w-full bg-ivory border-2 border-black p-6 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">PICK YOUR VIBE</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tones.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setData({...data, tone: t.id})}
                      className={`p-10 border-2 border-black font-bold uppercase text-xs tracking-widest shadow-hard transition-all ${data.tone === t.id ? 'bg-amber -translate-y-1' : 'bg-ivory hover:bg-black/5'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">PICK YOUR BATTLEFIELDS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {platforms.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const next = data.platforms.includes(p.id) 
                          ? data.platforms.filter(id => id !== p.id) 
                          : [...data.platforms, p.id];
                        setData({...data, platforms: next});
                      }}
                      className={`p-10 border-2 border-black flex items-center justify-between font-bold uppercase text-xs tracking-widest shadow-hard transition-all ${data.platforms.includes(p.id) ? 'bg-deep-red text-ivory -translate-y-1' : 'bg-ivory text-black hover:bg-black/5'}`}
                    >
                      {p.label}
                      {data.platforms.includes(p.id) && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">BRAND ASSETS</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="border-2 border-dashed border-black/20 p-12 flex flex-col items-center justify-center text-center group hover:border-black cursor-pointer bg-black/5 transition-all shadow-hard">
                    <Upload className="mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" size={40} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Upload Logo</p>
                    <p className="text-[8px] mt-2 opacity-40">SVG, PNG, JPG (SVG PREFERRED)</p>
                  </div>
                  <div className="border-2 border-black p-8 bg-ivory shadow-hard">
                    <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-3">
                        <Palette size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Brand Colors ({data.colors.length}/6)</span>
                       </div>
                       <p className="text-[8px] font-bold uppercase opacity-40">Min. 2 Required</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {data.colors.map((c, index) => (
                        <div key={index} className="relative group/color">
                          <div 
                            className="w-12 h-12 border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer relative overflow-hidden"
                            style={{ backgroundColor: c }}
                          >
                            <input 
                              type="color"
                              value={c}
                              onChange={(e) => {
                                const next = [...data.colors];
                                next[index] = e.target.value;
                                setData({...data, colors: next});
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                            />
                          </div>
                          {index >= 2 && (
                            <button 
                              onClick={() => {
                                const next = data.colors.filter((_, i) => i !== index);
                                setData({...data, colors: next});
                              }}
                              className="absolute -top-2 -right-2 bg-deep-red text-ivory rounded-none border border-black p-0.5 opacity-0 group-hover/color:opacity-100 transition-opacity z-10"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {data.colors.length < 6 && (
                        <div className="relative">
                          <button className="w-12 h-12 border-2 border-black border-dashed flex items-center justify-center cursor-pointer hover:bg-black/5">
                            <Plus size={16} />
                            <input 
                              type="color"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                              onChange={(e) => {
                                if (data.colors.length < 6) {
                                  setData({...data, colors: [...data.colors, e.target.value]});
                                }
                              }}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mt-6 opacity-40 leading-tight">
                      First 2 colors are mandatory but fully customizable. Click any swatch to edit.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-12">
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85]">CONNECT DISCORD</h2>
                <div className="space-y-8">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">
                    Connect your Discord account to receive generated workspace assets and updates.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (auth.currentUser) {
                        const url = `https://discord.com/oauth2/authorize?client_id=1506400226586394624&redirect_uri=https%3A%2F%2Fphantom-subsequently-steel-portable.trycloudflare.com%2Fauth%2Fdiscord%2Fcallback&response_type=code&scope=identify&state=${auth.currentUser.uid}`;
                        window.open(url, '_blank');
                      }
                    }}
                    className="w-full bg-black text-ivory p-6 font-bold uppercase text-sm tracking-widest hover:bg-deep-red transition-all shadow-hard"
                  >
                    CONNECT DISCORD
                  </button>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest opacity-60">Discord Username Name</label>
                    <input 
                      type="text" 
                      value={discordUsername}
                      onChange={e => setDiscordUsername(e.target.value)}
                      placeholder="E.G. USERNAME#0000 OR USERNAME"
                      className="w-full bg-ivory border-2 border-black p-6 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-16">
              {saveError && (
                <div className="mb-8 p-4 border-2 border-deep-red bg-deep-red/5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-deep-red">
                  <AlertCircle size={16} />
                  {saveError}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <button 
                  onClick={step === 1 ? onBack : prevStep}
                  disabled={isSaving}
                  className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-burnt transition-opacity ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft size={20} /> Back
                </button>
                <button 
                  onClick={step === 7 ? handleLaunch : nextStep}
                  disabled={isSaving}
                  className={`bg-deep-red text-ivory px-12 py-6 font-bold uppercase text-sm tracking-[0.3em] transition-all shadow-hard ${isSaving ? 'bg-black/20 cursor-not-allowed' : 'hover:bg-black'}`}
                >
                  {isSaving ? 'SAVING...' : (step === 7 ? 'LAUNCH DASHBOARD' : 'CONTINUE')}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = [
    'Activating Brand Brain...',
    'Analysing your mission brief...',
    'Crafting your content...',
    'Generating visuals...',
    'Finalising your pack...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev < messages.length - 1 ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[100] bg-ivory flex flex-col items-center justify-center p-6"
    >
      <div className="relative mb-12">
        <motion.img 
          src="/logo.png" 
          alt="VEGA" 
          className="h-[400px] w-[300px] object-contain"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      
      <div className="w-full max-w-md space-y-4">
        <div className="h-1 w-full bg-black/5 relative overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-amber h-full"
            initial={{ left: '-100%' }}
            animate={{ left: '0%' }}
            transition={{ duration: 3, ease: "linear" }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p 
            key={msgIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-black text-center"
          >
            {messages[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function NewCampaignFlow({ onCancel, onComplete, setView, gallery }: { onCancel: () => void, onComplete: (c: Campaign) => void, setView: (v: AppView) => void, gallery: GalleryItem[] }) {
  const { brandBrain } = useBrandBrain();
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    brief: '',
    duration: '7 days'
  });

  const handleDeploy = async () => {
    if (!auth.currentUser) return;
    setIsDeploying(true);
    setError(null);
    const uid = auth.currentUser.uid;

    try {
      // 1. Write to Firestore: users/{uid}/campaigns
      const docRef = await addDoc(collection(db, "users", uid, "campaigns"), {
        name: formData.name,
        brief: formData.brief,
        duration: formData.duration,
        status: 'active',
        createdAt: serverTimestamp(),
        deployedAt: serverTimestamp()
      });

      // 2. Fetch discordUserId from users/{uid}/brandBrain/current
      let discordUserId = "";
      try {
        const bdRef = doc(db, "users", uid, "brandBrain", "current");
        const bdSnap = await getDoc(bdRef);
        if (bdSnap.exists()) {
          const bdData = bdSnap.data();
          discordUserId = bdData?.discordUserId || bdData?.discordUsername || "";
        }
      } catch (bdErr) {
        console.warn("Could not read brandBrain for Discord user:", bdErr);
      }

      // 3. Trigger endpoint if discordUserId is present
      if (discordUserId) {
        try {
          await fetch("https://phantom-subsequently-steel-portable.trycloudflare.com/deploy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              userId: uid,
              discordUserId: discordUserId
            })
          });
        } catch (fetchErr) {
          console.warn("Deploy endpoint request failed or timed out silently:", fetchErr);
        }
      } else {
        console.warn("Warning: discordUserId missing or empty. Skipping deploy POST.");
      }

      // 4. Complete flow locally and redirect
      onComplete({
        id: docRef.id,
        name: formData.name || 'UNNAMED WORKSPACE',
        platforms: ['discord'],
        status: 'active',
        progress: 100,
        contentCount: 0,
        duration: formData.duration,
        createdAt: new Date().toISOString(),
        brief: formData.brief,
        content: []
      });
    } catch (err: any) {
      console.error("Failed to deploy workspace:", err);
      setError(err?.message || "Deployment failed. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col pt-20">
      <nav className="fixed top-0 left-0 w-full bg-ivory z-40 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
           <button onClick={onCancel} className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-deep-red">
             <ChevronLeft size={16} /> Cancel Workspace
           </button>
           <div className="flex gap-2">
             {[1, 2].map(it => (
                <div key={it} className={`h-1 w-6 transition-all ${it <= step ? 'bg-deep-red' : 'bg-black/10'}`} />
             ))}
           </div>
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center p-6 relative overflow-hidden">
        <div className="max-w-4xl w-full z-10 py-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="space-y-12 max-w-2xl mx-auto text-left"
              >
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85] uppercase">THE BRIEF</h2>
                <div className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60">Workspace Name</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="SUMMER SOLSTICE 2026"
                      className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60">The Mission Block</label>
                    <textarea 
                      rows={4}
                      value={formData.brief} 
                      onChange={e => setFormData({...formData, brief: e.target.value})}
                      placeholder="WHAT ARE WE PROMOTING?"
                      className="w-full bg-ivory border-2 border-black p-5 font-bold uppercase text-sm tracking-widest focus:bg-white focus:outline-none shadow-hard resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60">Workspace Duration</label>
                    <div className="relative inline-block w-full">
                      <select
                        value={formData.duration}
                        onChange={e => setFormData({...formData, duration: e.target.value})}
                        className="w-full px-5 py-5 border-2 border-black font-bold text-sm uppercase tracking-widest bg-amber shadow-hard focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="7 days">7 days</option>
                        <option value="14 days">14 days</option>
                        <option value="30 days">30 days</option>
                        <option value="Unlimited">Unlimited</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-black">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 border-2 border-deep-red bg-deep-red/5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-deep-red">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="flex justify-end pt-8">
                  <button 
                    onClick={() => {
                      if (formData.name.trim() && formData.brief.trim()) {
                        setStep(2);
                      }
                    }} 
                    disabled={!formData.name.trim() || !formData.brief.trim()}
                    className={`bg-deep-red text-ivory px-12 py-6 font-bold uppercase text-sm tracking-[0.3em] transition-all shadow-hard ${(!formData.name.trim() || !formData.brief.trim()) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
                  >
                    NEXT
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="space-y-12 max-w-2xl mx-auto text-left"
              >
                <h2 className="text-6xl md:text-8xl font-display tracking-tighter leading-[0.85] uppercase">CONFIRMATION</h2>
                
                <div className="border-4 border-black p-8 bg-white shadow-hard space-y-8">
                  <div className="space-y-2 border-b-2 border-black/10 pb-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Workspace Name</span>
                    <p className="text-3xl font-display tracking-tight uppercase leading-none">{formData.name || 'UNNAMED WORKSPACE'}</p>
                  </div>

                  <div className="space-y-2 border-b-2 border-black/10 pb-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">The Mission Block</span>
                    <p className="text-sm font-bold uppercase tracking-wider leading-relaxed">{formData.brief || 'NO BRIEF PROVIDED'}</p>
                  </div>

                  <div className="space-y-2 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Workspace Duration</span>
                    <div className="inline-block px-4 py-2 border-2 border-black bg-amber font-bold text-xs uppercase tracking-widest">
                      {formData.duration.toUpperCase()}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 border-2 border-deep-red bg-deep-red/5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-deep-red">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6">
                  <button 
                    onClick={() => setStep(1)} 
                    disabled={isDeploying}
                    className="text-[10px] font-bold uppercase tracking-widest hover:text-burnt"
                  >
                    Back to edit
                  </button>
                  <button 
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className={`w-full sm:w-auto bg-deep-red text-ivory px-16 py-6 font-bold uppercase text-sm tracking-[0.3em] transition-all shadow-hard flex items-center justify-center gap-3 ${isDeploying ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
                  >
                    {isDeploying ? 'DEPLOYING...' : 'DEPLOY TO WORKSTATION'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function DeleteConfirmationModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-ivory border-4 border-black p-10 max-w-sm w-full shadow-hard-lg"
      >
        <h3 className="text-3xl font-display uppercase tracking-tighter mb-4">Are you sure?</h3>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-8 leading-relaxed">
          Deleting this workspace will permanently remove all generated assets and scheduled posts. This action cannot be undone.
        </p>
        <div className="flex flex-col gap-4">
          <button 
            onClick={onConfirm}
            className="w-full py-4 bg-deep-red text-ivory font-bold uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-hard"
          >
            Delete Permanently
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 border-2 border-black font-bold uppercase text-[10px] tracking-widest hover:bg-black hover:text-ivory transition-all shadow-hard"
          >
            Keep Workspace
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CampaignDetailView({ campaign, onBack }: { campaign: Campaign, onBack: () => void }) {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-deep-red transition-colors group">
         <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to workspaces
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Workspace Details</p>
          <h2 className="text-7xl font-display tracking-tighter leading-none uppercase mb-6">{campaign.name}</h2>
          <p className="text-lg font-bold uppercase tracking-tight leading-relaxed opacity-80">{campaign.brief}</p>
        </div>
        <div className="shrink-0 pt-4">
           <div className={`px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-widest shadow-hard ${
                campaign.status === 'active' ? 'bg-amber' : 
                campaign.status === 'completed' ? 'bg-black text-ivory' : 
                'bg-ivory'
              }`}>
              {campaign.status}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8 text-left">
           <h3 className="text-2xl font-display border-b-2 border-black pb-4">GENERATED CONTENT</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaign.content.length === 0 ? (
                <div className="col-span-full py-20 border-2 border-black border-dashed flex items-center justify-center text-[10px] font-bold uppercase opacity-20">
                   No content generated for this workspace yet.
                </div>
              ) : campaign.content.map(item => (
                <div key={item.id} className="border-2 border-black p-6 bg-ivory shadow-hard">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[8px] font-bold uppercase tracking-widest bg-black text-ivory px-2 py-0.5">{item.type}</span>
                      <span className="text-[8px] font-bold uppercase opacity-40">PENDING DELIVERY</span>
                   </div>
                   <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">{item.body}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="space-y-8 text-left">
           <div className="border-2 border-black p-8 bg-ivory shadow-hard space-y-4">
              <h4 className="text-xl font-display uppercase tracking-widest">TIMELINE</h4>
              <p className="text-[10px] font-bold uppercase tracking-widest">Duration: {campaign.duration} Days</p>
              <div className="w-full h-2 bg-black/10">
                 <div className="h-full bg-black" style={{ width: `${campaign.progress}%` }} />
              </div>
              <p className="text-[8px] font-bold uppercase tracking-widest opacity-40">Created: {campaign.createdAt}</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function CampaignsPage({ 
  campaigns, 
  onNewCampaign,
  onUpdateCampaigns,
  isLoading
}: { 
  campaigns: Campaign[], 
  onNewCampaign: () => void,
  onUpdateCampaigns: (c: Campaign[]) => void,
  isLoading?: boolean
}) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'DRAFT' | 'ARCHIVED'>('ALL');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="py-32 border-4 border-black border-dashed flex items-center justify-center">
        <RefreshCcw size={48} className="animate-spin text-black opacity-10" />
      </div>
    );
  }

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'ALL') return true;
    return c.status.toUpperCase() === filter;
  });

  const handleDelete = (id: string) => {
    onUpdateCampaigns(campaigns.filter(c => c.id !== id));
    setShowDeleteModal(null);
  };

  const handleArchive = (id: string) => {
    onUpdateCampaigns(campaigns.map(c => c.id === id ? { ...c, status: 'archived' } : c));
    setMenuOpenId(null);
  };

  if (selectedCampaign) {
    return <CampaignDetailView campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} />;
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="flex flex-wrap gap-4 border-b-2 border-black pb-2">
          {['ALL', 'ACTIVE', 'DRAFT', 'COMPLETED', 'ARCHIVED'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] pb-2 px-2 border-b-4 transition-all ${filter === f ? 'border-deep-red text-deep-red' : 'border-transparent opacity-40 hover:opacity-100'}`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="flex-grow max-w-xl" />
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="py-32 border-4 border-black border-dashed flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
           <h3 className="text-6xl font-display uppercase tracking-widest opacity-10 mb-8">NO {filter} WORKSPACES</h3>
           <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 max-w-sm mb-12">Your first workspace is just one brief away. Feed the brain.</p>
           <button 
            onClick={onNewCampaign}
            className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all flex items-center gap-3"
           >
             <Plus size={16} /> NEW WORKSPACE
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          {filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="bg-ivory border-2 border-black p-8 shadow-hard flex flex-col relative group">
              <div className="absolute top-6 right-6">
                <button 
                  onClick={() => setMenuOpenId(menuOpenId === campaign.id ? null : campaign.id)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
                >
                  <MoreHorizontal size={20} />
                </button>
                <AnimatePresence>
                  {menuOpenId === campaign.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 top-12 bg-white border-2 border-black shadow-hard w-40 z-20 py-2"
                    >
                      {[
                        { label: 'View', icon: Eye, onClick: () => setSelectedCampaign(campaign) },
                        { label: 'Archive', icon: Archive, onClick: () => handleArchive(campaign.id) },
                        { label: 'Delete', icon: Trash2, onClick: () => setShowDeleteModal(campaign.id), color: 'text-deep-red' }
                      ].map(item => (
                        <button 
                          key={item.label}
                          onClick={item.onClick}
                          className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-black/5 ${item.color || ''}`}
                        >
                          <item.icon size={14} /> {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-grow">
                 <div className="flex items-center gap-4 mb-4">
                    <span className={`px-2 py-1 border border-black text-[8px] font-bold uppercase tracking-widest ${
                      campaign.status === 'active' ? 'bg-amber' : 
                      campaign.status === 'completed' ? 'bg-black text-ivory' : 
                      campaign.status === 'archived' ? 'opacity-40' : 'bg-white'
                    }`}>
                      {campaign.status}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">{campaign.createdAt}</span>
                 </div>
                 
                 <h4 className="text-4xl font-display tracking-tighter uppercase mb-2 group-hover:text-deep-red transition-colors cursor-pointer" onClick={() => setSelectedCampaign(campaign)}>
                   {campaign.name}
                 </h4>

                 <div className="flex items-center gap-2 mb-8">
                    {campaign.platforms.map(p => (
                       <div key={p} className="w-6 h-6 rounded-full border border-black flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                         {p === 'x' && <Zap size={10} />}
                         {p === 'linkedin' && <Briefcase size={10} />}
                         {p === 'instagram' && <LucideImage size={10} />}
                         {p === 'tiktok' && <Video size={10} />}
                       </div>
                    ))}
                 </div>

                 <div className="space-y-2 mb-8">
                    <div className="flex justify-between items-end mb-1">
                       <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Progress — Day {Math.floor((campaign.progress / 100) * Number(campaign.duration))} of {campaign.duration}</span>
                       <span className="text-[8px] font-bold uppercase tracking-widest">{campaign.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/5 border border-black/10 overflow-hidden relative">
                       <div className="absolute inset-y-0 left-0 bg-amber" style={{ width: `${campaign.progress}%` }} />
                    </div>
                 </div>

                 <div className="flex justify-between items-center bg-black/5 p-4 border border-black/10">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-bold opacity-40 mb-1">PACK SIZE</span>
                       <span className="text-[10px] font-bold uppercase">{campaign.contentCount} PIECES</span>
                    </div>
                    <div className="h-6 w-[1px] bg-black/10" />
                    <div className="flex flex-col text-right">
                       <span className="text-[8px] font-bold opacity-40 mb-1">CHANNELS</span>
                       <span className="text-[10px] font-bold uppercase">{campaign.platforms.length} PLATFORMS</span>
                    </div>
                 </div>
              </div>
            </div>
          ))}

          {Array.from({ length: 1 }).map((_, i) => (
             <button 
              key={`slot-${i}`}
              onClick={onNewCampaign}
              className="bg-ivory border-4 border-black border-dashed p-8 shadow-hard flex flex-col items-center justify-center text-center opacity-40 hover:opacity-100 transition-all group"
             >
                <div className="w-12 h-12 border-2 border-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                   <Plus size={24} />
                </div>
                <h4 className="text-xl font-display uppercase tracking-widest">NEW WORKSPACE SLOT</h4>
                <p className="text-[8px] font-bold uppercase tracking-widest mt-2">CREATE CONTENT PACK</p>
             </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmationModal 
            onConfirm={() => handleDelete(showDeleteModal)} 
            onCancel={() => setShowDeleteModal(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AssetsPage({ 
  assets, 
  onUpdateAssets 
}: { 
  assets: Asset[], 
  onUpdateAssets: (a: Asset[]) => void 
}) {
  const [filter, setFilter] = useState<'ALL' | 'IMAGES' | 'VIDEOS' | 'UPLOADS'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const filteredAssets = assets.filter(a => {
    if (filter === 'ALL') return true;
    if (filter === 'IMAGES') return a.type === 'image';
    if (filter === 'VIDEOS') return a.type === 'video';
    if (filter === 'UPLOADS') return a.type === 'upload';
    return true;
  });

  const handleDelete = (id: string) => {
    onUpdateAssets(assets.filter(a => a.id !== id));
    setShowDeleteModal(null);
  };

  const handleDownload = (id: string) => {
    setIsDownloading(id);
    setTimeout(() => setIsDownloading(null), 1500);
  };

  const handleUpload = (newAsset: Asset) => {
    onUpdateAssets([newAsset, ...assets]);
    setShowUploadModal(false);
  };


  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="flex flex-wrap gap-4 border-b-2 border-black pb-2">
          {['ALL', 'IMAGES', 'VIDEOS', 'UPLOADS'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] pb-2 px-2 border-b-4 transition-all ${filter === f ? 'border-deep-red text-deep-red' : 'border-transparent opacity-40 hover:opacity-100'}`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => setShowUploadModal(true)}
          className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all flex items-center gap-3"
        >
          <Upload size={16} /> UPLOAD ASSET
        </button>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="py-32 border-4 border-black border-dashed flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
           <h3 className="text-6xl font-display uppercase tracking-widest opacity-10 mb-8">NO {filter === 'ALL' ? '' : filter} ASSETS</h3>
           <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 max-w-sm mb-12">
             {filter === 'IMAGES' ? 'No images generated yet.' : 
              filter === 'VIDEOS' ? 'No videos generated yet.' :
              filter === 'UPLOADS' ? 'No uploads yet.' :
              'Your library is empty.'}
           </p>
           {filter === 'IMAGES' && (
             <button className="bg-black text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-deep-red transition-all">GO TO IMAGE LAB</button>
           )}
           {filter === 'VIDEOS' && (
             <button className="bg-black text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-deep-red transition-all">CREATE A WORKSPACE</button>
           )}
           {filter === 'UPLOADS' && (
             <button onClick={() => setShowUploadModal(true)} className="bg-black text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-deep-red transition-all">UPLOAD ASSET</button>
           )}
           {filter === 'ALL' && (
             <button className="bg-black text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-deep-red transition-all">START CREATING</button>
           )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredAssets.map(asset => (
             <div key={asset.id} className="bg-ivory border-2 border-black shadow-hard group relative overflow-hidden aspect-[4/5] flex flex-col">
                {/* ASSET PREVIEW */}
                <div className={`relative flex-grow ${asset.url} flex items-center justify-center overflow-hidden`}>
                   {asset.type === 'video' && (
                     <div className="w-16 h-16 rounded-full bg-ivory/20 backdrop-blur-md flex items-center justify-center border border-ivory/30 group-hover:scale-110 transition-transform">
                        <Play size={24} className="text-ivory fill-ivory ml-1" />
                     </div>
                   )}
                   {asset.type === 'upload' && (
                     <FileText size={48} className="text-black/20" />
                   )}
                   
                   {/* TYPE BADGE */}
                   <div className="absolute top-4 left-4">
                      <span className="bg-black text-ivory px-2 py-1 text-[7px] font-bold uppercase tracking-widest border border-ivory/20">
                        {asset.type}
                      </span>
                   </div>

                   {/* HOVER OVERLAY */}
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 border-2 border-ivory flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-300">
                         <Eye size={20} className="text-ivory" />
                      </div>
                   </div>
                </div>

                {/* INFO AREA */}
                <div className="p-4 bg-white border-t-2 border-black shrink-0 relative">
                  <div className="absolute top-3 right-3 capitalize">
                    <button 
                      onClick={() => setMenuOpenId(menuOpenId === asset.id ? null : asset.id)}
                      className="p-1 hover:bg-black/5 rounded transition-colors"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <AnimatePresence>
                      {menuOpenId === asset.id && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 top-8 bg-white border-2 border-black shadow-hard w-32 z-20 py-1"
                        >
                          <button 
                            onClick={() => { handleDownload(asset.id); setMenuOpenId(null); }}
                            className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-black/5"
                          >
                            <Download size={12} /> Download
                          </button>
                          <button 
                            onClick={() => { setMenuOpenId(null); }}
                            className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-black/5"
                          >
                            <Plus size={12} /> Add to workspace
                          </button>
                          <button 
                            onClick={() => setShowDeleteModal(asset.id)}
                            className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-black/5 text-deep-red border-t border-black/5 mt-1"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <h5 className="text-[10px] font-bold uppercase tracking-widest mb-1 truncate pr-6">{asset.name}</h5>
                  <p className="text-[7px] font-bold uppercase opacity-40 mb-1">{asset.campaign || 'Manual Upload'}</p>
                  <div className="flex justify-between items-center mt-2">
                     <span className="text-[7px] font-bold opacity-30">{asset.date}</span>
                     <span className="text-[7px] font-bold opacity-30">{asset.size}</span>
                  </div>
                </div>

                {/* DOWNLOAD OVERLAY */}
                <AnimatePresence>
                  {isDownloading === asset.id && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-amber flex flex-col items-center justify-center z-30"
                    >
                       <RefreshCcw size={24} className="text-black animate-spin mb-2" />
                       <span className="text-[8px] font-bold uppercase tracking-widest text-black">Downloading...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
           ))}
        </div>
      )}


      <AnimatePresence>
        {showUploadModal && <UploadModal onUpload={handleUpload} onCancel={() => setShowUploadModal(false)} />}
        {showDeleteModal && (
          <AssetDeleteModal 
            onConfirm={() => handleDelete(showDeleteModal)} 
            onCancel={() => setShowDeleteModal(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UploadModal({ onUpload, onCancel }: { onUpload: (a: Asset) => void, onCancel: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    simulateUpload();
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      onUpload({
        id: Math.random().toString(36).substr(2, 9),
        type: 'upload',
        name: 'NEW_BRAND_ASSET_' + Math.floor(Math.random() * 100),
        date: 'JUN 01 2026',
        url: 'bg-ivory',
        size: '1.2MB'
      });
      setIsUploading(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-ivory border-4 border-black p-12 max-w-xl w-full shadow-hard-lg text-center"
      >
        <div className="flex justify-between items-start mb-12">
           <h3 className="text-4xl font-display uppercase tracking-tighter">ADD TO VAULT</h3>
           <button onClick={onCancel} className="hover:rotate-90 transition-transform"><X size={24} /></button>
        </div>

        <div 
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={simulateUpload}
          className={`border-4 border-dashed border-black/10 py-24 flex flex-col items-center justify-center cursor-pointer transition-all ${dragActive ? 'bg-amber/10 border-black/40 scale-[0.98]' : 'hover:bg-black/5'}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center">
               <RefreshCcw size={48} className="animate-spin mb-6 text-deep-red" />
               <p className="text-xs font-bold uppercase tracking-[0.3em] animate-pulse">INGESTING BRAND DATA</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-black flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} className="text-ivory" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest mb-2 px-4">DROP YOUR BRAND ASSETS HERE</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-40">PNG, JPG, MP4, PDF SUPPORTED</p>
            </>
          )}
        </div>

        <div className="mt-12 flex justify-center">
           <button onClick={onCancel} className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-deep-red transition-all">Cancel Upload</button>
        </div>
      </motion.div>
    </div>
  );
}

function AssetDeleteModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border-4 border-black p-10 max-w-sm w-full shadow-hard-lg"
      >
        <h3 className="text-3xl font-display uppercase tracking-tighter mb-4">PURGE ASSET?</h3>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-8 leading-relaxed">
          This asset will be removed from your brand vault permanently.
        </p>
        <div className="flex flex-col gap-4">
          <button 
            onClick={onConfirm}
            className="w-full py-4 bg-deep-red text-ivory font-bold uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-hard"
          >
            CONFIRM PURGE
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 border-2 border-black font-bold uppercase text-[10px] tracking-widest hover:bg-black hover:text-ivory transition-all shadow-hard"
          >
            KEEP ASSET
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AnalyticsPage({ campaigns, isLoading }: { campaigns: Campaign[], isLoading?: boolean }) {
  const [dateRange, setDateRange] = useState('LAST 7 DAYS');
  
  if (isLoading) {
    return (
      <div className="py-32 border-4 border-black border-dashed flex items-center justify-center">
        <RefreshCcw size={48} className="animate-spin text-black opacity-10" />
      </div>
    );
  }

  const stats = useMemo(() => {
    // Generate numbers based on dateRange selected
    const mult = dateRange === 'LAST 7 DAYS' ? 1 : dateRange === 'LAST 30 DAYS' ? 4 : 45;
    return {
      reach: Math.floor((15000 + Math.random() * 10000) * mult).toLocaleString(),
      reachTrend: 12,
      engagement: (4 + Math.random() * 2).toFixed(1),
      engagementTrend: 3,
      content: Math.floor((20 + Math.random() * 20) * mult).toFixed(0),
      contentTrend: 8,
      topPlatform: 'INSTAGRAM'
    };
  }, [dateRange]);

  const reachData = useMemo(() => {
    const days = 7; 
    return Array.from({ length: days }).map((_, i) => ({
      name: `DAY ${i + 1}`,
      X: 400 + Math.random() * 600,
      LinkedIn: 300 + Math.random() * 400,
      Instagram: 600 + Math.random() * 800,
      TikTok: 500 + Math.random() * 1000
    }));
  }, []); // Static random data for now, could be seeded by dateRange

  const engagementData = useMemo(() => {
    return [
      { name: 'VIDEO', value: 65, color: '#8B0000' },
      { name: 'IMAGE', value: 42, color: '#FFBF00' },
      { name: 'TEXT', value: 28, color: '#000000' }
    ];
  }, []);

  if (campaigns.length === 0) {
    return (
      <div className="py-32 border-4 border-black border-dashed flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
         <h3 className="text-6xl font-display uppercase tracking-widest opacity-10 mb-8">NO DATA YET</h3>
         <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 max-w-sm mb-12">Launch your first workspace to start tracking performance metrics.</p>
         <button className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all">CREATE WORKSPACE</button>
      </div>
    );
  }

  return (
     <div className="space-y-12 relative">

       {/* HEADER & FILTERS */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-2 border-black pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 italic">Track. Learn. Dominate.</p>
          <div className="flex gap-2">
            {['LAST 7 DAYS', 'LAST 30 DAYS', 'ALL TIME'].map(range => (
              <button 
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 border-2 border-black font-bold uppercase text-[8px] tracking-widest transition-all ${dateRange === range ? 'bg-black text-ivory' : 'bg-ivory hover:bg-black/5'}`}
              >
                {range}
              </button>
            ))}
          </div>
       </div>

       {/* STAT CARDS */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
          {[
            { label: 'TOTAL REACH', value: stats.reach, trend: stats.reachTrend, up: true },
            { label: 'ENGAGEMENT RATE', value: `${stats.engagement}%`, trend: stats.engagementTrend, up: true },
            { label: 'POSTS CREATED', value: stats.content, trend: stats.contentTrend, up: true },
            { label: 'TOP PLATFORM', value: stats.topPlatform, trend: null }
          ].map((s, i) => (
            <div key={i} className="bg-ivory border-2 border-black p-8 shadow-hard flex flex-col justify-between">
               <span className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-4">{s.label}</span>
               <div className="flex items-end justify-between">
                  <h4 className="text-4xl font-display uppercase">{s.value}</h4>
                  {s.trend && (
                    <div className={`flex items-center gap-1 text-[8px] font-bold ${s.up ? 'text-amber' : 'text-deep-red'}`}>
                       {s.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                       {s.trend}%
                    </div>
                  )}
               </div>
            </div>
          ))}
       </div>

       {/* CHARTS */}
       <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-left">
          <div className="lg:col-span-3 bg-ivory border-2 border-black p-8 shadow-hard space-y-8">
             <h4 className="text-2xl font-display uppercase tracking-widest border-b border-black/10 pb-4">REACH OVER TIME</h4>
             <div className="h-[400px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={reachData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                   <XAxis 
                     dataKey="name" 
                     axisLine={{ stroke: '#000', strokeWidth: 2 }}
                     tickLine={false}
                     tick={{ fontSize: 8, fontWeight: 'bold' }}
                   />
                   <YAxis 
                      axisLine={{ stroke: '#000', strokeWidth: 2 }}
                      tickLine={false}
                      tick={{ fontSize: 8, fontWeight: 'bold' }}
                   />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#FCFAF2', border: '2px solid black', borderRadius: 0, fontSize: '10px', fontWeight: 'bold' }}
                   />
                   <Legend iconType="rect" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                   <Line type="monotone" dataKey="X" stroke="#000000" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#FCFAF2' }} />
                   <Line type="monotone" dataKey="LinkedIn" stroke="#8B0000" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#FCFAF2' }} />
                   <Line type="monotone" dataKey="Instagram" stroke="#FFBF00" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#FCFAF2' }} />
                   <Line type="monotone" dataKey="TikTok" stroke="#444444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#FCFAF2' }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="lg:col-span-2 bg-ivory border-2 border-black p-8 shadow-hard space-y-8">
             <h4 className="text-2xl font-display uppercase tracking-widest border-b border-black/10 pb-4">ENGAGEMENT BY TYPE</h4>
             <div className="h-[400px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={engagementData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                   <XAxis 
                     dataKey="name" 
                     axisLine={{ stroke: '#000', strokeWidth: 2 }}
                     tickLine={false}
                     tick={{ fontSize: 8, fontWeight: 'bold' }}
                   />
                   <YAxis 
                      axisLine={{ stroke: '#000', strokeWidth: 2 }}
                      tickLine={false}
                      tick={{ fontSize: 8, fontWeight: 'bold' }}
                   />
                   <Tooltip cursor={{fill: '#00000005'}} contentStyle={{ backgroundColor: '#FCFAF2', border: '2px solid black', borderRadius: 0, fontSize: '10px', fontWeight: 'bold' }} />
                   <Bar dataKey="value" stroke="#000" strokeWidth={2}>
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
       </div>

       {/* TABLE */}
       <div className="bg-ivory border-2 border-black shadow-hard overflow-hidden text-left">
          <div className="p-8 border-b-2 border-black">
             <h4 className="text-2xl font-display uppercase tracking-widest">WORKSPACE BREAKDOWN</h4>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-black text-ivory">
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest">Workspace Name</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest">Platforms</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest">Pieces</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest">Reach</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest">Eng.</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-right">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                   {campaigns.map((c, i) => (
                     <tr key={c.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-black/5'} group hover:bg-amber/10 transition-colors cursor-pointer`}>
                        <td className="px-8 py-6 font-display uppercase text-lg">{c.name}</td>
                        <td className="px-8 py-6">
                           <div className="flex gap-1">
                              {c.platforms.map(p => (
                                <div key={p} className="w-4 h-4 bg-black rounded-full flex items-center justify-center"><Zap size={8} className="text-ivory" /></div>
                              ))}
                           </div>
                        </td>
                        <td className="px-8 py-6 text-[10px] font-bold">{c.contentCount}</td>
                        <td className="px-8 py-6 text-[10px] font-bold">{(Math.random() * 5000 + 2000).toFixed(0)}</td>
                        <td className="px-8 py-6 text-[10px] font-bold">{(Math.random() * 3 + 2).toFixed(1)}%</td>
                        <td className="px-8 py-6 text-right">
                           <span className={`px-2 py-1 text-[7px] font-bold uppercase tracking-widest border border-black ${c.status === 'active' ? 'bg-amber' : 'bg-ivory'}`}>
                              {c.status}
                           </span>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>

       {/* BRAIN LEARNING */}
       <div className="space-y-8 bg-black text-ivory p-12 shadow-hard border-l-[16px] border-amber text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
             <div className="space-y-2">
                <h3 className="text-5xl font-display tracking-tighter uppercase leading-none">WHAT YOUR BRAIN LEARNED</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Vega gets smarter every workspace. Feed the machine.</p>
             </div>
             <div className="flex flex-col items-end gap-2">
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Brand Brain Confidence</span>
                <div className="flex items-center gap-4">
                   <div className="w-48 h-2 bg-ivory/10 overflow-hidden">
                      <div className="h-full bg-amber" style={{ width: '68%' }} />
                   </div>
                   <span className="text-xl font-display">68%</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
             {[
               'YOUR AUDIENCE ENGAGES 3X MORE WITH BOLD VISUALS',
               'TUESDAY 9AM IS YOUR PEAK POSTING TIME',
               'VIDEO CONTENT DRIVES 67% OF YOUR TOTAL REACH',
               'LINKEDIN PERFORMS BEST FOR YOUR BRAND TONE'
             ].map((insight, i) => (
                <div key={i} className="border border-ivory/20 p-6 space-y-4 hover:border-amber transition-colors group">
                   <Sparkles size={16} className="text-amber" />
                   <p className="text-[10px] font-bold uppercase tracking-[0.15em] leading-relaxed group-hover:text-amber transition-colors">{insight}</p>
                </div>
             ))}
          </div>
          
          <p className="text-[7px] font-bold uppercase tracking-widest opacity-20 text-center pt-8">Brain improves with every workspace you launch. Data integrity guaranteed.</p>
       </div>
     </div>
  );
}




function SettingsPage({ 
  onboardingData, 
  setOnboardingData 
}: { 
  onboardingData: any, 
  setOnboardingData: (d: any) => void 
}) {
  const [activeTab, setActiveTab] = useState<'BRAIN' | 'ACCOUNT' | 'NOTIFICATIONS' | 'DANGER'>('BRAIN');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  
  // Local form states
  const [brandName, setBrandName] = useState(onboardingData?.brandName || 'VEGA AI');
  const [tagline, setTagline] = useState(onboardingData?.tagline || 'FUTURE OF CONTENT');
  const [description, setDescription] = useState(onboardingData?.description || 'AI-powered marketing engine.');
  const [audience, setAudience] = useState(onboardingData?.audience || 'Tech-forward brands.');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(onboardingData?.visualStyles || []);
  
  const [notifications, setNotifications] = useState({
    launched: true,
    posted: true,
    weekly: false,
    learning: true,
    updates: true
  });

  const styles = ['Bold', 'Minimal', 'Technical', 'Modern', 'Futuristic', 'Clean', 'Brutal', 'Vibrant'];

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const handleSaveBrain = () => {
    setOnboardingData({
      ...onboardingData,
      brandName,
      tagline,
      description,
      audience,
      visualStyles: selectedStyles
    });
    // Visual feedback would go here
  };

  return (
    <div className="flex flex-col lg:flex-row gap-12 text-left min-h-[600px]">
      {/* SIDEBAR TABS */}
      <div className="w-full lg:w-64 shrink-0 space-y-2">
        {[
          { id: 'BRAIN', label: 'BRAND BRAIN', icon: Sparkles },
          { id: 'ACCOUNT', label: 'ACCOUNT', icon: User },
          { id: 'NOTIFICATIONS', label: 'NOTIFICATIONS', icon: Bell },
          { id: 'DANGER', label: 'DANGER ZONE', icon: ShieldAlert, color: 'text-deep-red' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`w-full flex items-center justify-between p-4 border-2 border-black font-bold uppercase text-[10px] tracking-widest transition-all shadow-hard ${
              activeTab === tab.id ? 'bg-black text-ivory translate-x-1 -translate-y-1' : 'bg-ivory hover:bg-black/5'
            } ${tab.color || ''}`}
          >
            <div className="flex items-center gap-3">
              <tab.icon size={14} /> {tab.label}
            </div>
            <ChevronRight size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-20'} />
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-grow bg-ivory border-2 border-black p-8 lg:p-12 shadow-hard space-y-12">
        {activeTab === 'BRAIN' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-4">
             <div className="space-y-2">
               <h3 className="text-4xl font-display uppercase tracking-tighter">YOUR BRAND BRAIN</h3>
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">This is what Vega knows about you. Keep it sharp.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Brand Name</label>
                   <input value={brandName} onChange={e => setBrandName(e.target.value)} className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:bg-amber/10 focus:outline-none" />
                </div>
                <div className="space-y-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Tagline</label>
                   <input value={tagline} onChange={e => setTagline(e.target.value)} className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:bg-amber/10 focus:outline-none" />
                </div>
                <div className="space-y-2 md:col-span-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">What do you sell?</label>
                   <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:bg-amber/10 focus:outline-none resize-none" />
                </div>
                <div className="space-y-2 md:col-span-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Target Audience</label>
                   <textarea rows={3} value={audience} onChange={e => setAudience(e.target.value)} className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:bg-amber/10 focus:outline-none resize-none" />
                </div>
             </div>

             <div className="space-y-4">
                <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Brand Tone / Styles</label>
                <div className="flex flex-wrap gap-2">
                   {styles.map(s => (
                     <button 
                      key={s} 
                      onClick={() => toggleStyle(s)}
                      className={`px-4 py-2 border-2 border-black font-bold uppercase text-[8px] tracking-widest transition-all ${
                        selectedStyles.includes(s) ? 'bg-black text-ivory' : 'bg-white hover:bg-black/5'
                      }`}
                     >
                       {s}
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-8 border-t-2 border-black/10">
               <button onClick={handleSaveBrain} className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all">
                 SAVE BRAIN CHANGES
               </button>
               <p className="text-[7px] font-bold uppercase tracking-widest opacity-20 mt-4 italic">Updating your brain improves future workspace accuracy instantly.</p>
             </div>
          </div>
        )}

        {activeTab === 'ACCOUNT' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-4">
             <div className="flex items-start justify-between">
                <div className="space-y-2">
                   <h3 className="text-4xl font-display uppercase tracking-tighter">ACCOUNT CONTROL</h3>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Full Name</label>
                   <input defaultValue="VEGA USER" className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:outline-none" />
                </div>
                <div className="space-y-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Email Address</label>
                   <input defaultValue="mnaeel381@gmail.com" className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-xs tracking-widest focus:outline-none opacity-40 cursor-not-allowed" disabled />
                </div>
             </div>

             <div className="space-y-6 pt-12 border-t-2 border-black/10">
                <h4 className="text-xl font-display uppercase tracking-widest">CHANGE PASSWORD</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <input type="password" placeholder="CURRENT PASSWORD" className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-[10px] tracking-widest focus:outline-none" />
                   <input type="password" placeholder="NEW PASSWORD" className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-[10px] tracking-widest focus:outline-none" />
                   <input type="password" placeholder="CONFIRM NEW" className="w-full bg-white border-2 border-black p-4 font-bold uppercase text-[10px] tracking-widest focus:outline-none" />
                </div>
             </div>

             <button className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all">
                UPDATE PROFILE
             </button>
          </div>
        )}



        {activeTab === 'NOTIFICATIONS' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-4">
             <div className="space-y-2">
               <h3 className="text-4xl font-display uppercase tracking-tighter">PREFERENCES</h3>
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Choose how Vega speaks to you across the lifecycle.</p>
             </div>

             <div className="space-y-8">
                {[
                  { key: 'launched', label: 'Workspace Launched', desc: 'Alert when a new workspace enters active status' },
                  { key: 'learning', label: 'Brain Learning Updates', desc: 'Notifications when your brand brain hits a confidence milestone' },
                  { key: 'updates', label: 'Product Updates', desc: 'New feature drops and Vega roadmap news' },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between group">
                     <div className="space-y-1">
                        <span className="text-sm font-bold uppercase tracking-widest group-hover:text-deep-red transition-colors">{n.label}</span>
                        <p className="text-[8px] font-bold uppercase opacity-40">{n.desc}</p>
                     </div>
                     <button 
                      onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !(prev as any)[n.key] }))}
                      className={`w-14 h-8 border-2 border-black transition-all relative ${
                        (notifications as any)[n.key] ? 'bg-amber' : 'bg-black/5'
                      }`}
                     >
                        <div className={`absolute top-1 bottom-1 w-5 bg-black transition-all ${
                          (notifications as any)[n.key] ? 'right-1' : 'left-1'
                        }`} />
                     </button>
                  </div>
                ))}
             </div>

             <button className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all mt-8">
                SAVE PREFERENCES
             </button>
          </div>
        )}

        {activeTab === 'DANGER' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-4">
             <div className="space-y-2">
               <h3 className="text-4xl font-display uppercase tracking-tighter text-deep-red">DANGER ZONE</h3>
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Irreversible actions that scale back your intelligence bank.</p>
             </div>

             <div className="border-4 border-black p-10 bg-deep-red/5 space-y-10 shadow-hard">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="space-y-1">
                      <span className="text-sm font-bold uppercase tracking-widest">RESET BRAND BRAIN</span>
                      <p className="text-[8px] font-bold uppercase opacity-40">Clears all style preferences and historical learning data</p>
                   </div>
                   <button 
                    onClick={() => setShowResetModal(true)}
                    className="border-2 border-deep-red text-deep-red px-6 py-3 font-bold uppercase text-[10px] tracking-widest hover:bg-deep-red hover:text-ivory transition-all shadow-hard"
                   >
                     RESET DATA
                   </button>
                </div>

                <div className="h-[2px] bg-black/10" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="space-y-1">
                      <span className="text-sm font-bold uppercase tracking-widest">DELETE ACCOUNT</span>
                      <p className="text-[8px] font-bold uppercase opacity-40">Permanently remove all data, workspaces and subscription</p>
                   </div>
                   <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="border-2 border-deep-red text-deep-red px-6 py-3 font-bold uppercase text-[10px] tracking-widest hover:bg-deep-red hover:text-ivory transition-all shadow-hard"
                   >
                     TERMINATE ACCESS
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* RESET MODAL */}
        {showResetModal && (
          <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white border-4 border-black p-12 max-w-md w-full shadow-hard-lg text-center">
                <AlertCircle size={48} className="mx-auto mb-8 text-deep-red" />
                <h3 className="text-3xl font-display uppercase tracking-tighter mb-4">BRAIN WIPE?</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-12">This will clear all learned preferences. Your next generation will start from zero.</p>
                <div className="flex flex-col gap-4">
                  <button onClick={() => setShowResetModal(false)} className="w-full py-4 bg-deep-red text-ivory font-bold uppercase text-[10px] tracking-widest shadow-hard">CONFIRM WIPE</button>
                  <button onClick={() => setShowResetModal(false)} className="w-full py-4 border-2 border-black font-bold uppercase text-[10px] tracking-widest shadow-hard">KEEP DATA</button>
                </div>
             </motion.div>
          </div>
        )}

        {/* DELETE MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white border-4 border-black p-12 max-w-md w-full shadow-hard-lg text-center">
                <h3 className="text-3xl font-display uppercase tracking-tighter mb-4">TERMINATE ACCOUNT?</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-8">Type <span className="text-black font-black">DELETE</span> to confirm permanent termination.</p>
                <div className="space-y-6">
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="TYPE DELETE..." className="w-full bg-white border-2 border-black p-5 font-bold uppercase text-[10px] tracking-[0.3em] text-center focus:outline-none" />
                  <button 
                    disabled={deleteConfirm !== 'DELETE'}
                    className={`w-full py-4 font-bold uppercase text-[10px] tracking-widest shadow-hard transition-all ${
                      deleteConfirm === 'DELETE' ? 'bg-deep-red text-ivory hover:bg-black' : 'bg-black/10 text-black/20 cursor-not-allowed'
                    }`}
                  >
                    CONFIRM TERMINATION
                  </button>
                  <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} className="text-[8px] font-bold uppercase tracking-widest opacity-40">Abort Operation</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GalleryPage({ 
  gallery, 
  remixesToday,
  onUpdateGallery,
  onRemix
}: { 
  gallery: GalleryItem[], 
  remixesToday: number,
  onUpdateGallery: (g: GalleryItem[]) => void,
  onRemix: () => void
}) {
  const [filter, setFilter] = useState<'ALL' | 'BOLD & LOUD' | 'CLEAN & MINIMAL' | 'DARK & MOODY' | 'BRIGHT & ENERGETIC' | 'LUXURY' | 'PLAYFUL'>('ALL');
  const [search, setSearch] = useState('');
  const [remixItem, setRemixItem] = useState<GalleryItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewPromptId, setViewPromptId] = useState<string | null>(null);

  const filteredGallery = gallery.filter(item => {
    const matchesFilter = filter === 'ALL' || item.style === filter;
    const matchesSearch = item.prompt.toLowerCase().includes(search.toLowerCase()) || 
                          item.style.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const remixLimits = {
    free: 1000,
    pro: 1000,
    creator: 1000
  };

  const currentLimit = 1000;
  const canRemix = true;

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex-grow max-w-xl relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity" size={20} />
              <input 
                type="text"
                placeholder="SEARCH VISUAL DNA..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-2 border-black p-5 pl-12 font-bold uppercase text-[10px] tracking-widest focus:bg-black/5 focus:outline-none shadow-hard"
              />
           </div>
           
           <button 
             onClick={() => setShowAddModal(true)}
             className="bg-deep-red text-ivory px-10 py-5 font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black transition-all flex items-center gap-3 shrink-0"
           >
             <Plus size={16} /> ADD TO GALLERY
           </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {['ALL', 'BOLD & LOUD', 'CLEAN & MINIMAL', 'DARK & MOODY', 'BRIGHT & ENERGETIC', 'LUXURY', 'PLAYFUL'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-2 border-2 border-black transition-all shadow-hard ${filter === f ? 'bg-black text-ivory' : 'bg-ivory hover:bg-black/5'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
         {filteredGallery.map(item => (
           <div key={item.id} className="bg-ivory border-2 border-black shadow-hard group relative aspect-[4/5] overflow-hidden flex flex-col">
              {/* IMAGE PLACEHOLDER */}
              <div className={`relative flex-grow ${item.color} transition-all duration-700 group-hover:scale-105`}>
                 <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-black text-ivory px-2 py-1 text-[7px] font-bold uppercase tracking-widest border border-ivory/20">
                      {item.style}
                    </span>
                    <span className={`px-2 py-1 text-[7px] font-bold uppercase tracking-widest border border-black/20 ${item.source === 'VEGA' ? 'bg-amber text-black' : 'bg-ivory text-black'}`}>
                      {item.source}
                    </span>
                 </div>

                 {/* HOVER OVERLAY */}
                 <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-300 p-8 flex flex-col justify-center items-center text-center">
                    <p className="text-ivory text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-8 line-clamp-4">
                       {item.prompt}
                    </p>
                    
                    <div className="flex flex-col gap-4 w-full">
                       <button 
                         onClick={() => setRemixItem(item)}
                         className="w-full py-4 bg-deep-red text-ivory font-bold uppercase text-[10px] tracking-widest hover:bg-white hover:text-black transition-all shadow-hard"
                       >
                         REMIX
                       </button>
                       <button 
                         onClick={() => setViewPromptId(item.id)}
                         className="w-full py-4 bg-amber text-black font-bold uppercase text-[10px] tracking-widest hover:bg-ivory transition-all shadow-hard"
                       >
                         VIEW PROMPT
                       </button>
                    </div>
                 </div>
              </div>

              {/* CARD FOOTER (Optional, keeping it clean for brutalist look) */}
              <div className="h-2 bg-black w-full" />
           </div>
         ))}
      </div>


      <AnimatePresence>
        {remixItem && (
          <RemixPanel 
             item={remixItem} 
             onClose={() => setRemixItem(null)} 
             canRemix={canRemix}
             onRemix={onRemix}
          />
        )}
        {showAddModal && (
          <AddToGalleryModal 
             onCancel={() => setShowAddModal(false)}
             onSubmit={(newItem) => {
               onUpdateGallery([newItem, ...gallery]);
               setShowAddModal(false);
             }}
          />
        )}
        {viewPromptId && (
          <ViewPromptModal 
            prompt={gallery.find(g => g.id === viewPromptId)?.prompt || ''} 
            onClose={() => setViewPromptId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RemixPanel({ item, onClose, canRemix, onRemix }: { item: GalleryItem, onClose: () => void, canRemix: boolean, onRemix: () => void }) {
  const [direction, setDirection] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!canRemix) return;
    setIsGenerating(true);
    setTimeout(() => {
      setResult('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop');
      setIsGenerating(false);
      onRemix();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
       <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         onClick={onClose}
         className="absolute inset-0 bg-black/40 backdrop-blur-sm"
       />
       <motion.div 
         initial={{ x: '100%' }}
         animate={{ x: 0 }}
         exit={{ x: '100%' }}
         className="relative w-full max-w-md bg-ivory border-l-4 border-black h-full shadow-hard-lg flex flex-col"
       >
          <div className="p-8 border-b-2 border-black flex justify-between items-center bg-black text-ivory">
             <h3 className="text-3xl font-display tracking-tighter uppercase leading-none">REMIX DNA</h3>
             <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={24} /></button>
          </div>

          <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar">
             <div className="space-y-4">
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Original Inspiration</span>
                <div className={`aspect-square w-full border-2 border-black ${item.color} flex items-center justify-center`}>
                    <p className="px-8 text-center text-[10px] font-bold uppercase tracking-widest opacity-20">{item.prompt}</p>
                </div>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Describe your vibe</label>
                   <textarea 
                     rows={4}
                     value={direction}
                     onChange={(e) => setDirection(e.target.value)}
                     placeholder="E.G. MORE NEON, BRUTALIST ARCHITECTURE, SUNSET PALETTE..."
                     className="w-full bg-transparent border-2 border-black p-4 font-bold uppercase text-[10px] tracking-widest focus:bg-black/5 focus:outline-none shadow-hard resize-none"
                   />
                </div>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-40 leading-relaxed italic">
                  Your brand brain will handle the rest. Vega merges the inspiration with your active style guide.
                </p>
                
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !canRemix}
                  className={`w-full py-6 font-bold uppercase tracking-[0.3em] text-xs transition-all shadow-hard flex items-center justify-center gap-3 ${
                    !canRemix ? 'bg-black/10 text-black/40 cursor-not-allowed' : 
                    isGenerating ? 'bg-black text-ivory' : 'bg-deep-red text-ivory hover:bg-black'
                  }`}
                >
                  {isGenerating ? <RefreshCcw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isGenerating ? 'FUSING DNA...' : 'GENERATE REMIX'}
                </button>
                
                {!canRemix && (
                  <div className="p-4 border-2 border-black bg-amber/10 flex items-start gap-4 animate-in slide-in-from-top-4">
                     <AlertCircle size={20} className="shrink-0 text-deep-red" />
                     <div className="space-y-1 text-left">
                        <p className="text-[10px] font-bold uppercase leading-tight">Generation Error</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 leading-relaxed">Vega encountered an issue with this request. Please try a different vibe.</p>
                     </div>
                  </div>
                )}
             </div>

             {result && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-10 border-t-2 border-black/10">
                  <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Result</span>
                  <div className="aspect-square w-full border-2 border-black bg-black relative group overflow-hidden">
                     <img src={result} className="w-full h-full object-cover opacity-80" />
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm pointer-events-none">
                        <Check size={40} className="text-ivory" />
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <button className="flex-grow py-4 bg-black text-ivory font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-amber hover:text-black">Save to Assets</button>
                     <button className="flex-grow py-4 border-2 border-black font-bold uppercase text-[10px] tracking-widest shadow-hard hover:bg-black hover:text-ivory">Add to Workspace</button>
                  </div>
               </motion.div>
             )}
          </div>
       </motion.div>
    </div>
  );
}

function AddToGalleryModal({ onCancel, onSubmit }: { onCancel: () => void, onSubmit: (item: GalleryItem) => void }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('BOLD & LOUD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!prompt) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit({
        id: Math.random().toString(36).substr(2, 9),
        source: 'COMMUNITY',
        style,
        prompt,
        color: 'bg-ivory'
      });
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[210] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-ivory border-4 border-black p-12 max-w-xl w-full shadow-hard-lg"
      >
        <div className="flex justify-between items-start mb-12">
           <h3 className="text-4xl font-display uppercase tracking-tighter">SUBMIT TO DNA BANK</h3>
           <button onClick={onCancel} className="hover:rotate-90 transition-transform"><X size={24} /></button>
        </div>

        <div className="space-y-8 text-left">
           <div className="border-4 border-dashed border-black/10 py-16 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition-all">
              <Upload size={32} className="opacity-20 mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">DROP YOUR IMAGE HERE</p>
           </div>

           <div className="space-y-2">
              <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">What was the prompt? (Required)</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="DESCRIBE THE VISUAL SO OTHERS CAN REMIX IT..."
                className="w-full bg-transparent border-2 border-black p-4 font-bold uppercase text-[10px] tracking-widest focus:bg-black/5 focus:outline-none shadow-hard resize-none"
              />
           </div>

           <div className="space-y-4">
              <label className="text-[8px] font-bold uppercase tracking-widest opacity-40">Visual Category</label>
              <div className="grid grid-cols-2 gap-3">
                 {['BOLD & LOUD', 'CLEAN & MINIMAL', 'DARK & MOODY', 'BRIGHT & ENERGETIC', 'LUXURY', 'PLAYFUL'].map(s => (
                   <button 
                     key={s}
                     onClick={() => setStyle(s)}
                     className={`py-3 border-2 border-black font-bold uppercase text-[8px] tracking-widest transition-all shadow-hard ${style === s ? 'bg-black text-ivory' : 'bg-ivory hover:bg-black/5'}`}
                   >
                     {s}
                   </button>
                 ))}
              </div>
           </div>

           <button 
             onClick={handleSubmit}
             disabled={isSubmitting || !prompt}
             className={`w-full py-6 font-bold uppercase tracking-[0.3em] text-sm shadow-hard flex items-center justify-center gap-3 transition-all mt-4 ${
               isSubmitting || !prompt ? 'bg-black/10 text-black/40 cursor-not-allowed' : 'bg-deep-red text-ivory hover:bg-black'
             }`}
           >
              {isSubmitting ? <RefreshCcw size={18} className="animate-spin" /> : 'SUBMIT TO GALLERY'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function ViewPromptModal({ prompt, onClose }: { prompt: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[220] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-ivory border-4 border-black p-12 max-w-lg w-full shadow-hard-lg"
      >
        <div className="flex justify-between items-start mb-8">
           <h3 className="text-3xl font-display uppercase tracking-tighter">VISUAL PROMPT</h3>
           <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={24} /></button>
        </div>
        <div className="bg-black text-ivory p-8 border-l-[12px] border-amber font-mono text-sm leading-relaxed uppercase tracking-tighter">
           {prompt}
        </div>
        <button 
          onClick={() => { navigator.clipboard.writeText(prompt); onClose(); }}
          className="w-full mt-8 py-4 border-2 border-black font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-black hover:text-ivory transition-all shadow-hard"
        >
          Copy Prompt
        </button>
      </motion.div>
    </div>
  );
}

function DashboardPlaceholder({ 
  campaigns, 
  setCampaigns,
  assets,
  setAssets,
  gallery,
  setGallery,
  remixesToday,
  setRemixesToday,
  onboardingData, 
  setOnboardingData,
  onNewCampaign, 
  onLogout,
  activeTab: passedActiveTab,
  setActiveTab: passedSetActiveTab
}: { 
  campaigns: Campaign[];
  setCampaigns: (c: Campaign[] | ((prev: Campaign[]) => Campaign[])) => void;
  assets: Asset[];
  setAssets: (a: Asset[] | ((prev: Asset[]) => Asset[])) => void;
  gallery: GalleryItem[];
  setGallery: (g: GalleryItem[] | ((prev: GalleryItem[]) => GalleryItem[])) => void;
  remixesToday: number;
  setRemixesToday: (n: number | ((prev: number) => number)) => void;
  onboardingData: any;
  setOnboardingData: (d: any) => void;
  onNewCampaign: () => void;
  onLogout: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState('Dashboard');
  const activeTab = passedActiveTab ?? localActiveTab;
  const setActiveTab = passedSetActiveTab ?? setLocalActiveTab;
  const [labDirection, setLabDirection] = useState('');
  const [labResult, setLabResult] = useState<string | null>(null);
  const [isGeneratingLab, setIsGeneratingLab] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      if (!auth.currentUser) return;
      
      setIsFetching(true);
      try {
        const q = query(
          collection(db, "users", auth.currentUser.uid, "campaigns"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedCampaigns: Campaign[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const pack = data.contentPack;
          const content: CampaignContent[] = [];
          
          if (pack) {
            if (pack.tweets) pack.tweets.forEach((t: string, i: number) => content.push({ id: `t-${i}-${doc.id}`, type: 'tweet', platform: 'x', body: t }));
            if (pack.linkedin) content.push({ id: `li-${doc.id}`, type: 'linkedin', platform: 'linkedin', body: pack.linkedin });
            if (pack.reelScript) content.push({ id: `reel-${doc.id}`, type: 'reel', platform: 'tiktok', body: `HOOK: ${pack.reelScript.hook}\n\nBODY: ${pack.reelScript.body}\n\nCTA: ${pack.reelScript.cta}` });
            if (pack.memeCopy) content.push({ id: `meme-${doc.id}`, type: 'meme', platform: 'all', body: `TOP: ${pack.memeCopy.topText}\n\nBOTTOM: ${pack.memeCopy.bottomText}` });
            if (pack.email) content.push({ id: `email-${doc.id}`, type: 'email', platform: 'all', body: pack.email.body, subject: pack.email.subject });
          }

          return {
            id: doc.id,
            name: data.name || data.campaignInput?.substring(0, 30).toUpperCase() || "UNTITLED WORKSPACE",
            platforms: ['x', 'linkedin', 'tiktok', 'email'],
            status: data.status || 'active',
            progress: 100,
            contentCount: content.length,
            duration: data.duration || '1',
            createdAt: data.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() || 'RECENT',
            brief: data.brief || data.campaignInput || '',
            content: content
          };
        });
        setCampaigns(fetchedCampaigns);
      } catch (err) {
        console.error("Error fetching campaigns:", err);
      } finally {
        setIsFetching(false);
      }
    }

    fetchCampaigns();
  }, [auth.currentUser, setCampaigns]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const stats = [
    { label: 'Total Content', value: campaigns.reduce((acc, c) => acc + c.contentCount, 0).toString() },
    { label: 'Active Workspaces', value: campaigns.filter(c => c.status === 'active').length.toString() }
  ];

  const handleGenerateLab = () => {
    setIsGeneratingLab(true);
    setTimeout(() => {
      setLabResult('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop');
      setIsGeneratingLab(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r-2 border-black flex flex-col bg-ivory h-screen sticky top-0 z-30">
        <div className="h-20 border-b-2 border-black flex items-center px-4 overflow-hidden shrink-0">
           <img src="/logo.png" alt="VEGA AI" className="h-[250px] w-[200px] pl-0 -ml-[35px] object-contain shrink-0" />
        </div>
        <nav className="flex-grow py-8 flex flex-col overflow-y-auto">
          {['Dashboard', 'Workspaces', 'Workstation', 'Settings'].map(it => (
            <button 
              key={it} 
              onClick={() => setActiveTab(it)}
              className={`w-full text-left p-6 font-bold uppercase text-[10px] tracking-widest transition-colors border-b border-black/5 last:border-0 flex items-center gap-4 ${activeTab === it ? 'bg-amber' : 'hover:bg-black/5'}`}
            >
              {it === 'Dashboard' && <Layout size={16} />}
              {it === 'Workspaces' && <Briefcase size={16} />}
              {it === 'Workstation' && <Sparkles size={16} />}
              {it === 'Settings' && <Settings size={16} />}
              {it}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-black/10">
          <button 
            onClick={onLogout}
            className="w-full text-left font-bold uppercase text-[10px] tracking-widest hover:text-deep-red transition-colors flex items-center gap-2"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-10 overflow-y-auto h-screen bg-white ring-1 ring-black/5">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">
              {onboardingData?.brandName || 'VEGA AI'} / {activeTab}
            </p>
            <h1 className="text-7xl lg:text-8xl font-display tracking-tighter leading-none uppercase">
                {activeTab === 'Workspaces' ? 'YOUR WORKSPACES' :
                 activeTab === 'Workstation' ? 'WORKSTATION' :
                 activeTab === 'Settings' ? 'SETTINGS' :
                 'COMMAND CENTER'}
            </h1>
          </div>
          {(activeTab === 'Dashboard' || activeTab === 'Workspaces') && (
            <button 
                onClick={onNewCampaign}
                className="bg-deep-red text-ivory px-8 py-5 font-bold uppercase text-xs tracking-widest shadow-hard hover:bg-black transition-all flex items-center gap-3 group"
            >
                <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                New Workspace
            </button>
          )}
        </header>

        {activeTab === 'Dashboard' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {stats.map((s, i) => (
                <div key={i} className="border-2 border-black p-6 shadow-hard bg-ivory">
                  <p className="text-[8px] font-bold uppercase tracking-widest mb-2 opacity-50">{s.label}</p>
                  <p className="text-4xl font-display">{s.value}</p>
                </div>
              ))}
              <div className="border-2 border-black p-6 shadow-hard bg-amber">
                <p className="text-[8px] font-bold uppercase tracking-widest mb-2 opacity-50">Content Strategy</p>
                <p className="text-[10px] font-bold uppercase leading-tight">
                  {onboardingData?.tone || 'BOLD'} VOICE ACTIVE
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              <div className="lg:col-span-2 space-y-8">
                {isFetching ? (
                  <div className="bg-ivory border-2 border-black p-12 shadow-hard h-[500px] flex items-center justify-center">
                     <RefreshCcw size={40} className="animate-spin text-black opacity-20" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="bg-ivory border-2 border-black p-12 shadow-hard h-[500px] flex flex-col items-center justify-center text-center">
                     <div className="w-20 h-20 bg-amber border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center mb-8 rotate-12">
                       <Send className="text-black" />
                     </div>
                     <h3 className="text-4xl font-display mb-4">NO ACTIVE WORKSPACES</h3>
                     <p className="text-sm font-bold uppercase tracking-widest text-black/40 max-w-sm leading-relaxed px-4 text-center">
                       You haven't launched anything yet. Your AI brain is waiting for the first direction.
                     </p>
                     <button 
                      onClick={onNewCampaign}
                      className="mt-8 border-2 border-black px-6 py-3 font-bold uppercase text-[10px] tracking-widest hover:bg-black hover:text-ivory transition-all"
                     >
                       Start Your First Workspace
                     </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {campaigns.filter(c => c.status === 'active').slice(0, 4).map(c => (
                      <div key={c.id} className="border-2 border-black p-8 bg-ivory shadow-hard relative group">
                        <div className="absolute top-4 right-4 flex gap-1">
                          {c.platforms.includes('x') && <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center"><Zap size={8} className="text-ivory" /></div>}
                          {c.platforms.includes('linkedin') && <div className="w-4 h-4 bg-blue-600 rounded-full" />}
                        </div>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-deep-red mb-2 block">{c.status}</span>
                        <h4 className="text-2xl font-display mb-4">{c.name}</h4>
                        <div className="space-y-4">
                          <div className="w-full h-1 bg-black/10">
                            <div className="h-full bg-black transition-all" style={{ width: `${c.progress}%` }} />
                          </div>
                          <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest opacity-40">
                            <span>{c.contentCount} PIECES</span>
                            <span>{c.duration === 'unlimited' ? 'UNLIMITED' : `${c.duration} DAYS`}</span>
                          </div>
                        </div>
                        <button onClick={() => setActiveTab('Workspaces')} className="mt-8 w-full border border-black p-3 font-bold uppercase text-[8px] tracking-widest hover:bg-amber transition-colors">
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-8">
                <div className="bg-amber border-2 border-black p-8 shadow-hard relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 translate-x-12 -translate-y-12 rotate-45" />
                   <h4 className="text-xl font-display mb-4 relative z-10">BRAIN STATE</h4>
                   <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-relaxed relative z-10 space-y-2">
                     <p className="flex justify-between border-b border-black/5 pb-1"><span>Tone:</span> <span>{onboardingData?.tone || 'Bold'}</span></p>
                     <p className="flex justify-between border-b border-black/5 pb-1"><span>Platforms:</span> <span>{onboardingData?.platforms?.length || 0} Connected</span></p>
                     <p className="flex justify-between border-b border-black/5 pb-1"><span>Status:</span> <span className="text-deep-red">Active</span></p>
                     <p className="flex justify-between"><span>Last Feed:</span> <span>Just Now</span></p>
                   </div>
                </div>
                
                <div className="bg-white border-2 border-black p-8 shadow-hard">
                   <h4 className="text-xl font-display mb-4">QUICK TIPS</h4>
                   <ul className="space-y-6">
                     {[
                       "Deploy your first workspace and your agents activate immediately.",
                       "Approve content fast — your Scout is already watching competitors.",
                       "Connect Discord or Telegram in Settings to receive your content."
                     ].map((tip, it) => (
                       <li key={it} className="flex gap-4 text-[10px] font-bold uppercase tracking-tight leading-snug">
                         <span className="text-deep-red text-lg leading-none shrink-0 italic font-serif">†</span>
                         {tip}
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'Workspaces' && (
          <CampaignsPage 
            campaigns={campaigns} 
            onNewCampaign={onNewCampaign} 
            onUpdateCampaigns={setCampaigns}
            isLoading={isFetching}
          />
        )}

        {activeTab === 'Workstation' && (
          <div className="border-2 border-black p-12 bg-ivory shadow-hard min-h-[500px] flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-amber border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center mb-8 rotate-3">
               <Sparkles className="text-black animate-pulse" size={32} />
             </div>
             <h3 className="text-4xl font-display mb-4 text-black animate-pulse">AGENT WORKSTATION</h3>
             <p className="text-sm font-bold uppercase tracking-widest text-black/40 max-w-sm leading-relaxed px-4 text-center">
               Your agents (Brand Agent, Content Agent, and Scout Agent) are currently in synchronization. Approve and review your raw brand ideas right here.
             </p>
          </div>
        )}

        {activeTab === 'Settings' && (
          <SettingsPage 
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
          />
        )}
      </main>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] px-12 py-6 border-4 border-black font-display text-2xl uppercase tracking-tighter shadow-hard-lg flex items-center gap-6 ${
              showToast.type === 'success' ? 'bg-amber text-black' : 'bg-deep-red text-ivory'
            }`}
          >
             <Sparkles size={24} className="animate-pulse" />
             {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
