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
  { id: "business", name: "사업", color: "#a8e25b" },
  { id: "career", name: "직업", color: "#5bd8cb" },
  { id: "life", name: "생활", color: "#67e0aa" },
  { id: "industry", name: "산업", color: "#c7e85a" },
  { id: "corporate", name: "기업", color: "#e7b65f" },
  { id: "real-estate", name: "부동산", color: "#b790f0" },
  { id: "philosophy", name: "철학", color: "#f28ba4" },
  { id: "society", name: "사회문화", color: "#54d2e0" },
];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function assetPath(path) {
  return `${BASE_URL}/${path}`.replace(/\/+/g, "/");
}

function normalizeSummaryPost(raw) {
  if (Array.isArray(raw)) {
    return {
      postId: String(raw[0] || ""),
      date: String(raw[1] || ""),
      theses: String(raw[2] || ""),
      title: String(raw[3] || ""),
      summary: String(raw[4] || ""),
      link: raw[5] ? String(raw[5]) : "",
    };
  }
  return {
    postId: String(raw?.postId || raw?.id || ""),
    date: String(raw?.date || ""),
    theses: String(raw?.theses || raw?.topic || raw?.thesis || ""),
    title: String(raw?.title || ""),
    summary: String(raw?.summary || raw?.body || ""),
    link: String(raw?.link || ""),
  };
}

function normalizeFullTextPost(raw) {
  if (Array.isArray(raw)) {
    return {
      postId: String(raw[0] || ""),
      body: String(raw[1] || ""),
    };
  }
  return {
    postId: String(raw?.postId || raw?.id || ""),
    body: String(raw?.body || ""),
  };
}

function getTopicCount(posts, topicName) {
  return posts.filter((post) => post.theses.includes(topicName)).length;
}

function getTopicMeta(theses) {
  return TOPICS.find((topic) => theses?.includes(topic.name)) || TOPICS[0];
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

  const toggle = (bucket, postId) => {
    updateActivity((prev) => {
      const set = new Set(prev[bucket]);
      set.has(postId) ? set.delete(postId) : set.add(postId);
      return { ...prev, [bucket]: [...set] };
    });
  };

  const markRead = (postId) => {
    updateActivity((prev) => {
      const set = new Set(prev.read);
      set.add(postId);
      return { ...prev, read: [...set] };
    });
  };

  return {
    read: new Set(activity.read),
    later: new Set(activity.later),
    scraps: new Set(activity.scraps),
    toggleLater: (postId) => toggle("later", postId),
    toggleScrap: (postId) => toggle("scraps", postId),
    markRead,
  };
}

function getTerms(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function includesAny(value, terms) {
  const lower = String(value || "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function tokenize(value) {
  return String(value || "").toLowerCase().split(/[\s·/.,!?()[\]{}"'“”‘’:_-]+/).filter(Boolean);
}

function getSummaryMatch(post, terms, phrase) {
  const title = post.title.toLowerCase();
  const summary = post.summary.toLowerCase();
  const theses = post.theses.toLowerCase();
  const titleTokens = tokenize(post.title);

  if (phrase && title.includes(phrase)) return { rank: 1, matchType: "title", icon: "🏷️" };
  if (terms.some((term) => titleTokens.some((token) => token.includes(term) || term.includes(token)))) return { rank: 2, matchType: "title", icon: "🏷️" };
  if ((phrase && summary.includes(phrase)) || terms.some((term) => summary.includes(term))) return { rank: 3, matchType: "summary", icon: "📝" };
  if ((phrase && theses.includes(phrase)) || terms.some((term) => theses.includes(term))) return { rank: 4, matchType: "category", icon: "🧭" };

  return null;
}

function searchSummaries(posts, query) {
  const terms = getTerms(query);
  const phrase = query.trim().toLowerCase();
  if (!terms.length) return [];

  return posts
    .map((post) => {
      const match = getSummaryMatch(post, terms, phrase);
      return match ? { ...post, ...match, excerpt: post.summary } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || String(b.date).localeCompare(String(a.date)));
}

function makeExcerpt(body, terms) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const firstIndex = terms.reduce((best, term) => {
    const index = lower.indexOf(term);
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);
  if (firstIndex < 0) return text.slice(0, 180);
  const start = Math.max(0, firstIndex - 70);
  const end = Math.min(text.length, firstIndex + 130);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function searchFullText(fullTextPosts, summaryById, query, defaultResults) {
  const terms = getTerms(query);
  const existing = new Set(defaultResults.map((post) => post.postId));
  if (!terms.length) return [];

  return fullTextPosts
    .map((post, index) => {
      if (!includesAny(post.body, terms)) return null;
      const summary = summaryById.get(post.postId);
      if (!summary || existing.has(post.postId)) return null;
      return {
        ...summary,
        rank: 5,
        matchType: "body",
        icon: "📄",
        excerpt: makeExcerpt(post.body, terms),
        bodyOrder: index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.bodyOrder - b.bodyOrder);
}

function App() {
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [panelMode, setPanelMode] = useState(null);
  const [readMode, setReadMode] = useState("browse");
  const [levelOpen, setLevelOpen] = useState(false);
  const [fullTextPosts, setFullTextPosts] = useState([]);
  const [fullTextLoaded, setFullTextLoaded] = useState(false);
  const [fullTextLoading, setFullTextLoading] = useState(false);
  const [fullTextQuery, setFullTextQuery] = useState("");
  const programmedQueryRef = useRef(false);
  const { read, later, scraps, toggleLater, toggleScrap, markRead } = useUserActivity();

  useEffect(() => {
    let alive = true;
    fetch(assetPath("search-summary.json"))
      .then((res) => {
        if (!res.ok) throw new Error("search-summary.json fetch failed");
        return res.json();
      })
      .then((data) => {
        if (alive) setPosts((data.posts || []).map(normalizeSummaryPost).filter((post) => post.postId));
      })
      .catch(() => {
        if (alive) setPosts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setFullTextQuery("");
  }, [query]);

  const theses = useMemo(() => {
    return [...new Set(posts.map((post) => post.theses).filter(Boolean))];
  }, [posts]);

  const summaryById = useMemo(() => {
    return new Map(posts.map((post) => [post.postId, post]));
  }, [posts]);

  const defaultResults = useMemo(() => {
    if (panelMode === "later") return posts.filter((post) => later.has(post.postId)).map((post) => ({ ...post, icon: "⏰", matchType: "saved", excerpt: post.summary }));
    if (panelMode === "scrap") return posts.filter((post) => scraps.has(post.postId)).map((post) => ({ ...post, icon: "🔖", matchType: "saved", excerpt: post.summary }));
    if (selected) return searchSummaries(posts, selected.name);
    if (query.trim()) return searchSummaries(posts, query);
    return [];
  }, [posts, query, selected, panelMode, later, scraps]);

  const bodyResults = useMemo(() => {
    if (!fullTextQuery || panelMode !== "search") return [];
    return searchFullText(fullTextPosts, summaryById, fullTextQuery, defaultResults);
  }, [fullTextPosts, summaryById, fullTextQuery, defaultResults, panelMode]);

  const filtered = useMemo(() => {
    return [...defaultResults, ...bodyResults];
  }, [defaultResults, bodyResults]);

  const readCount = read.size;
  const level = Math.floor(readCount / 10) + 1;
  const nextLevel = level * 10;

  const runFullTextSearch = async () => {
    const term = query.trim();
    if (!term || fullTextLoading) return;
    setPanelMode("search");
    setFullTextLoading(true);
    try {
      let loadedPosts = fullTextPosts;
      if (!fullTextLoaded) {
        const manifestRes = await fetch(assetPath("ft-manifest.json"));
        if (!manifestRes.ok) throw new Error("ft-manifest.json fetch failed");
        const manifest = await manifestRes.json();
        const files = Array.isArray(manifest.files) ? manifest.files : [];
        const chunks = await Promise.all(
          files.map((file) =>
            fetch(assetPath(file))
              .then((res) => {
                if (!res.ok) throw new Error(`${file} fetch failed`);
                return res.json();
              })
              .then((data) => (data.posts || []).map(normalizeFullTextPost).filter((post) => post.postId))
          )
        );
        loadedPosts = chunks.flat();
        setFullTextPosts(loadedPosts);
        setFullTextLoaded(true);
      }
      setFullTextQuery(term);
    } finally {
      setFullTextLoading(false);
    }
  };

  const openTopic = (topic) => {
    programmedQueryRef.current = true;
    setQuery(topic.name);
    setSelected({ type: "topic", name: topic.name, subtitle: "대주제" });
    setPanelMode("search");
  };

  const openThesis = (name) => {
    programmedQueryRef.current = true;
    setQuery(name);
    setSelected({ type: "thesis", name, subtitle: "카테고리" });
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
      <Header query={query} setQuery={setQuery} openTopic={openTopic} openArchive={openArchive} level={level} setLevelOpen={setLevelOpen} runFullTextSearch={runFullTextSearch} fullTextLoading={fullTextLoading} />
      <section className="workspace">
        <GraphCanvas posts={posts} theses={theses} selected={selected} panelOpen={Boolean(panelMode)} onTopic={openTopic} onThesis={openThesis} onDismiss={() => setPanelMode(null)} />
        {panelMode && (
          <ListPanel
            mode={panelMode}
            selected={selected}
            query={query}
            posts={filtered}
            defaultCount={defaultResults.length}
            bodyCount={bodyResults.length}
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
      <Footer total={posts.length} />
      {levelOpen && <LevelModal posts={posts} level={level} read={read} readCount={readCount} nextLevel={nextLevel} onClose={() => setLevelOpen(false)} />}
    </main>
  );
}

function Header({ query, setQuery, openTopic, openArchive, level, setLevelOpen, runFullTextSearch, fullTextLoading }) {
  return (
    <header className="header">
      <div className="topbar">
        <div className="brand" aria-label="N-MIND Universe">
          <span className="bamboo">╂</span>
          <strong>N-MIND <b>UNIVERSE</b></strong>
        </div>
        <label className="search">
          <Search size={24} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·요약·카테고리 검색" />
        </label>
        <button className="pill iconPill" onClick={runFullTextSearch} disabled={!query.trim() || fullTextLoading}><Search />{fullTextLoading ? "검색중" : "본문 검색"}</button>
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

function GraphCanvas({ posts, theses, selected, panelOpen, onTopic, onThesis, onDismiss }) {
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
      const count = getTopicCount(posts, topic.name);
      return { ...topic, count, kind: "topic", r: 15 + Math.min(10, count / 12), a: (Math.PI * 2 * index) / TOPICS.length, d: 98 + (index % 3) * 25 };
    });

    const thesisNodes = theses.slice(0, 24).map((name, index) => {
      const topic = getTopicMeta(name);
      return { id: `thesis-${index}`, name, count: posts.filter((post) => post.theses === name).length, kind: "thesis", color: topic.color, r: 6 + (index % 3), a: (Math.PI * 2 * index) / Math.max(1, theses.length) + 0.3, d: 165 + (index % 5) * 15 };
    });

    const smallNodes = posts.slice(0, 52).map((post, index) => {
      const topic = getTopicMeta(post.theses);
      return { id: `small-${post.postId}`, name: "", kind: "small", color: topic.color, r: 2 + (index % 4), a: (Math.PI * 2 * index) / 52, d: 231 + (index % 8) * 13 };
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
  }, [posts, theses, selected, panelOpen]);

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

function getPostLink(post) {
  return post.link || `https://blog.naver.com/bambooinvesting/${encodeURIComponent(post.postId)}`;
}

function ListPanel(props) {
  const {
    mode,
    selected,
    query,
    posts,
    defaultCount,
    bodyCount,
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

  const openPost = (post) => {
    window.open(getPostLink(post), "_blank", "noopener,noreferrer");
    markRead(post.postId);
  };

  return (
    <aside className="panel">
      <button className="close" onClick={onClose}><X /></button>
      <p className="subtitle">{subtitle}</p>
      <h1>{title}</h1>
      {mode === "search" ? <strong className="count">{defaultCount}편이 제목·요약·카테고리와 일치합니다{bodyCount ? ` · 본문 ${bodyCount}편` : ""}</strong> : <strong className="count">나중에 읽기 {later.size}건 · 스크랩 {scraps.size}건</strong>}
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
          {posts.map((post) => (
            <article key={`${post.matchType}-${post.postId}`} className={read.has(post.postId) ? "read article" : "article"} onClick={() => openPost(post)}>
              <div>
                <h2><span className="matchIcon">{post.icon}</span>{post.title}</h2>
                <p className="articleExcerpt">{post.excerpt}</p>
                <time>{post.date} · {post.theses}</time>
              </div>
              <div className="articleActions">
                <button
                  className={later.has(post.postId) ? "saved ring-1 ring-amber-400 bg-emerald-950/40" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleLater(post.postId);
                  }}
                  title="나중에 읽기"
                >
                  ⏰
                </button>
                <button
                  className={scraps.has(post.postId) ? "saved ring-1 ring-amber-400 bg-emerald-950/40" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleScrap(post.postId);
                  }}
                  title="스크랩"
                >
                  🔖
                </button>
              </div>
            </article>
          ))}
          {!posts.length && <p className="empty">검색 결과가 없어요.</p>}
        </div>
      </div>
    </aside>
  );
}

function LevelModal({ posts, level, read, readCount, nextLevel, onClose }) {
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
        <p className="progressText">전체 진행도 <b>{readCount}</b> / {posts.length}편 ({posts.length ? Math.round((readCount / posts.length) * 100) : 0}%) · 다음 레벨까지 {Math.max(0, nextLevel - readCount)}편</p>
        <div className="bar"><span style={{ width: `${Math.min(100, (readCount % 10) * 10)}%` }} /></div>
        <div className="levelBody">
          <div className="radar">
            {TOPICS.map((topic, index) => <span key={topic.id} style={{ transform: `rotate(${index * 45}deg) translateY(-116px) rotate(${-index * 45}deg)` }}>{topic.name}</span>)}
          </div>
          <div className="topicProgress">
            {TOPICS.map((topic) => {
              const topicPosts = posts.filter((post) => post.theses.includes(topic.name));
              const topicRead = topicPosts.filter((post) => read.has(post.postId)).length;
              return <label key={topic.id}>{topic.name}<b>{topicRead}/{topicPosts.length}</b><i><span style={{ width: `${topicPosts.length ? (topicRead / topicPosts.length) * 100 : 0}%` }} /></i></label>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer({ total }) {
  return <footer className="footer">총 <b>{total.toLocaleString()}편</b> · © N-MIND. 비상업적 — <a href="https://minseok617.github.io/moso-universe" target="_new">Inspired by moso-universe</a></footer>;
}

createRoot(document.getElementById("root")).render(<App />);
