import type { Feed, Post } from '@/lib/history';

const roots = '[data-urn^="urn:li:activity:"], [data-urn^="urn:li:ugcPost:"], .feed-shared-update-v2, [data-testid="feed-post"]';
const text = (post: Element, selector: string) =>
  post.querySelector<HTMLElement>(selector)?.innerText.trim() ?? '';
const mediaUrl = (value?: string | null) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'licdn.com' || url.hostname.endsWith('.licdn.com')) ? url.href : '';
  } catch {
    return '';
  }
};

function currentFeed(): Feed | undefined {
  const labels = [...document.querySelectorAll('main [aria-selected="true"], main [aria-pressed="true"], main [aria-current="page"], main button[aria-checked="true"]')]
    .map(element => (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase());
  const path = location.pathname;
  const filter = new URLSearchParams(location.search).get('feedType')?.toUpperCase();
  if (labels.includes('your network') || labels.includes('network') || path.startsWith('/feed/following') || filter === 'FOLLOWING' || filter === 'NETWORK') return 'network';
  if (labels.includes('for you') || filter === 'FORYOU' || filter === 'FOR_YOU') return 'for-you';
}

function readPost(element: Element, feed: Feed | undefined): Post | undefined {
  let urn = element.getAttribute('data-urn') ?? element.getAttribute('data-id') ?? '';
  let originalUrl = '';
  for (const link of element.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const url = new URL(link.href);
    if (url.origin !== 'https://www.linkedin.com') continue;
    const match = url.pathname.match(/\/feed\/update\/(urn:li:(?:activity|ugcPost):\d+)|\/posts\/[^/]*-activity-(\d+)/);
    if (!match) continue;
    urn ||= match[1] || 'urn:li:activity:' + match[2];
    const linkedUrn = match[1] || 'urn:li:activity:' + match[2];
    if (linkedUrn !== urn) continue;
    originalUrl = url.origin + url.pathname;
    break;
  }
  if (!/^urn:li:(activity|ugcPost):\d+$/.test(urn)) return;
  const body = element.querySelector<HTMLElement>('.feed-shared-update-v2__description, .update-components-text, [data-testid="post-text"]');
  const content = body?.cloneNode(true) as HTMLElement | undefined;
  content?.querySelectorAll('button, script, style, .visually-hidden, [aria-hidden="true"].see-more').forEach(node => node.remove());
  if (content) content.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  const media = [...element.querySelectorAll<HTMLImageElement>('.update-components-image img, .feed-shared-image img, .feed-shared-carousel img, .update-components-carousel img, .update-components-document img, [data-testid="post-media"] img')]
    .map(image => mediaUrl(image.currentSrc || image.src));
  media.push(...[...element.querySelectorAll<HTMLVideoElement>('video[poster]')].map(video => mediaUrl(video.poster)));
  const now = Date.now();
  return {
    id: urn,
    url: originalUrl || 'https://www.linkedin.com/feed/update/' + urn + '/',
    author: text(element, '.update-components-actor__title [aria-hidden="true"], .feed-shared-actor__name, [data-testid="post-author"]'),
    headline: text(element, '.update-components-actor__description [aria-hidden="true"], .feed-shared-actor__description'),
    avatar: mediaUrl(element.querySelector<HTMLImageElement>('.update-components-actor__image img, .feed-shared-actor__image img')?.src),
    text: content?.textContent?.trim() ?? '',
    media: [...new Set(media.filter(Boolean))],
    feeds: feed ? [feed] : [],
    firstViewed: now,
    lastViewed: now,
  };
}

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main(ctx) {
    const visible = new Set<Element>();
    const observed = new Set<Element>();
    const captured = new Map<Element, string>();
    let route = '';
    function scan() {
      const feed = currentFeed();
      const nextRoute = location.pathname + location.search + ':' + feed;
      if (nextRoute !== route) {
        captured.clear();
        route = nextRoute;
      }
      if (document.visibilityState !== 'visible' || !/^\/feed(?:\/?$|\/following\/?$)/.test(location.pathname)) return;
      const posts: Post[] = [];
      for (const element of visible) {
        if (!element.isConnected) continue;
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.right <= 0 || bounds.top >= innerHeight || bounds.left >= innerWidth) continue;
        const post = readPost(element, feed);
        if (!post) continue;
        const signature = JSON.stringify([post.id, post.author, post.headline, post.avatar, post.text, post.media, post.feeds]);
        if (captured.get(element) === signature) continue;
        captured.set(element, signature);
        posts.push(post);
      }
      if (posts.length) void browser.runtime.sendMessage({ type: 'capture', posts }).then(result => {
        if (!result || result.error) captured.clear();
      }, () => captured.clear());
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) visible.add(entry.target);
        else {
          visible.delete(entry.target);
          captured.delete(entry.target);
        }
      }
      scan();
    });
    function refresh() {
      for (const element of observed) {
        if (element.isConnected) continue;
        observer.unobserve(element);
        observed.delete(element);
        visible.delete(element);
        captured.delete(element);
      }
      for (const element of document.querySelectorAll('main :is(' + roots + ')')) {
        if (observed.has(element) || element.parentElement?.closest(roots)) continue;
        observer.observe(element);
        observed.add(element);
      }
      scan();
    }
    refresh();
    ctx.setInterval(refresh, 500);
    ctx.addEventListener(document, 'visibilitychange', () => {
      captured.clear();
      scan();
    });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
