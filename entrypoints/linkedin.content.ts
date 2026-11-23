import type { Engagement, Feed, Post } from '@/lib/history';

const modernCard = '[role="listitem"][componentkey^="update-card-focus"]';
const roots = [
  '[data-urn^="urn:li:activity:"]',
  '[data-urn^="urn:li:ugcPost:"]',
  '[data-id^="urn:li:activity:"]',
  '[data-id^="urn:li:ugcPost:"]',
  '.feed-shared-update-v2',
  '[data-testid="feed-post"]',
  modernCard,
].join(', ');
const activityCandidates = '[role="listitem"], article, .profile-creator-shared-feed-update__container, [data-view-name="profile-activity-post"]';
const activityPath = /^\/(?:in|company|school)\/[^/]+\/recent-activity(?:\/|$)/;
const profileDetailsPath = /^\/(?:in|company|school)\/[^/]+\/(?:details|about)(?:\/|$)/;
const activityList = '[data-testid^="ProfileRecentActivity"]';
const postCards = ':is(main, [role="main"]) :is(' + roots + ')';
const activityCards = ':is(main, [role="main"]) :is(' + activityCandidates + ')';
const feedPath = /^\/feed(?:\/(?:following|network|for-?you))?\/?$/;
const postUrn = /^urn:li:(?:activity|ugcPost):\d+$/;
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
  const path = location.pathname;
  const filter = new URLSearchParams(location.search).get('feedType')?.toUpperCase();
  if (/^\/feed\/(following|network)\/?$/.test(path) || filter === 'FOLLOWING' || filter === 'NETWORK') return 'network';
  if (/^\/feed\/for-?you\/?$/.test(path) || filter === 'FORYOU' || filter === 'FOR_YOU') return 'for-you';

  const labels = [...document.querySelectorAll('main [aria-selected="true"], main [aria-pressed="true"], main [aria-current="page"], main button[aria-checked="true"]')]
    .map(element => (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase());
  if (labels.includes('your network') || labels.includes('network')) return 'network';
  if (labels.includes('for you')) return 'for-you';
}

function modernPostUrn(element: Element) {
  const key = element.querySelector('[id*="-replaceableCommentTools"]')?.id.split('-replaceableCommentTools')[0];
  if (!key) return '';
  // The comment-tools key wraps a signed 64-bit post ID in a length-delimited field.
  try {
    const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    if (bytes.length !== 13 || bytes[0] !== 10 || bytes[1] !== 11 || bytes[2] !== 8 || bytes[12] !== 1) return '';
    let encoded = 0n;
    for (const [index, byte] of bytes.slice(3).entries()) {
      if (index < 9 && byte < 128) return '';
      encoded |= BigInt(byte & 127) << BigInt(index * 7);
    }
    if (encoded % 2n === 0n) return 'urn:li:activity:' + (encoded >> 1n);
  } catch {
    return '';
  }
  return '';
}

const engagementLabels = {
  reactions: /([\d][\d,.\s\u00a0]*[kmb]?)\s*(?:reactions?|likes?)\b/i,
  comments: /([\d][\d,.\s\u00a0]*[kmb]?)\s*comments?\b/i,
  reposts: /([\d][\d,.\s\u00a0]*[kmb]?)\s*(?:reposts?|shares?)\b/i,
};

function readEngagement(card: Element, body?: Element | null): Engagement {
  const counts: Engagement = {};
  const controls = card.querySelectorAll('a, button, [role="button"], [aria-label], .social-details-social-counts');
  for (const control of controls) {
    if (body?.contains(control)) continue;
    for (const label of [control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent?.trim()]) {
      if (!label || label.length > 160) continue;
      for (const kind of Object.keys(engagementLabels) as (keyof Engagement)[]) {
        const value = label.match(engagementLabels[kind])?.[1]?.trim();
        if (value) counts[kind] ??= value;
      }
    }
  }
  return counts;
}

const profileLinks = 'a:is([href*="/in/"], [href*="/company/"], [href*="/school/"])';
const postAge = /^\d+\s*(?:s|m|h|d|w|mo|yr|y)(?:\s|$)/i;
const postMenuPrefix = 'Open control menu for post by ';

function modernAuthor(card: Element, body: Element | null, menu: Element | null) {
  const name = menu?.getAttribute('aria-label')?.slice(postMenuPrefix.length);
  const links = [...card.querySelectorAll<HTMLAnchorElement>(profileLinks)].filter(link => !body?.contains(link));
  const link = links.find(link => name && link.innerText.includes(name))
    ?? links.find(link => link.innerText.trim());
  if (!link) return { name, link };
  // Some cards put the headline and age alongside the profile link.
  let headline: string | undefined;
  let published: string | undefined;
  for (let section: HTMLElement | null = link; section && section !== card; section = section.parentElement) {
    if (body && section.contains(body)) break;
    const lines = section.innerText.split('\n').map(line => line.trim()).filter(Boolean);
    const authorIndex = lines.findIndex(line => name ? line.includes(name) : line === link.innerText.trim());
    if (authorIndex === -1) continue;
    const details = lines.slice(authorIndex + 1);
    published ??= details.find(line => postAge.test(line));
    headline ??= details.find(line => (!name || !line.startsWith(name)) && !postAge.test(line)
      && !/^(?:following|connect|follow|[·•]|[123](?:st|nd|rd)(?:\+)?|promoted|sponsored)$/i.test(line));
    if (headline && published) break;
  }
  return { name: name || link.innerText.trim().split('\n')[0], link, headline, published };
}

function readPost(element: Element, feed: Feed | undefined): Post | undefined {
  const modern = element.matches(modernCard) || Boolean(element.querySelector('[aria-label^="' + postMenuPrefix + '"]'));
  const componentKey = modern ? element.getAttribute('componentkey') : null;
  const cardKey = componentKey?.replace(/^update-card-focus/, '').replace(/FeedType_[A-Z_]+$/, '');
  const sourceKey = cardKey ? 'linkedin-card:' + cardKey : undefined;
  let urn = [element.getAttribute('data-urn'), element.getAttribute('data-id')]
    .find(value => value && postUrn.test(value)) ?? '';
  if (!urn && modern) urn = modernPostUrn(element);
  if (!urn && !sourceKey) {
    const identity = element.querySelector('[data-urn^="urn:li:activity:"], [data-urn^="urn:li:ugcPost:"]');
    const value = identity?.getAttribute('data-urn');
    if (value && postUrn.test(value)) urn = value;
  }
  let originalUrl = '';
  for (const link of element.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (!URL.canParse(link.href)) continue;
    const url = new URL(link.href);
    if (url.origin !== 'https://www.linkedin.com') continue;
    const match = url.pathname.match(/^\/feed\/update\/(urn(?::|%3A)li(?::|%3A)(?:activity|ugcPost)(?::|%3A)\d+)\/?$|^\/posts\/[^/]*-activity-(\d+)(?:-[^/]*)?\/?$/i);
    if (!match) continue;
    const linkedUrn = match[1] ? decodeURIComponent(match[1]) : 'urn:li:activity:' + match[2];
    // A quote post may link to its embedded post. Keep the outer card's identity.
    if (!urn && sourceKey) continue;
    urn ||= linkedUrn;
    if (linkedUrn !== urn) continue;
    originalUrl = url.origin + url.pathname;
    break;
  }
  // LinkedIn can keep the old feed mounted while loading the next one.
  if (componentKey?.endsWith('FeedType_MAIN_FEED_RELEVANCE')) feed = 'for-you';
  if (componentKey && /FeedType_(?:MAIN_FEED_)?(?:NETWORK|FOLLOWING)$/.test(componentKey)) feed = 'network';
  if (!postUrn.test(urn) && !sourceKey) return;
  const menu = modern ? element.querySelector('[aria-label^="' + postMenuPrefix + '"]') : null;
  const body = element.querySelector<HTMLElement>('.feed-shared-update-v2__description, .update-components-text, [data-testid="post-text"]')
    ?? (modern ? [...element.querySelectorAll<HTMLElement>('p[componentkey]')].find(paragraph =>
      !menu || Boolean(menu.compareDocumentPosition(paragraph) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? null : null);
  const author = modern ? modernAuthor(element, body, menu) : undefined;
  const authorLink = author?.link ?? element.querySelector<HTMLAnchorElement>(profileLinks);
  const authorUrl = authorLink?.origin === location.origin ? authorLink.origin + authorLink.pathname : undefined;
  const authorImage = element.querySelector<HTMLImageElement>('.update-components-actor__image img, .feed-shared-actor__image img')
    ?? (modern ? authorLink?.querySelector<HTMLImageElement>('img') ?? element.querySelector<HTMLImageElement>('a:is([href*="/in/"], [href*="/company/"]) img') : null);
  const published = element.querySelector('time')?.getAttribute('datetime')
    || text(element, 'time, .update-components-actor__sub-description, .feed-shared-actor__sub-description')
    || author?.published;
  const content = body?.cloneNode(true) as HTMLElement | undefined;
  content?.querySelectorAll('button, script, style, .visually-hidden, .see-more, .feed-shared-inline-show-more-text__see-more-less-toggle').forEach(node => node.remove());
  if (content) content.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  const media = [...element.querySelectorAll<HTMLImageElement>('.update-components-image img, .feed-shared-image img, .feed-shared-carousel img, .update-components-carousel img, .update-components-document img, [data-testid="post-media"] img')]
    .map(image => mediaUrl(image.currentSrc || image.src));
  if (modern) {
    for (const image of element.querySelectorAll<HTMLImageElement>('img')) {
      if (image === authorImage || image.closest('button, a:is([href*="/in/"], [href*="/company/"], [href*="/school/"])')) continue;
      media.push(mediaUrl(image.currentSrc || image.src));
    }
  }
  const videos = [...element.querySelectorAll('video')].map(video => {
    const sources = [video.currentSrc, video.src, ...[...video.querySelectorAll<HTMLSourceElement>('source[src]')].map(source => source.src)];
    const url = sources.map(mediaUrl).find(Boolean);
    const poster = mediaUrl(video.poster) || undefined;
    return { url, poster };
  }).filter(video => video.url || video.poster);
  const now = Date.now();
  return {
    id: urn || sourceKey!,
    sourceKey,
    url: originalUrl || (urn ? 'https://www.linkedin.com/feed/update/' + urn + '/' : ''),
    authorUrl,
    published,
    engagement: readEngagement(element, body),
    author: text(element, '.update-components-actor__title [aria-hidden="true"], .feed-shared-actor__name, [data-testid="post-author"]')
      || author?.name || '',
    headline: text(element, '.update-components-actor__description [aria-hidden="true"], .feed-shared-actor__description, [data-testid="post-headline"]')
      || author?.headline || '',
    avatar: mediaUrl(authorImage?.currentSrc || authorImage?.src),
    text: content?.textContent?.trim() ?? '',
    media: [...new Set(media.filter(Boolean))],
    videos,
    feeds: feed ? [feed] : [],
    firstViewed: now,
    lastViewed: now,
  };
}

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  runAt: 'document_start',
  main(ctx) {
    let captured = new WeakMap<Element, string>();
    let lastPath = '';
    function scan() {
      const path = location.pathname;
      if (path !== lastPath) {
        captured = new WeakMap();
        lastPath = path;
      }
      if (profileDetailsPath.test(path)) return;
      const activity = activityPath.test(path);
      const feed = feedPath.test(location.pathname) ? currentFeed() : undefined;
      const batch: { element: Element; post: Post; signature: string }[] = [];
      const activityFilter = activity && document.querySelector(activityList);
      const cards = new Set([...document.querySelectorAll(postCards)]
        .filter(element => (!activityFilter || element.closest(activityList)) && !element.parentElement?.closest(roots)));
      if (activity) {
        for (const candidate of [...document.querySelectorAll(activityCards)].reverse()) {
          if ((activityFilter && !candidate.closest(activityList)) || candidate.closest(roots) || candidate.querySelector(roots)) continue;
          const postControl = candidate.querySelector('[aria-label^="' + postMenuPrefix + '"]');
          const permalink = candidate.querySelector('a[href*="/feed/update/"], a[href*="/posts/"][href*="-activity-"]');
          if (!postControl && !permalink) continue;
          if ([...cards].some(card => card.contains(candidate) || candidate.contains(card))) continue;
          cards.add(candidate);
        }
      }
      for (const element of cards) {
        const post = readPost(element, feed);
        if (!post) continue;
        const { firstViewed, lastViewed, ...details } = post;
        const signature = JSON.stringify(details);
        if (captured.get(element) === signature) continue;
        captured.set(element, signature);
        batch.push({ element, post, signature });
      }
      if (!batch.length) return;

      function retryBatch() {
        for (const { element, signature } of batch) {
          if (captured.get(element) === signature) captured.delete(element);
        }
      }

      // The worker serializes writes. A pending save should never block a scan of the next feed.
      void browser.runtime.sendMessage({ type: 'capture', posts: batch.map(item => item.post) }).then(result => {
        if (!result || result.error) retryBatch();
      }, retryBatch);
    }

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          captured.delete(node);
          for (const card of node.querySelectorAll(roots + ', ' + activityCandidates)) captured.delete(card);
        }
      }
      scan();
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'poster', 'aria-label', 'aria-selected', 'aria-pressed', 'aria-current', 'aria-checked', 'componentkey', 'data-urn', 'data-id', 'id', 'href'],
    });
    ctx.addEventListener(window, 'wxt:locationchange', scan);
    ctx.addEventListener(document, 'click', event => {
      if (!feedPath.test(location.pathname) || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, [role="button"]');
      const label = control?.getAttribute('aria-label') || control?.textContent?.trim() || '';
      if (/^(?:refresh(?: (?:the )?feed)?|(?:show|load|see) (?:\d+ )?new posts?)$/i.test(label)) {
        captured = new WeakMap();
        ctx.setTimeout(scan, 0);
      }
    }, { capture: true });
    scan();
    ctx.setInterval(scan, 1000);
    ctx.onInvalidated(() => observer.disconnect());
  },
});
