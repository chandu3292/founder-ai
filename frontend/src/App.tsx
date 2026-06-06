import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2, Mic, PhoneOff, Send, Trash2, X, ArrowRight, Sparkles,
  FlaskConical, Cpu, Code2, Award, Mail, Phone, Github, MapPin, GraduationCap, BookOpen,
} from 'lucide-react';
import { Room, createLocalAudioTrack, RoomEvent, Track } from 'livekit-client';
import './index.css';

interface Persona { id: string; name: string; language: string; description: string; }
interface Caption { id: string; role: 'you' | 'agent'; text: string; final: boolean; }

const NAME = 'Chandra Sekhar Karri';
const ROLE = 'AI Engineer & Researcher';
const SUGGESTIONS = ['Who is Chandra and what does he do?', 'Tell me about his research', 'What has he built?', 'Book a meeting with him'];

const FACTS = [
  { k: '8.98', v: 'CGPA · B.Tech IT' },
  { k: '1', v: 'Published paper' },
  { k: '4+', v: 'Shipped projects' },
  { k: '300+', v: 'Students taught' },
];
const PROJECTS = [
  { Icon: FlaskConical, tag: 'Research', title: 'NoveltyNet', body: 'Multi-dimensional novelty detection using SBERT, HDBSCAN and citation-graph reasoning across a 50K-plus paper dataset.' },
  { Icon: Cpu, tag: 'Voice AI', title: 'Multilingual Voice Agent', body: 'Real-time LiveKit agent (English, Telugu, Tamil) with sub-second latency, RAG Q&A and Google Calendar booking.' },
  { Icon: Code2, tag: 'RAG', title: 'DocQuery', body: 'Document intelligence over scanned files: hybrid OCR plus Sentence-Transformer retrieval, 41 percent better relevance.' },
  { Icon: Award, tag: 'Optimisation', title: 'Timetable Generator', body: 'Conflict-free academic scheduling with genetic algorithms, 92 percent faster, on Django and PostgreSQL.' },
];
const EXPERIENCE = [
  { when: '2025 — now', role: 'Full Stack Developer Intern', org: 'Coastal Seven Consulting, Hyderabad', body: 'GraphQL APIs (Strawberry + FastAPI), Google OAuth and Drive integration, automated podcast publishing that cut manual work 95 percent.' },
  { when: '2023 — 2025', role: 'Research Assistant', org: 'Dept. of IT, ANITS', body: 'Built NoveltyNet and RAG document pipelines; improved minority-class F1 by 15 percent; taught ML/DL labs to 150-plus students.' },
  { when: '2024', role: 'Data Science Intern', org: 'Oasis Infobyte (Remote)', body: 'Trained and benchmarked Random Forest, Regression and SVM models reaching 94 to 97 percent accuracy on multi-domain tasks.' },
];
const SKILLS = ['Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'React', 'Django', 'LangChain', 'LiveKit', 'RAG', 'NLP', 'SBERT', 'FAISS', 'Docker', 'PostgreSQL', 'GraphQL'];

const App: React.FC = () => {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'voice' | 'chat'>('voice');
  const [photoOk, setPhotoOk] = useState(true);

  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string; time?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState('sophia');

  const [status, setStatus] = useState('Tap to talk');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [timer, setTimer] = useState(0);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const roomRef = useRef<Room | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { fetchPersonas(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, isSending]);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    if (isConnected) id = setInterval(() => setTimer(t => t + 1), 1000); else setTimer(0);
    return () => { if (id) clearInterval(id); };
  }, [isConnected]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const fetchPersonas = async () => {
    try { const r = await fetch('/api/personas'); const d = await r.json(); setPersonas(d.personas || []); setSelectedPersona(d.active_persona_id || 'sophia'); } catch (e) { console.error(e); }
  };
  const handlePersonaChange = async (id: string) => {
    setSelectedPersona(id);
    try { await fetch('/api/set-persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: id }) }); } catch (e) { console.error(e); }
  };
  const sendMessage = async (preset?: string) => {
    const message = (preset ?? chatInput).trim(); if (!message || isSending) return;
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatInput(''); setChatMessages(p => [...p, { role: 'user', text: message, time: t }]); setIsSending(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, session_id: sessionId }) });
      const d = await r.json();
      const rt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(p => [...p, { role: 'assistant', text: d.status === 'success' ? d.response : `Error: ${d.message}`, time: rt }]);
    } catch (err) { console.error(err); setChatMessages(p => [...p, { role: 'assistant', text: 'Something went wrong. Please try again.', time: '' }]); }
    finally { setIsSending(false); inputRef.current?.focus(); }
  };
  const clearChat = async () => {
    setChatMessages([]);
    try { await fetch('/api/chat/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }); } catch (e) { console.error(e); }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const startReactive = (track: MediaStreamTrack) => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.min(1, (sum / data.length) / 90);
        if (orbRef.current) orbRef.current.style.setProperty('--level', level.toFixed(3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { console.error('reactive audio failed', e); }
  };
  const stopReactive = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (orbRef.current) orbRef.current.style.setProperty('--level', '0');
    audioCtxRef.current?.close().catch(() => {}); audioCtxRef.current = null;
  };

  const startConversation = async () => {
    if (isConnecting || isConnected) return;
    if (roomRef.current) { await roomRef.current.disconnect(); roomRef.current = null; }
    setIsConnecting(true); setStatus('Connecting…'); setCaptions([]);
    try {
      const res = await fetch(`/token?persona=${selectedPersona}`);
      const { token, url } = await res.json();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const audio = track.attach(); audio.volume = 1.0; audio.setAttribute('autoplay', 'true'); document.body.appendChild(audio);
          const mst = (track as any).mediaStreamTrack as MediaStreamTrack | undefined;
          if (mst) startReactive(mst);
        }
      });
      room.on(RoomEvent.TranscriptionReceived, (segments: any[], participant: any) => {
        const isAgent = participant?.identity !== 'web-user';
        setCaptions(prev => {
          const next = [...prev];
          for (const s of segments) {
            const role: 'you' | 'agent' = isAgent ? 'agent' : 'you';
            const idx = next.findIndex(c => c.id === s.id);
            if (idx >= 0) next[idx] = { id: s.id, role, text: s.text, final: s.final }; else next.push({ id: s.id, role, text: s.text, final: s.final });
          }
          return next.slice(-6);
        });
      });
      room.on(RoomEvent.Disconnected, () => { setIsConnected(false); setStatus('Tap to talk'); roomRef.current = null; stopReactive(); });
      await room.connect(url, token);
      roomRef.current = room; setIsConnected(true); setStatus('Listening…');
      const mic = await createLocalAudioTrack(); await room.localParticipant.publishTrack(mic);
    } catch (err) { console.error(err); setStatus('Connection failed — tap to retry'); }
    finally { setIsConnecting(false); }
  };
  const disconnectRoom = async () => {
    if (roomRef.current) await roomRef.current.disconnect();
    setIsConnected(false); setStatus('Tap to talk'); roomRef.current = null; stopReactive();
  };

  const openAI = (mode: 'voice' | 'chat') => { setAiMode(mode); setAiOpen(true); };
  const closeAI = () => { setAiOpen(false); if (isConnected) disconnectRoom(); };
  const orbAction = isConnected ? disconnectRoom : startConversation;
  const liveCaptions = captions.filter(c => c.text.trim());

  const Portrait = ({ cls }: { cls: string }) =>
    photoOk ? <img src="/founder.jpg" alt={NAME} className={cls} onError={() => setPhotoOk(false)} />
            : <span className={`${cls} portrait-fallback`}>CK</span>;

  return (
    <div className="site">
      <div className="bg-aura" aria-hidden />
      <div className="bg-mesh" aria-hidden />

      {/* ---- nav ---- */}
      <header className="nav">
        <a className="brand" href="#top"><img src="/founder-mark.svg" alt="" /><span>Chandra <b>Karri</b></span></a>
        <nav className="nav-links">
          <a href="#about">About</a><a href="#work">Work</a><a href="#path">Experience</a><a href="#contact">Contact</a>
        </nav>
        <button className="nav-cta" onClick={() => openAI('voice')}><Sparkles size={15} /> Talk to my AI</button>
      </header>

      <main id="top">
        {/* ---- hero ---- */}
        <section className="hero">
          <div className="hero-left">
            <div className="eyebrow"><span className="dot" /> {ROLE}</div>
            <h1>Hi, I&rsquo;m <span className="grad">Chandra</span>.<br />I build intelligent systems.</h1>
            <p>Research-focused AI engineer specializing in novelty detection, retrieval-augmented generation and NLP, with published research and production engineering experience.</p>
            <div className="hero-meta"><MapPin size={14} /> Visakhapatnam, India</div>
            <div className="hero-cta">
              <button className="btn-primary" onClick={() => openAI('voice')}><Mic size={16} /> Talk to my AI</button>
              <button className="btn-ghost" onClick={() => openAI('chat')}>Ask about me <ArrowRight size={15} /></button>
              <a className="btn-ghost" href="https://github.com/chandu3292" target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>
            </div>
            <div className="facts">{FACTS.map(f => <div key={f.v} className="fact"><span className="fact-k">{f.k}</span><span className="fact-v">{f.v}</span></div>)}</div>
          </div>
          <div className="hero-right">
            <div className="portrait-wrap">
              <span className="portrait-glow" aria-hidden />
              <Portrait cls="portrait" />
              <button className="portrait-badge" onClick={() => openAI('voice')}><Sparkles size={13} /> Talk to my AI</button>
            </div>
          </div>
        </section>

        {/* ---- about ---- */}
        <section className="about" id="about">
          <img src="/research-graph.svg" className="about-bg" alt="" aria-hidden />
          <span className="kicker">About</span>
          <h2>An engineer who ships, and a researcher who measures.</h2>
          <p>I work across the full stack of intelligent systems, from designing and evaluating ML and DL architectures to building real-time, production-grade products. My research focuses on novelty detection, retrieval-augmented generation and NLP, grounded in careful experimental design and reproducible evaluation.</p>
          <div className="about-cards">
            <div className="ac"><GraduationCap size={18} /><h4>Education</h4><p>B.Tech, Information Technology, ANITS. Expected 2026. CGPA 8.98 / 10.</p></div>
            <div className="ac"><BookOpen size={18} /><h4>Publication</h4><p>Deep Learning and Generative AI for Drug Discovery, IRPJR 2025 (in press).</p></div>
          </div>
        </section>

        {/* ---- work ---- */}
        <section className="work" id="work">
          <span className="kicker">Selected work</span>
          <h2>Things I&rsquo;ve built.</h2>
          <div className="work-grid">
            {PROJECTS.map(({ Icon, tag, title, body }) => (
              <article className="card" key={title}>
                <div className="card-ic"><Icon size={18} /></div>
                <span className="card-tag">{tag}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---- experience ---- */}
        <section className="path" id="path">
          <span className="kicker">Experience</span>
          <h2>Where I&rsquo;ve worked.</h2>
          <div className="timeline">
            {EXPERIENCE.map(e => (
              <div className="tl-item" key={e.role + e.when}>
                <div className="tl-when">{e.when}</div>
                <div className="tl-body"><h3>{e.role}</h3><span className="tl-org">{e.org}</span><p>{e.body}</p></div>
              </div>
            ))}
          </div>
          <div className="skills">{SKILLS.map(s => <span key={s} className="skill">{s}</span>)}</div>
        </section>

        {/* ---- contact ---- */}
        <footer className="contact" id="contact">
          <span className="kicker">Get in touch</span>
          <h2>Let&rsquo;s talk.<br />Or just <span className="grad">ask my AI</span>.</h2>
          <div className="contact-grid">
            <a href="mailto:karrichandu03@gmail.com"><Mail size={16} /> karrichandu03@gmail.com</a>
            <a href="tel:+919390694802"><Phone size={16} /> +91 93906 94802</a>
            <a href="https://github.com/chandu3292" target="_blank" rel="noreferrer"><Github size={16} /> github.com/chandu3292</a>
            <button onClick={() => openAI('voice')}><Sparkles size={16} /> Book a meeting via my AI</button>
          </div>
          <div className="foot-bottom"><span>© 2026 {NAME}</span><span className="muted">AI voice portfolio · built with LiveKit</span></div>
        </footer>
      </main>

      {/* ---- floating AI launcher ---- */}
      {!aiOpen && (
        <button className="ai-launch" onClick={() => openAI('voice')} aria-label="Talk to my AI">
          <Sparkles size={20} /><span>Talk to my AI</span>
        </button>
      )}

      {/* ---- AI modal ---- */}
      {aiOpen && (
        <div className="ai-overlay" onClick={closeAI}>
          <div className="ai-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-head">
              <div className="ai-title"><Sparkles size={15} /> Chandra&rsquo;s AI</div>
              <div className="ai-tools">
                <div className="ai-modes">
                  <button className={aiMode === 'voice' ? 'on' : ''} onClick={() => setAiMode('voice')}>Voice</button>
                  <button className={aiMode === 'chat' ? 'on' : ''} onClick={() => setAiMode('chat')}>Chat</button>
                </div>
                <select value={selectedPersona} onChange={e => handlePersonaChange(e.target.value)} disabled={isConnected}>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name} · {p.language.toUpperCase()}</option>)}
                </select>
                <button className="ai-close" onClick={closeAI}><X size={18} /></button>
              </div>
            </div>

            {aiMode === 'voice' ? (
              <div className="ai-voice">
                <div ref={orbRef} className={`orb-stage ${isConnected ? 'live' : ''} ${isConnecting ? 'busy' : ''}`}>
                  <span className="orb-glow" aria-hidden />
                  <span className="orb-ring r1" aria-hidden /><span className="orb-ring r2" aria-hidden /><span className="orb-ring r3" aria-hidden />
                  <button className="orb" onClick={orbAction} disabled={isConnecting}>
                    <span className="orb-face">{isConnecting ? <Loader2 className="spin" size={32} /> : isConnected ? <PhoneOff size={30} /> : <Mic size={34} />}</span>
                  </button>
                  {isConnected && <div className="wave" aria-hidden>{Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ '--n': i } as React.CSSProperties} />)}</div>}
                </div>
                <div className="ai-status">{isConnected ? 'Listening…' : status}</div>
                {isConnected && <div className="timer">{formatTime(timer)}</div>}
                {isConnected && liveCaptions.length > 0 && (
                  <div className="captions">{liveCaptions.map(c => (
                    <div key={c.id} className={`cap ${c.role} ${c.final ? '' : 'interim'}`}><span className="cap-who">{c.role === 'you' ? 'You' : 'AI'}</span><span className="cap-txt">{c.text}</span></div>
                  ))}</div>
                )}
                {!isConnected && !isConnecting && <p className="ai-hint">Ask about my research and projects, or book a meeting. English, Hindi or Telugu.</p>}
                {isConnected && <button className="hang" onClick={disconnectRoom}>End conversation</button>}
              </div>
            ) : (
              <div className="ai-chat">
                <div className="chat-scroll">
                  {chatMessages.length === 0 ? (
                    <div className="chat-intro">
                      <p className="chat-hi">Hi, I&rsquo;m Chandra&rsquo;s AI. Ask me anything about him.</p>
                      <div className="suggests">{SUGGESTIONS.map(s => <button key={s} onClick={() => sendMessage(s)} disabled={isSending}>{s}</button>)}</div>
                    </div>
                  ) : (<>
                    {chatMessages.map((m, i) => (<div key={i} className={`msg ${m.role}`}><div className="bubble">{m.text}</div>{m.time && <span className="ts">{m.time}</span>}</div>))}
                    {isSending && <div className="msg assistant"><div className="bubble typing"><span /><span /><span /></div></div>}
                  </>)}
                  <div ref={chatEndRef} />
                </div>
                <div className="composer">
                  {chatMessages.length > 0 && <button className="icon-btn" onClick={clearChat} title="Clear"><Trash2 size={16} /></button>}
                  <textarea ref={inputRef} placeholder="Ask about Chandra…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} disabled={isSending} />
                  <button className="send" onClick={() => sendMessage()} disabled={isSending || !chatInput.trim()}>{isSending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
