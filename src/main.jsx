import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  Bookmark,
  BookOpen,
  Eye,
  Flame,
  Focus,
  LibraryBig,
  Link2,
  Minus,
  Plus,
  Search,
  Sprout,
  X,
} from "lucide-react";
import "./styles.css";

const TOPICS = [
  { id: "semiconductor", name: "반도체", color: "#a8e25b", count: 127 },
  { id: "ai-sw", name: "AI·SW", color: "#5bd8cb", count: 89 },
  { id: "ai-use", name: "AI활용", color: "#67e0aa", count: 57 },
  { id: "macro", name: "매크로", color: "#c7e85a", count: 176 },
  { id: "machine-defense", name: "기계·방산", color: "#e7b65f", count: 90 },
  { id: "industry", name: "산업섹터", color: "#b790f0", count: 168 },
  { id: "crypto", name: "암호화폐", color: "#f28ba4", count: 39 },
  { id: "real-estate", name: "부동산", color: "#54d2e0", count: 66 },
];

const THESES = [
  "의류/의류OEM/유통",
  "미중·유럽 패권 경쟁",
  "사업·창업가 정신",
  "시장을 읽는 법",
  "자기계발·성장",
  "투자·리서치에 AI 쓰기",
  "부의 축적·복리",
  "중국 반도체·수출규제",
  "트럼프와 정책",
  "방산 밸류체인",
  "로봇과 자동화",
  "금리와 달러",
  "AI 에이전트 경제",
  "조선 슈퍼사이클",
  "비트코인 ETF",
  "부동산 사이클",
];

const featuredTitles = [
  "의류주는 '섹터'가 아니라 '사이클 온도계'다",
  "다이소에서 화장품 사고 20만원짜리 밥 먹는 사람들의 비밀",
  "중국 로봇 굴기의 진짜 병목은 소프트웨어다",
  "트럼프 2기 관세 지도에서 읽는 공급망 재배치",
  "조선업 슈퍼사이클은 어디에서 끝나는가",
  "방산 수주잔고가 숫자로만 보이면 놓치는 것",
  "비트코인 현물 ETF 이후 유동성의 방향",
  "부동산은 금리가 아니라 가계 심리의 함수다",
  "AI 에이전트가 SaaS 가격표를 다시 쓴다",
  "반도체 수출규제의 다음 표적",
  "금리 인하가 늦어질 때 살아남는 포트폴리오",
  "투자 리서치에 AI를 붙이는 가장 현실적인 방법",
];

function makeArticles() {
  const rows = [];
  for (let i = 0; i < 1054; i += 1) {
    const topic = TOPICS[i % TOPICS.length];
    const thesis = THESES[(i * 5 + Math.floor(i / 7)) % THESES.length];
    const base = featuredTitles[i % featuredTitles.length];
    const year = 2025 + (i % 2);
    const month = String((i % 12) + 1).padStart(2, "0");
    const day = String(((i * 3) % 28) + 1).padStart(2, "0");
    rows.push({
      id: `post-${i + 1}`,
      title: i < featuredTitles.length ? base : `${base} · ${thesis}`,
      date: `${year}.${month}.${day}`,
      topic: topic.name,
      topicId: topic.id,
      thesis,
      body: `${topic.name} ${thesis} 중국 로봇 트럼프 금리 부동산 에이전트 방산 비트코인 조선 투자 리서치`,
    });
  }
  return rows;
}

const ARTICLES = makeArticles();

function useStoredSet(key) {
  const [items, setItems] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return new Set();
    }
  });

  const toggle = (id) => {
    setItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  };

  return [items, toggle];
}

function matchesSearch(article, search) {
  const terms = search.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  const haystack = `${article.title} ${article.body} ${article.topic} ${article.thesis}`.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [panelMode, setPanelMode] = useState(null);
  const [readMode, setReadMode] = useState("browse");
  const [levelOpen, setLevelOpen] = useState(false);
  const programmedQueryRef = useRef(false);
  const [later, toggleLater] = useStoredSet("moso-later");
  const [scraps, toggleScrap] = useStoredSet("moso-scraps");
  const [read, toggleRead] = useStoredSet("moso-read");

  const filtered = useMemo(() => {
    if (panelMode === "later") return ARTICLES.filter((a) => later.has(a.id));
    if (panelMode === "scrap") return ARTICLES.filter((a) => scraps.has(a.id));
    if (selected) {
      return ARTICLES.filter((a) => a.topic === selected.name || a.thesis === selected.name);
    }
    if (query.trim()) return ARTICLES.filter((a) => matchesSearch(a, query));
    return [];
  }, [query, selected, panelMode, later, scraps]);

  const readCount = read.size;
  const level = Math.floor(readCount / 10) + 1;
  const nextLevel = level * 10;

  const openTopic = (topic) => {
    programmedQueryRef.current = true;
    setQuery(topic.name);
    setSelected({ type: "topic", name: topic.name, subtitle: "대주제" });
    setPanelMode("search");
  };

  const openThesis = (name) => {
    programmedQueryRef.current = true;
    setQuery(name);
    setSelected({ type: "thesis", name, subtitle: "산업·섹터별 분석 · 세부 테제" });
    setPanelMode("search");
  };

  const openArchive = (mode = "later") => {
    setSelected(null);
    setPanelMode(mode);
  };

  useEffect(() => {
    if (programmedQueryRef.current) {
      programmedQueryRef.current = false;
      return;
    }
    if (query.trim()) {
      setSelected(null);
      setPanelMode("search");
    } else if (panelMode === "search") {
      setPanelMode(null);
    }
  }, [query]);

  return (
    <main className="app">
      <Header
        query={query}
        setQuery={setQuery}
        openTopic={openTopic}
        openArchive={openArchive}
        level={level}
        setLevelOpen={setLevelOpen}
      />
      <section className="workspace">
        <GraphCanvas
          selected={selected}
          panelOpen={Boolean(panelMode)}
          onTopic={openTopic}
          onThesis={openThesis}
          onDismiss={() => setPanelMode(null)}
        />
        {panelMode && (
          <ListPanel
            mode={panelMode}
            selected={selected}
            query={query}
            articles={filtered}
            later={later}
            scraps={scraps}
            read={read}
            toggleLater={toggleLater}
            toggleScrap={toggleScrap}
            toggleRead={toggleRead}
            readMode={readMode}
            setReadMode={setReadMode}
            openArchive={openArchive}
            onClose={() => setPanelMode(null)}
          />
        )}
      </section>
      <Footer />
      {levelOpen && (
        <LevelModal
          level={level}
          readCount={readCount}
          nextLevel={nextLevel}
          onClose={() => setLevelOpen(false)}
        />
      )}
    </main>
  );
}

function Header({ query, setQuery, openTopic, openArchive, level, setLevelOpen }) {
  return (
    <header className="header">
      <div className="topbar">
        <div className="brand" aria-label="모소밤부 Universe">
          <span className="bamboo">╂</span>
          <strong>모소밤부 <b>UNIVERSE</b></strong>
        </div>
        <label className="search">
          <Search size={24} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·내용으로 글 검색" />
        </label>
        <button className="pill iconPill" onClick={() => setLevelOpen(true)}><Sprout />레벨 {level}</button>
        <button className="pill iconPill" onClick={() => openArchive("later")}><Archive />보관함</button>
        <button className="pill iconPill"><Flame />추천글</button>
        <button className="pill iconPill"><LibraryBig />추천 경로</button>
        <button className="blog">블로그</button>
      </div>
      <div className="quickbar">
        <button className="primaryChip"><Eye size={16} />둘러보기</button>
        <button className="ghostChip"><BookOpen size={17} />제대로 읽기</button>
        {TOPICS.map((topic) => (
          <button key={topic.id} className="topicChip" onClick={() => openTopic(topic)}>{topic.name}</button>
        ))}
      </div>
    </header>
  );
}

function GraphCanvas({ selected, panelOpen, onTopic, onThesis, onDismiss }) {
  const canvasRef = useRef(null);
  const graphRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, locked: false, nodes: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const graph = graphRef.current;
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes = [
      ...TOPICS.map((t, i) => ({ ...t, kind: "topic", r: 24 + (t.count % 6), a: (Math.PI * 2 * i) / TOPICS.length, d: 140 + (i % 3) * 35 })),
      ...THESES.map((name, i) => ({ id: `thesis-${i}`, name, kind: "thesis", color: TOPICS[i % TOPICS.length].color, r: 8 + (i % 4), a: (Math.PI * 2 * i) / THESES.length + 0.3, d: 235 + (i % 5) * 22 })),
      ...Array.from({ length: 52 }, (_, i) => ({ id: `small-${i}`, name: "", kind: "small", color: TOPICS[i % TOPICS.length].color, r: 3 + (i % 5), a: (Math.PI * 2 * i) / 52, d: 330 + (i % 8) * 18 })),
    ];
    graph.nodes = nodes;

    let frame = 0;
    const draw = () => {
      frame += graph.locked ? 0 : 0.003;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w * (panelOpen ? 0.42 : 0.55) + graph.offsetX;
      const cy = h * 0.52 + graph.offsetY;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#061109";
      ctx.fillRect(0, 0, w, h);
      drawBamboo(ctx, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(graph.scale, graph.scale);
      nodes.forEach((n) => {
        n.x = Math.cos(n.a + frame * (n.kind === "small" ? 0.8 : 0.35)) * n.d;
        n.y = Math.sin(n.a + frame * (n.kind === "small" ? 0.8 : 0.35)) * n.d * 0.72;
      });
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 9) {
          const a = nodes[i], b = nodes[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 190) {
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      nodes.forEach((n) => drawNode(ctx, n, selected));
      ctx.restore();
      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener("resize", resize);
  }, [selected, panelOpen]);

  const hitTest = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const graph = graphRef.current;
    const cx = canvas.clientWidth * (panelOpen ? 0.42 : 0.55) + graph.offsetX;
    const cy = canvas.clientHeight * 0.52 + graph.offsetY;
    const x = (e.clientX - rect.left - cx) / graph.scale;
    const y = (e.clientY - rect.top - cy) / graph.scale;
    const hit = [...graph.nodes].reverse().find((n) => Math.hypot(n.x - x, n.y - y) <= n.r + 10 && n.kind !== "small");
    if (!hit) {
      if (panelOpen) onDismiss();
      return;
    }
    hit.kind === "topic" ? onTopic(hit) : onThesis(hit.name);
  };

  const api = {
    zoom: (delta) => { graphRef.current.scale = Math.max(0.55, Math.min(1.8, graphRef.current.scale + delta)); },
    fit: () => { graphRef.current.scale = 1; graphRef.current.offsetX = 0; graphRef.current.offsetY = 0; },
    lock: () => { graphRef.current.locked = !graphRef.current.locked; },
  };

  return (
    <section className={`graphWrap ${panelOpen ? "dimmed" : ""}`}>
      <canvas ref={canvasRef} className="graph" onClick={hitTest} />
      <div className="controls">
        <button onClick={() => api.fit()} title="화면 맞춤"><Focus /></button>
        <button onClick={() => api.zoom(0.12)} title="확대"><Plus /></button>
        <button onClick={() => api.zoom(-0.12)} title="축소"><Minus /></button>
        <button onClick={() => api.lock()} title="링크 고정"><Link2 /></button>
      </div>
    </section>
  );
}

function drawBamboo(ctx, w, h) {
  ctx.strokeStyle = "rgba(91, 144, 62, 0.12)";
  ctx.lineWidth = 8;
  for (let x = 74; x < w; x += 965) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 75, 0); ctx.lineTo(x + 75, h); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(91, 144, 62, 0.15)";
  ctx.lineWidth = 3;
  for (let y = 56; y < h; y += 122) {
    ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(162, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 150, y); ctx.lineTo(w - 52, y); ctx.stroke();
  }
}

function drawNode(ctx, n, selected) {
  const active = selected?.name === n.name;
  ctx.beginPath();
  ctx.fillStyle = n.kind === "topic" ? n.color : "#0b2012";
  ctx.strokeStyle = active ? "#f6ffd7" : n.color;
  ctx.lineWidth = active ? 3 : 1.6;
  ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (n.kind !== "small") {
    ctx.fillStyle = n.kind === "topic" ? "#13210d" : "#e9ffd0";
    ctx.font = n.kind === "topic" ? "bold 8px sans-serif" : "bold 6px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(n.kind === "topic" ? String(n.count) : "◆", n.x, n.y + 3);
    ctx.fillStyle = "#eefadc";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText(n.name, n.x, n.y + n.r + 13);
  }
}

function ListPanel(props) {
  const {
    mode, selected, query, articles, later, scraps, read, toggleLater, toggleScrap, toggleRead,
    readMode, setReadMode, openArchive, onClose,
  } = props;
  const title = mode === "later" ? "나중에 읽기" : mode === "scrap" ? "스크랩" : selected?.name || query;
  const subtitle = mode === "search" ? selected?.subtitle || "검색 결과" : "보관함";

  return (
    <aside className="panel">
      <button className="close" onClick={onClose}><X /></button>
      <p className="subtitle">{subtitle}</p>
      <h1>{title}</h1>
      {mode === "search" ? (
        <strong className="count">{articles.length}편이 제목과 일치합니다</strong>
      ) : (
        <strong className="count">나중에 읽기 {later.size}건 · 스크랩 {scraps.size}건</strong>
      )}
      <div className="panelTools">
        <span>글 열</span>
        <button className={mode === "later" ? "activeTool" : ""} onClick={() => openArchive("later")}>⏰ 나중에 읽기</button>
        <button className={mode === "scrap" ? "activeTool" : ""} onClick={() => openArchive("scrap")}>🔖 스크랩</button>
        <span>→ 보관함에 저장돼요</span>
      </div>
      <div className="modeToggle">
        <button className={readMode === "browse" ? "on" : ""} onClick={() => setReadMode("browse")}><Eye size={16} />둘러보기</button>
        <button className={readMode === "read" ? "on" : ""} onClick={() => setReadMode("read")}><BookOpen size={16} />제대로 읽기</button>
      </div>
      {mode === "search" && (
        <div className="related">
          <p>유기적으로 연결된 다른 분야 테제</p>
          {THESES.slice(1, 9).map((thesis) => <button key={thesis}>{thesis}</button>)}
        </div>
      )}
      <div className="articleList">
        {articles.map((article) => (
          <article key={article.id} className={read.has(article.id) ? "read article" : "article"} onDoubleClick={() => toggleRead(article.id)}>
            <div>
              <h2>{article.title}</h2>
              <time>{article.date}</time>
            </div>
            <div className="articleActions">
              <button className={later.has(article.id) ? "saved" : ""} onClick={() => toggleLater(article.id)} title="나중에 읽기">⏰</button>
              <button className={scraps.has(article.id) ? "saved" : ""} onClick={() => toggleScrap(article.id)} title="스크랩">🔖</button>
            </div>
          </article>
        ))}
        {!articles.length && <p className="empty">아직 저장된 글이 없어요.</p>}
      </div>
    </aside>
  );
}

function LevelModal({ level, readCount, nextLevel, onClose }) {
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <section className="levelModal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}><X /></button>
        <div className="levelHead">
          <span className="bigSprout"><Sprout size={54} /></span>
          <div>
            <h1>Lv.{level} · 대나무 씨앗</h1>
            <p>{readCount ? "읽은 글이 차곡차곡 쌓이고 있어요" : "아직 읽은 글이 없어요 — 글을 눌러 탐험을 시작하세요"}</p>
          </div>
        </div>
        <p className="progressText">전체 진행도 <b>{readCount}</b> / {ARTICLES.length}편 ({Math.round((readCount / ARTICLES.length) * 100)}%) · 다음 레벨까지 {Math.max(0, nextLevel - readCount)}편</p>
        <div className="bar"><span style={{ width: `${Math.min(100, (readCount % 10) * 10)}%` }} /></div>
        <div className="levelBody">
          <div className="radar">
            {TOPICS.map((topic, i) => <span key={topic.id} style={{ transform: `rotate(${i * 45}deg) translateY(-116px) rotate(${-i * 45}deg)` }}>{topic.name}</span>)}
          </div>
          <div className="topicProgress">
            {TOPICS.map((topic) => {
              const topicRead = ARTICLES.filter((a) => a.topic === topic.name && readCount && Number(a.id.split("-")[1]) <= readCount).length;
              return <label key={topic.id}>{topic.name}<b>{topicRead}/{topic.count}</b><i><span style={{ width: `${(topicRead / topic.count) * 100}%` }} /></i></label>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return <footer className="footer">모소밤부 · <b>{ARTICLES.length.toLocaleString()}편</b> (2025.01~2026.06) · © 모소밤부. 비상업적 — <u>저작권</u></footer>;
}

createRoot(document.getElementById("root")).render(<App />);
