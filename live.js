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
      const {data:photos} = await client.from("job_photos").select("storage_path").eq("job_id",job.id).limit(3);
      if (photos?.length) { const gallery=document.createElement("div");gallery.className="job-photos";for(const photo of photos){const img=document.createElement("img");img.src=client.storage.from("job-photos").getPublicUrl(photo.storage_path).data.publicUrl;img.loading="lazy";img.alt="İş fotoğrafı";gallery.append(img);}card.append(gallery);}
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
    const {data:created,error} = await client.from("jobs").insert(job).select("id").single();
    if (error) return alert("İlan kaydedilemedi. Hesap bilgilerinizi kontrol edin.");
    const files=[...document.getElementById("photos").files];let uploaded=0;
    for (const file of files.slice(0,3)) {
      if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size>10*1024*1024) continue;
      try {
        const resized=await new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement("canvas"),scale=Math.min(1,640/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error("Dönüştürme başarısız"))},"image/jpeg",.65)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Fotoğraf okunamadı"))};img.src=url;});
        const path=user.id+"/"+created.id+"/"+crypto.randomUUID()+".jpg";
        const {error:uploadError}=await client.storage.from("job-photos").upload(path,resized,{contentType:"image/jpeg",upsert:false});
        if(uploadError)continue;
        const {error:metaError}=await client.from("job_photos").insert({job_id:created.id,owner_id:user.id,storage_path:path});
        if(!metaError)uploaded++;
      }catch(_){}
    }
    form.reset();
    if(typeof selectedPhotos!=="undefined"){selectedPhotos=[];document.getElementById("photoPreview").replaceChildren();}
    if(typeof updateServices==="function")updateServices();
    if(typeof showWizardStep==="function")showWizardStep(0);
    alert("İlanınız yayımlandı."+ (files.length&&uploaded<files.length?" "+(files.length-uploaded)+" fotoğraf yüklenemedi.":""));
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
