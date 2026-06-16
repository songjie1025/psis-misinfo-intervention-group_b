/**
 * app.js — Mock X-style homepage in MVC structure
 */

const Model = {
  getSessionId() {
    let id = localStorage.getItem("misinfo_session_id");
    if (!id) {
      id = "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("misinfo_session_id", id);
    }
    return id;
  },

  async fetchPosts() {
    try {
      const res = await fetch("mock-data/posts.json");
      if (!res.ok) throw new Error("Failed to load posts");
      return await res.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },
};

const Controller = {
  useAppController() {
    const [sessionId, setSessionId] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState("forYou");
    const [currentPage, setCurrentPage] = React.useState("home");
    const [posts, setPosts] = React.useState([]);

    React.useEffect(() => {
      setSessionId(Model.getSessionId());

      async function loadPosts() {
        const posts = await Model.fetchPosts();
        setPosts(posts);
      }

      loadPosts();
    }, []);

    const handleLike = (postId) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, likes: post.likes + 1 } : post
        )
      );
    };

    const handleShare = (postId) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, shares: post.shares + 1 } : post
        )
      );
    };

    const goToPage = (page) => setCurrentPage(page);
    const selectTab = (tab) => setActiveTab(tab);

    return {
      sessionId,
      activeTab,
      currentPage,
      posts,
      handleLike,
      handleShare,
      goToPage,
      selectTab,
    };
  },
};

// ---------------------------------------------------------------
// View components
// ---------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400 text-lg">Loading...</p>
    </div>
  );
}

function NavBar({ activeTab, onTabChange }) {
  return (
    <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-gray-800">
      <div className="flex">
        <button
          onClick={() => onTabChange("forYou")}
          className={`flex-1 py-4 font-semibold transition relative${
            activeTab === "forYou" ? "text-white" : "text-gray-500 hover:bg-gray-900"
          }`}
        >
          For you
        </button>
        <button
          onClick={() => onTabChange("following")}
          className={`flex-1 py-4 font-semibold transition ${
            activeTab === "following" ? "text-white" : "text-gray-500 hover:bg-gray-900"
          }`}
        >
          Following
        </button>
      </div>
    </nav>
  );
}

function Sidebar({ currentPage, onPageChange }) {
  const items = [
    { label: "Home", emoji: "🏠", page: "home" },
    { label: "Explore", emoji: "🔍", page: "explore" },
    { label: "Notifications", emoji: "🔔", page: "notifications" },
    { label: "Messages", emoji: "✉", page: "messages" },
    { label: "Profile", emoji: "👤", page: "profile" },
  ];

  return (
    <aside className="w-72 p-4">
      <div className="text-center mb-8 text-3xl">𝕏</div>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => onPageChange(item.page)}
            className={`w-full text-left rounded-full px-4 py-3 transition ${
              currentPage === item.page ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-900"
            }`}
          >
            <span className="mr-3">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function PostCard({ post, onLike, onShare }) {
  return (
    <article className="px-4 py-4 hover:bg-gray-900/50 transition border-b border-gray-800">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
          {post.author.charAt(0)}
        </div>
        <div>
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="font-semibold">{post.author}</span>
            <span className="text-gray-500">@{post.username}</span>
            <span className="text-gray-500">· {post.timestamp}</span>
          </div>
          <div className="text-xs text-gray-500">{post.category}</div>
        </div>
      </div>

      <p className="text-sm leading-7 mb-4">{post.content}</p>

      <div className="flex flex-wrap gap-6 text-sm text-gray-500">
        <button onClick={onLike} className="flex items-center gap-2 hover:text-blue-400 transition">
          ♡ {post.likes}
        </button>
        <button onClick={onShare} className="flex items-center gap-2 hover:text-green-400 transition">
          🔄 {post.shares}
        </button>
      </div>
    </article>
  );
}

function Feed({ posts, activeTab, onLike, onShare }) {
  const displayedPosts = activeTab === "following" ? posts.slice(0, posts.length) : posts;

  return (
    <div>
      {displayedPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={() => onLike(post.id)}
          onShare={() => onShare(post.id)}
        />
      ))}
    </div>
  );
}

function HomeRightPanel() {
  const trends = [
    { label: "#ClimateAction", subtitle: "Trending in Environment", count: "24.5K Tweets" },
    { label: "#Design", subtitle: "Trending in X", count: "12.1K Tweets" },
    { label: "#AI", subtitle: "Trending in Technology", count: "38.2K Tweets" },
  ];

  return (
    <aside className="hidden xl:block w-80 p-4">
      <div className="sticky top-4 space-y-4">
        <div className="rounded-3xl bg-gray-900 p-4 border border-gray-800">
          <input
            className="w-full rounded-full bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-gray-200 outline-none focus:border-blue-500"
            placeholder="Search X"
          />
        </div>

        <div className="rounded-3xl bg-gray-900 p-4 border border-gray-800">
          <h2 className="text-xl font-bold mb-4">What’s happening</h2>
          <div className="space-y-4">
            {trends.map((trend) => (
              <div key={trend.label} className="rounded-2xl p-3 bg-gray-950/60">
                <p className="text-xs text-gray-500">{trend.subtitle}</p>
                <p className="font-semibold">{trend.label}</p>
                <p className="text-xs text-gray-500 mt-1">{trend.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  const {
    sessionId,
    currentPage,
    activeTab,
    posts,
    handleLike,
    handleShare,
    goToPage,
    selectTab,
  } = Controller.useAppController();

  if (!sessionId) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="flex">
        <Sidebar currentPage={currentPage} onPageChange={goToPage} />

        <main className="flex-1 max-w-2xl border-l border-r border-gray-800">
          <NavBar activeTab={activeTab} onTabChange={selectTab} />
          <div className="px-4 py-3 border-b border-gray-800 bg-black/95">
            <h1 className="text-2xl font-bold">Home</h1>
            <p className="text-sm text-gray-500">A simple X-style homepage mockup.</p>
          </div>
          <Feed posts={posts} activeTab={activeTab} onLike={handleLike} onShare={handleShare} />
        </main>

        <HomeRightPanel />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
