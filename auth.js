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
  const google = document.createElement("button");
  google.type = "button";
  google.textContent = "Google ile devam et";
  const apple = document.createElement("button");
  apple.type = "button";
  apple.textContent = "Apple ile devam et";
  const phone = document.createElement("button");
  phone.type = "button";
  phone.textContent = "Telefon numarasıyla devam et";
  const phoneForm = document.createElement("div");
  const phoneNumber = document.createElement("input");
  phoneNumber.type = "tel";
  phoneNumber.placeholder = "05XX XXX XX XX";
  phoneNumber.autocomplete = "tel";
  const smsCode = document.createElement("input");
  smsCode.inputMode = "numeric";
  smsCode.placeholder = "SMS doğrulama kodu";
  smsCode.autocomplete = "one-time-code";
  const smsVerify = document.createElement("button");
  smsVerify.type = "button";
  smsVerify.textContent = "Kodu doğrula";
  smsCode.hidden = true;
  smsVerify.hidden = true;
  phoneForm.hidden = true;
  phoneForm.append(phoneNumber, smsCode, smsVerify);
  const choices = document.createElement("div");
  choices.style.cssText = "display:grid;gap:10px;max-width:420px";
  [google, apple, phone, button].forEach(b => { b.style.width = "100%"; choices.append(b); });
  button.textContent = "E-posta ile devam et";
  host.append(choices, phoneForm, status);
  // Native browser redirect works even if the external Supabase JS CDN fails to load.
  google.onclick = () => {
    if (!config?.googleOAuthReady) { status.textContent = "Google girişi henüz etkin değil."; return; }
    const destination = location.origin + location.pathname;
    const url = config.supabaseUrl + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(destination);
    status.textContent = "Google giriş sayfası açılıyor...";
    window.location.assign(url);
  };
  if (!ready) {
    button.disabled = true; google.disabled = true; apple.disabled = true; phone.disabled = true;
    status.textContent = " Giriş ayarları henüz tamamlanmadı.";
    return;
  }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: "implicit" } });
    window.teklifbulSupabase = client;
    async function oauth(provider) {
      if (!config[provider === "google" ? "googleOAuthReady" : "appleOAuthReady"]) {
        status.textContent = "Bu giriş yöntemi henüz etkinleştirilmedi.";
        return;
      }
      status.textContent = "Hesabınıza yönlendiriliyorsunuz...";
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: location.origin + location.pathname }
      });
      if (error) status.textContent = "Giriş başlatılamadı. Lütfen tekrar deneyin.";
    }
    // Google uses direct redirect above; no CDN dependency.
    apple.onclick = () => oauth("apple");
    let pendingPhone = "";
    phone.onclick = async () => {
      phoneForm.hidden = false;
      const digits = phoneNumber.value.replace(/\D/g, "");
      if (!digits) { phoneNumber.focus(); status.textContent = "Telefon numaranızı yazıp tekrar SMS gönder düğmesine basın."; phone.textContent = "SMS kodu gönder"; return; }
      const national = digits.startsWith("90") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
      if (!/^5\d{9}$/.test(national)) { status.textContent = "Geçerli bir cep telefonu numarası girin."; return; }
      pendingPhone = "+90" + national;
      const { error } = await client.auth.signInWithOtp({ phone: pendingPhone });
      if (error) { status.textContent = "SMS gönderilemedi. SMS sağlayıcısı ayarlarını kontrol edin."; return; }
      smsCode.hidden = false; smsVerify.hidden = false;
      status.textContent = "SMS kodu gönderildi.";
    };
    smsVerify.onclick = async () => {
      if (!pendingPhone || !/^\d{4,8}$/.test(smsCode.value.trim())) { status.textContent = "Geçerli SMS kodunu girin."; return; }
      const { error } = await client.auth.verifyOtp({ phone: pendingPhone, token: smsCode.value.trim(), type: "sms" });
      status.textContent = error ? "SMS kodu doğrulanamadı." : "Giriş başarılı.";
    };
    window.dispatchEvent(new Event("teklifbul:client-ready"));
    const refresh = async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        button.textContent = "E-posta ile devam et";
        status.textContent = ""; google.hidden = false; apple.hidden = false; phone.hidden = false;
      } else {
        button.textContent = "Çıkış yap"; google.hidden = true; apple.hidden = true; phone.hidden = true; phoneForm.hidden = true;
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
    // Wait for Supabase to process OAuth URL fragments before deciding that no user is signed in.
    const callbackHash = new URLSearchParams(window.location.hash.slice(1));
    if (callbackHash.has("access_token") && callbackHash.has("refresh_token")) {
      status.textContent = "Google oturumu tamamlanıyor...";
      const { error: callbackError } = await client.auth.setSession({
        access_token: callbackHash.get("access_token"),
        refresh_token: callbackHash.get("refresh_token")
      });
      if (callbackError) {
        status.textContent = "Google oturumu kaydedilemedi. Tekrar giriş yapın.";
      } else {
        history.replaceState(null, "", location.pathname + location.search);
      }
    }
    await refresh();
  } catch (e) {
    button.disabled = false;
    button.onclick = () => alert("Giriş sistemi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.");
    status.textContent = " Giriş sistemi yüklenemedi; sayfayı yenileyin.";
  }
})();
