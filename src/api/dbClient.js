/**
 * @typedef {Object} EntityHandlers
 * @property {(sort?: string|{column:string,ascending?:boolean}, limit?: number) => Promise<T[]>} list
 * @property {(conditions: Partial<T>) => Promise<T[]>} filter
 * @property {(data: Partial<T>) => Promise<T>} create
 * @property {(id: string, data: Partial<T>) => Promise<T>} update
 * @property {(id: string) => Promise<boolean>} delete
 * @property {(id: string) => Promise<T|null>} get
 */

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} [cnpj]
 * @property {string} [tipo]
 * @property {string} [estabelecimento_tipo]
 * @property {string} [razao_social]
 * @property {string} [situacao_cadastral]
 * @property {string} [data_abertura]
 * @property {number} [capital_social]
 * @property {string} [porte]
 * @property {string} [cnae_principal]
 * @property {string} [natureza_juridica]
 * @property {string} [cep]
 * @property {string} [uf]
 * @property {string} [cidade]
 * @property {string} [bairro]
 * @property {string} [logradouro]
 * @property {string} [numero]
 * @property {string} [complemento]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {boolean} [active]
 * @property {string} [owner_email]
 * @property {string} [owner_name]
 * @property {string} [owner_phone]
 * @property {boolean} [has_branch]
 * @property {string} [branding_app_name]
 * @property {string} [branding_logo_url]
 * @property {string} [branding_primary_color]
 * @property {string} [branding_secondary_color]
 * @property {string} [branding_accent_color]
 * @property {string} [branding_background_color]
 * @property {string} [opening_time]
 * @property {string} [closing_time]
 * @property {string[]} [open_days]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} name
 * @property {string} [cpf]
 * @property {string} [rg]
 * @property {string} [email]
 * @property {string} [whatsapp]
 * @property {string} [address_street]
 * @property {string} [address_number]
 * @property {string} [address_complement]
 * @property {string} [address_neighborhood]
 * @property {string} [address_city]
 * @property {string} [address_state]
 * @property {string} [address_zipcode]
 * @property {string} [birth_date]
 * @property {string} [medical_certificate_url]
 * @property {string} [plan_id]
 * @property {Object} [custom_plan]
 * @property {number} [current_credits]
 * @property {string} [access_token]
 * @property {string} [asaas_customer_id]
 * @property {string} [asaas_subscription_id]
 * @property {string} [teacher_id]
 * @property {string} [guardian_id]
 * @property {string} [billing_mode]
 * @property {boolean} [portal_enabled]
 * @property {string} [company_id]
 * @property {string[]} [company_ids]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Appointment
 * @property {string} id
 * @property {string} customer_id
 * @property {string} [customer_name]
 * @property {string} [plan_id]
 * @property {string} date
 * @property {string} start_time
 * @property {string} [end_time]
 * @property {number} duration_mins
 * @property {string} [service_category]
 * @property {string} [status]
 * @property {string} [appointment_type]
 * @property {string} [cancellation_reason]
 * @property {boolean} [service_performed]
 * @property {string} [notes]
 * @property {boolean} [rescheduled]
 * @property {string} [rescheduled_appointment_id]
 * @property {string} [original_appointment_id]
 * @property {string} company_id
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} customer_id
 * @property {string} [customer_name]
 * @property {string} [asaas_id]
 * @property {string} [asaas_url]
 * @property {string} [plan_id]
 * @property {string} [plan_name]
 * @property {number} value
 * @property {string} [due_date]
 * @property {string} [status]
 * @property {string} [payment_date]
 * @property {string} company_id
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Plan
 * @property {string} id
 * @property {string} name
 * @property {string} modality
 * @property {string} [product_type]
 * @property {string} [combo_type]
 * @property {number} duration_mins
 * @property {number} price
 * @property {number} [session_count]
 * @property {number} [commission]
 * @property {number} [discount]
 * @property {string} [professional]
 * @property {string} [description]
 * @property {boolean} [active]
 * @property {string} [company_id]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Template
 * @property {string} id
 * @property {string} trigger
 * @property {string} message
 * @property {boolean} [enabled]
 * @property {number} [send_before_hours]
 * @property {string} [company_id]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {string} action
 * @property {string} entity_type
 * @property {string} [entity_id]
 * @property {string} [category]
 * @property {string} description
 * @property {string} [user_name]
 * @property {string} [user_email]
 * @property {string} [ip_address]
 * @property {Object} [metadata]
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} WaitingList
 * @property {string} id
 * @property {string} customer_name
 * @property {string} [whatsapp]
 * @property {string} [email]
 * @property {string} modality
 * @property {number} [duration_mins]
 * @property {Object} [preferred_days]
 * @property {string} [priority]
 * @property {string} [notes]
 * @property {string} [status]
 * @property {string} company_id
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Settings
 * @property {string} id
 * @property {string} key
 * @property {string} value
 * @property {string} [description]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Modality
 * @property {string} id
 * @property {string} name
 * @property {boolean} [active]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} CompanyIntegration
 * @property {string} id
 * @property {string} company_id
 * @property {string} [asaas_api_key]
 * @property {string} [asaas_environment]
 * @property {string} [asaas_subaccount_id]
 * @property {string} [asaas_subaccount_wallet_id]
 * @property {string} [whatsapp_provider]
 * @property {string} [whatsapp_api_url]
 * @property {string} [whatsapp_api_token]
 * @property {string} [whatsapp_phone]
 * @property {string} [whatsapp_webhook_url]
 * @property {string} [whatsapp_instance]
 * @property {boolean} [whatsapp_connected]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} [full_name]
 * @property {string} [email]
 * @property {string} [cpf]
 * @property {string} [rg]
 * @property {string} [birth_date]
 * @property {"super_admin"|"admin"|"profissional"|"cliente"|"user"} role
 * @property {boolean} [active]
 * @property {string} [temp_password]
 * @property {boolean} [must_change_password]
 * @property {string} [company_id]
 * @property {string[]} [company_ids]
 * @property {string} [stylist_level_id]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} StylistLevel
 * @property {string} id
 * @property {string} company_id
 * @property {string} name
 * @property {string} slug
 * @property {number} multiplier
 * @property {string} [color]
 * @property {number} [sort_order]
 * @property {boolean} [active]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} BlockedTime
 * @property {string} id
 * @property {string} company_id
 * @property {string} date
 * @property {string} start_time
 * @property {string} end_time
 * @property {string} [description]
 * @property {boolean} [block_all_barbers]
 * @property {"none"|"weekly"|"daily"|"period"} [recurrence_type]
 * @property {number} [recurrence_day_of_week]
 * @property {string} [period_start_date]
 * @property {string} [period_end_date]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

import { supabase } from "@/lib/supabaseClient";

const _tableColumnsCache = {};
function cacheColumnsFromRow(table, row) {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    _tableColumnsCache[table] = Object.keys(row);
  }
}
function filterKnownColumns(obj, knownColumns) {
  if (!knownColumns || !obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (knownColumns.includes(k)) out[k] = v;
  }
  return out;
}

const ENTITY_TABLE_MAP = {
  Company: "companies",
  Customer: "customers",
  Appointment: "appointments",
  Invoice: "invoices",
  Plan: "plans",
  Template: "templates",
  AuditLog: "audit_logs",
  WaitingList: "waiting_list",
  Settings: "settings",
  Modality: "modalities",
  CompanyIntegration: "company_integrations",
  User: "users",
  Service: "services",
  ServiceCombo: "service_combos",
  ServiceComboItem: "service_combo_items",
  PlanService: "plan_services",
  PlanItem: "plan_items",
  StylistLevel: "stylist_levels",
  PunchCard: "punch_cards",
  ProfessionalService: "professional_services",
  BlockedTime: "blocked_times",
  EstablishmentType: "establishment_types",
};

const CUSTOMER_COLUMN_MAP = {
  addressStreet: "address_street",
  addressNumber: "address_number",
  addressComplement: "address_complement",
  addressNeighborhood: "address_neighborhood",
  addressCity: "address_city",
  addressState: "address_state",
  addressZipcode: "address_zipcode",
  birthDate: "birth_date",
  medicalCertificateUrl: "medical_certificate_url",
  planId: "plan_id",
  customPlan: "custom_plan",
  currentCredits: "current_credits",
  accessToken: "access_token",
  asaasCustomerId: "asaas_customer_id",
  asaasSubscriptionId: "asaas_subscription_id",
  teacherId: "teacher_id",
  guardianId: "guardian_id",
  billingMode: "billing_mode",
  portalEnabled: "portal_enabled",
  companyId: "company_id",
  companyIds: "company_ids",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const REVERSE_CUSTOMER_COLUMN_MAP = Object.fromEntries(
  Object.entries(CUSTOMER_COLUMN_MAP).map(([k, v]) => [v, k])
);

function mapKeys(obj, map) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

const createEntityHandler = (entityName) => {
  const table = ENTITY_TABLE_MAP[entityName];
  if (!table) {
    console.warn(`No table mapping for entity "${entityName}", falling back to mock`);
    return createMockHandler(entityName);
  }

  const isCustomer = entityName === "Customer";

  const toDb = (data) => {
    if (!data || typeof data !== "object") return data;
    let mapped = isCustomer ? mapKeys(data, CUSTOMER_COLUMN_MAP) : { ...data };
    if (mapped.customerId !== undefined && mapped.customer_id === undefined) {
      mapped.customer_id = mapped.customerId;
      delete mapped.customerId;
    }
    if (mapped.studentId !== undefined && mapped.customer_id === undefined) {
      mapped.customer_id = mapped.studentId;
      delete mapped.studentId;
    }
    return mapped;
  };

  const fromDb = (data) => {
    if (!data || typeof data !== "object") return data;
    let mapped = isCustomer ? mapKeys(data, REVERSE_CUSTOMER_COLUMN_MAP) : { ...data };
    return mapped;
  };

  return {
    list: async (sort, limit) => {
      let query = supabase.from(table).select("*");
      if (sort) {
        if (typeof sort === "string") {
          const descending = sort.startsWith("-");
          const column = descending ? sort.slice(1) : sort;
          query = query.order(column, { ascending: !descending });
        } else {
          query = query.order(sort.column, { ascending: sort.ascending ?? true });
        }
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      if (data?.[0]) cacheColumnsFromRow(table, data[0]);
      return (data || []).map(fromDb);
    },

    filter: async (conditions) => {
      let query = supabase.from(table).select("*");
      const dbConditions = toDb(conditions);
      for (const key in dbConditions) {
        if (dbConditions[key] !== undefined && dbConditions[key] !== null) {
          query = query.eq(key, dbConditions[key]);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(fromDb);
    },

    create: async (data) => {
      const knownCols = _tableColumnsCache[table];
      const payload = knownCols ? filterKnownColumns(toDb(data), knownCols) : toDb(data);
      const { data: created, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (!error) {
        if (created) cacheColumnsFromRow(table, created);
        return fromDb(created);
      }
      if (error.code === "PGRST204") {
        const { error: err2 } = await supabase.from(table).insert(payload);
        if (err2) throw err2;
        return fromDb({ ...payload, id: crypto.randomUUID() });
      }
      throw error;
    },

    update: async (id, data) => {
      const knownCols = _tableColumnsCache[table];
      const payload = knownCols ? filterKnownColumns(toDb(data), knownCols) : toDb(data);
      const { data: updated, error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error) {
        if (updated) cacheColumnsFromRow(table, updated);
        return fromDb(updated);
      }
      if (error.code === "PGRST204") {
        const { error: err2 } = await supabase.from(table).update(payload).eq("id", id);
        if (err2) throw err2;
        return fromDb({ id, ...payload });
      }
      throw error;
    },

    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    get: async (id) => {
      if (!id) return null;
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return fromDb(data);
    },
  };
};

const createMockHandler = (entityName) => {
  const getStorage = () => {
    const data = localStorage.getItem(`mock_db_${entityName}`);
    return data ? JSON.parse(data) : [];
  };
  const setStorage = (data) =>
    localStorage.setItem(`mock_db_${entityName}`, JSON.stringify(data));
  const generateId = () => Math.random().toString(36).substring(2, 9);

  return {
    list: async () => getStorage(),
    filter: async (conditions) =>
      getStorage().filter((item) =>
        Object.keys(conditions).every((k) => item[k] === conditions[k])
      ),
    create: async (data) => {
      const items = getStorage();
      const newItem = {
        id: generateId(),
        created_at: new Date().toISOString(),
        ...data,
      };
      items.push(newItem);
      setStorage(items);
      return newItem;
    },
    update: async (id, data) => {
      const items = getStorage();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) throw new Error("Not found");
      items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
      setStorage(items);
      return items[index];
    },
    delete: async (id) => {
      setStorage(getStorage().filter((i) => i.id !== id));
      return true;
    },
    get: async (id) => getStorage().find((i) => i.id === id) || null,
  };
};

const entitiesProxy = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (!target[prop]) {
        target[prop] = createEntityHandler(prop);
      }
      return target[prop];
    },
  }
);

export async function getCustomerCompanies(customerId) {
  const { data, error } = await supabase
    .from("customer_companies")
    .select("company_id")
    .eq("customer_id", customerId);
  if (error) throw error;
  return data?.map((r) => r.company_id) || [];
}

export async function setCustomerCompanies(customerId, companyIds) {
  const { error: delErr } = await supabase
    .from("customer_companies")
    .delete()
    .eq("customer_id", customerId);
  if (delErr) throw delErr;

  if (companyIds?.length) {
    const rows = companyIds.map((company_id) => ({ customer_id: customerId, company_id }));
    const { error: insErr } = await supabase.from("customer_companies").insert(rows);
    if (insErr) throw insErr;
  }
}

export const db = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      const { data: user } = await supabase
        .from("users")
        .select("*, user_companies(company_id)")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!user) return data.session.user;
      return {
        ...user,
        company_ids: user.user_companies?.length > 0
          ? user.user_companies.map(uc => uc.company_id)
          : (user.company_id ? [user.company_id] : []),
      };
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
    redirectToLogin: () => {
      window.location.href = "/login";
    },
  },
  users: {
    inviteUser: async (email, role, full_name, extra = {}) => {
      console.log("=== inviteUser ===", { email, role, full_name });
      const tempPassword = (crypto.randomUUID?.() || Math.random().toString(36).slice(2, 14)) + "!Aa1";

      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = import.meta.env.VITE_API_URL || "";

      // 1. Tenta criar via servidor (usa admin API com service_role)
      try {
        const res = await fetch(`${apiBase || window.location.origin}/api/auth/admin-create-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({
            email,
            password: tempPassword,
            full_name: full_name || "",
            role: role || "cliente",
            phone: extra.phone,
            commission_pct: extra.commission_pct,
            specialty: extra.specialty,
            photo_url: extra.photo_url,
            work_days: extra.work_days,
            company_id: extra.company_id,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          console.log("User created via server:", data);

          // Set must_change_password so the user is forced to change on first login
          if (data.user_id) {
            try {
              await supabase
                .from("users")
                .update({ must_change_password: true, temp_password: tempPassword })
                .eq("id", data.user_id);
            } catch (flagErr) {
              console.warn("Failed to set must_change_password:", flagErr);
            }
          }

          return {
            user_id: data.user_id,
            email,
            temp_password: tempPassword,
            message: "Conta criada! O usuário pode entrar com a senha fornecida.",
          };
        }
        console.warn("admin-create-user failed, falling back to signUp:", await res.text());
      } catch (serverErr) {
        console.warn("admin-create-user error, falling back to signUp:", serverErr);
      }

      // 2. Fallback: cria via signUp + confirma email
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: { full_name: full_name || "", role: role || "cliente" },
          emailRedirectTo: window.location.origin + "/login",
        },
      });

      if (signUpError) {
        console.error("signUp error:", signUpError);
        throw signUpError;
      }

      if (!signUpData?.user?.id) {
        throw new Error("Email já cadastrado ou não foi possível criar o usuário.");
      }

      console.log("User created via signUp:", signUpData.user.id);

      // 3. Confirma o e-mail para login imediato
      try {
        await fetch(`${apiBase || window.location.origin}/api/auth/confirm-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ user_id: signUpData.user.id }),
        });
      } catch (confirmErr) {
        console.error("Failed to confirm email:", confirmErr);
      }

      return {
        user_id: signUpData.user.id,
        email,
        message: "Conta criada! O usuário receberá um e-mail para definir a senha.",
      };
    },
    updateUser: async (userId, data) => {
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiBase || window.location.origin}/api/auth/admin-update-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ user_id: userId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao atualizar" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
  },
  functions: {
    invoke: async (functionName, payload) => {
      const apiBase = import.meta.env.VITE_API_URL || "";

      const routeMap = {
        asaasCustomer: "/api/asaas/customer",
        asaasSubaccounts: "/api/asaas/subaccounts",
        whatsappSend: "/api/whatsapp/send",
        testAsaasConnection: "/api/asaas/test",
        testWhatsappConnection: "/api/whatsapp/test",
        "send-email": "/api/send-email",
        lookupCep: "/api/cep",
        lookupCnpj: "/api/cnpj",
      };

      const apiPath = routeMap[functionName];
      if (apiPath) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${apiBase}${apiPath}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token || ""}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          return { data };
        } catch (err) {
          if (err.message !== "Failed to fetch") {
            throw err;
          }
        }
      }

      // Fallback to Edge Functions
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });
      if (error) throw error;
      return { data };
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from("uploads")
          .upload(fileName, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("uploads")
          .getPublicUrl(data.path);
        return { file_url: urlData.publicUrl };
      },
      SendEmail: async ({ to, subject, body }) => {
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: { to, subject, body },
        });
        if (error) throw error;
        return data;
      },
    },
  },
  appLogs: {
    logUserInApp: async (pageName) => {
      console.log(`[Supabase] logUserInApp: ${pageName}`);
    },
  },
customers: {
    getCompanies: getCustomerCompanies,
    setCompanies: setCustomerCompanies,
  },
};

export default db;