#!/usr/bin/env node

/**
 * Resale Radar — refresh.js
 * Calls Claude API to research new high-resale-potential events,
 * merges them with existing events.json, and saves the result.
 *
 * Usage: node refresh.js
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_KEY        = process.env.ANTHROPIC_API_KEY;
const EVENTS_FILE    = path.join(__dirname, 'events.json');
const MODEL          = 'claude-opus-4-6';
// ─────────────────────────────────────────────────────────────────────────────

if (!API_KEY) {
  console.error('\n❌  Missing API key.');
  console.error('    Set it with: export ANTHROPIC_API_KEY=your_key_here\n');
  process.exit(1);
}

// Load existing events so Claude knows what's already tracked
const existing = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
const existingNames = existing.events.map(e => e.name);
const today = new Date().toISOString().split('T')[0];

const SYSTEM_PROMPT = `You are a ticket resale intelligence analyst. Your job is to identify upcoming US events where buying tickets at retail price (face value) is likely to result in significant profit on the secondary market.

You have deep knowledge of:
- Concert tours and artist popularity / demand signals
- Sports playoffs and championship events
- Music festivals
- Which events historically resell at 2× or more above face value
- Current ticket on-sale windows and presale timing

When identifying events, focus on:
- Events where demand significantly exceeds supply
- Limited tour dates or residencies (fewer cities = more demand per city)
- Reunion tours or rare performances
- Major sporting playoff rounds
- Artists with passionate, large fan bases known to drive up secondary prices

Always respond with valid JSON only. No prose, no markdown, no explanation outside the JSON.`;

const USER_PROMPT = `Today's date is ${today}.

Events already being tracked (do NOT include these again):
${existingNames.map(n => `- ${n}`).join('\n')}

Research and identify 5 to 8 NEW upcoming US events going on sale in the near future that have strong ticket resale potential. These should be events NOT already in the list above.

For each event return a JSON object with exactly these fields:
- id: a unique kebab-case identifier string (e.g. "taylor-swift-2026-tour")
- name: clear event name string
- type: one of exactly "Sports", "Concert", or "Festival"
- multiple: estimated resale multiple as a string like "2–4×" or "3×"
- on_sale: when and where tickets go on sale, as a concise string (1–2 sentences)
- best_bets: which specific tickets or seats to target for maximum resale upside, as a concise string (1–2 sentences)
- city: city or cities as a string, or "Multiple" or "TBD"
- urgency: one of exactly "now", "soon", or "watch"
  - "now" = tickets on sale right now or within days
  - "soon" = tickets going on sale within the next 2–4 weeks
  - "watch" = anticipated but not yet announced, worth monitoring

Return ONLY a JSON array of event objects. Example format:
[
  {
    "id": "example-event-2026",
    "name": "Example Event 2026",
    "type": "Concert",
    "multiple": "2–4×",
    "on_sale": "Goes on sale April 15 at Ticketmaster.com",
    "best_bets": "Floor seats and front GA sections in major markets.",
    "city": "New York, Los Angeles, Chicago",
    "urgency": "soon"
  }
]`;

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(new Error('Failed to parse API response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseEvents(text) {
  // Strip any accidental markdown fences
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  console.log('\n🔍  Resale Radar — refreshing events...\n');
  console.log('    Asking Claude to research new events...');

  let rawResponse;
  try {
    rawResponse = await callClaude(USER_PROMPT);
  } catch (err) {
    console.error('\n❌  API call failed:', err.message);
    process.exit(1);
  }

  let newEvents;
  try {
    newEvents = parseEvents(rawResponse);
  } catch (err) {
    console.error('\n❌  Could not parse Claude response as JSON.');
    console.error('    Raw response:\n', rawResponse.slice(0, 500));
    process.exit(1);
  }

  console.log(`    Claude returned ${newEvents.length} new events.`);

  // Merge: keep existing events, append new ones (dedupe by id)
  const existingIds = new Set(existing.events.map(e => e.id));
  const toAdd = newEvents.filter(e => !existingIds.has(e.id));

  console.log(`    ${toAdd.length} are genuinely new (not duplicates).`);

  // Also update urgency on existing events — mark anything "now" 
  // that was "watch" if Claude returned it as now
  const updated = {
    last_updated: today,
    events: [...existing.events, ...toAdd]
  };

  fs.writeFileSync(EVENTS_FILE, JSON.stringify(updated, null, 2));

  console.log('\n✅  events.json updated successfully!');
  console.log(`    Total events tracked: ${updated.events.length}`);
  console.log('\n    Next steps:');
  console.log('    1. Review events.json if you want to check what was added');
  console.log('    2. Run: git add events.json && git commit -m "refresh events" && git push');
  console.log('    3. Your site will update automatically within ~60 seconds\n');
}

main();
