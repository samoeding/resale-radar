"""
research.py — Called by the GitHub Action.
Uses Claude with web_search to find upcoming high-resale-potential ticket events,
then writes a structured events_draft.json for human review.
"""

import anthropic
import json
import os
import re
from datetime import datetime, timezone

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
focus  = os.environ.get("FOCUS_AREA", "").strip()

TODAY = datetime.now(timezone.utc).strftime("%B %d, %Y")

SYSTEM = """You are a ticket resale intelligence analyst. Your job is to identify upcoming
events in the United States where buying tickets at retail (face value / primary sale) is
likely to yield strong resale profit on the secondary market.

You have access to web search. Use it to find current, accurate information before answering.
Search for recent news about: upcoming tour announcements, ticket on-sale dates, sold-out shows,
high-demand events, and secondary market price trends.

You must output ONLY a valid JSON object — no markdown fences, no explanation, no preamble.
The JSON must match this exact schema:

{
  "last_updated": "<ISO 8601 timestamp>",
  "generated_by": "claude-research",
  "events": [
    {
      "name": "Event name",
      "type": "Sports | Concert | Festival",
      "multiple": "X–Y×",
      "on_sale": "When and where tickets go on sale",
      "best_bets": "Which tickets/seats/games to target",
      "city": "City or cities, or TBD",
      "urgency": "now | soon | watch",
      "notes": "Optional extra context, max 1 sentence"
    }
  ]
}

Urgency definitions:
- "now"   = tickets are on sale RIGHT NOW or within the next 7 days
- "soon"  = tickets go on sale within the next 1–4 weeks
- "watch" = not yet announced or 1+ month away — set alerts

Resale multiple guidelines (be realistic, not optimistic):
- 1.5–2×  = moderate demand, mainstream artist/team
- 2–4×    = high demand, major artist / playoff sports
- 4–10×   = extraordinary demand, once-in-a-decade event
- Use ranges like "2–4×" not single values

Quality bar — only include events where ALL of these are true:
1. Genuine scarcity: limited dates, sold-out likelihood, or one-city-only
2. Strong fan base with demonstrated willingness to pay secondary market prices
3. US-based event (domestic only)
4. Not already fully sold out on primary (unless noting resale-only availability)

Include 8–14 events total. Mix of urgency levels. Remove any events from the existing list
that are now outdated, already sold out on primary, or no longer relevant."""

focus_clause = f"\n\nFocus especially on: {focus}" if focus else ""

USER = f"""Today is {TODAY}.

Research and identify the best upcoming US ticket resale opportunities. Search for:
1. Major concert tour announcements or on-sales happening right now or soon
2. Sports playoff tickets going on sale (NBA, NHL, MLB postseason approaching)
3. High-demand festival tickets
4. Any "watch" events — anticipated announcements from major artists

Here is the current events list to update/replace:
{open('events.json').read()}

Refresh this list with the best current opportunities. Keep events that are still valid,
remove stale ones, and add newly announced events.{focus_clause}

Return ONLY the JSON object."""

print(f"[research.py] Running Claude research — today is {TODAY}")
if focus:
    print(f"[research.py] Focus area: {focus}")

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4000,
    tools=[{"type": "web_search_20250305", "name": "web_search"}],
    system=SYSTEM,
    messages=[{"role": "user", "content": USER}]
)

# Extract the final text block (after tool use)
raw = ""
for block in response.content:
    if block.type == "text":
        raw = block.text.strip()

# Strip any accidental markdown fences
raw = re.sub(r'^```[a-z]*\n?', '', raw, flags=re.MULTILINE)
raw = re.sub(r'\n?```$', '', raw, flags=re.MULTILINE)
raw = raw.strip()

try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    print(f"[research.py] ERROR: Claude returned invalid JSON: {e}")
    print(f"[research.py] Raw output:\n{raw[:500]}")
    raise

# Ensure timestamp is set
data["last_updated"] = datetime.now(timezone.utc).isoformat()
data["generated_by"] = "claude-research"

# Validate required fields on each event
required = {"name", "type", "multiple", "on_sale", "best_bets", "city", "urgency"}
for i, ev in enumerate(data.get("events", [])):
    missing = required - set(ev.keys())
    if missing:
        print(f"[research.py] WARNING: Event {i} missing fields: {missing}")
    ev.setdefault("notes", "")

output_path = "events_draft.json"
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"[research.py] Done. {len(data['events'])} events written to {output_path}")
for ev in data["events"]:
    print(f"  [{ev['urgency'].upper():5}] {ev['name']} — {ev['multiple']}")
