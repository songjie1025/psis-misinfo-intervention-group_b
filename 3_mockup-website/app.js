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
  initializePostState(post) {
      return {
      ...post,
      liked: false,
      shared: false,
      bookmarked: false,
    };
  },

  useAppController() {
    const [sessionId, setSessionId] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState("forYou");
    const [currentPage, setCurrentPage] = React.useState("home");
    const [posts, setPosts] = React.useState([]);
    const [comments, setComments] = React.useState([]);
    const [selectedPostId, setSelectedPostId] = React.useState(null);
    const [draftText, setDraftText] = React.useState("");

    React.useEffect(() => {
      setSessionId(Model.getSessionId());

      async function loadData() {
        const [posts, comments] = await Promise.all([
          Model.fetchPosts(),
          Model.fetchComments(),
        ]);
        setPosts(posts.map(Controller.initializePostState));
        setComments(comments);
      }

      loadData();
    }, []);

    const handleLike = (postId) => {
      setPosts(prev =>
        prev.map(post => {
          if (post.id !== postId) return post;

          return {
            ...post,
            likes: post.liked
              ? post.likes - 1
              : post.likes + 1,
            liked: !post.liked
          };
        })
      );
    };

    const handleShare = (postId) => {
      setPosts(prev =>
        prev.map(post => {
          if (post.id !== postId) return post;

          return {
            ...post,
            shares: post.shared
              ? post.shares - 1
              : post.shares + 1,
            shared: !post.shared
          };
        })
      );
    };

    const handleBookmark = (postId) => {
      setPosts(prev =>
        prev.map(post => {
          if (post.id !== postId) return post;

          return {
            ...post,
            bookmarked: !post.bookmarked
          };
        })
      );
    };

    const handleAddComment = (postId, content) => {
      if (!content || !content.trim()) return;
      const newComment = {
        id: "c" + Date.now(),
        postId: String(postId),
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
      const newPost = Controller.initializePostState({
        id: "p" + Date.now(),
        author: "You",
        username: (sessionId || "you").toString().slice(0, 12),
        content: draftText.trim(),
        timestamp: "now",
        category: "",
        likes: 0,
        shares: 0,
        isOwnPost: true,
      });
      setPosts((prevPosts) => [newPost, ...prevPosts]);
      setDraftText("");
    };

    const handlePostClick = (postId) => {
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
      handleBookmark,
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


// SVG Icons
function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16V11a6 6 0 10-12 0v5l-2 2h16z" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16v11H7l-3 3z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
    </svg>
  );
}

function HomeIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M21 10.5L12 3 3 10.5V21h6v-6h6v6h6V10.5z" />
    </svg>
  );
}

function ExploreIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M10.5 3a7.5 7.5 0 105.04 13.06l4.2 4.19 1.41-1.41-4.19-4.2A7.5 7.5 0 0010.5 3z" />
    </svg>
  );
}

function NotificationIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M19 17H5l1.8-2.4V10a5.2 5.2 0 0110.4 0v4.6L19 17zm-7 4a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0012 21z" />
    </svg>
  );
}

function MessageIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M2 5h20v14H6l-4 3V5z" />
    </svg>
  );
}

function BookmarkIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M5 3h14v18l-7-4.5L5 21V3z" />
    </svg>
  );
}

function ProfileIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.4 0-8 2.7-8 6h16c0-3.3-3.6-6-8-6z" />
    </svg>
  );
}

function MoreIconFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11.5c0 4.1-3.8 7.5-8.5 7.5-1.1 0-2.2-.2-3.2-.6L4 20l1.2-3.6C4.4 15 3 13.3 3 11.5 3 7.4 6.8 4 11.5 4S20 7.4 20 11.5z" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 4l4 4-4 4" />
      <path d="M3 12V8h18" />
      <path d="M7 20l-4-4 4-4" />
      <path d="M21 12v4H3" />
    </svg>
  );
}

function LikeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5l-1.1-1C5.2 14.4 2 11.6 2 8.1 2 5.3 4.2 3 7 3c1.7 0 3.4.8 5 2.6C13.6 3.8 15.3 3 17 3c2.8 0 5 2.3 5 5.1 0 3.5-3.2 6.3-8.9 11.4L12 20.5z" />
    </svg>
  );
}

function LikeIconFilled() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="currentColor"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
    </svg>
  );
}

function BookmarkIconSmall() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4.5h10a1 1 0 011 1V20l-6-4-6 4V5.5a1 1 0 011-1z" />
    </svg>
  );
}

function BookmarkIconFilledSmall() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="currentColor"
    >
      <path d="M7 4.5h10a1 1 0 011 1V20l-6-4-6 4V5.5a1 1 0 011-1z" />
    </svg>
  );
}

function Sidebar({ currentPage, onPageChange }) {

const items = [
    {
      label: "Home",
      icon: HomeIcon,
      activeIcon: HomeIconFilled,
      page: "home"
    },
    {
      label: "Explore",
      icon: ExploreIcon,
      activeIcon: ExploreIconFilled,
      page: "explore"
    },
    {
      label: "Notifications",
      icon: NotificationIcon,
      activeIcon: NotificationIconFilled,
      page: "notifications"
    },
    {
      label: "Messages",
      icon: MessageIcon,
      activeIcon: MessageIconFilled,
      page: "messages"
    },
    {
      label: "Bookmarks",
      icon: BookmarkIcon,
      activeIcon: BookmarkIconFilled,
      page: "bookmarks"
    },
    {
      label: "Profile",
      icon: ProfileIcon,
      activeIcon: ProfileIconFilled,
      page: "profile"
    },
    {
      label: "More",
      icon: MoreIcon,
      activeIcon: MoreIconFilled,
      page: "more"
    },
  ];

  return (
    <aside className="w-72 p-4 sticky top-0 self-start h-screen">
      <div className="text-center mb-8 text-3xl">
        <button
          onClick={() => onPageChange("home")}
          className="text-white"
        >
          𝕏
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon =
            currentPage === item.page
              ? item.activeIcon
              : item.icon;

          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={`flex items-center gap-4 px-4 py-3 rounded-full transition ${
                currentPage === item.page
                  ? "text-white font-bold"
                  : "text-gray-300 hover:bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-4">
                <Icon />
                <span className={currentPage === item.page ? "font-bold" : "font-normal"}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PostCard({
  post,
  commentCount,
  onCardClick,
  onComment,
  onShare,
  onLike,
  onBookmark,
  compact,
}) {

  const containerClass = compact
    ? "cursor-auto px-3 py-3 hover:bg-gray-900/50 transition border-b border-gray-800"
    : "cursor-pointer px-4 py-4 hover:bg-gray-900/50 transition border-b border-gray-800";
  const avatarClass = compact ? "w-9 h-9" : "w-11 h-11";

  return (
    <article onClick={onCardClick} className={containerClass}>
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
              <CommentIcon />
              <span>{commentCount ?? 0}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onShare) onShare(post.id);
              }}
              className={`flex items-center gap-2 transition ${
                post.shared
                  ? "text-green-400"
                  : "hover:text-indigo-400"
              }`}
            >
              <RepostIcon />
              <span>{post.shares ?? 0}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onLike) onLike(post.id);
              }}
              className={`flex items-center gap-2 transition ${
                post.liked
                  ? "text-red-400"
                  : "hover:text-red-400"
              }`}
            >
              <LikeIcon />
              <span>{post.likes ?? 0}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onBookmark) onBookmark(post.id);
              }}
              className={`flex items-center gap-2 transition ${
                post.bookmarked
                  ? "text-sky-500"
                  : "text-white hover:text-sky-500"
              }`}
            >
              {post.bookmarked
                ? <BookmarkIconFilledSmall />
                : <BookmarkIconSmall />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Feed({ posts, comments, activeTab, onCardClick, onLike, onShare, onBookmark }) {
  const displayedPosts =
    activeTab === "following"
      ? posts.filter(post => post.isOwnPost)
      : posts;

if (displayedPosts.length === 0) {
  return (
    <p className="p-6 text-gray-400">
      No posts to display.
    </p>
  );
}

return (
  <div>
    {displayedPosts.map((post) => {
      const commentCount = comments.filter(
        comment => String(comment.postId) === String(post.id)
      ).length;

      return (
        <PostCard
          key={post.id}
          post={post}
          commentCount={commentCount}
          onCardClick={() => onCardClick(post.id)}
          onComment={() => onCardClick(post.id)}
          onShare={() => onShare(post.id)}
          onLike={() => onLike(post.id)}
          onBookmark={() => onBookmark(post.id)}
        />
      );
    })}
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

function PostDetail({ post, comments, onLike, onShare, onBack, onAddComment, onBookmark}) {
  const postComments = comments.filter(
    (comment) => String(comment.postId) === String(post.id),
  );
  const commentCount = postComments.length;
  const [replyText, setReplyText] = React.useState("");
  const replyRef = React.useRef(null);

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
            <CommentIcon />
            <span>{commentCount}</span>
          </button>

          <button
            onClick={() => onShare(post.id)}
            className={`flex items-center gap-2 transition ${
              post.shared
                ? "text-green-400"
                : "hover:text-indigo-400"
            }`}
          >
            <RepostIcon />
            <span>{post.shares ?? 0}</span>
          </button>

          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-2 transition ${
              post.liked
                ? "text-red-400"
                : "hover:text-red-400"
            }`}
          >
            {post.liked ? <LikeIconFilled /> : <LikeIcon />}
            <span>{post.likes ?? 0}</span>
          </button>

          <button
            onClick={() => onBookmark(post.id)}
            className={`flex items-center gap-2 transition ${
              post.bookmarked
                ? "text-sky-500"
                : "text-white hover:text-sky-500"
            }`}
          >
            {post.bookmarked
              ? <BookmarkIconFilledSmall />
              : <BookmarkIconSmall />}
          </button>
        </div>
      </article>

      <section className="px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <textarea
            ref={replyRef}
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
    handleBookmark,
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
          {currentPage === "home" && (
            <NavBar activeTab={activeTab} onTabChange={selectTab} />
          )}

          {selectedPost ? (
            <PostDetail
              post={selectedPost}
              comments={comments}
              onLike={handleLike}
              onShare={handleShare}
              onBack={handleBackToFeed}
              onBookmark={handleBookmark}
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
                comments={comments}
                activeTab={activeTab}
                onCardClick={handlePostClick}
                onLike={handleLike}
                onShare={handleShare}
                onBookmark={handleBookmark}
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
