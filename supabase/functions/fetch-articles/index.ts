import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new TextDecoder().decode(encode(new Uint8Array(hash)));
}

interface FeedItem {
  title: string;
  link: string;
  author: string;
  summary: string;
  published: string;
}

function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const b = match[1];
    const title = b.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] || b.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link = b.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const author = b.match(/<dc:creator><!\[CDATA\[(.*?)\]\]>/)?.[1] || b.match(/<author>(.*?)<\/author>/)?.[1] || "";
    const desc = b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] || b.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
    const pubDate = b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
    if (title && link) {
      items.push({
        title: title.trim(),
        link: link.trim(),
        author: author.trim(),
        summary: desc.replace(/<[^>]+>/g, "").trim().slice(0, 300),
        published: pubDate,
      });
    }
  }
  return items;
}

function parseAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const b = match[1];
    const title = b.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || "";
    const link = b.match(/<link[^>]*href="([^"]*)"[^>]*\/>/)?.[1] || b.match(/<link[^>]*href="([^"]*)">/)?.[1] || "";
    const author = b.match(/<name>(.*?)<\/name>/)?.[1] || "";
    const summary = b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] || "";
    const published = b.match(/<published>(.*?)<\/published>/)?.[1] || b.match(/<updated>(.*?)<\/updated>/)?.[1] || "";
    if (title && link) {
      items.push({
        title: title.trim(),
        link: link.trim(),
        author: author.trim(),
        summary: summary.replace(/<[^>]+>/g, "").trim().slice(0, 300),
        published,
      });
    }
  }
  return items;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: sources } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true);

  if (!sources) return new Response("No sources", { status: 500 });

  let totalInserted = 0;
  let totalErrors = 0;

  for (const source of sources) {
    if (!source.feed_url) continue;
    try {
      const resp = await fetch(source.feed_url, {
        headers: { "User-Agent": "pmm-daily-digest/1.0" },
      });
      if (!resp.ok) { totalErrors++; continue; }

      const xml = await resp.text();
      const items = xml.includes("<entry>") ? parseAtom(xml) : parseRss(xml);

      for (const item of items.slice(0, 15)) {
        const hash = await sha256(item.link);
        const publishedAt = item.published ? new Date(item.published).toISOString() : null;

        const { error } = await supabase.from("articles").insert({
          source_id: source.id,
          title: item.title,
          url: item.link,
          author: item.author || null,
          summary: item.summary || null,
          published_at: publishedAt,
          dedup_hash: hash,
        });
        if (!error) totalInserted++;
      }

      await supabase
        .from("sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", source.id);
    } catch {
      totalErrors++;
    }
  }

  return new Response(
    JSON.stringify({ inserted: totalInserted, errors: totalErrors, timestamp: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
