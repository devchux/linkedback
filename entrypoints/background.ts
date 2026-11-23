import { initialHistory, retained, type Action, type History } from '@/lib/history';

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
  });

  let queue = Promise.resolve<unknown>(undefined);
  async function apply(action: Action) {
    const { history = initialHistory } = await browser.storage.local.get<{ history?: History }>('history');
    const previousCount = history.posts.length;
    const posts = new Map(retained(history).map(post => [post.id, post]));
    switch (action.type) {
      case 'capture': {
        const bySource = new Map([...posts.values()].filter(post => post.sourceKey).map(post => [post.sourceKey, post]));
        for (const post of action.posts) {
          const previous = posts.get(post.id) ?? bySource.get(post.sourceKey);
          if (!previous) {
            posts.set(post.id, post);
            if (post.sourceKey) bySource.set(post.sourceKey, post);
            continue;
          }
          const merged = {
            ...post,
            id: post.url ? post.id : previous.id,
            url: post.url || previous.url,
            sourceKey: post.sourceKey || previous.sourceKey,
            authorUrl: post.authorUrl || previous.authorUrl,
            published: post.published || previous.published,
            engagement: { ...previous.engagement, ...post.engagement },
            author: post.author || previous.author,
            headline: post.headline || previous.headline,
            avatar: post.avatar || previous.avatar,
            text: post.text.length >= previous.text.length ? post.text : previous.text,
            media: [...new Set([...post.media, ...previous.media])],
            videos: post.videos?.length ? post.videos.map(video => {
              const saved = previous.videos?.find(item => (video.url && item.url === video.url)
                || (video.poster && item.poster === video.poster));
              return { url: video.url || saved?.url, poster: video.poster || saved?.poster };
            }) : previous.videos,
            feeds: [...new Set([...post.feeds, ...previous.feeds])],
            firstViewed: Math.min(previous.firstViewed, post.firstViewed),
            lastViewed: Math.max(previous.lastViewed, post.lastViewed),
          };
          if (previous.id !== merged.id) posts.delete(previous.id);
          posts.set(merged.id, merged);
          if (merged.sourceKey) bySource.set(merged.sourceKey, merged);
        }
        break;
      }
      case 'retention':
        history.retention = action.days;
        break;
      case 'delete':
        posts.delete(action.id);
        break;
      case 'delete-many':
        for (const id of action.ids) posts.delete(id);
        break;
      case 'clear':
        posts.clear();
        break;
      case 'recover': {
        const post = posts.get(action.id);
        if (!post) throw new Error('This post is no longer in your history.');
        if (!post.url) throw new Error('LinkedIn did not provide a link for this post.');
        await browser.tabs.create({ url: post.url, active: history.recovered });
        const celebrate = !history.recovered;
        history.recovered = true;
        history.posts = [...posts.values()];
        await browser.storage.local.set({ history });
        return { history, celebrate };
      }
    }
    history.posts = retained({ ...history, posts: [...posts.values()] });
    if (action.type !== 'read' || previousCount !== history.posts.length) {
      await browser.storage.local.set({ history });
    }
    return { history };
  }

  browser.runtime.onMessage.addListener((message: Action, sender, respond) => {
    const fromFeed = sender.url?.startsWith('https://www.linkedin.com/');
    if (!message || Boolean(fromFeed) !== (message.type === 'capture')) return;
    const result = queue.then(() => apply(message));
    queue = result.catch(() => undefined);
    void result.then(respond, (error: Error) => respond({ error: error.message }));
    return true;
  });

  function expireHistory() {
    queue = queue.then(() => apply({ type: 'read' })).catch(console.error);
  }

  browser.runtime.onStartup.addListener(expireHistory);
  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'expire-history') expireHistory();
  });
  void browser.alarms.get('expire-history').then(alarm => {
    if (!alarm) return browser.alarms.create('expire-history', { periodInMinutes: 15 });
  });
});
