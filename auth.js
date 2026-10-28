// Progressive enhancement: browsing remains available before backend configuration.
(async function () {
  const host = document.getElementById("account");
  if (!host) return;
  const config = window.TEKLIFBUL_CONFIG;
  const ready = config && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl) && config.supabaseAnonKey && !config.supabaseAnonKey.includes("YOUR_");
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Google ile giriş yap";
  host.append(button, status);
  if (!ready) {
    button.disabled = true;
    status.textContent = " Google ile üyelik hazırlanıyor. Hizmetleri üyelik olmadan inceleyebilirsiniz.";
    return;
  }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    window.teklifbulSupabase = client;
    const refresh = async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        button.textContent = "Google ile giriş yap";
        status.textContent = "";
      } else {
        button.textContent = "Çıkış yap";
        status.textContent = " Giriş yapıldı: " + (user.user_metadata?.full_name || user.email || "Kullanıcı");
      }
    };
    button.onclick = async () => {
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        const { error } = await client.auth.signOut();
        if (error) status.textContent = " Çıkış başarısız, tekrar deneyin.";
        await refresh();
      } else {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + location.pathname }
        });
        if (error) status.textContent = " Giriş başlatılamadı. Tekrar deneyin.";
      }
    };
    client.auth.onAuthStateChange(() => { void refresh(); });
    await refresh();
  } catch (e) {
    button.disabled = true;
    status.textContent = " Giriş hizmetine ulaşılamıyor. Daha sonra tekrar deneyin.";
  }
})();
