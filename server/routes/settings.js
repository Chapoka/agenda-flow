import { Router } from "express";
import { createServerSupabase } from "../lib/supabase.js";

const router = Router();

// GET /api/settings — lista settings (service_role bypassa RLS quebrada)
router.get("/", async (req, res) => {
  try {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("settings").select("*").order("key");
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("settings list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings — upsert de pares key/value (super_admin via middleware)
router.post("/", async (req, res) => {
  try {
    const { entries } = req.body || {};
    if (!entries || typeof entries !== "object" || !Object.keys(entries).length) {
      return res.status(400).json({ error: "entries é obrigatório (objeto key→value)" });
    }
    const sb = createServerSupabase();
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value: value == null ? "" : String(value),
    }));

    const { data: existing, error: selErr } = await sb
      .from("settings")
      .select("key")
      .in("key", rows.map((r) => r.key));
    if (selErr) throw selErr;

    const existingKeys = new Set((existing || []).map((r) => r.key));
    const toInsert = rows.filter((r) => !existingKeys.has(r.key));
    const toUpdate = rows.filter((r) => existingKeys.has(r.key));

    if (toUpdate.length) {
      for (const row of toUpdate) {
        const { error } = await sb.from("settings").update({ value: row.value }).eq("key", row.key);
        if (error) throw error;
      }
    }
    if (toInsert.length) {
      const { error } = await sb.from("settings").insert(toInsert);
      if (error) throw error;
    }

    res.json({ ok: true, updated: toUpdate.length, inserted: toInsert.length });
  } catch (err) {
    console.error("settings upsert error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
