import type { Category, ServiceDef } from './types';

/**
 * Every entry was checked to return CORS-enabled Statuspage JSON, so the board can
 * run without a backend. Adding a service here is all it takes.
 */
export const SERVICES: ServiceDef[] = [
  { id: 'github', name: 'GitHub', category: 'Dev & CI', base: 'https://www.githubstatus.com', homepage: 'https://github.com' },
  { id: 'bitbucket', name: 'Bitbucket', category: 'Dev & CI', base: 'https://bitbucket.status.atlassian.com', homepage: 'https://bitbucket.org' },
  { id: 'vercel', name: 'Vercel', category: 'Dev & CI', base: 'https://www.vercel-status.com', homepage: 'https://vercel.com' },
  { id: 'render', name: 'Render', category: 'Dev & CI', base: 'https://status.render.com', homepage: 'https://render.com' },
  { id: 'npm', name: 'npm', category: 'Dev & CI', base: 'https://status.npmjs.org', homepage: 'https://npmjs.com' },
  { id: 'postman', name: 'Postman', category: 'Dev & CI', base: 'https://status.postman.com', homepage: 'https://postman.com' },
  { id: 'sentry', name: 'Sentry', category: 'Dev & CI', base: 'https://status.sentry.io', homepage: 'https://sentry.io' },
  { id: 'linear', name: 'Linear', category: 'Dev & CI', base: 'https://linearstatus.com', homepage: 'https://linear.app' },
  { id: 'newrelic', name: 'New Relic', category: 'Dev & CI', base: 'https://status.newrelic.com', homepage: 'https://newrelic.com' },

  { id: 'cloudflare', name: 'Cloudflare', category: 'Infrastructure', base: 'https://www.cloudflarestatus.com', homepage: 'https://cloudflare.com' },
  { id: 'digitalocean', name: 'DigitalOcean', category: 'Infrastructure', base: 'https://status.digitalocean.com', homepage: 'https://digitalocean.com' },
  { id: 'supabase', name: 'Supabase', category: 'Infrastructure', base: 'https://status.supabase.com', homepage: 'https://supabase.com' },
  { id: 'mongodb', name: 'MongoDB Atlas', category: 'Infrastructure', base: 'https://status.mongodb.com', homepage: 'https://mongodb.com' },
  { id: 'elastic', name: 'Elastic', category: 'Infrastructure', base: 'https://status.elastic.co', homepage: 'https://elastic.co' },
  { id: 'atlassian', name: 'Atlassian', category: 'Infrastructure', base: 'https://status.atlassian.com', homepage: 'https://atlassian.com' },

  { id: 'openai', name: 'OpenAI', category: 'AI', base: 'https://status.openai.com', homepage: 'https://openai.com' },
  { id: 'anthropic', name: 'Claude / Anthropic', category: 'AI', base: 'https://status.claude.com', homepage: 'https://claude.ai' },

  { id: 'discord', name: 'Discord', category: 'Communication', base: 'https://discordstatus.com', homepage: 'https://discord.com' },
  { id: 'zoom', name: 'Zoom', category: 'Communication', base: 'https://www.zoomstatus.com', homepage: 'https://zoom.us' },
  { id: 'twilio', name: 'Twilio', category: 'Communication', base: 'https://status.twilio.com', homepage: 'https://twilio.com' },
  { id: 'dropbox', name: 'Dropbox', category: 'Communication', base: 'https://status.dropbox.com', homepage: 'https://dropbox.com' },

  { id: 'figma', name: 'Figma', category: 'Productivity', base: 'https://status.figma.com', homepage: 'https://figma.com' },
  { id: 'asana', name: 'Asana', category: 'Productivity', base: 'https://status.asana.com', homepage: 'https://asana.com' },
  { id: 'box', name: 'Box', category: 'Productivity', base: 'https://status.box.com', homepage: 'https://box.com' },
  { id: 'airtable', name: 'Airtable', category: 'Productivity', base: 'https://status.airtable.com', homepage: 'https://airtable.com' },
  { id: '1password', name: '1Password', category: 'Productivity', base: 'https://status.1password.com', homepage: 'https://1password.com' },

  { id: 'shopify', name: 'Shopify', category: 'Commerce', base: 'https://www.shopifystatus.com', homepage: 'https://shopify.com' },
  { id: 'hubspot', name: 'HubSpot', category: 'Commerce', base: 'https://status.hubspot.com', homepage: 'https://hubspot.com' },
];

export const CATEGORIES: Category[] = ['Dev & CI', 'Infrastructure', 'AI', 'Communication', 'Productivity', 'Commerce'];
