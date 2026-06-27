/**
 * app.js — Mock X-style homepage in MVC structure
 *
 * SETUP (one-time):
 * - Windows: run .\setup.bat
 * - Mac/Linux: run ./setup.sh
 * - Or manually: npm install && npm run compile
 *
 * RUN:
 * - npm start (starts Python server on http://localhost:8000)
 * - Edit this file and run: npm run compile
 * - Refresh browser to see changes
 */

const Model = {
  getSessionId() {
    let id = localStorage.getItem("misinfo_session_id");
    if (!id) {
      id =
        "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
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

  async fetchComments() {
    try {
      const res = await fetch("mock-data/comments.json");
      if (!res.ok) throw new Error("Failed to load comments");
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
    const [comments, setComments] = React.useState([]);
    const [selectedPostId, setSelectedPostId] = React.useState(null);
    const [draftText, setDraftText] = React.useState("");
    // Remember the feed's scroll position so returning from a post detail restores it
    // instead of jumping to the top (the feed is unmounted while viewing a detail).
    const scrollPositionRef = React.useRef(0);

    React.useLayoutEffect(() => {
      // Opening a post -> start the detail at the top; returning -> restore the feed.
      window.scrollTo(0, selectedPostId === null ? scrollPositionRef.current : 0);
    }, [selectedPostId]);

    React.useEffect(() => {
      setSessionId(Model.getSessionId());

      async function loadData() {
        const [posts, comments] = await Promise.all([
          Model.fetchPosts(),
          Model.fetchComments(),
        ]);
        setPosts(posts);
        setComments(comments);
      }

      loadData();
    }, []);

    const handleLike = (postId) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, likes: post.likes + 1 } : post,
        ),
      );
    };

    const handleShare = (postId) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, shares: post.shares + 1 } : post,
        ),
      );
    };

    const handleAddComment = (postId, content) => {
      if (!content || !content.trim()) return;
      const newComment = {
        id: "c" + Date.now(),
        postId: string(postId),
        author: "You",
        username: (sessionId || "you").toString().slice(0, 12),
        content: content.trim(),
        timestamp: "now",
      };
      setComments((prev) => [newComment, ...prev]);
    };

    const handleDraftChange = (value) => {
      setDraftText(value);
    };

    const handleCreatePost = () => {
      if (!draftText.trim()) return;
      const newPost = {
        id: "p" + Date.now(),
        author: "You",
        username: (sessionId || "you").toString().slice(0, 12),
        content: draftText.trim(),
        timestamp: "now",
        category: "",
        likes: 0,
        shares: 0,
      };
      setPosts((prevPosts) => [newPost, ...prevPosts]);
      setDraftText("");
    };

    const handlePostClick = (postId) => {
      scrollPositionRef.current = window.scrollY;
      setSelectedPostId(postId);
    };

    const handleBackToFeed = () => {
      setSelectedPostId(null);
    };

    const goToPage = (page) => {
      setCurrentPage(page);
      setSelectedPostId(null);
    };

    const selectTab = (tab) => setActiveTab(tab);

    return {
      sessionId,
      activeTab,
      currentPage,
      posts,
      comments,
      selectedPostId,
      draftText,
      handleLike,
      handleShare,
      handleAddComment,
      handleDraftChange,
      handleCreatePost,
      handlePostClick,
      handleBackToFeed,
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
          className={`flex-1 py-4 font-semibold transition border-b-2 ${
            activeTab === "forYou"
              ? "text-white border-blue-500"
              : "text-gray-500 border-transparent hover:text-white"
          }`}
        >
          For you
        </button>
        <button
          onClick={() => onTabChange("following")}
          className={`flex-1 py-4 font-semibold transition border-b-2 ${
            activeTab === "following"
              ? "text-white border-blue-500"
              : "text-gray-500 border-transparent hover:text-white"
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
    { label: "Home", emoji: "  ", page: "home" },
    { label: "Explore", emoji: "  ", page: "explore" },
    { label: "Notifications", emoji: "  ", page: "notifications" },
    { label: "Messages", emoji: "  ", page: "messages" },
    { label: "Bookmarks", emoji: "  ", page: "bookmarks" },
    { label: "Profile", emoji: "  ", page: "profile" },
    { label: "More", emoji: "  ", page: "more" },
    { label: "Post", emoji: "  ", page: "post" },
  ];

  return (
    <aside className="w-72 p-4 sticky top-0 self-start h-screen">
      <div className="text-center mb-8 text-3xl">𝕏</div>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => onPageChange(item.page)}
            className={`w-full text-left rounded-full px-4 py-3 transition ${
              currentPage === item.page
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-900"
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

function PostCard({
  post,
  onCardClick,
  onComment,
  onShare,
  onLike,
  onBookmark,
  compact,
}) {
  const [bookmarked, setBookmarked] = React.useState(false);
  const containerClass = compact
    ? "cursor-auto px-3 py-3 hover:bg-gray-900/50 transition border-b border-gray-800"
    : "cursor-pointer px-4 py-4 hover:bg-gray-900/50 transition border-b border-gray-800";
  const avatarClass = compact ? "w-9 h-9" : "w-11 h-11";

  return (
    <article
      {...(!compact
        ? { "data-xcheck-post": "", "data-xcheck-post-id": post.id }
        : {})}
      onClick={onCardClick}
      className={containerClass}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`${avatarClass} rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold`}
        >
          {post.author.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="font-semibold">{post.author}</span>
            <span className="text-gray-500">@{post.username}</span>
            <span className="text-gray-500">· {post.timestamp}</span>
          </div>
          {!compact && (
            <div className="text-xs text-gray-500">{post.category}</div>
          )}
          <p
            className={
              compact ? "text-sm leading-6 mt-2" : "text-sm leading-7 mt-2"
            }
          >
            {post.content}
          </p>

          <div className="flex items-center justify-between gap-6 text-sm text-gray-500 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onComment) onComment();
              }}
              className="flex items-center gap-2 hover:text-blue-400 transition"
            >
              💬
            </button>

            <button
              data-xcheck-share="true"
              onClick={(e) => {
                e.stopPropagation();
                if (onShare) onShare(post.id);
              }}
              className="flex items-center gap-2 hover:text-indigo-400 transition"
            >
              🔄 {post.shares ?? 0}
            </button>

            <button
              data-xcheck-like="true"
              onClick={(e) => {
                e.stopPropagation();
                if (onLike) onLike(post.id);
              }}
              className="flex items-center gap-2 hover:text-red-400 transition"
            >
              ♡ {post.likes ?? 0}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setBookmarked((b) => !b);
                if (onBookmark) onBookmark(post.id);
              }}
              className="flex items-center gap-2 hover:text-yellow-400 transition"
            >
              {bookmarked ? "🔖" : "📑"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Feed({ posts, activeTab, onCardClick, onLike, onShare }) {
  const displayedPosts =
    activeTab === "following" ? posts.slice(0, posts.length) : posts;

  return (
    <div>
      {displayedPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onCardClick={() => onCardClick(post.id)}
          onComment={() => onCardClick(post.id)}
          onShare={() => onShare(post.id)}
          onLike={() => onLike(post.id)}
          onBookmark={() => {}}
        />
      ))}
    </div>
  );
}

function ComposePostBox({ draftText, onDraftChange, onCreatePost, username }) {
  return (
    <div className="px-4 py-4 border-b border-gray-800 bg-black/95">
      <div className="flex gap-3 items-center">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
          {username.charAt(0).toUpperCase()}
        </div>

        <textarea
          value={draftText}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="What’s happening?"
          className="flex-1 resize-none bg-transparent border-none p-0 text-lg text-gray-200 outline-none placeholder:text-gray-500"
        />

        <div className="flex items-center ml-2">
          <button
            onClick={onCreatePost}
            disabled={!draftText.trim()}
            className={`rounded-full px-4 py-2 text-sm transition ${
              draftText.trim()
                ? "bg-white text-black hover:bg-gray-200"
                : "bg-gray-700 text-gray-500"
            }`}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetail({ post, comments, onLike, onShare, onBack, onAddComment }) {
  const postComments = comments.filter(
    (comment) => String(comment.postId) === String(post.id),
  );
  const [replyText, setReplyText] = React.useState("");
  const replyRef = React.useRef(null);
  const [postBookmarked, setPostBookmarked] = React.useState(false);

  const submitReply = () => {
    if (!replyText || !replyText.trim()) return;
    onAddComment(post.id, replyText.trim());
    setReplyText("");
  };

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-black/95 flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full px-3 py-2 font-bold text-lg text-white-400 hover:bg-white/5"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </div>

      <article className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
            {post.author.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex flex-wrap gap-2 items-center text-sm">
                  <span className="font-semibold">{post.author}</span>
                  <span className="text-gray-500">@{post.username}</span>
                  <span className="text-gray-500">· {post.timestamp}</span>
                </div>
                <div className="text-xs text-gray-500">{post.category}</div>
              </div>
              <div className="ml-auto">
                <button className="rounded-full bg-blue-500/20 text-blue-300 px-3 py-1 text-sm">
                  Follow
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-base leading-8 mb-4">{post.content}</p>
        <div className="pt-4 border-t border-gray-800 -mx-4"></div>

        <div className="flex items-center justify-between gap-6 text-sm text-gray-500 mb-2">
          <button
            onClick={() => replyRef.current && replyRef.current.focus()}
            className="flex items-center gap-2 hover:text-blue-400 transition"
          >
            💬
          </button>

          <button
            onClick={() => onShare(post.id)}
            className="flex items-center gap-2 hover:text-indigo-400 transition"
          >
            🔄 {post.shares}
          </button>

          <button
            onClick={() => onLike(post.id)}
            className="flex items-center gap-2 hover:text-red-400 transition"
          >
            ♡ {post.likes}
          </button>

          <button
            onClick={() => setPostBookmarked((b) => !b)}
            className="flex items-center gap-2 hover:text-yellow-400 transition"
          >
            {postBookmarked ? "🔖" : "📑"}
          </button>
        </div>
      </article>

      <section className="px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply to this post"
            className="flex-1 resize-none bg-transparent border-none p-0 text-lg text-gray-200 outline-none placeholder:text-gray-500"
            rows={2}
          />
          <button
            onClick={submitReply}
            disabled={!replyText.trim()}
            className={`rounded-full px-4 py-2 text-sm transition ${
              replyText.trim()
                ? "bg-white text-black hover:bg-gray-200"
                : "bg-gray-700 text-gray-500"
            }`}
          >
            Reply
          </button>
        </div>

        {postComments.length === 0 ? (
          <div className="pt-4 border-t border-gray-800 -mx-4">
            <p className="px-6 text-sm text-gray-500">No replies yet.</p>
          </div>
        ) : (
          <div className="pt-4 border-t border-gray-800 -mx-4">
            {postComments.map((comment) => (
              <PostCard
                key={comment.id}
                post={{
                  id: comment.id,
                  author: comment.author,
                  username: comment.username,
                  content: comment.content,
                  timestamp: comment.timestamp,
                  likes: comment.likes || 0,
                  shares: comment.shares || 0,
                  category: "",
                }}
                compact={true}
                onCardClick={() => {}}
                onComment={() => {}}
                onShare={() => {}}
                onLike={() => {}}
                onBookmark={() => {}}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HomeRightPanel() {
  const trends = [
    {
      label: "#ClimateAction",
      subtitle: "Trending in Environment",
      count: "24.5K Tweets",
    },
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
    comments,
    selectedPostId,
    draftText,
    handleLike,
    handleShare,
    handleAddComment,
    handleDraftChange,
    handleCreatePost,
    handlePostClick,
    handleBackToFeed,
    goToPage,
    selectTab,
  } = Controller.useAppController();

  const selectedPost = posts.find((post) => post.id === selectedPostId);

  if (!sessionId) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="flex">
        <Sidebar currentPage={currentPage} onPageChange={goToPage} />

        <main className="flex-1 max-w-2xl border-l border-r border-gray-800">
          <NavBar activeTab={activeTab} onTabChange={selectTab} />

          {selectedPost ? (
            <PostDetail
              post={selectedPost}
              comments={comments}
              onLike={handleLike}
              onShare={handleShare}
              onBack={handleBackToFeed}
              onAddComment={handleAddComment}
            />
          ) : currentPage === "home" ? (
            <>
              <ComposePostBox
                draftText={draftText}
                onDraftChange={handleDraftChange}
                onCreatePost={handleCreatePost}
                username={(sessionId || "you").toString().slice(0, 12)}
              />
              <Feed
                posts={posts}
                activeTab={activeTab}
                onCardClick={handlePostClick}
                onLike={handleLike}
                onShare={handleShare}
              />
            </>
          ) : (
            <div className="px-4 py-6">
              <div className="px-4 py-3 border-b border-gray-800 bg-black/95">
                <h1 className="text-2xl font-bold capitalize">{currentPage}</h1>
                <p className="text-sm text-gray-500">
                  This page is not available yet.
                </p>
              </div>
              <div className="p-6 text-gray-400">
                Choose Home to view the feed.
              </div>
            </div>
          )}
        </main>

        <HomeRightPanel />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
