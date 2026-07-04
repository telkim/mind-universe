import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
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
  { id: "semiconductor", name: "반도체", color: "#a8e25b" },
  { id: "ai-sw", name: "AI·SW", color: "#5bd8cb" },
  { id: "ai-use", name: "AI활용", color: "#67e0aa" },
  { id: "macro", name: "매크로", color: "#c7e85a" },
  { id: "machine-defense", name: "암호화폐", color: "#e7b65f" },
  { id: "industry", name: "로봇", color: "#b790f0" },
  { id: "crypto", name: "금리", color: "#f28ba4" },
  { id: "real-estate", name: "부동산", color: "#54d2e0" },
];

function getTopicCount(articles, topicName) {
  return articles.filter((article) => article.topic === topicName).length;
}

function getTopicMeta(topicName) {
  return TOPICS.find((topic) => topic.name === topicName) || TOPICS[0];
}

function normalizeActivity(value) {
  return {
    read: Array.isArray(value?.read) ? value.read : [],
    later: Array.isArray(value?.later) ? value.later : [],
    scraps: Array.isArray(value?.scraps) ? value.scraps : [],
  };
}

function useUserActivity() {
  const [activity, setActivity] = useState(() => {
    try {
      return normalizeActivity(JSON.parse(localStorage.getItem("user-activity") || "{}"));
    } catch {
      return { read: [], later: [], scraps: [] };
    }
  });

  const updateActivity = (updater) => {
    setActivity((prev) => {
      const next = normalizeActivity(updater(normalizeActivity(prev)));
      localStorage.setItem("user-activity", JSON.stringify(next));
      return next;
    });
  };

  const toggle = (bucket, id) => {
    updateActivity((prev) => {
      const set = new Set(prev[bucket]);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...prev, [bucket]: [...set] };
    });
  };

  const markRead = (id) => {
    updateActivity((prev) => {
      const set = new Set(prev.read);
      set.add(id);
      return { ...prev, read: [...set] };
    });
  };

  return {
    read: new Set(activity.read),
    later: new Set(activity.later),
    scraps: new Set(activity.scraps),
    toggleLater: (id) => toggle("later", id),
    toggleScrap: (id) => toggle("scraps", id),
    markRead,
  };
}

function matchesSearch(article, search) {
  const terms = search.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  const haystack = `${article.title || ""} ${article.body || ""}`.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function App() {
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [panelMode, setPanelMode] = useState(null);
  const [readMode, setReadMode] = useState("browse");
  const [levelOpen, setLevelOpen] = useState(false);
  const programmedQueryRef = useRef(false);
  const { read, later, scraps, toggleLater, toggleScrap, markRead } = useUserActivity();

  useEffect(() => {
    let alive = true;
    const jsonPath = `${import.meta.env.BASE_URL}/data.json`.replace(/\/+/g, '/');
    fetch(jsonPath)
      .then((res) => {
        if (!res.ok) throw new Error("data.json fetch failed");
        return res.json();
      })
      .then((data) => {
        if (alive) setArticles(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setArticles([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const theses = useMemo(() => {
    return [...new Set(articles.map((article) => article.thesis).filter(Boolean))];
  }, [articles]);

  const filtered = useMemo(() => {
    if (panelMode === "later") return articles.filter((article) => later.has(article.id));
    if (panelMode === "scrap") return articles.filter((article) => scraps.has(article.id));
    if (selected) return articles.filter((article) => article.topic === selected.name || article.thesis === selected.name);
    if (query.trim()) return articles.filter((article) => matchesSearch(article, query));
    return [];
  }, [articles, query, selected, panelMode, later, scraps]);

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
      <Header query={query} setQuery={setQuery} openTopic={openTopic} openArchive={openArchive} level={level} setLevelOpen={setLevelOpen} />
      <section className="workspace">
        <GraphCanvas articles={articles} theses={theses} selected={selected} panelOpen={Boolean(panelMode)} onTopic={openTopic} onThesis={openThesis} onDismiss={() => setPanelMode(null)} />
        {panelMode && (
          <ListPanel
            mode={panelMode}
            selected={selected}
            query={query}
            articles={filtered}
            theses={theses}
            later={later}
            scraps={scraps}
            read={read}
            toggleLater={toggleLater}
            toggleScrap={toggleScrap}
            markRead={markRead}
            readMode={readMode}
            setReadMode={setReadMode}
            openArchive={openArchive}
            onClose={() => setPanelMode(null)}
          />
        )}
      </section>
      <Footer total={articles.length} />
      {levelOpen && <LevelModal articles={articles} level={level} read={read} readCount={readCount} nextLevel={nextLevel} onClose={() => setLevelOpen(false)} />}
    </main>
  );
}

function Header({ query, setQuery, openTopic, openArchive, level, setLevelOpen }) {
  return (
    <header className="header">
      <div className="topbar">
        <div className="brand" aria-label="N-MIND Universe">
          <span className="bamboo">╂</span>
          <strong>N-MIND <b>UNIVERSE</b></strong>
        </div>
        <label className="search">
          <Search size={24} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·내용으로 글 검색" />
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

function GraphCanvas({ articles, theses, selected, panelOpen, onTopic, onThesis, onDismiss }) {
  const canvasRef = useRef(null);
  const graphRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, locked: false, nodes: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const graph = graphRef.current;
    let animationId = 0;

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const topicNodes = TOPICS.map((topic, index) => {
      const count = getTopicCount(articles, topic.name);
      return { ...topic, count, kind: "topic", r: 15 + Math.min(10, count / 12), a: (Math.PI * 2 * index) / TOPICS.length, d: 98 + (index % 3) * 25 };
    });

    const thesisNodes = theses.slice(0, 24).map((name, index) => {
      const topic = getTopicMeta(articles.find((article) => article.thesis === name)?.topic);
      return { id: `thesis-${index}`, name, kind: "thesis", color: topic.color, r: 6 + (index % 3), a: (Math.PI * 2 * index) / Math.max(1, theses.length) + 0.3, d: 165 + (index % 5) * 15 };
    });

    const smallNodes = articles.slice(0, 52).map((article, index) => {
      const topic = getTopicMeta(article.topic);
      return { id: `small-${article.id}`, name: "", kind: "small", color: topic.color, r: 2 + (index % 4), a: (Math.PI * 2 * index) / 52, d: 231 + (index % 8) * 13 };
    });

    const nodes = [...topicNodes, ...thesisNodes, ...smallNodes];
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
      nodes.forEach((node) => {
        node.x = Math.cos(node.a + frame * (node.kind === "small" ? 0.8 : 0.35)) * node.d;
        node.y = Math.sin(node.a + frame * (node.kind === "small" ? 0.8 : 0.35)) * node.d * 0.72;
      });
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 9) {
          const a = nodes[i];
          const b = nodes[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 133) {
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
      nodes.forEach((node) => drawNode(ctx, node, selected));
      ctx.restore();
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [articles, theses, selected, panelOpen]);

  const hitTest = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const graph = graphRef.current;
    const cx = canvas.clientWidth * (panelOpen ? 0.42 : 0.55) + graph.offsetX;
    const cy = canvas.clientHeight * 0.52 + graph.offsetY;
    const x = (event.clientX - rect.left - cx) / graph.scale;
    const y = (event.clientY - rect.top - cy) / graph.scale;
    const hit = [...graph.nodes].reverse().find((node) => Math.hypot(node.x - x, node.y - y) <= node.r + 5 && node.kind !== "small");
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
    <section className={`graphWrap ${panelOpen ? "dimmed" : ""}`} onClick={(event) => {
      if (event.target === event.currentTarget && panelOpen) onDismiss();
    }}>
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
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 75, 0);
    ctx.lineTo(x + 75, h);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(91, 144, 62, 0.15)";
  ctx.lineWidth = 3;
  for (let y = 56; y < h; y += 122) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(162, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - 150, y);
    ctx.lineTo(w - 52, y);
    ctx.stroke();
  }
}

function drawNode(ctx, node, selected) {
  const active = selected?.name === node.name;
  ctx.beginPath();
  ctx.fillStyle = node.kind === "topic" ? node.color : "#0b2012";
  ctx.strokeStyle = active ? "#f6ffd7" : node.color;
  ctx.lineWidth = active ? 3 : 1.6;
  ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (node.kind !== "small") {
    ctx.fillStyle = node.kind === "topic" ? "#13210d" : "#e9ffd0";
    ctx.font = node.kind === "topic" ? "bold 6px sans-serif" : "bold 4px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.kind === "topic" ? String(node.count) : "◆", node.x, node.y + 3);
    ctx.fillStyle = "#eefadc";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText(node.name, node.x, node.y + node.r + 9);
  }
}

function ListPanel(props) {
  const {
    mode,
    selected,
    query,
    articles,
    theses,
    later,
    scraps,
    read,
    toggleLater,
    toggleScrap,
    markRead,
    readMode,
    setReadMode,
    openArchive,
    onClose,
  } = props;
  const title = mode === "later" ? "나중에 읽기" : mode === "scrap" ? "스크랩" : selected?.name || query;
  const subtitle = mode === "search" ? selected?.subtitle || "검색 결과" : "보관함";

  const openArticle = (article) => {
    if (article.link) window.open(article.link, "_blank", "noopener,noreferrer");
    markRead(article.id);
  };

  return (
    <aside className="panel">
      <button className="close" onClick={onClose}><X /></button>
      <p className="subtitle">{subtitle}</p>
      <h1>{title}</h1>
      {mode === "search" ? <strong className="count">{articles.length}편이 제목과 일치합니다</strong> : <strong className="count">나중에 읽기 {later.size}건 · 스크랩 {scraps.size}건</strong>}
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
      <div className="panelScroll">
        {mode === "search" && (
          <div className="related">
            <p>유기적으로 연결된 다른 분야 테제</p>
            {theses.slice(0, 8).map((thesis) => <button key={thesis}>{thesis}</button>)}
          </div>
        )}
        <div className="articleList">
          {articles.map((article) => (
            <article key={article.id} className={read.has(article.id) ? "read article" : "article"} onClick={() => openArticle(article)}>
              <div>
                <h2>{article.title}</h2>
                <time>{article.date}</time>
              </div>
              <div className="articleActions">
                <button
                  className={later.has(article.id) ? "saved ring-1 ring-amber-400 bg-emerald-950/40" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleLater(article.id);
                  }}
                  title="나중에 읽기"
                >
                  ⏰
                </button>
                <button
                  className={scraps.has(article.id) ? "saved ring-1 ring-amber-400 bg-emerald-950/40" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleScrap(article.id);
                  }}
                  title="스크랩"
                >
                  🔖
                </button>
              </div>
            </article>
          ))}
          {!articles.length && <p className="empty">아직 저장된 글이 없어요.</p>}
        </div>
      </div>
    </aside>
  );
}

function LevelModal({ articles, level, read, readCount, nextLevel, onClose }) {
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <section className="levelModal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}><X /></button>
        <div className="levelHead">
          <span className="bigSprout"><Sprout size={54} /></span>
          <div>
            <h1>Lv.{level} · 대나무 씨앗</h1>
            <p>{readCount ? "읽은 글이 차곡차곡 쌓이고 있어요" : "아직 읽은 글이 없어요 — 글을 눌러 탐험을 시작하세요"}</p>
          </div>
        </div>
        <p className="progressText">전체 진행도 <b>{readCount}</b> / {articles.length}편 ({articles.length ? Math.round((readCount / articles.length) * 100) : 0}%) · 다음 레벨까지 {Math.max(0, nextLevel - readCount)}편</p>
        <div className="bar"><span style={{ width: `${Math.min(100, (readCount % 10) * 10)}%` }} /></div>
        <div className="levelBody">
          <div className="radar">
            {TOPICS.map((topic, index) => <span key={topic.id} style={{ transform: `rotate(${index * 45}deg) translateY(-116px) rotate(${-index * 45}deg)` }}>{topic.name}</span>)}
          </div>
          <div className="topicProgress">
            {TOPICS.map((topic) => {
              const topicArticles = articles.filter((article) => article.topic === topic.name);
              const topicRead = topicArticles.filter((article) => read.has(article.id)).length;
              return <label key={topic.id}>{topic.name}<b>{topicRead}/{topicArticles.length}</b><i><span style={{ width: `${topicArticles.length ? (topicRead / topicArticles.length) * 100 : 0}%` }} /></i></label>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer({ total }) {
  return <footer className="footer">총 <b>{total.toLocaleString()}편</b> · © N-MIND. 비상업적 —  <a href="https://minseok617.github.io/moso-universe" target="_new">Inspired by moso-universe</a> <u></u></footer>;
}

createRoot(document.getElementById("root")).render(<App />);
