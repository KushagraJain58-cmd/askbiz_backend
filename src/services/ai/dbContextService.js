/**
 * Searches the platform's existing MongoDB collections for businesses,
 * experts, communities, and posts relevant to the user's query, so the AI
 * can recommend real people/communities/posts to connect with.
 *
 * Uses keyword-based case-insensitive regex matching so it works without
 * any new indexes on existing collections. If search volume grows, add a
 * MongoDB text index on the users/communities/posts collections and switch
 * to $text queries.
 */

const User = require('../../models/users');
const Community = require('../../models/community');
const Post = require('../../models/post');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now',
  'any', 'who', 'get', 'use', 'that', 'this', 'with', 'from', 'have', 'what',
  'when', 'where', 'which', 'about', 'should', 'would', 'could', 'there',
  'their', 'them', 'then', 'than', 'does', 'need', 'want', 'like', 'help',
  'please', 'tell', 'know', 'find', 'india', 'indian', 'business', 'company',
  'kya', 'hai', 'kaise', 'mein', 'karna', 'chahiye', 'liye', 'aur',
]);

/**
 * Extract meaningful keywords from a free-text query and build a
 * case-insensitive OR-regex out of them.
 */
function buildKeywordRegex(query) {
  const words = (query || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  const unique = [...new Set(words)].slice(0, 8);
  if (unique.length === 0) return null;

  const escaped = unique.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'i');
}

async function searchBusinesses(query) {
  try {
    const rx = buildKeywordRegex(query);
    if (!rx) return [];

    return await User.find({
      accountType: 'Bussiness',
      status: 'active',
      adminApproval: 'approved',
      $or: [
        { businessName: rx },
        { businessCategory: rx },
        { products: rx },
        { services: rx },
        { description: rx },
      ],
    })
      .select('businessName businessCategory description products services blueTick profileImage location.cityName')
      .limit(5)
      .lean();
  } catch (error) {
    console.warn('[DBContext] Business search failed:', error.message);
    return [];
  }
}

async function searchExperts(query) {
  try {
    const rx = buildKeywordRegex(query);
    if (!rx) return [];

    return await User.find({
      accountType: 'Expert',
      status: 'active',
      adminApproval: 'approved',
      $or: [
        { name: rx },
        { expertise: rx },
        { occupationTitle: rx },
        { occupationSector: rx },
        { shortBio: rx },
      ],
    })
      .select('name expertise occupationTitle shortBio blueTick profileImage location.cityName')
      .limit(3)
      .lean();
  } catch (error) {
    console.warn('[DBContext] Expert search failed:', error.message);
    return [];
  }
}

async function searchCommunities(query) {
  try {
    const rx = buildKeywordRegex(query);
    if (!rx) return [];

    return await Community.find({
      status: 'active',
      $or: [
        { communityName: rx },
        { description: rx },
        { 'interest.value': rx },
      ],
    })
      .select('communityName communityUsername communityType description logo location.cityName')
      .limit(3)
      .lean();
  } catch (error) {
    console.warn('[DBContext] Community search failed:', error.message);
    return [];
  }
}

async function searchPosts(query) {
  try {
    const rx = buildKeywordRegex(query);
    if (!rx) return [];

    return await Post.find({
      $or: [
        { title: rx },
        { description: rx },
        { tags: rx },
      ],
      audienceSelection: { $ne: 'private' },
    })
      .select('title description tags createdAt')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
  } catch (error) {
    console.warn('[DBContext] Post search failed:', error.message);
    return [];
  }
}

/**
 * Formats DB results into a string for the system prompt.
 */
function formatDBContext({ businesses = [], experts = [], communities = [], posts = [] }) {
  const parts = [];
  const trim = (s, n) => (s ? `${String(s).substring(0, n)}${String(s).length > n ? '...' : ''}` : '');

  if (businesses.length > 0) {
    parts.push('RELEVANT BUSINESSES ON THE PLATFORM:');
    businesses.forEach(b => {
      parts.push(`- ${b.businessName} | ${b.businessCategory || 'General'} | ${b.location?.cityName || 'India'}${b.blueTick ? ' | Verified' : ''}`);
      if (b.description) parts.push(`  ${trim(b.description, 120)}`);
    });
  }

  if (experts.length > 0) {
    parts.push('\nRELEVANT EXPERTS ON THE PLATFORM:');
    experts.forEach(e => {
      parts.push(`- ${e.name} | ${e.expertise || e.occupationTitle || 'General'} | ${e.location?.cityName || 'India'}${e.blueTick ? ' | Verified' : ''}`);
      if (e.shortBio) parts.push(`  ${trim(e.shortBio, 120)}`);
    });
  }

  if (communities.length > 0) {
    parts.push('\nRELEVANT COMMUNITIES ON THE PLATFORM:');
    communities.forEach(c => {
      parts.push(`- ${c.communityName} (@${c.communityUsername}) | ${c.communityType}`);
      if (c.description) parts.push(`  ${trim(c.description, 120)}`);
    });
  }

  if (posts.length > 0) {
    parts.push('\nRELEVANT RECENT POSTS ON THE PLATFORM:');
    posts.forEach(p => {
      parts.push(`- "${p.title}"`);
      if (p.description) parts.push(`  ${trim(p.description, 120)}`);
    });
  }

  return parts.join('\n');
}

/**
 * Builds a structured, client-safe list of the same entities that were fed to
 * the model, so the app can render tappable cards (open profile / follow /
 * join community / view post) instead of parsing them out of the answer text.
 *
 * Deliberately NOT derived from the model's output — these are the exact
 * records that came from the database, so IDs are always correct and never
 * depend on the model reproducing them.
 */
function buildEntityPayload({ businesses = [], experts = [], communities = [], posts = [] }) {
  const trim = (s, n) => (s ? `${String(s).substring(0, n)}${String(s).length > n ? '...' : ''}` : '');

  return [
    ...businesses.map(b => ({
      kind: 'business',
      id: b._id.toString(),
      name: b.businessName || 'Business',
      subtitle: b.businessCategory || 'Business',
      city: b.location?.cityName || '',
      image: b.profileImage || '',
      verified: !!b.blueTick,
      description: trim(b.description, 100),
    })),
    ...experts.map(e => ({
      kind: 'expert',
      id: e._id.toString(),
      name: e.name || 'Expert',
      subtitle: e.expertise || e.occupationTitle || 'Expert',
      city: e.location?.cityName || '',
      image: e.profileImage || '',
      verified: !!e.blueTick,
      description: trim(e.shortBio, 100),
    })),
    ...communities.map(c => ({
      kind: 'community',
      id: c._id.toString(),
      name: c.communityName || 'Community',
      subtitle: c.communityType === 'private' ? 'Private community' : 'Public community',
      communityType: c.communityType,
      image: c.logo || '',
      description: trim(c.description, 100),
    })),
    ...posts.map(p => ({
      kind: 'post',
      id: p._id.toString(),
      name: p.title || 'Post',
      subtitle: 'Post on AskBiz',
      description: trim(p.description, 120),
    })),
  ];
}

module.exports = { searchBusinesses, searchExperts, searchCommunities, searchPosts, formatDBContext, buildEntityPayload };
