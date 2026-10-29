# TeklifBul

Türkiye genelinde hizmet arayanlarla hizmet verenleri buluşturmayı amaçlayan platform.

## Mevcut durum (prototip)
- GitHub Pages üzerinde mobil uyumlu web arayüzü: https://fatihspor.github.io/teklifbul/
- Android uygulaması, aynı web sayfasını WebView içinde açıyor.
- Kategori seçimi, il/ilçe/mahalle seçimi ve cihazda saklanan örnek ilan/teklif akışı.
- GitHub Actions `.github/workflows/android.yml` üzerinden **debug APK** oluşturma yapılandırması.

**Uyarı:** İlanlar ve teklifler şu an yalnızca cihazın tarayıcı depolamasında tutuluyor; gerçek çok kullanıcılı hizmet henüz yok. Usta puanları, ödeme altyapısı, kimlik doğrulama ve mesajlaşma henüz uygulanmadı. Debug APK, Google Play yayınına uygun imzalı AAB değildir.

## İlk yayın için ürün kararları
- Hizmet arayanlar ücretsiz ilan açar.
- Hizmet verenler ücretsiz teklif sunar.
- Hizmet bedeli müşteri ile hizmet veren arasında doğrudan ödenir; TeklifBul para tahsil etmez, tutmaz veya aktarmaz.
- Tamamlanmış ve doğrulanmış işlerden sonra müşteriler hizmet verene 1-5 yıldız ve yorum bırakabilir.
- Usta profilleri, ortalama puan ve doğrulanmış iş sayısını gösterir.
- İleride lisanslı ödeme kuruluşu ile güvenceli ödeme değerlendirilebilir; ilk sürümde aktif değildir.

## Yayına çıkmadan önce
1. Kullanıcı hesabı, kimlik doğrulama ve güvenli oturum yönetimi.
2. Sunucu/veritabanı: ilanlar, teklifler, kullanıcı profilleri ve durum takibi.
3. Teklif kabulü ve işin tamamlandığının doğrulanması.
4. Doğrulanmış iş sonrası puan/yorum, şikayet ve moderasyon.
5. Konum verisinin güvenilirliği, erişilebilirlik, arama ve filtreleme.
6. KVKK aydınlatması, gizlilik politikası, kullanım koşulları, hesap ve veri silme.
7. Android testleri, hata takibi, sürüm numaraları, imzalı release AAB.
8. Google Play Console gereklilikleri ve uygun test/yayın süreci.

## Android test APK
GitHub > Actions > TeklifBul Android APK > son başarılı çalıştırma > Artifacts > TeklifBul-APK.

Debug APK yalnızca test içindir. APK üretim adımının varlığı, iş akışının başarılı çalıştığı anlamına gelmez; Actions durumunu ayrıca doğrulayın.

## Kapalı teklif politikası (ürün kararı)
- Her ilanın teklif tutarları, açıklamaları ve teklif veren kimlikleri yalnızca ilan sahibi ile ilgili teklifin sahibi tarafından, kendi yetkileri ölçüsünde görüntülenebilir.
- İlan sahibi tüm teklifleri ve hizmet verenlerin profillerini karşılaştırabilir.
- Hizmet veren yalnızca kendi teklifini ve ilanın toplam teklif sayısını görür; rakip teklif tutarlarını, ortalamayı, en düşük fiyatı, sıralamayı ve kazanan teklifin bedelini göremez.
- Teklif seçildikten sonra diğer hizmet verenlere yalnızca ilanın kapandığı bildirilebilir; kazananın kimliği ve tutarı açıklanmaz.
- Bu kural yalnızca arayüzde gizleme ile değil, veritabanı erişim kuralları / sunucu tarafı yetkilendirmesi ile uygulanmalıdır. Liste API'leri ve bildirimler de rakip tekliflerini sızdırmamalıdır.
- Platform yöneticileri teklif verilerini yalnızca yetkili destek, güvenlik ve uyuşmazlık çözümü amacıyla, erişim kayıtları tutularak inceleyebilir.

## Ortak veritabanı hazırlığı
`supabase/schema.sql` dosyası Google ile kimlik doğrulaması yapılmış kullanıcılar için profiller, ilanlar, teklifler ve satır düzeyinde kapalı teklif erişim kurallarının **ilk taslağını** içerir. Henüz canlı Supabase projesi bağlanmamış, şema uygulanmamış veya güvenlik testleri yapılmamıştır. Bu dosya yayın öncesi erişim kontrolleri, iş durum geçişleri, şikayet/yorum modelleri ve kötüye kullanım testleriyle gözden geçirilmelidir.

## Google girişini etkinleştirme (henüz yapılmadı)
1. Supabase projesi açın ve `supabase/schema.sql` şemasını güvenlik incelemesinden sonra uygulayın.
2. Supabase Authentication > Providers > Google üzerinden Google OAuth sağlayıcısını yapılandırın. Google Cloud OAuth istemcisi ve izin verilen yönlendirme adresleri gereklidir.
3. Supabase Authentication > URL Configuration bölümünde GitHub Pages adresini site/redirect URL olarak ekleyin: `https://fatihspor.github.io/teklifbul/`.
4. `config.example.js` dosyasını `config.js` adıyla kopyalayıp Supabase proje URL'si ve **public anon/publishable key** bilgilerini girin. Gizli anahtarları GitHub'a koymayın.
5. Google ile giriş/çıkış, farklı cihazlardan erişim, yetkisiz teklif okuma ve yönlendirme testlerini tamamlayın.

**Not:** `auth.js` yalnızca oturum açma arayüzünü hazırlar. İlan/teklif işlemleri hâlâ demo localStorage kullanır; veritabanına geçiş ve canlı yayın ayrıca yapılmalıdır.

## İlan süresi ve ilan sahibi kontrolü (ürün kararı)
- İlanlar için zorunlu 7/15/30 günlük bitiş süresi yoktur. İlan sahibi kapatana veya bir hizmet vereni seçene kadar ilan açık kalabilir; güvenlik/moderasyon istisnaları saklıdır.
- İlan sahibi istediği zaman ilanını teklif alımına kapatabilir, hizmet vereni seçebilir veya kimseyi seçmeden iptal edebilir.
- Durumlar: açık → anlaşıldı → iş devam ediyor → tamamlandı; ayrıca iptal edildi ve yeniden açıldı durumları.
- Hizmet veren seçildiğinde yeni teklif alımı durur. Diğer teklif sahiplerine yalnızca ilan kapandığı bildirilir; kazanan ve tutar açıklanmaz.
- Seçilen hizmet veren gelmez veya anlaşma iptal edilirse ilan sahibi ilanı yeniden açabilir.
- Puan ve yorum yalnızca doğrulanmış tamamlanmış işlerden sonra verilebilir.
- Gerçek kullanıcıya açılmadan önce bu geçişler sunucu tarafında yetkilendirilip denetlenmelidir; demo cihaz verileri gerçek iş anlaşması sayılmaz.
