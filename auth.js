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
  button.textContent = "E-posta ile giriş yap";
  host.append(button, status);
  if (!ready) {
    button.disabled = true;
    status.textContent = " Giriş ayarları henüz tamamlanmadı.";
    return;
  }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    window.teklifbulSupabase = client;
    window.dispatchEvent(new Event("teklifbul:client-ready"));
    const refresh = async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        button.textContent = "E-posta ile giriş yap";
        status.textContent = "";
      } else {
        button.textContent = "Çıkış yap";
        try {
          await client.from("profiles").upsert({id:user.id,display_name:(user.user_metadata?.full_name || user.email?.split("@")[0] || "Kullanıcı").slice(0,100)}, {onConflict:"id",ignoreDuplicates:true});
        } catch (_) { /* login should still work if profile sync fails */ }
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
        const email = prompt("Giriş bağlantısı gönderilecek e-posta adresiniz:");
        if (email === null) return;
        const trimmed=email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {status.textContent=" Geçerli bir e-posta adresi girin.";return;}
        const { error } = await client.auth.signInWithOtp({email:trimmed,options:{emailRedirectTo:location.origin+location.pathname}});
        status.textContent=error?" Giriş bağlantısı gönderilemedi. E-posta ayarlarını kontrol edin.":" E-postanıza giriş bağlantısı gönderildi. Gelen kutunuzu kontrol edin.";
      }
    };
    client.auth.onAuthStateChange(() => { void refresh(); });
    await refresh();
  } catch (e) {
    button.disabled = false;
    button.onclick = () => alert("Giriş sistemi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
    status.textContent = " Giriş sistemi yüklenemedi; sayfayı yenileyin.";
  }
})();
