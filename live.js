// Live Supabase mode. Until OAuth is configured the existing demo remains separate.
(function () {
  let client = null;
  let live = false;
  let loadSequence = 0;
  const form = document.getElementById("form");
  const root = document.getElementById("jobs");
  const notice = document.querySelector("#providers .notice");
  function el(tag, value) { const e = document.createElement(tag); e.textContent = value; return e; }
  function message(value) { root.replaceChildren(el("p", value)); }
  async function load() {
    if (!client) return;
    const sequence = ++loadSequence;
    const {data, error} = await client.from("jobs").select("id,owner_id,category,province,district,neighborhood,description,budget_note,preferred_date,preferred_time,alternative_date,work_days,created_at,status,selected_offer_id").in("status",["open","awarded","completed"]).order("created_at",{ascending:false}).limit(50);
    if (sequence !== loadSequence) return;
    if (error) { message("İlanlar yüklenemedi. İnternet bağlantınızı kontrol edin."); const retry = el("button", "Tekrar dene"); retry.type = "button"; retry.onclick = () => { retry.disabled = true; void load(); }; root.append(retry); return; }
    root.replaceChildren();
    if (!data.length) root.append(el("p","Henüz açık ilan yok. İlk ilanı siz oluşturabilirsiniz."));
    const {data:{user}} = await client.auth.getUser();
    if (sequence !== loadSequence) return;
    for (const job of data) {
      if (sequence !== loadSequence) return;
      const card = el("div","");
      card.className = "job";
      card.append(el("h3",job.category),el("p","Konum: "+[job.province,job.district,job.neighborhood].join(" / ")),el("p",job.description),el("p","Bütçe: "+(job.budget_note||"Belirtilmedi")));
      if(job.preferred_date) card.append(el("p","İstenen tarih: "+job.preferred_date+(job.preferred_time?" · "+job.preferred_time:"")+(job.alternative_date?" · Alternatif: "+job.alternative_date:"")+(job.work_days?" · İş süresi: "+job.work_days+" gün":"")));
      const {data:photos} = await client.from("job_photos").select("storage_path").eq("job_id",job.id).limit(3);
      if (photos?.length) { const gallery=document.createElement("div");gallery.className="job-photos";for(const photo of photos){const img=document.createElement("img");img.src=client.storage.from("job-photos").getPublicUrl(photo.storage_path).data.publicUrl;img.loading="lazy";img.alt="İş fotoğrafı";gallery.append(img);}card.append(gallery);}
      if (user && job.owner_id === user.id) {
        const own = el("p",job.status==="completed"?"İş tamamlandı.":job.status==="awarded"?"Usta seçildi · Teklif alımı kapalı.":"Bu ilan size ait. Gelen teklifler yalnızca size görünür.");
        card.append(own);
        if(job.status==="awarded"){const finish=el("button","İşi tamamlandı olarak onayla");finish.type="button";finish.onclick=async()=>{if(!confirm("İşin tamamlandığını onaylıyor musunuz? Bu işlem ödeme aktarmaz."))return;finish.disabled=true;const {data:ok,error}=await client.rpc("advance_job_status",{p_job_id:job.id,p_next_status:"completed"});if(error||!ok){alert("İş durumu değiştirilemedi.");finish.disabled=false;return;}await load();};card.append(finish);}
        if(job.status==="completed"){
          const {data:existingReview}=await client.from("job_reviews").select("rating,comment").eq("job_id",job.id).maybeSingle();
          if(existingReview){
            card.append(el("p","Değerlendirmeniz: "+"★".repeat(existingReview.rating)+"☆".repeat(5-existingReview.rating)));
            if(existingReview.comment)card.append(el("p",existingReview.comment));
          }else{
            const reviewForm=document.createElement("form");reviewForm.className="bid-form";
            reviewForm.append(el("h4","Tamamlanan işi değerlendir"));
            const ratingLabel=el("label","Puanınız");
            const rating=document.createElement("select");
            for(let n=5;n>=1;n--){const opt=document.createElement("option");opt.value=String(n);opt.textContent=n+" yıldız";rating.append(opt);}
            ratingLabel.append(rating);reviewForm.append(ratingLabel);
            const commentLabel=el("label","Yorumunuz (isteğe bağlı)");
            const comment=document.createElement("textarea");comment.maxLength=1000;commentLabel.append(comment);reviewForm.append(commentLabel);
            const submit=el("button","Değerlendirmeyi gönder");submit.type="submit";reviewForm.append(submit);
            reviewForm.addEventListener("submit",async e=>{
              e.preventDefault();submit.disabled=true;
              const {data:selected,error:selectionError}=await client.from("offers").select("provider_id").eq("id",job.selected_offer_id).single();
              if(selectionError||!selected){alert("Seçilen usta bulunamadı.");submit.disabled=false;return;}
              const {error:reviewError}=await client.from("job_reviews").insert({job_id:job.id,customer_id:user.id,provider_id:selected.provider_id,rating:Number(rating.value),comment:comment.value.trim()});
              if(reviewError){alert("Değerlendirme kaydedilemedi.");submit.disabled=false;return;}
              await load();
            });card.append(reviewForm);
          }
        }
        const {data:received,error:offerError} = await client.from("offers").select("id,provider_id,amount,note,created_at,duration_text,material_included,availability,alternative_date").eq("job_id",job.id).order("created_at",{ascending:false});
        if (!offerError) {
          const heading = el("h4", "Gelen teklifleri karşılaştır (" + received.length + ")");
          card.append(heading);
          const comparison = document.createElement("div");
          comparison.className = "offer-comparison";
          const providerIds=[...new Set(received.map(o=>o.provider_id).filter(Boolean))];
          const providerStats={};
          if(providerIds.length){
            const [{data:reviews,error:reviewsError},{data:profiles}]=await Promise.all([
              client.from("job_reviews").select("provider_id,rating,comment,created_at").in("provider_id",providerIds).order("created_at",{ascending:false}).limit(300),
              client.from("profiles").select("id,display_name").in("id",providerIds)
            ]);
            (profiles||[]).forEach(p=>{providerStats[p.id]={name:p.display_name||"Hizmet veren",reviews:[],average:null};});
            if(!reviewsError)(reviews||[]).forEach(review=>{
              const stat=providerStats[review.provider_id]||(providerStats[review.provider_id]={name:"Hizmet veren",reviews:[],average:null});
              stat.reviews.push(review);
            });
            Object.values(providerStats).forEach(stat=>{
              if(stat.reviews.length)stat.average=stat.reviews.reduce((sum,v)=>sum+v.rating,0)/stat.reviews.length;
            });
          }
          const sorted = [...received].sort((a,b)=>Number(a.amount)-Number(b.amount));
          sorted.forEach((offer,index)=>{
            const item = document.createElement("div");
            item.className = "offer-card";
            const stat=providerStats[offer.provider_id];
            item.append(el("h4",stat?.name||"Hizmet veren"));
            item.append(el("p",stat?.reviews.length?("★ "+stat.average.toFixed(1)+"/5 · "+stat.reviews.length+" doğrulanmış değerlendirme"):"Henüz değerlendirilmedi"));
            if(stat?.reviews.length){
              const details=document.createElement("details");
              details.append(el("summary","Müşteri yorumlarını gör"));
              stat.reviews.slice(0,5).forEach(review=>{
                const reviewBox=document.createElement("div");reviewBox.className="review-item";
                reviewBox.append(el("strong","★".repeat(review.rating)+"☆".repeat(5-review.rating)));
                if(review.comment)reviewBox.append(el("p",review.comment));
                details.append(reviewBox);
              });
              item.append(details);
            }
            const amount = el("strong", Number(offer.amount).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" TL");
            item.append(amount);
            if(index===0 && sorted.length>1) item.append(el("small","En düşük fiyatlı teklif"));
            if(offer.duration_text) item.append(el("p","İş süresi: "+offer.duration_text));
            item.append(el("p","Malzeme: "+(offer.material_included===true?"Dahil":offer.material_included===false?"Dahil değil":"Belirtilmedi")));
            item.append(el("p","Tarih: "+(offer.availability==="requested"?"İstenen tarihte uygun":offer.availability==="alternative"?"Alternatif "+(offer.alternative_date||""):"Görüşülecek")));
            if(offer.note) item.append(el("p",offer.note));
            item.append(el("small","Teklif tarihi: "+new Date(offer.created_at).toLocaleDateString("tr-TR")));
            if(job.status==="open"){const accept=el("button","Bu teklifi kabul et");accept.type="button";accept.onclick=async()=>{if(!confirm("Teklifi kabul edip ilanı kapatmak istiyor musunuz?"))return;accept.disabled=true;const {data:ok,error}=await client.rpc("accept_job_offer",{p_job_id:job.id,p_offer_id:offer.id});if(error||!ok){alert("Teklif kabul edilemedi.");accept.disabled=false;return;}alert("Teklif kabul edildi.");await load();};item.append(accept);}else if(job.selected_offer_id===offer.id)item.append(el("strong","✓ Seçilen teklif"));comparison.append(item);
          });
          card.append(comparison);
        } else card.append(el("p","Gelen teklifler yüklenemedi."));
      } else if (user && job.status==="open") {
        const button = el("button","Gizli teklif ver");
        button.type = "button";
        button.onclick = () => {
          const previous = card.querySelector(".live-offer-form");
          if (previous) { previous.remove(); return; }
          const offerForm = document.createElement("form");
          offerForm.className = "bid-form live-offer-form";
          const heading = el("h4", "Gizli teklif oluştur");
          offerForm.append(heading);
          const makeField = (title, tag, type) => {
            const label = document.createElement("label");
            label.textContent = title;
            const input = document.createElement(tag);
            if (type) input.type = type;
            label.append(input);
            offerForm.append(label);
            return input;
          };
          const amount = makeField("Teklif tutarı (TL)", "input", "number");
          amount.required = true; amount.min = "1"; amount.max = "9999999999"; amount.step = "0.01";
          const duration = makeField("İşin tamamlanma süresi", "input", "text");
          duration.required=true;duration.maxLength=80;duration.value="1 gün";
          const material = makeField("Malzeme fiyata dahil mi?", "select");
          [["yes","Evet, dahil"],["no","Hayır, dahil değil"]].forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;material.append(o);});
          const availability = makeField("Tarih uygunluğu", "select");
          [["requested","İstenen tarihte uygunum"],["alternative","Alternatif tarih öneriyorum"],["discuss","Tarihi görüşelim"]].forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;availability.append(o);});
          availability.value=job.preferred_date?"requested":"discuss";
          const alternativeDate = makeField("Alternatif tarih", "input", "date");
          alternativeDate.parentElement.hidden=true;
          availability.addEventListener("change",()=>{alternativeDate.parentElement.hidden=availability.value!=="alternative";alternativeDate.required=availability.value==="alternative";});
          const note = makeField("Teklif açıklaması (isteğe bağlı)", "textarea");
          note.maxLength = 1000;
          note.placeholder = "Yapılacak işler, malzeme ve tahmini süre hakkında bilgi verin.";
          const send = el("button", "Teklifi güvenli gönder");
          send.type = "submit";
          offerForm.append(send);
          offerForm.addEventListener("submit", async event => {
            event.preventDefault();
            const value = Number(amount.value);
            if (!Number.isFinite(value) || value <= 0 || value > 9999999999) {
              amount.setCustomValidity("Geçerli bir tutar girin.");
              amount.reportValidity();
              amount.setCustomValidity("");
              return;
            }
            send.disabled = true;
            send.textContent = "Gönderiliyor...";
            try {
              const {data:{user:currentUser},error:authError} = await client.auth.getUser();
              if (authError || !currentUser) { alert("Oturumunuz sona ermiş. Yeniden giriş yapın."); return; }
              const {error:offerError} = await client.from("offers").insert({
                job_id:job.id,provider_id:currentUser.id,amount:value,note:note.value.trim(),
                duration_text:duration.value.trim(),material_included:material.value==="yes",
                availability:availability.value,alternative_date:availability.value==="alternative"?alternativeDate.value:null
              });
              if (offerError) { alert("Teklif kaydedilemedi. Daha önce teklif vermiş olabilirsiniz."); return; }
              alert("Teklifiniz kaydedildi. Tutar yalnızca size ve ilan sahibine görünür.");
              await load();
            } catch (_) {
              alert("Bağlantı hatası. Lütfen yeniden deneyin.");
            } finally {
              send.disabled = false;
              send.textContent = "Teklifi güvenli gönder";
            }
          });
          button.insertAdjacentElement("afterend", offerForm);
          amount.focus();
        };
        card.append(button);
      } else {
        card.append(el("p",job.status==="completed"?"Bu iş tamamlandı.":job.status==="awarded"?"Bu iş için usta seçildi.":"Teklif vermek için giriş yapın."));
      }
      if (sequence !== loadSequence) return;
      root.append(card);
    }
  }
  form.addEventListener("submit",async e=>{
    if (!live || !client) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const {data:{user}} = await client.auth.getUser();
    if (!user) return alert("İlan yayımlamak için hesabınıza giriş yapın. Hazırladığınız ilan korunuyor.");
    const job = {
      owner_id:user.id,category:document.getElementById("category").value,
      province:document.getElementById("province").selectedOptions[0]?.text||"",
      district:document.getElementById("district").selectedOptions[0]?.text||"",
      neighborhood:document.getElementById("neighborhood").value,
      description:document.getElementById("description").value.trim(),
      budget_note:document.getElementById("budget").value.trim(),
      preferred_date:document.getElementById("preferredDate").value||null,
      preferred_time:document.getElementById("preferredTime").value||null,
      alternative_date:document.getElementById("alternativeDate").value||null,
      work_days:document.getElementById("workDays").value?Number(document.getElementById("workDays").value):null
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
    live = true;
    if (notice) notice.textContent="Canlı sistem: İlanları herkes görebilir. İlan veya teklif göndermek için giriş gerekir. Teklifler gizlidir.";
    await load();
    client.auth.onAuthStateChange((_event,session)=>{
      live=true;
      void load();
    });
  });
})();
