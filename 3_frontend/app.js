/**
 * app.js — Twitter-style Mockup Feed with Misinformation Intervention
 *
 * This is the entire frontend for the PSIS prototype.
 * It runs in the browser without any build step — just open index.html.
 *
 * Architecture:
 *   App
 *   ├── BigFiveTest        (modal overlay, shown on first visit)
 *   ├── Feed               (main timeline)
 *   │   └── PostCard       (individual post × N)
 *   │       └── Intervention (Label / Justification / Interruption)
 *   └── Dashboard          (toggle view with stats + tips)
 *
 * State flow:
 *   1. User opens page → BFI-10 test appears
 *   2. User completes test → scores sent to POST /api/bigfive
 *   3. Feed loads posts from GET /api/posts
 *   4. User views a post → behavior logged via POST /api/behavior
 *   5. If post is misinformation → intervention shown
 *   6. User can switch to Dashboard view → GET /api/dashboard/{session}
 */

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------
// App — Root Component
// ---------------------------------------------------------------

function App() {
  const [sessionId, setSessionId] = React.useState(null);
  const [bigFiveDone, setBigFiveDone] = React.useState(false);
  const [showDashboard, setShowDashboard] = React.useState(false);

  // Generate a unique session ID on first load
  React.useEffect(() => {
    const stored = localStorage.getItem("misinfo_session_id");
    if (stored) {
      setSessionId(stored);
      setBigFiveDone(true);
    } else {
      const newId = "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("misinfo_session_id", newId);
      setSessionId(newId);
    }
  }, []);

  if (!sessionId) return <LoadingScreen />;

  if (!bigFiveDone) {
    return (
      <BigFiveTest
        sessionId={sessionId}
        onComplete={() => setBigFiveDone(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Top navigation bar */}
      <NavBar
        onToggleDashboard={() => setShowDashboard(!showDashboard)}
        showDashboard={showDashboard}
      />

      {/* Main content area */}
      <div className="max-w-2xl mx-auto">
        {showDashboard ? (
          <Dashboard sessionId={sessionId} />
        ) : (
          <Feed sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------
// Loading Screen
// ---------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400 text-lg">Loading...</p>
    </div>
  );
}


// ---------------------------------------------------------------
// Navigation Bar
// ---------------------------------------------------------------

function NavBar({ onToggleDashboard, showDashboard }) {
  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-gray-800">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold">MisinfoFeed</h1>
        <button
          onClick={onToggleDashboard}
          className="px-4 py-1.5 rounded-full border border-gray-600 text-sm hover:bg-gray-800 transition"
        >
          {showDashboard ? "← Feed" : "📊 Dashboard"}
        </button>
      </div>
    </nav>
  );
}


// ---------------------------------------------------------------
// BFI-10 Test — Big Five Inventory (simplified 10-item version)
// ---------------------------------------------------------------

const BFI10_QUESTIONS = [
  // Openness (items 1, 6 — reversed: none needed for this subset)
  { id: "o1", text: "I see myself as someone who is curious about many different things.", trait: "openness", reversed: false },
  { id: "o2", text: "I see myself as someone who values artistic, aesthetic experiences.", trait: "openness", reversed: false },
  // Conscientiousness (items 2, 7)
  { id: "c1", text: "I see myself as someone who does a thorough job.", trait: "conscientiousness", reversed: false },
  { id: "c2", text: "I see myself as someone who tends to be lazy.", trait: "conscientiousness", reversed: true },
  // Extraversion (items 3, 8)
  { id: "e1", text: "I see myself as someone who is outgoing, sociable.", trait: "extraversion", reversed: false },
  { id: "e2", text: "I see myself as someone who is reserved.", trait: "extraversion", reversed: true },
  // Agreeableness (items 4, 9)
  { id: "a1", text: "I see myself as someone who is generally trusting.", trait: "agreeableness", reversed: false },
  { id: "a2", text: "I see myself as someone who tends to find fault with others.", trait: "agreeableness", reversed: true },
  // Neuroticism (items 5, 10)
  { id: "n1", text: "I see myself as someone who gets nervous easily.", trait: "neuroticism", reversed: false },
  { id: "n2", text: "I see myself as someone who is relaxed, handles stress well.", trait: "neuroticism", reversed: true },
];

function BigFiveTest({ sessionId, onComplete }) {
  const [answers, setAnswers] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);

  // Record a Likert-scale answer (1 = strongly disagree, 5 = strongly agree)
  function setAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  // Calculate trait scores from individual items
  function calculateScores() {
    const traits = { openness: [], conscientiousness: [], extraversion: [], agreeableness: [], neuroticism: [] };
    BFI10_QUESTIONS.forEach(q => {
      const raw = answers[q.id] || 3; // default to neutral if unanswered
      const score = q.reversed ? (6 - raw) : raw;
      traits[q.trait].push(score);
    });
    // Each trait has 2 items, sum then scale to 2–10 range (BFI-10 standard)
    const result = {};
    for (const [trait, scores] of Object.entries(traits)) {
      result[trait] = scores.reduce((a, b) => a + b, 0); // range: 2–10
    }
    return result;
  }

  async function handleSubmit() {
    setSubmitting(true);
    const scores = calculateScores();
    try {
      await fetch(`${API_BASE}/api/bigfive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, ...scores }),
      });
      onComplete();
    } catch (err) {
      console.error("Failed to submit BFI-10:", err);
      alert("Could not connect to backend. Make sure the server is running on " + API_BASE);
    }
    setSubmitting(false);
  }

  const allAnswered = BFI10_QUESTIONS.every(q => answers[q.id]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-2xl font-bold mb-2">Personality Quiz</h2>
        <p className="text-gray-400 text-sm mb-6">
          Rate how much you agree with each statement. This helps us personalize your experience.
        </p>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto">
          {BFI10_QUESTIONS.map((q, i) => (
            <div key={q.id} className="border-b border-gray-800 pb-4">
              <p className="text-sm font-medium mb-2">
                {i + 1}. {q.text}
              </p>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Disagree strongly</span>
                <span>Agree strongly</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    onClick={() => setAnswer(q.id, val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      answers[q.id] === val
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className={`mt-6 w-full py-3 rounded-full font-bold text-lg transition ${
            allAnswered && !submitting
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          }`}
        >
          {submitting ? "Saving..." : "Start Browsing →"}
        </button>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------
// Feed — Main Timeline (Twitter-style)
// ---------------------------------------------------------------

function Feed({ sessionId }) {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeIntervention, setActiveIntervention] = React.useState(null);
  // Track which posts the user has already viewed (for behavior logging)
  const viewedRef = React.useRef(new Set());

  // Load posts from backend on mount
  React.useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch(`${API_BASE}/api/posts`);
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        console.error("Failed to load posts:", err);
      }
      setLoading(false);
    }
    loadPosts();
  }, []);

  // Log a view event when a post enters the viewport (once per post per session)
  function handlePostView(postId) {
    if (viewedRef.current.has(postId)) return;
    viewedRef.current.add(postId);
    fetch(`${API_BASE}/api/behavior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, post_id: postId, action: "view" }),
    }).catch(err => console.error("Behavior log failed:", err));
  }

  // Called when user interacts with a post (like, share, intervention dismiss/read)
  function handleInteraction(postId, action) {
    fetch(`${API_BASE}/api/behavior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, post_id: postId, action }),
    }).catch(err => console.error("Behavior log failed:", err));
  }

  // Check a post for misinformation and show intervention if needed
  async function handlePostClick(post) {
    try {
      const res = await fetch(`${API_BASE}/api/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id, post_content: post.content }),
      });
      const result = await res.json();

      if (result.is_misinformation) {
        // Fetch personalized intervention
        const intRes = await fetch(
          `${API_BASE}/api/intervention/${post.id}?session_id=${sessionId}`
        );
        const intervention = await intRes.json();
        setActiveIntervention({ ...intervention, postId: post.id });
      }
    } catch (err) {
      console.error("Detection failed:", err);
    }
  }

  function dismissIntervention() {
    if (activeIntervention) {
      handleInteraction(activeIntervention.postId, "dismiss_intervention");
    }
    setActiveIntervention(null);
  }

  function engageIntervention() {
    if (activeIntervention) {
      handleInteraction(activeIntervention.postId, "read_intervention");
    }
    setActiveIntervention(null);
  }

  if (loading) {
    return <p className="text-center text-gray-500 mt-20">Loading posts...</p>;
  }

  return (
    <div>
      {/* Intervention overlay (shown on top of feed when user clicks a misinfo post) */}
      {activeIntervention && (
        <InterventionDisplay
          intervention={activeIntervention}
          onDismiss={dismissIntervention}
          onEngage={engageIntervention}
        />
      )}

      {/* Post list */}
      <div className="divide-y divide-gray-800">
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onView={() => handlePostView(post.id)}
            onClick={() => handlePostClick(post)}
            onLike={() => handleInteraction(post.id, "like")}
            onShare={() => handleInteraction(post.id, "share")}
          />
        ))}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------
// PostCard — Individual Post in the Feed
// ---------------------------------------------------------------

function PostCard({ post, onView, onClick, onLike, onShare }) {
  // Fire view event when post appears
  React.useEffect(() => {
    onView();
  }, []);

  return (
    <article
      className="px-4 py-3 hover:bg-gray-900/50 cursor-pointer transition"
      onClick={onClick}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
          {post.author.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="font-semibold text-sm">@{post.author}</span>
          <span className="text-gray-500 text-sm ml-2">
            · {post.category}
          </span>
        </div>
      </div>

      {/* Post content */}
      <p className="text-sm leading-relaxed mb-3">{post.content}</p>

      {/* Interaction buttons (like, share) */}
      <div className="flex gap-6 text-gray-500 text-sm">
        <button
          onClick={(e) => { e.stopPropagation(); onLike(); }}
          className="hover:text-red-400 transition flex items-center gap-1"
        >
          ♡ Like
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="hover:text-green-400 transition flex items-center gap-1"
        >
          🔄 Share
        </button>
      </div>
    </article>
  );
}


// ---------------------------------------------------------------
// InterventionDisplay — Shows the appropriate intervention type
// ---------------------------------------------------------------

function InterventionDisplay({ intervention, onDismiss, onEngage }) {
  // Type 3: Interruption — full-screen modal
  if (intervention.type === "interruption") {
    return (
      <div className="intervention-overlay">
        <div className="intervention-card bg-gray-900 rounded-2xl p-8 max-w-md mx-4 text-center border border-red-500/30">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-3">{intervention.title}</h2>
          <p className="text-gray-300 mb-6">{intervention.body}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onEngage}
              className="px-6 py-2 rounded-full bg-red-600 hover:bg-red-700 font-semibold transition"
            >
              {intervention.confirm_text}
            </button>
            <button
              onClick={onDismiss}
              className="px-6 py-2 rounded-full border border-gray-600 hover:bg-gray-800 transition"
            >
              {intervention.cancel_text}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Type 1 & 2: Label or Justification — inline card
  return (
    <div
      className={`intervention-card mx-4 my-2 rounded-xl p-4 border ${
        intervention.type === "label"
          ? "border-red-500/40 bg-red-900/20"
          : "border-yellow-500/40 bg-yellow-900/20"
      }`}
    >
      {/* Type 1: Label */}
      {intervention.type === "label" && (
        <div className="flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: intervention.color }}>
              {intervention.badge_text}
            </p>
            <button
              onClick={onEngage}
              className="mt-2 text-sm text-blue-400 hover:underline"
            >
              {intervention.action_text}
            </button>
          </div>
          <button onClick={onDismiss} className="text-gray-500 hover:text-white text-lg">×</button>
        </div>
      )}

      {/* Type 2: Justification */}
      {intervention.type === "justification" && (
        <div>
          <h3 className="font-bold text-sm mb-2">📋 {intervention.title}</h3>
          <p className="text-sm text-gray-300 mb-2">{intervention.explanation}</p>
          <p className="text-xs text-gray-500 mb-3">{intervention.source}</p>
          <div className="flex gap-2">
            <button
              onClick={onEngage}
              className="text-sm px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 transition"
            >
              {intervention.action_text}
            </button>
            <button
              onClick={onDismiss}
              className="text-sm px-4 py-1.5 rounded-full border border-gray-600 hover:bg-gray-800 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------
// Dashboard — Stats & Personalized Tips (Idea 2 integration)
// ---------------------------------------------------------------

function Dashboard({ sessionId }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/${sessionId}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Dashboard load failed:", err);
      }
      setLoading(false);
    }
    loadDashboard();
  }, [sessionId]);

  if (loading) return <p className="text-center text-gray-500 mt-20">Loading dashboard...</p>;
  if (!data) return <p className="text-center text-gray-500 mt-20">No data yet. Browse some posts first!</p>;

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Your Dashboard</h2>

      {/* Topic Diversity */}
      <section className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Topic Diversity</h3>
        {Object.keys(data.topic_diversity).length === 0 ? (
          <p className="text-sm text-gray-500">No posts viewed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.topic_diversity).map(([topic, count]) => (
              <span key={topic} className="px-3 py-1 rounded-full bg-gray-800 text-sm">
                {topic}: {count}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Misinformation Exposure */}
      <section className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Misinformation Exposure</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{data.misinformation_exposure.misinfo_posts_seen}</p>
            <p className="text-xs text-gray-500">Flagged Posts</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.misinformation_exposure.total_posts_seen}</p>
            <p className="text-xs text-gray-500">Total Viewed</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {Math.round(data.misinformation_exposure.misinfo_ratio * 100)}%
            </p>
            <p className="text-xs text-gray-500">Misinfo Ratio</p>
          </div>
        </div>
      </section>

      {/* Intervention Engagement */}
      <section className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Intervention Engagement</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{data.intervention_stats.interventions_shown}</p>
            <p className="text-xs text-gray-500">Shown</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.intervention_stats.interventions_engaged}</p>
            <p className="text-xs text-gray-500">Read / Engaged</p>
          </div>
        </div>
        {/* Simple progress bar for engagement rate */}
        <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all"
            style={{ width: `${Math.round(data.intervention_stats.engagement_rate * 100)}%` }}
          />
        </div>
      </section>

      {/* Personalized Tips (based on Big Five) */}
      <section className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tips for You</h3>
        <ul className="space-y-2">
          {data.tips.map((tip, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-blue-400">💡</span>
              <span className="text-gray-300">{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Risk Score */}
      <section className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Risk Score</h3>
        <p className="text-3xl font-bold">
          {Math.round((data.risk_score || 0) * 100)}%
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Higher = more vulnerable to misinformation
        </p>
      </section>
    </div>
  );
}


// ---------------------------------------------------------------
// Mount the app
// ---------------------------------------------------------------

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
