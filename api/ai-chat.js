// Housley Happy Paws AI Chat Proxy
// POST /api/ai-chat

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.housleyhappypaws.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // R65 - this was an open, unauthenticated, unthrottled proxy to the
  //       Anthropic API on the business's own key - anyone who found the URL
  //       could spend it without limit. The widget it serves lives inside
  //       #pg-owner: it is Rachel's business assistant, not a customer
  //       feature. It is now restricted to signed-in owner/staff.
  const { createClient } = require("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://niysrippazlkpvdkzepp.supabase.co";

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Not signed in" });

  const supabaseAuth = createClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !authData || !authData.user) {
    return res.status(401).json({ error: "Not signed in" });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Server misconfigured" });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!callerProfile || (callerProfile.role !== "owner" && callerProfile.role !== "staff")) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AI not configured. Add ANTHROPIC_API_KEY to Vercel env vars." });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing messages array" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1024,
        system: system || "",
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: data.error?.message || "AI request failed" });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("AI chat error:", err);
    return res.status(500).json({ error: "Failed to connect to AI service" });
  }
};
