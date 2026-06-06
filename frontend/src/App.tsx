import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Mic, PhoneOff, Send, Trash2, ArrowLeft, ArrowRight, FlaskConical, Cpu, Code2, Award } from 'lucide-react';
import { Room, createLocalAudioTrack, RoomEvent, Track } from 'livekit-client';
import './index.css';

interface Persona { id: string; name: string; language: string; description: string; }
interface Caption { id: string; role: 'you' | 'agent'; text: string; final: boolean; }

const NAME = 'Chandra Sekhar Karri';
const ROLE = 'AI Engineer & Researcher';

const CHIPS = ['His research', 'His projects', 'His skills', 'Experience', 'Book a meeting'];
const SUGGESTIONS = ['Who is Chandra and what does he do?', 'Tell me about his research', 'What projects has he built?', 'Book a meeting with him'];

const TEASERS: Record<string, string[]> = {
  'His research': [
    'Chandra works on novelty detection and retrieval-augmented generation, with a published paper. Tap to talk and I will walk you through it.',
    'He built NoveltyNet, an AI system that scores how original a research idea is. Start a call and I will explain how it works.',
    'Curious about his research in NLP and generative AI? Tap the orb and ask me anything.',
  ],
  'His projects': [
    'From a multilingual voice agent to a genetic-algorithm timetable engine, he ships real systems. Tap to talk and I will show you.',
    'He built DocQuery, NoveltyNet, and the voice agent this site is based on. Start a call to hear the details.',
    'Want the highlights of his best projects? Tap the orb and I will run through them.',
  ],
  'His skills': [
    'Python, PyTorch, FastAPI, RAG pipelines, LiveKit, and more. Tap to talk and I will match his skills to what you need.',
    'He is strong across ML, DL, NLP and full-stack engineering. Start a call and ask about any of it.',
    'Wondering if he fits your team? Tap the orb and let us talk skills.',
  ],
  'Experience': [
    'Research Assistant at ANITS and Full Stack Developer at Coastal Seven. Tap to talk and I will tell you more.',
    'He has shipped production systems and led research projects. Start a call to hear the story.',
    'Want his work history in brief? Tap the orb and ask me.',
  ],
  'Book a meeting': [
    'Want to talk to Chandra directly? I can set up a meeting. Tap the orb and tell me a day that works.',
    'Happy to get you on his calendar. Start a call and I will find a slot that suits you.',
    'Let us schedule a quick chat with Chandra. Tap to talk and we will sort the time.',
  ],
};

const PROJECTS = [
  { Icon: FlaskConical, tag: 'Research', title: 'NoveltyNet', body: 'Multi-dimensional novelty detection using SBERT, HDBSCAN and citation-graph reasoning across a 50K-plus paper dataset.' },
  { Icon: Cpu, tag: 'Voice AI', title: 'Multilingual Voice Agent', body: 'Real-time LiveKit agent (English, Telugu, Tamil) with sub-second latency, RAG Q&A and Google Calendar booking.' },
  { Icon: Code2, tag: 'RAG', title: 'DocQuery', body: 'Document-intelligence over scanned files: hybrid OCR plus Sentence-Transformer retrieval, 41 percent better relevance.' },
  { Icon: Award, tag: 'Optimisation', title: 'Timetable Generator', body: 'Conflict-free academic scheduling with genetic algorithms, 92 percent faster, built on Django and PostgreSQL.' },
];
const FACTS = [
  { k: '8.98', v: 'CGPA (B.Tech IT, 2026)' },
  { k: '1', v: 'Published research paper' },
  { k: '15%', v: 'Minority-class F1 gain' },
  { k: '150+', v: 'Students mentored' },
];
const SKILLS = ['Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'React', 'LangChain', 'LiveKit', 'RAG', 'NLP', 'SBERT', 'FAISS', 'Docker'];

const App: React.FC = () => {
  const [view, setView] = useState<'call' | 'chat'>('call');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string; time?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState('sophia');

  const [status, setStatus] = useState('Listening…');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [timer, setTimer] = useState(0);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [bubble, setBubble] = useState<{ topic: string; text: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhrase = useRef<Record<string, number>>({});
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

  const teaseTopic = (topic: string) => {
    if (isConnected || isConnecting) return;
    const pool = TEASERS[topic]; if (!pool || !pool.length) return;
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === lastPhrase.current[topic]) idx = (idx + 1) % pool.length;
    lastPhrase.current[topic] = idx;
    setBubble({ topic, text: pool[idx] });
    setSpeaking(true);
    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(() => setSpeaking(false), 1500);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 9000);
  };

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
    setIsConnecting(true); setStatus('Connecting…'); setCaptions([]); setBubble(null);
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
            if (idx >= 0) next[idx] = { id: s.id, role, text: s.text, final: s.final };
            else next.push({ id: s.id, role, text: s.text, final: s.final });
          }
          return next.slice(-6);
        });
      });
      room.on(RoomEvent.Disconnected, () => { setIsConnected(false); setStatus('Listening…'); roomRef.current = null; stopReactive(); });
      await room.connect(url, token);
      roomRef.current = room; setIsConnected(true); setStatus('Listening…');
      const mic = await createLocalAudioTrack(); await room.localParticipant.publishTrack(mic);
    } catch (err) { console.error(err); setStatus('Connection failed — tap to retry'); }
    finally { setIsConnecting(false); }
  };
  const disconnectRoom = async () => {
    if (roomRef.current) await roomRef.current.disconnect();
    setIsConnected(false); setStatus('Listening…'); roomRef.current = null; stopReactive();
  };
  const orbAction = isConnected ? disconnectRoom : startConversation;
  const liveCaptions = captions.filter(c => c.text.trim());

  const Avatar = ({ cls }: { cls: string }) =>
    photoOk
      ? <img src="/founder.jpg" alt={NAME} className={cls} onError={() => setPhotoOk(false)} />
      : <span className={`${cls} avatar-fallback`}>CK</span>;

  return (
    <div className="page">
      <div className="aura" aria-hidden />
      <div className="mesh" aria-hidden />
      <div className="vignette" aria-hidden />

      <div className="stage">
        <header className="top">
          <div className="brand">
            <img src="/founder-mark.svg" alt="" className="brand-logo" />
            <span className="brand-word">{NAME.split(' ')[0]}<b> Karri</b></span>
          </div>
          <div className="persona">
            <select value={selectedPersona} onChange={e => handlePersonaChange(e.target.value)} disabled={isConnected}>
              {personas.map(p => <option key={p.id} value={p.id}>{p.name} · {p.language.toUpperCase()}</option>)}
            </select>
          </div>
        </header>

        {view === 'call' ? (
          <section className="call">
            <div ref={orbRef} className={`orb-stage ${isConnected ? 'live' : ''} ${isConnecting ? 'busy' : ''} ${speaking ? 'speaking' : ''}`}>
              <span className="orb-glow" aria-hidden />
              <span className="orb-ring r1" aria-hidden /><span className="orb-ring r2" aria-hidden /><span className="orb-ring r3" aria-hidden />
              <button className="orb" onClick={orbAction} disabled={isConnecting} aria-label={isConnected ? 'End call' : 'Start call'}>
                <span className="orb-face">{isConnecting ? <Loader2 className="spin" size={38} /> : isConnected ? <PhoneOff size={34} /> : <Mic size={40} />}</span>
              </button>
              {isConnected && <div className="wave" aria-hidden>{Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ '--n': i } as React.CSSProperties} />)}</div>}
            </div>

            <div className="call-copy">
              {!isConnected && !isConnecting && (<>
                <h1>Meet <span className="grad">Chandra</span>&rsquo;s AI</h1>
                <p>Tap to talk with my AI assistant. It tells you about my research and projects, answers your questions, and books a meeting with me, in English, Hindi or Telugu.</p>
              </>)}
              {isConnecting && <h1 className="dim">Connecting you…</h1>}
              {isConnected && (<><h1 className="status-live">{status}</h1><div className="timer">{formatTime(timer)}</div></>)}
            </div>

            {isConnected && liveCaptions.length > 0 && (
              <div className="captions">
                {liveCaptions.map(c => (
                  <div key={c.id} className={`cap ${c.role} ${c.final ? '' : 'interim'}`}>
                    <span className="cap-who">{c.role === 'you' ? 'You' : 'Assistant'}</span>
                    <span className="cap-txt">{c.text}</span>
                  </div>
                ))}
              </div>
            )}

            {!isConnected && !isConnecting && bubble && (
              <div className="tease" key={bubble.text}>
                <span className="tease-who">{NAME.split(' ')[0]}&rsquo;s AI</span>
                <p>{bubble.text}</p>
                <button className="tease-cta" onClick={startConversation}>Tap to talk <ArrowRight size={15} /></button>
              </div>
            )}

            {isConnected && <button className="hang" onClick={disconnectRoom}>End conversation</button>}

            {!isConnected && (<>
              <ul className="chips">
                {CHIPS.map(c => <li key={c}><button className={bubble?.topic === c ? 'on' : ''} onClick={() => teaseTopic(c)}>{c}</button></li>)}
              </ul>
              <button className="type-link" onClick={() => setView('chat')}>Prefer to type? Open chat →</button>
            </>)}
          </section>
        ) : (
          <section className="chatview">
            <button className="back" onClick={() => setView('call')}><ArrowLeft size={16} /> Back to call</button>
            <div className="panel">
              <div className="chat-scroll">
                {chatMessages.length === 0 ? (
                  <div className="chat-intro">
                    <p className="chat-hi">Hi, I&rsquo;m Chandra&rsquo;s AI assistant. Ask me anything about him.</p>
                    <div className="suggests">{SUGGESTIONS.map(s => <button key={s} onClick={() => sendMessage(s)} disabled={isSending}>{s}</button>)}</div>
                  </div>
                ) : (<>
                  {chatMessages.map((m, i) => (<div key={i} className={`msg ${m.role}`}><div className="bubble">{m.text}</div>{m.time && <span className="ts">{m.time}</span>}</div>))}
                  {isSending && <div className="msg assistant"><div className="bubble typing"><span /><span /><span /></div></div>}
                </>)}
                <div ref={chatEndRef} />
              </div>
              <div className="composer">
                {chatMessages.length > 0 && <button className="icon-btn" onClick={clearChat} title="Clear"><Trash2 size={17} /></button>}
                <textarea ref={inputRef} placeholder="Ask about Chandra…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} disabled={isSending} />
                <button className="send" onClick={() => sendMessage()} disabled={isSending || !chatInput.trim()}>{isSending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}</button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ===== About / showcase ===== */}
      <section className="more" id="more">
        <img src="/research-graph.svg" className="research-bg" alt="" aria-hidden />
        <div className="profile">
          <Avatar cls="profile-photo" />
          <div>
            <span className="kicker">{ROLE}</span>
            <h2>{NAME}</h2>
            <p>Research-focused AI engineer specializing in novelty detection, retrieval-augmented generation and NLP systems, with published research and production engineering experience. Based in Visakhapatnam, India.</p>
            <div className="facts">{FACTS.map(f => <div key={f.v} className="fact"><span className="fact-k">{f.k}</span><span className="fact-v">{f.v}</span></div>)}</div>
          </div>
        </div>

        <div className="sec-head"><span className="kicker">Selected work</span><h2>Things he has built</h2></div>
        <div className="ex-grid">
          {PROJECTS.map(({ Icon, tag, title, body }) => (
            <article className="ex" key={title}>
              <div className="ex-ic"><Icon size={18} /></div>
              <span className="ex-tag ex-blue">{tag}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>

        <div className="skills-row">{SKILLS.map(s => <span key={s} className="skill-pill">{s}</span>)}</div>
      </section>

      <footer className="contact" id="contact">
        <div className="contact-cta">
          <span className="kicker">Want to work together?</span>
          <h2>Let&rsquo;s talk.</h2>
          <div className="contact-actions">
            <a className="btn-primary" href="mailto:karrichandu03@gmail.com">Email Chandra <ArrowRight size={16} /></a>
            <a className="btn-ghost" href="tel:+919390694802">+91 93906 94802</a>
            <a className="btn-ghost" href="https://github.com/chandu3292" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className="contact-bottom">
          <div className="brand"><img src="/founder-mark.svg" alt="" className="brand-logo" /><span className="brand-word">{NAME}</span></div>
          <span className="muted">© 2026 {NAME} · AI voice portfolio</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
