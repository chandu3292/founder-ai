import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Mic, PhoneOff, Send, Trash2, X, ArrowUpRight, ArrowDown, Sparkles } from 'lucide-react';
import { Room, createLocalAudioTrack, RoomEvent, Track } from 'livekit-client';
import './index.css';

interface Persona { id: string; name: string; language: string; description: string; }
interface Caption { id: string; role: 'you' | 'agent'; text: string; final: boolean; }

const NAME = 'Chandra Sekhar Karri';
const SUGGESTIONS = ['Who is Chandra and what does he do?', 'Tell me about his research', 'What has he built?', 'Book a meeting with him'];

const PROJECTS = [
  { no: '01', tag: 'Research', title: 'NoveltyNet', body: 'Multi-dimensional novelty detection using SBERT, HDBSCAN and citation-graph reasoning across a 50K-plus paper dataset.' },
  { no: '02', tag: 'Voice AI', title: 'Multilingual Voice Agent', body: 'Real-time LiveKit agent in English, Telugu and Tamil with sub-second latency, RAG Q&A and Google Calendar booking.' },
  { no: '03', tag: 'RAG', title: 'DocQuery', body: 'Document intelligence over scanned files with a hybrid OCR pipeline and Sentence-Transformer retrieval, 41 percent better relevance.' },
  { no: '04', tag: 'Systems', title: 'Timetable Generator', body: 'Conflict-free academic scheduling with genetic algorithms, 92 percent faster, built on Django and PostgreSQL.' },
];
const EXPERIENCE = [
  { when: "'25 — Now", role: 'Full Stack Developer Intern', org: 'Coastal Seven Consulting', body: 'GraphQL APIs (Strawberry + FastAPI), Google OAuth and Drive integration, automation that cut manual work by 95%.' },
  { when: "'23 — '25", role: 'Research Assistant', org: 'Dept. of IT, ANITS', body: 'Built NoveltyNet and RAG pipelines, improved minority-class F1 by 15%, taught ML/DL labs to 150+ students.' },
  { when: "'24", role: 'Data Science Intern', org: 'Oasis Infobyte', body: 'Trained and benchmarked Random Forest, Regression and SVM models reaching 94 to 97% accuracy.' },
];
const SKILLS = ['Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'React', 'Django', 'LangChain', 'LiveKit', 'RAG', 'NLP', 'SBERT', 'FAISS', 'Docker', 'PostgreSQL', 'GraphQL'];
const STATS = [['8.98', 'CGPA'], ['1', 'Paper'], ['4+', 'Projects'], ['300+', 'Taught']];

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
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.04, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
    // safety net: never leave anything invisible
    const fallback = setTimeout(() => els.forEach(el => el.classList.add('in')), 1400);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);

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

  return (
    <div className="cine">
      <div className="atmos" aria-hidden><span className="a1" /><span className="a2" /><span className="a3" /></div>
      <div className="grain" aria-hidden />
      <div className="scan" aria-hidden />

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="hud tl"><b>Chandra Sekhar Karri</b><span>© 2026 — All rights reserved</span></div>
        <div className="hud tr"><b>// Manifesto</b><span>I build intelligent systems at the intersection of research and product.</span></div>
        <div className="hud bl"><span className="blink">●</span> Available for opportunities</div>
        <div className="hud br"><button className="hud-ai" onClick={() => openAI('voice')}>◖ Talk to my AI</button></div>

        <div className="stage-photo">
          <span className="halo" aria-hidden />
          {photoOk
            ? <img src="/founder.jpg" alt={NAME} className="hphoto" onError={() => setPhotoOk(false)} />
            : <span className="hphoto ph-fb">CK</span>}
        </div>

        <h1 className="bigname">CHANDRA<br />SEKHAR<br /><span className="thin">KARRI</span></h1>
        <div className="hero-sub">
          <span>AI Engineer &amp; Researcher</span>
          <span className="dotsep">/</span>
          <span>Visakhapatnam, India</span>
        </div>
        <a className="scrollcue" href="#about"><ArrowDown size={14} /> Scroll to explore</a>
      </section>

      {/* ============ CONTENT ============ */}
      <main className="content">
        <section className="sec reveal" id="about">
          <div className="sec-head"><span className="sec-no">01 / About</span></div>
          <div className="about-grid">
            <p className="lead">Research-focused AI engineer working on <em>novelty detection</em>, <em>retrieval-augmented generation</em> and <em>NLP</em>, with published research and production engineering experience.</p>
            <p className="about-sub">I work across the full stack of intelligent systems, from designing and evaluating ML and DL architectures to shipping real-time products, grounded in careful experimental design and reproducible evaluation.</p>
          </div>
          <div className="stats">{STATS.map(([k, v]) => <div key={v} className="stat"><b>{k}</b><span>{v}</span></div>)}</div>
          <div className="edu">
            <div><span className="lbl">Education</span> B.Tech IT, ANITS · 2026 · CGPA 8.98</div>
            <div><span className="lbl">Publication</span> Deep Learning &amp; Generative AI for Drug Discovery, IRPJR 2025</div>
          </div>
        </section>

        <section className="sec reveal" id="work">
          <div className="sec-head"><span className="sec-no">02 / Selected Work</span><h2>Things I&rsquo;ve built</h2></div>
          <div className="work-grid">
            {PROJECTS.map(p => (
              <article className="card" key={p.title}>
                <span className="card-no">{p.no}</span>
                <span className="card-tag">{p.tag}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sec reveal" id="exp">
          <div className="sec-head"><span className="sec-no">03 / Experience</span></div>
          <div className="exp-list">
            {EXPERIENCE.map(e => (
              <div className="exp" key={e.role}>
                <span className="exp-when">{e.when}</span>
                <div className="exp-body"><h3>{e.role} <span>— {e.org}</span></h3><p>{e.body}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="sec reveal" id="skills">
          <div className="sec-head"><span className="sec-no">04 / Toolkit</span></div>
          <div className="skills">{SKILLS.map(s => <span key={s}>{s}</span>)}</div>
        </section>

        <footer className="end reveal" id="contact">
          <span className="sec-no">05 / Contact</span>
          <h2 className="end-h">Let&rsquo;s build<br />something.</h2>
          <div className="end-links">
            <a href="mailto:karrichandu03@gmail.com">Email <ArrowUpRight size={18} /></a>
            <a href="https://github.com/chandu3292" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={18} /></a>
            <button onClick={() => openAI('voice')}>Talk to my AI <Sparkles size={17} /></button>
          </div>
          <div className="end-foot"><span>{NAME}</span><span>+91 93906 94802 · karrichandu03@gmail.com</span></div>
        </footer>
      </main>

      {/* floating launcher */}
      {!aiOpen && (
        <button className="ai-launch" onClick={() => openAI('voice')} aria-label="Talk to my AI"><Sparkles size={18} /><span>Talk to my AI</span></button>
      )}

      {/* AI modal */}
      {aiOpen && (
        <div className="ai-overlay" onClick={closeAI}>
          <div className="ai-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-head">
              <div className="ai-title"><Sparkles size={14} /> Chandra&rsquo;s AI</div>
              <div className="ai-tools">
                <div className="ai-modes"><button className={aiMode === 'voice' ? 'on' : ''} onClick={() => setAiMode('voice')}>Voice</button><button className={aiMode === 'chat' ? 'on' : ''} onClick={() => setAiMode('chat')}>Chat</button></div>
                <select value={selectedPersona} onChange={e => handlePersonaChange(e.target.value)} disabled={isConnected}>{personas.map(p => <option key={p.id} value={p.id}>{p.name} · {p.language.toUpperCase()}</option>)}</select>
                <button className="ai-close" onClick={closeAI}><X size={18} /></button>
              </div>
            </div>
            {aiMode === 'voice' ? (
              <div className="ai-voice">
                <div ref={orbRef} className={`orb-stage ${isConnected ? 'live' : ''} ${isConnecting ? 'busy' : ''}`}>
                  <span className="orb-glow" aria-hidden /><span className="orb-ring r1" aria-hidden /><span className="orb-ring r2" aria-hidden /><span className="orb-ring r3" aria-hidden />
                  <button className="orb" onClick={orbAction} disabled={isConnecting}><span className="orb-face">{isConnecting ? <Loader2 className="spin" size={30} /> : isConnected ? <PhoneOff size={28} /> : <Mic size={32} />}</span></button>
                  {isConnected && <div className="wave" aria-hidden>{Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ '--n': i } as React.CSSProperties} />)}</div>}
                </div>
                <div className="ai-status">{isConnected ? 'Listening…' : status}</div>
                {isConnected && <div className="ai-timer">{formatTime(timer)}</div>}
                {isConnected && liveCaptions.length > 0 && (<div className="captions">{liveCaptions.map(c => (<div key={c.id} className={`cap ${c.role} ${c.final ? '' : 'interim'}`}><span className="cap-who">{c.role === 'you' ? 'You' : 'AI'}</span><span className="cap-txt">{c.text}</span></div>))}</div>)}
                {!isConnected && !isConnecting && <p className="ai-hint">Ask about my research and projects, or book a meeting. English, Hindi or Telugu.</p>}
                {isConnected && <button className="hang" onClick={disconnectRoom}>End conversation</button>}
              </div>
            ) : (
              <div className="ai-chat">
                <div className="chat-scroll">
                  {chatMessages.length === 0 ? (
                    <div className="chat-intro"><p className="chat-hi">Hi, I&rsquo;m Chandra&rsquo;s AI. Ask me anything about him.</p><div className="suggests">{SUGGESTIONS.map(s => <button key={s} onClick={() => sendMessage(s)} disabled={isSending}>{s}</button>)}</div></div>
                  ) : (<>{chatMessages.map((m, i) => (<div key={i} className={`msg ${m.role}`}><div className="bubble">{m.text}</div>{m.time && <span className="ts">{m.time}</span>}</div>))}{isSending && <div className="msg assistant"><div className="bubble typing"><span /><span /><span /></div></div>}</>)}
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
