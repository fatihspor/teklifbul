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
