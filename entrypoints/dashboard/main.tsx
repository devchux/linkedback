import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  day,
  initialHistory,
  type Action,
  type History,
  type Post,
  type Retention,
} from "@/lib/history";
import "./dashboard.css";

const icons = {
  logo: "M3 6 12 2l9 4v12l-9 4-9-4z M3 6l9 4 9-4 M3 12l9 4 9-4",
  chart: "M5 20v-7m7 7V4m7 16V9",
  trash: "M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6",
  search: "M15.5 15.5 21 21M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  calendar: "M4 6h16v15H4zM4 11h16M8 3v5m8-5v5",
  clock: "M12 6v6l4 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  external: "M13 4h7v7m0-7-9 9m7 0v7H4V6h7",
  previous: "m15 5-7 7 7 7",
  next: "m9 5 7 7-7 7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  react:
    "M7 10v10H3V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1.2-5A2 2 0 0 0 18.3 10H15l.5-4a2 2 0 0 0-3.7-1.2L7 10",
  comment: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.8-4A8.5 8.5 0 1 1 21 11.5Z",
  repost: "M5 11V6h14l-3-3m3 3-3 3m3 4v5H5l3 3m-3-3 3-3",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
};
function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name]} />
    </svg>
  );
}

function Illustration() {
  return (
    <svg className="illustration" viewBox="0 0 220 145" aria-hidden="true">
      <path
        fill="#e8eff8"
        d="M32 43Q65 3 111 9t81 42q34 39-4 69t-103 14Q17 126 14 88 10 61 32 43Z"
      />
      <rect
        x="44"
        y="38"
        width="122"
        height="77"
        rx="9"
        fill="#fff"
        stroke="#a3bad4"
      />
      <path
        d="M60 53h20m-20 12h72m-72 12h63m-63 12h32m-32 12h48"
        stroke="#ccd7e5"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle
        cx="159"
        cy="87"
        r="20"
        fill="#e9f1fc"
        fillOpacity=".72"
        stroke="#4e749f"
        strokeWidth="4"
      />
      <path
        d="m173 102 18 18"
        stroke="#4e749f"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Confirmation =
  | { type: "clear" }
  | { type: "delete"; id: string }
  | { type: "retention"; days: Retention };
const startOfDay = (offset = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getTime();
};
function groupLabel(timestamp: number) {
  if (timestamp >= startOfDay()) return "Today";
  if (timestamp >= startOfDay(-1)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(timestamp);
}
function saved(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes === 0) return "Saved just now";
  if (minutes < 60)
    return (
      "Saved " + minutes + (minutes === 1 ? " minute ago" : " minutes ago")
    );
  if (timestamp >= startOfDay())
    return (
      "Saved today at " +
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(timestamp)
    );
  return "Saved " + groupLabel(timestamp).toLowerCase();
}
function Author({ post }: { post: Post }) {
  return (
    <header className="author">
      {post.avatar ? (
        <img src={post.avatar} alt="" />
      ) : (
        <span className="avatar">{post.author.trim()[0] || "?"}</span>
      )}
      <div>
        <strong>{post.author || "LinkedIn member"}</strong>
        {post.headline && <div>{post.headline}</div>}
        {post.published && <div>Published {post.published}</div>}
        <time dateTime={new Date(post.lastViewed).toISOString()}>
          {saved(post.lastViewed)}
        </time>
      </div>
    </header>
  );
}

function Engagement({ post }: { post: Post }) {
  const { reactions, comments, reposts } = post.engagement ?? {};
  if (!reactions && !comments && !reposts) return null;
  return (
    <footer className="engagement">
      {reactions && (
        <span>
          <Icon name="react" /> {reactions} reactions
        </span>
      )}
      {comments && (
        <span>
          <Icon name="comment" /> {comments} comments
        </span>
      )}
      {reposts && (
        <span>
          <Icon name="repost" /> {reposts} reposts
        </span>
      )}
    </footer>
  );
}

function PostMedia({ post }: { post: Post }) {
  const [selected, setSelected] = useState(0);
  const videos = post.videos ?? [];
  const images = post.media.filter(
    (url) => !videos.some((video) => video.poster === url),
  );
  const count = videos.length + images.length;
  if (!count) return null;

  const index = Math.min(selected, count - 1);
  const video = videos[index];
  const image = images[index - videos.length];

  return (
    <div className="post-media">
      <div className="media-slide" key={video?.url || video?.poster || image}>
        {video?.url ? (
          <video
            controls
            playsInline
            preload="none"
            poster={video.poster}
            aria-label="Saved post video"
            src={video.url}
          />
        ) : video ? (
          <div className="video-preview">
            <img src={video.poster} loading="lazy" alt="Video preview" />
            {post.url && (
              <a href={post.url} target="_blank" rel="noreferrer">
                Watch on LinkedIn <Icon name="external" />
              </a>
            )}
          </div>
        ) : (
          <img
            src={image}
            loading="lazy"
            alt={"Post image " + (index - videos.length + 1)}
          />
        )}
      </div>
      {count > 1 && (
        <div
          className="media-navigation"
          role="group"
          aria-label="Post media navigation"
        >
          <button
            type="button"
            aria-label="Previous slide"
            aria-disabled={index === 0}
            onClick={() => setSelected(Math.max(0, index - 1))}
          >
            <Icon name="previous" />
          </button>
          <span role="status" aria-atomic="true">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            aria-label="Next slide"
            aria-disabled={index === count - 1}
            onClick={() => setSelected(Math.min(count - 1, index + 1))}
          >
            <Icon name="next" />
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [history, setHistory] = useState<History>(initialHistory);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [date, setDate] = useState("any");
  const [settings, setSettings] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const main = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<{ id: string; scroll: number; pageScroll: number }>(
    null,
  );
  const detail = history.posts.find((post) => post.id === detailId);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  async function send(action: Action) {
    try {
      const result = (await browser.runtime.sendMessage(action)) as {
        history?: History;
        celebrate?: boolean;
        error?: string;
      };
      if (!result?.history)
        throw new Error(
          result?.error || "LinkedBack could not complete that action.",
        );
      setHistory(result.history);
      if (result.celebrate) setCelebration(true);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Please try again.");
      return false;
    }
  }

  useEffect(() => {
    const update = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === "local" && changes.history?.newValue)
        setHistory(changes.history.newValue as History);
    };
    browser.storage.onChanged.addListener(update);
    void send({ type: "read" }).finally(() => setLoaded(true));
    return () => browser.storage.onChanged.removeListener(update);
  }, []);
  useEffect(() => {
    if (!celebration) return;
    const timeout = window.setTimeout(() => setCelebration(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [celebration]);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmation]);
  useEffect(() => {
    if (Number(date) > history.retention) setDate("any");
  }, [date, history.retention]);

  useLayoutEffect(() => {
    if (detail) {
      main.current?.scrollTo(0, 0);
      window.scrollTo(0, 0);
      back.current?.focus({ preventScroll: true });
    } else if (returnTo.current) {
      const { id, scroll, pageScroll } = returnTo.current;
      returnTo.current = null;
      main.current?.scrollTo(0, scroll);
      window.scrollTo(0, pageScroll);
      document
        .getElementById("view-more-" + id)
        ?.focus({ preventScroll: true });
    }
  }, [detail?.id]);

  const term = query.trim().toLowerCase();
  const minimum =
    date === "today"
      ? startOfDay()
      : date === "yesterday"
        ? startOfDay(-1)
        : date === "any"
          ? 0
          : Date.now() - Number(date) * day;
  const groups = new Map<string, Post[]>();
  for (const item of [...history.posts].sort(
    (a, b) => b.lastViewed - a.lastViewed,
  )) {
    if (tab !== "all" && !item.feeds.some((feed) => feed === tab)) continue;
    if (
      !item.author.toLowerCase().includes(term) &&
      !item.text.toLowerCase().includes(term)
    )
      continue;
    if (
      item.lastViewed < minimum ||
      (date === "yesterday" && item.lastViewed >= startOfDay())
    )
      continue;
    const key = groupLabel(item.lastViewed);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const danger = confirmation?.type !== "retention";
  const days =
    confirmation?.type === "retention" ? confirmation.days : undefined;
  const title =
    confirmation?.type === "delete"
      ? "Delete this post?"
      : confirmation?.type === "clear"
        ? "Clear your history?"
        : "Change your LinkedBack history option?";
  const explanation = days
    ? "You’re switching from " +
      history.retention +
      " days to " +
      days +
      " days. " +
      (days === 7
        ? "Posts older than 7 days will be permanently deleted from your LinkedBack history. This action cannot be undone."
        : "From now on, posts will be kept for 30 days.")
    : confirmation?.type === "clear"
      ? "This will permanently delete all posts in your LinkedBack history. This action cannot be undone."
      : "This will permanently remove the post from your LinkedBack history. This action cannot be undone.";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Icon name="logo" /> <h1>LinkedBack</h1>
        </div>
        <p className="tagline">Saw a post. Lost it. Find it again.</p>
        <div className="count">
          <Icon name="chart" />
          <div>
            Posts saved in the past {history.retention} days
            <strong>{loaded ? history.posts.length : "…"}</strong>posts
          </div>
        </div>
        <div className="retention-label" id="retention-label">
          History retention
        </div>
        <div className="retention-controls">
          <button
            className="retention-button"
            aria-labelledby="retention-label retention-value"
            onClick={() => setSettings(true)}
          >
            <span id="retention-value">{history.retention} days</span>
            <span aria-hidden="true">⌄</span>
          </button>
          <button
            className="icon-button"
            aria-label="Clear history"
            title="Clear history"
            onClick={() => setConfirmation({ type: "clear" })}
          >
            <Icon name="trash" />
          </button>
        </div>
        <a
          className="feedback"
          href={`https://chromewebstore.google.com/detail/linkedback/${browser.runtime.id}/reviews`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="star" /> I'd love to hear your feedback.{" "}
          <Icon name="external" />
        </a>
      </aside>
      <main className="main" ref={main}>
        {detail ? (
          <section className="post-detail" aria-label="Post details">
            <button
              className="back detail-back"
              ref={back}
              onClick={() => setDetailId(undefined)}
            >
              ‹ Back to posts
            </button>
            <article className="card">
              <div className="card-header">
                <Author post={detail} />
              </div>
              {detail.text && <p className="post-text">{detail.text}</p>}
              <PostMedia key={detail.id} post={detail} />
              <Engagement post={detail} />
            </article>
          </section>
        ) : settings ? (
          <>
            <button
              className="back settings-heading"
              onClick={() => setSettings(false)}
            >
              ‹ &nbsp; History retention
            </button>
            <p>Choose how long to keep posts loaded in your LinkedIn feed.</p>
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                className="retention-option"
                aria-pressed={history.retention === value}
                onClick={() => {
                  if (history.retention !== value)
                    setConfirmation({ type: "retention", days: value });
                }}
              >
                <span className="radio" aria-hidden="true" />
                <span>
                  <strong>
                    {value} days{value === 7 && " (recommended)"}
                  </strong>
                  <small>Keep posts for {value} days.</small>
                </span>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="search">
              <Icon name="search" />
              <input
                type="search"
                aria-label="Search author or post text"
                placeholder="Search author or post text..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="filters">
              <div className="tabs" aria-label="Feed source" role="group">
                {[
                  ["all", "All Posts"],
                  ["for-you", "For You"],
                  ["network", "Your Network"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value!)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="date">
                <Icon name="calendar" />
                <select
                  aria-label="Date saved"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                >
                  <option value="any">Any date</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  {(history.retention === 7 ? [3, 7] : [3, 7, 14, 30]).map(
                    (value) => (
                      <option key={value} value={value}>
                        Past {value} days
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {!loaded ? (
              <p role="status">Loading your history…</p>
            ) : groups.size ? (
              [...groups].map(([label, posts]) => (
                <section className="group" key={label}>
                  <h2>{label}</h2>
                  <div className="post-grid">
                    {posts.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-content">
                          <div className="card-header">
                            <Author post={item} />
                            <details
                              className="post-menu"
                              onBlur={(event) => {
                                if (
                                  !event.currentTarget.contains(
                                    event.relatedTarget,
                                  )
                                )
                                  event.currentTarget.open = false;
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key !== "Escape" ||
                                  !event.currentTarget.open
                                )
                                  return;
                                event.currentTarget.open = false;
                                event.currentTarget
                                  .querySelector("summary")
                                  ?.focus();
                              }}
                              onClick={(event) => {
                                if (
                                  !(event.target instanceof Element) ||
                                  !event.target.closest("button")
                                )
                                  return;
                                event.currentTarget.open = false;
                                event.currentTarget
                                  .querySelector("summary")
                                  ?.focus();
                              }}
                            >
                              <summary
                                aria-label={
                                  "Actions for " +
                                  (item.author || "LinkedIn post")
                                }
                                title="Post actions"
                              >
                                <Icon name="more" />
                              </summary>
                              <div>
                                {item.url && (
                                  <button
                                    onClick={() =>
                                      void send({
                                        type: "recover",
                                        id: item.id,
                                      })
                                    }
                                  >
                                    Go to post <Icon name="external" />
                                  </button>
                                )}
                                {item.url && (
                                  <button
                                    onClick={() =>
                                      void navigator.clipboard
                                        .writeText(item.url)
                                        .then(
                                          () => setNotice("Post link copied."),
                                          () =>
                                            setNotice(
                                              "Could not copy the post link. Please try again.",
                                            ),
                                        )
                                    }
                                  >
                                    Copy post URL
                                  </button>
                                )}
                                <button
                                  className="danger-text"
                                  onClick={() =>
                                    setConfirmation({
                                      type: "delete",
                                      id: item.id,
                                    })
                                  }
                                >
                                  Delete post
                                </button>
                              </div>
                            </details>
                          </div>
                          {item.text && (
                            <p className="post-text post-preview">
                              {item.text}
                            </p>
                          )}
                          {(item.text ||
                            item.media.length > 0 ||
                            Boolean(item.videos?.length)) && (
                            <button
                              className="view-more"
                              id={"view-more-" + item.id}
                              onClick={() => {
                                returnTo.current = {
                                  id: item.id,
                                  scroll: main.current?.scrollTop ?? 0,
                                  pageScroll: window.scrollY,
                                };
                                setDetailId(item.id);
                              }}
                            >
                              View more
                            </button>
                          )}
                        </div>
                        <PostMedia post={item} />
                        <Engagement post={item} />
                      </article>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <section className="empty">
                <Illustration />
                <h2>
                  {history.posts.length
                    ? "No matching posts found."
                    : "Nothing here yet."}
                </h2>
                <p>
                  {history.posts.length
                    ? "Try searching for another author or keyword, or changing your filters."
                    : "Browse your LinkedIn feed and LinkedBack will automatically save the posts LinkedIn loads."}
                </p>
                {!history.posts.length && (
                  <div className="info">
                    <div>
                      <Icon name="clock" />
                      <strong>Available for 7 or 30 days</strong>
                      <span>
                        Posts remain in your history for your selected period.
                      </span>
                    </div>
                    <div>
                      <Icon name="logo" />
                      <strong>Stored locally</strong>
                      <span>Your post history stays on your device.</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setConfirmation(undefined);
        }}
      >
        <button
          className="close"
          aria-label="Close confirmation"
          disabled={busy}
          onClick={() => setConfirmation(undefined)}
        >
          ×
        </button>
        <span className={"modal-icon" + (danger ? " destructive" : "")}>
          <Icon name={danger ? "trash" : "clock"} />
        </span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{explanation}</p>
        {notice && <p role="status">{notice}</p>}
        <div className="modal-actions">
          <button
            autoFocus
            disabled={busy}
            onClick={() => setConfirmation(undefined)}
          >
            {confirmation?.type === "clear" ? "No, cancel" : "Cancel"}
          </button>
          <button
            disabled={busy}
            className={danger ? "destructive-button" : "primary"}
            onClick={async () => {
              if (!confirmation) return;
              setNotice("");
              setBusy(true);
              if (await send(confirmation)) {
                if (confirmation.type === "retention") setSettings(false);
                setConfirmation(undefined);
              }
              setBusy(false);
            }}
          >
            {days
              ? "Yes, change to " + days + " days"
              : confirmation?.type === "clear"
                ? "Yes, clear history"
                : "Yes, delete"}
          </button>
        </div>
      </dialog>
      {celebration && (
        <div className="toast" role="status">
          <span className="confetti" aria-hidden="true">
            🎉
          </span>
          <div>
            <strong>You just recovered your post!</strong>
            <p>LinkedBack has your back.</p>
          </div>
          <button
            className="close"
            aria-label="Dismiss celebration"
            onClick={() => setCelebration(false)}
          >
            ×
          </button>
          <div className="progress" aria-hidden="true" />
        </div>
      )}
      {notice && !confirmation && (
        <div className="toast notice" role="status">
          {notice}
          <button
            className="close"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
