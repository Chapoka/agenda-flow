import { Router } from "express";

const router = Router();

// POST /api/auth/confirm-email — confirma o e-mail de um usuário via GoTrue Admin API
router.post("/confirm-email", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id é obrigatório" });

    const gotrueUrl = `${process.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${user_id}`;
    const response = await fetch(gotrueUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ email_confirm: true }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || `HTTP ${response.status}`);
    }

    res.json({ ok: true, user: data });
  } catch (err) {
    console.error("confirm-email error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-create-user — criar um usuário (auth + public)
router.post("/admin-create-user", async (req, res) => {
  try {
    const { email, password, full_name, role, phone, commission_pct, specialty, photo_url, work_days, company_id, company_ids, whatsapp, cpf, rg, birth_date } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email e password são obrigatórios" });
    }

    const callerId = req.user.id;
    if (!callerId) return res.status(401).json({ error: "Não autorizado" });

    const { data: profile } = await req.supabase
      .from("users")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profile?.role !== "super_admin" && profile?.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Normaliza company_ids (array) + company_id (legado) para validações
    const requestedCompanyIds = Array.isArray(company_ids) ? company_ids.filter(Boolean)
      : (company_id ? [company_id] : []);
    // Admin só pode criar usuários para sua própria empresa
    if (profile?.role === "admin" && requestedCompanyIds.length > 0) {
      const { data: callerCompanies } = await req.supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", callerId);
      const callerCompanyIds = (callerCompanies || []).map(c => c.company_id);
      const invalid = requestedCompanyIds.filter(id => !callerCompanyIds.includes(id));
      if (invalid.length > 0) {
        return res.status(403).json({ error: "Acesso negado: não pode criar usuário para outra empresa" });
      }
    }

    let userId;

    const { data: userData, error: createError } = await req.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "", role: role || "cliente" },
    });

    if (createError) {
      // Se o e-mail já está registrado, retorna 409 com link para o usuário existente
      const msgLower = (createError.message || "").toLowerCase();
      const isAlreadyRegistered = msgLower.includes("already") && msgLower.includes("registered");
      if (isAlreadyRegistered) {
        const { data: existingUsers, error: listErr } = await req.supabase.auth.admin.listUsers();
        if (listErr) throw listErr;
        const existing = (existingUsers?.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!existing) throw createError;
        // Busca dados do usuário existente para link
        const { data: existingProfile } = await req.supabase.from("users").select("id, full_name, email, role").eq("id", existing.id).maybeSingle();
        return res.status(409).json({
          error: "Este e-mail já está cadastrado como usuário",
          code: "USER_ALREADY_EXISTS",
          existing_user_id: existing.id,
          existing_user_email: existing.email,
          existing_user_name: existingProfile?.full_name || existing.email,
          existing_user_role: existingProfile?.role || "cliente",
        });
      } else {
        throw createError;
      }
    } else {
      userId = userData?.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário");
    }

    // O trigger handle_new_user já deve ter criado o registro em public.users,
    // mas confirmamos e atualizamos o role se necessário
    const updateData = {
      full_name: full_name || "",
      role: role || "cliente",
    };
    if (phone) updateData.phone = phone;
    if (commission_pct != null) updateData.commission_pct = commission_pct;
    if (specialty != null) updateData.specialty = specialty;
    if (photo_url) updateData.photo_url = photo_url;
    if (work_days) updateData.work_days = work_days;
    if (company_id) updateData.company_id = company_id;
    if (whatsapp) updateData.whatsapp = whatsapp;
    if (cpf) updateData.cpf = cpf;
    if (rg) updateData.rg = rg;
    if (birth_date) updateData.birth_date = birth_date;

    await req.supabase.from("users").update(updateData).eq("id", userId);

    // Garantir que user_companies seja preenchido para RLS (get_user_company_ids usa user_companies como fonte)
    // Suporta tanto company_id (singular, legado) quanto company_ids (array, novo frontend)
    const finalCompanyIds = requestedCompanyIds.length > 0 ? requestedCompanyIds : (company_id ? [company_id] : []);
    if (finalCompanyIds.length > 0) {
      // Cria vínculos via service_role (bypass RLS) - evita 403 para admin
      const rows = finalCompanyIds.map(cid => ({ user_id: userId, company_id: cid }));
      const { error: ucErr } = await req.supabase
        .from("user_companies")
        .upsert(rows, { onConflict: "user_id,company_id" });
      if (ucErr) console.warn("user_companies upsert failed:", ucErr.message);

      // Sincroniza users.company_id (legado, primeira empresa) e users.company_ids (array)
      try {
        const { data: existing } = await req.supabase
          .from("users")
          .select("company_id, company_ids")
          .eq("id", userId)
          .single();
        const currentIds = existing?.company_ids || [];
        const newIds = [...new Set([...currentIds, ...finalCompanyIds])];
        const primaryCompanyId = existing?.company_id || finalCompanyIds[0] || null;
        await req.supabase.from("users").update({ company_id: primaryCompanyId, company_ids: newIds }).eq("id", userId);
      } catch (e) {
        console.warn("company_ids sync failed:", e.message);
      }
    }

    res.json({ user_id: userId, email });
  } catch (err) {
    console.error("admin-create-user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-update-user — atualizar dados de um usuário (service_role bypasses RLS)
// Regra: super_admin pode editar qualquer um; admin NÃO pode editar a si mesmo e SÓ pode editar OUTROS admin/super_admin do MESMA empresa
router.post("/admin-update-user", async (req, res) => {
  try {
    const { user_id, full_name, phone, email, active, commission_pct, specialty, photo_url, work_days, whatsapp, cpf, rg, birth_date, role, is_master, is_professional, company_ids } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id é obrigatório" });

    const callerId = req.user.id;
    if (!callerId) return res.status(401).json({ error: "Não autorizado" });

    const { data: profile } = await req.supabase
      .from("users")
      .select("role")
      .eq("id", callerId)
      .single();

    const isSuperAdmin = profile?.role === "super_admin";
    const isAdmin = profile?.role === "admin";

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Admin não pode editar a si mesmo via este endpoint (deve usar perfil próprio)
    if (isAdmin && !isSuperAdmin && callerId === user_id) {
      return res.status(403).json({ error: "Admin não pode alterar o próprio perfil por aqui. Use seu perfil." });
    }

    // Se for admin (não super_admin), verificar que alvo é admin/super_admin e compartilha empresa
    if (isAdmin && !isSuperAdmin) {
      const { data: target } = await req.supabase
        .from("users")
        .select("role")
        .eq("id", user_id)
        .single();
      if (!target) return res.status(404).json({ error: "Usuário alvo não encontrado" });
      if (target.role !== "admin" && target.role !== "profissional") {
        return res.status(403).json({ error: "Admin só pode alterar outros admins e profissionais da mesma empresa" });
      }
      // Checar mesma empresa via user_companies
      const { data: callerCompanies } = await req.supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", callerId);
      const { data: targetCompanies } = await req.supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user_id);
      const callerCompanyIds = (callerCompanies || []).map(c => c.company_id);
      const targetCompanyIds = (targetCompanies || []).map(c => c.company_id);
      const shared = callerCompanyIds.some(id => targetCompanyIds.includes(id));
      if (!shared) {
        return res.status(403).json({ error: "Acesso negado: usuário não pertence à sua empresa" });
      }
      // Bloquear escalada de privilégio
      if (role === "super_admin") {
        return res.status(403).json({ error: "Admin não pode promover a super_admin" });
      }
      if (is_master === true) {
        return res.status(403).json({ error: "Apenas super_admin pode conceder Master" });
      }
    }

    const updateData = {};
    if (full_name != null) updateData.full_name = full_name;
    if (phone != null) updateData.phone = phone;
    if (email != null) updateData.email = email;
    if (active != null) updateData.active = active;
    if (commission_pct != null) updateData.commission_pct = commission_pct;
    if (specialty != null) updateData.specialty = specialty;
    if (photo_url != null) updateData.photo_url = photo_url;
    if (work_days != null) updateData.work_days = work_days;
    if (whatsapp != null) updateData.whatsapp = whatsapp;
    if (cpf != null) updateData.cpf = cpf;
    if (rg != null) updateData.rg = rg;
    if (birth_date != null) updateData.birth_date = birth_date;
    if (role != null && isSuperAdmin) updateData.role = role; // só super_admin pode trocar role
    else if (role != null && isAdmin) {
      // admin pode manter admin ou mudar para profissional? manter restrito: só pode manter admin
      if (["profissional", "cliente"].includes(role)) updateData.role = role;
    }
    if (is_master != null && isSuperAdmin) updateData.is_master = is_master;
    if (is_professional != null) updateData.is_professional = is_professional;

    if (Object.keys(updateData).length > 0) {
      const { error } = await req.supabase.from("users").update(updateData).eq("id", user_id);
      if (error) throw error;
    }

    // Atualizar vínculo de empresas se enviado (company_ids: string[])
    if (Array.isArray(company_ids)) {
      // Validar que admin só pode vincular a empresas que ele próprio possui (se não for super_admin)
      if (!isSuperAdmin) {
        const { data: callerCompanies } = await req.supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", callerId);
        const allowedIds = new Set((callerCompanies || []).map(c => c.company_id));
        const invalid = company_ids.filter(id => !allowedIds.has(id));
        if (invalid.length > 0) {
          return res.status(403).json({ error: "Admin só pode vincular a empresas que pertence" });
        }
      }
      await req.supabase.from("user_companies").delete().eq("user_id", user_id);
      if (company_ids.length > 0) {
        const rows = company_ids.map(company_id => ({ user_id, company_id }));
        const { error: insertError } = await req.supabase.from("user_companies").insert(rows);
        if (insertError) throw insertError;
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("admin-update-user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-delete-user — deletar um usuário (auth + public)
router.post("/admin-delete-user", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id é obrigatório" });

    const callerId = req.user.id;
    if (!callerId) return res.status(401).json({ error: "Não autorizado" });

    const { data: profile } = await req.supabase
      .from("users")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profile?.role !== "super_admin") {
      return res.status(403).json({ error: "Apenas Super Admin pode excluir usuários" });
    }

    // Bloqueia exclusão de super_admin via app - só via SQL direto no Supabase (Studio > SQL Editor)
    const { data: targetProfile } = await req.supabase.from("users").select("role,email").eq("id", user_id).single();
    if (targetProfile?.role === "super_admin") {
      return res.status(403).json({ error: `super_admin "${targetProfile.email}" não pode ser deletado via app. Use Supabase Studio > SQL Editor (como postgres): DELETE FROM auth.users WHERE id = '${user_id}';` });
    }

    // Limpa referências FK em tabelas dependentes (ordem importa)
    // 1. Zera FKs em customers (teacher_id, guardian_id) — não deleta o customer
    const { error: custErr } = await req.supabase
      .from("customers")
      .update({ teacher_id: null, guardian_id: null })
      .or(`teacher_id.eq.${user_id},guardian_id.eq.${user_id}`);
    if (custErr) console.warn("update customers FKs:", custErr.message);

    // 2. Deleta registros nas tabelas de dependência direta
    const deleteSteps = [
      { table: "professional_services", col: "professional_id" },
      { table: "user_companies", col: "user_id" },
    ];

    for (const { table, col } of deleteSteps) {
      const { error: delErr } = await req.supabase.from(table).delete().eq(col, user_id);
      if (delErr) {
        console.error(`delete ${table} error:`, delErr.message);
        return res.status(500).json({ error: `Erro ao limpar tabela ${table}: ${delErr.message}` });
      }
    }

    // 3. Deleta o usuário da tabela pública
    const { error: userDelErr } = await req.supabase.from("users").delete().eq("id", user_id);
    if (userDelErr) {
      console.error("delete users error:", userDelErr);
      return res.status(500).json({ error: "Erro ao remover do banco: " + userDelErr.message });
    }

    // Deleta do auth.users via admin API (service_role bypasses)
    const { error: authDelErr } = await req.supabase.auth.admin.deleteUser(user_id);
    if (authDelErr) {
      console.error("auth.users delete error:", authDelErr.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("admin-delete-user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-reset-password — redefinir a senha de um usuário
router.post("/admin-reset-password", async (req, res) => {
  try {
    const { user_id, new_password, must_change_password } = req.body;
    if (!user_id || !new_password) {
      return res.status(400).json({ error: "user_id e new_password são obrigatórios" });
    }

    // 1. Verificar se o chamador é super_admin ou admin no banco
    const callerId = req.user.id;
    if (!callerId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const { data: profile, error: profileError } = await req.supabase
      .from("users")
      .select("role")
      .eq("id", callerId)
      .single();

    const callerRole = profile?.role;
    const isSuperAdmin = callerRole === "super_admin";
    const isAdmin = callerRole === "admin";

    if (profileError || (!isSuperAdmin && !isAdmin)) {
      return res.status(403).json({ error: "Acesso negado: apenas super_admin ou admin pode redefinir senhas" });
    }

    // 2. If admin (not super_admin), verify they share at least one company with the target user
    if (isAdmin && !isSuperAdmin) {
      const { data: callerCompanies } = await req.supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", callerId);

      const { data: targetCompanies } = await req.supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user_id);

      const callerCompanyIds = (callerCompanies || []).map(c => c.company_id);
      const targetCompanyIds = (targetCompanies || []).map(c => c.company_id);
      const sharedCompany = callerCompanyIds.some(id => targetCompanyIds.includes(id));

      if (!sharedCompany) {
        return res.status(403).json({ error: "Acesso negado: você só pode redefinir senhas de usuários da mesma empresa" });
      }
    }

    // 3. Atualizar a senha via Supabase Admin API (service_role)
    const { error: updateAuthError } = await req.supabase.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (updateAuthError) throw updateAuthError;

    // 4. Atualizar flags no perfil público
    const { error: updateError } = await req.supabase
      .from("users")
      .update({
        temp_password: new_password,
        must_change_password: must_change_password || false,
      })
      .eq("id", user_id);

    if (updateError) throw updateError;

    res.json({ ok: true });
  } catch (err) {
    console.error("admin-reset-password error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
