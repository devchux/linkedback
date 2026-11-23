export const day = 86_400_000;
export type Retention = 7 | 30;
export type Feed = 'for-you' | 'network';
export type Engagement = Partial<Record<'reactions' | 'comments' | 'reposts', string>>;
export type PostVideo = { url?: string; poster?: string };
export type Post = {
  id: string;
  url: string;
  sourceKey?: string;
  authorUrl?: string;
  published?: string;
  engagement?: Engagement;
  author: string;
  headline: string;
  avatar: string;
  text: string;
  media: string[];
  videos?: PostVideo[];
  feeds: Feed[];
  firstViewed: number;
  lastViewed: number;
};
export type History = { posts: Post[]; retention: Retention; recovered: boolean };
export const initialHistory: History = { posts: [], retention: 7, recovered: false };
export type Action =
  | { type: 'capture'; posts: Post[] }
  | { type: 'retention'; days: Retention }
  | { type: 'delete'; id: string }
  | { type: 'delete-many'; ids: string[] }
  | { type: 'clear' }
  | { type: 'recover'; id: string }
  | { type: 'read' };

export function retained(history: History, now = Date.now()) {
  return history.posts.filter(post => post.lastViewed >= now - history.retention * day);
}
