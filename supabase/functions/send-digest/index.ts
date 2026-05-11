import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: articles } = await supabase
    .from("articles")
    .select("*, sources(name, category)")
    .eq("included_in_digest", false)
    .gte("fetched_at", oneDayAgo)
    .order("fetched_at", { ascending: false });

  if (!articles || articles.length === 0) {
    return new Response(JSON.stringify({ message: "No new articles to digest" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().split("T")[0];

  const grouped: Record<string, typeof articles> = {};
  for (const a of articles) {
    const cat = a.sources?.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  }

  const categoryLabels: Record<string, string> = {
    pmm: "Product Marketing",
    product: "Product & Growth",
    strategy: "Strategy",
    growth: "Growth",
    marketing: "Marketing",
    general: "General",
  };

  let sections = "";
  for (const [cat, items] of Object.entries(grouped)) {
    const label = categoryLabels[cat] || cat;
    const articleRows = items.map(a => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <a href="${a.url}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px;">${a.title}</a>
          <br><span style="color: #888; font-size: 12px;">${a.sources?.name || "Unknown"}${a.author ? ` — ${a.author}` : ""}</span>
          ${a.summary ? `<br><span style="color: #555; font-size: 13px;">${a.summary}</span>` : ""}
        </td>
      </tr>
    `).join("");

    sections += `
      <tr>
        <td style="padding: 20px 0 8px;">
          <h2 style="margin: 0; font-size: 16px; color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; display: inline-block;">${label}</h2>
        </td>
      </tr>
      ${articleRows}
    `;
  }

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, sans-serif; color: #1a1a1a;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 24px 0; border-bottom: 2px solid #e5e5e5;">
            <h1 style="margin: 0; font-size: 20px;">PMM Daily Digest</h1>
            <p style="margin: 4px 0 0; color: #888; font-size: 13px;">${today} — ${articles.length} articles</p>
          </td>
        </tr>
        ${sections}
        <tr>
          <td style="padding: 24px 0; border-top: 1px solid #e5e5e5; color: #888; font-size: 12px; text-align: center;">
            PMM Daily Digest — built with Supabase
          </td>
        </tr>
      </table>
    </div>
  `;

  // Store the compiled digest — email sending happens locally via Gmail API
  await supabase.from("digests").upsert({
    digest_date: today,
    article_count: articles.length,
    html_content: html,
    email_status: "ready",
  }, { onConflict: "digest_date" });

  const articleIds = articles.map(a => a.id);
  await supabase
    .from("articles")
    .update({ included_in_digest: true })
    .in("id", articleIds);

  return new Response(
    JSON.stringify({ compiled: true, articleCount: articles.length, date: today }),
    { headers: { "Content-Type": "application/json" } }
  );
});
