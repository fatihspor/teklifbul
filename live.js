// Live Supabase mode. Until OAuth is configured the existing demo remains separate.
(function () {
  let client = null;
  let live = false;
  const form = document.getElementById("form");
  const root = document.getElementById("jobs");
  const notice = document.querySelector("#providers .notice");
  function el(tag, value) { const e = document.createElement(tag); e.textContent = value; return e; }
  function message(value) { root.replaceChildren(el("p", value)); }
  async function load() {
    if (!client || !live) return;
    const {data, error} = await client.from("jobs").select("id,owner_id,category,province,district,neighborhood,description,budget_note,created_at").eq("status","open").order("created_at",{ascending:false}).limit(50);
    if (error) return message("İlanlar yüklenemedi. Lütfen yeniden deneyin.");
    root.replaceChildren();
    if (!data.length) root.append(el("p","Henüz açık ilan yok. İlk ilanı siz oluşturabilirsiniz."));
    for (const job of data) {
      const card = el("div","");
      card.className = "job";
      card.append(el("h3",job.category),el("p","Konum: "+[job.province,job.district,job.neighborhood].join(" / ")),el("p",job.description),el("p","Bütçe: "+(job.budget_note||"Belirtilmedi")));
      const {data:{user}} = await client.auth.getUser();
      if (user && job.owner_id === user.id) {
        const own = el("p","Bu ilan size ait. Gelen teklifler yalnızca size görünür.");
        card.append(own);
        const {data:received,error:offerError} = await client.from("offers").select("amount,note,created_at").eq("job_id",job.id).order("created_at",{ascending:false});
        if (!offerError) received.forEach(o=>card.append(el("p","Gelen teklif: "+o.amount+" TL"+(o.note?" — "+o.note:""))));
      } else if (user) {
        const button = el("button","Gizli teklif ver");
        button.type = "button";
        button.onclick = async () => {
          const raw = prompt("Teklif tutarınız (TL):");
          if (raw === null) return;
          const amount = Number(raw.trim().replace(",","."));
          if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999) return alert("Geçerli bir tutar girin.");
          const note = prompt("Açıklama (isteğe bağlı):");
          if (note === null) return;
          const {error:offerError} = await client.from("offers").insert({job_id:job.id,provider_id:user.id,amount,note:note.slice(0,1000)});
          alert(offerError ? "Teklif kaydedilemedi. Aynı ilana daha önce teklif vermiş olabilirsiniz." : "Teklifiniz gizli olarak kaydedildi.");
        };
        card.append(button);
      }
      root.append(card);
    }
  }
  form.addEventListener("submit",async e=>{
    if (!live || !client) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const {data:{user}} = await client.auth.getUser();
    if (!user) return alert("İlan vermek için Google ile giriş yapın.");
    const job = {
      owner_id:user.id,category:document.getElementById("category").value,
      province:document.getElementById("province").selectedOptions[0]?.text||"",
      district:document.getElementById("district").selectedOptions[0]?.text||"",
      neighborhood:document.getElementById("neighborhood").value,
      description:document.getElementById("description").value.trim(),
      budget_note:document.getElementById("budget").value.trim()
    };
    if (job.description.length < 10) return alert("İş açıklaması en az 10 karakter olmalı.");
    const {error} = await client.from("jobs").insert(job);
    if (error) return alert("İlan kaydedilemedi. Hesap bilgilerinizi kontrol edin.");
    form.reset();
    alert("İlanınız yayımlandı.");
    await load();
  },true);
  window.addEventListener("teklifbul:client-ready",async()=>{
    client = window.teklifbulSupabase;
    if (!client) return;
    const {data:{session}} = await client.auth.getSession();
    live = Boolean(session);
    if (live) {
      if (notice) notice.textContent="Canlı sistem: İlanlar ortak veritabanına kaydedilir. Teklif tutarlarını yalnızca ilan sahibi ve teklif veren görür.";
      await load();
    }
    client.auth.onAuthStateChange((_event,session)=>{
      const wasLive=live;
      live=Boolean(session);
      if (live) { if(notice)notice.textContent="Canlı sistem: Teklifler gizlidir."; void load(); }
      else if (wasLive) location.reload();
    });
  });
})();
