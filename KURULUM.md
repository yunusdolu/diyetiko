# Kurulum rehberi (Supabase + Vercel)

Bu rehber siteyi, diyetisyen panelini (`/admin`) ve danışan panelini (`/panel`) gerçek bir
Supabase veritabanıyla canlıya almak içindir. Adımları **sırayla** uygula; her adımın sonunda
bir "Kontrol" satırı var.

> Teknik ayrıntılar (mimari, güvenlik modeli, testler) için [README.md](README.md).

---

## Adım 0 — Gerekenler

- Bilgisayarında **Node 22+** ve **pnpm 10+** (`npm i -g pnpm`)
- Ücretsiz bir **Supabase** hesabı → https://supabase.com
- Ücretsiz bir **Vercel** hesabı → https://vercel.com (GitHub hesabınla girebilirsin)
- Projenin bir GitHub deposunda olması (Vercel oradan çeker)

## Adım 1 — Önce bilgisayarında dene (hesap gerekmez)

```bash
pnpm install
cp .env.example .env.local   # Supabase satırlarını BOŞ bırak
pnpm dev                     # http://localhost:3000
```

Supabase ayarı yokken uygulama kendi içindeki **yerel veritabanıyla** (PGlite — tarayıcı dışı
gerçek Postgres) çalışır: aynı tablolar, aynı güvenlik kuralları, sahte demo verisi.

| Nereye            | Adres                       | Giriş                                      |
| ----------------- | --------------------------- | ------------------------------------------ |
| Site              | http://localhost:3000       | —                                          |
| Diyetisyen paneli | http://localhost:3000/admin | `muzahim@local.test` / `mutfak-demo-2026`  |
| Danışan paneli    | http://localhost:3000/panel | `danisan@local.test` / `danisan-demo-2026` |

Demo verisini sıfırlamak için: sunucuyu durdur (Ctrl+C), `.demo-data/pg` klasörünü sil, tekrar
`pnpm dev`.

**Kontrol:** iki panele de girebiliyorsun; danışan panelinde "Bugün", "Günlük", "İlerleme"
sayfaları dolu görünüyor.

## Adım 2 — Supabase projesi oluştur

1. Supabase → **New project**.
2. **Region:** Türkiye'ye yakın olsun → _Central EU (Frankfurt)_.
3. **Database password:** güçlü bir şifre üret ve bir şifre yöneticisine kaydet (Adım 5'te
   lazım olacak).
4. Proje hazır olana kadar bekle (1–2 dk).

**Kontrol:** proje panosu açılıyor.

## Adım 3 — Veritabanını kur (migration'lar)

`supabase/migrations/` klasöründeki **10 dosyayı, dosya adı sırasıyla** çalıştır:

1. `20260928000001_schema.sql` — tablolar
2. `20260928000002_rls.sql` — satır düzeyi güvenlik (RLS) kuralları
3. `20260928000003_functions.sql` — fonksiyonlar, tetikleyiciler, Storage kovaları
4. `20261001000004_client_portal.sql` — danışan paneli (davetler, günlük, kayıtlar, mesajlar,
   öğün fotoğrafları)
5. `20261001000005_tasks.sql` — diyetisyenin görev listesi (Özet sayfasındaki "Görevler")
6. `20261002000006_practice.sql` — paketler, ödemeler ve tahliller (danışan sayfasındaki
   "Paket & ödeme" ve "Tahliller", Özet sayfasındaki "Tahsilat")
7. `20261003000007_applications.sql` — sitedeki "Başvur" formu için yeni talep türü
   ("Talepler" sayfasında "Başvuru" sekmesi)
8. `20261003000008_fix_json_strings.sql` — onarım: canlı veritabanında yanlış kaydedilmiş
   JSON alanlarını (başvuru cevapları, site ayarları, besin birimleri, program kopyaları, kayıt
   ayrıntıları) düzeltir. Tekrar çalıştırmak zararsızdır.
9. `20261005000009_uploads_activity.sql` — mesajlarda dosya gönderimi (danışan tahlilini PDF ya da
   fotoğraf olarak yollar) ve günlük kayıtta hareket (spor) alanı. Tekrar çalıştırılabilir.
10. `20261006000010_client_care.sql` — danışanla paylaşılan görevler (danışan işaretler, diyetisyen
    görür) ve danışanın kendi randevu / paket / ödeme bilgisini görmesi. Tekrar çalıştırılabilir.

> **Kurulumu daha önce yaptıysan**: yalnızca henüz çalıştırmadığın dosyaları (5., 6. ve/veya 7.)
> SQL Editor'da sırayla çalıştırman yeterli. Çalıştırılana kadar panel açılır; ilgili kartlar
> ("Görevler", "Tahsilat", "Paket & ödeme", "Tahliller") bu adımı hatırlatır. 7. dosya
> çalıştırılmadan gelen başvurular kaybolmaz: "İletişim" türünde kaydedilir ve panelde yine
> "Başvuru" olarak görünür.

### Panele kolay giriş

- Sitenin en altında **"Diyetisyen girişi"** (ve danışanlar için "Danışan girişi") bağlantısı
  var; menüde de aynı iki düğme bulunur. Adres yazmana gerek yok.
- Daha da kolayı: paneli **uygulama olarak yükle**. Bilgisayarda Chrome/Edge ile panele girince
  soldaki menüde "Uygulama olarak yükle" çıkar. Telefonda (Android, Chrome) aynı düğme ya da
  tarayıcı menüsünden "Ana ekrana ekle"; iPhone'da Safari → Paylaş → "Ana Ekrana Ekle". Ekrana
  gelen "Mutfak Masası" simgesi paneli doğrudan açar.

> 5. ve 6. dosyalar **tekrar çalıştırılabilir**: yanlışlıkla ikinci kez çalıştırırsan hata
>    vermez, var olanı bozmaz. (Önceden "relation client_packages already exists" hatası aldıysan,
>    dosya zaten başarıyla çalışmış demektir; yeni sürümü yine de güvenle çalıştırabilirsin.)

**Yol A — SQL Editor (en kolayı):** Supabase → _SQL Editor_ → _New query_ → dosyanın tüm
içeriğini yapıştır → _Run_. Sonraki dosya için yeni bir sorgu aç. Sıra önemli.

**Yol B — Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>   # ref: Project Settings → General
npx supabase db push
```

**Kontrol:** _Table Editor_'da `clients`, `programs`, `checkins`, `diary_meals`, `messages`
gibi tablolar var ve her birinin yanında "RLS enabled" yazıyor. _Storage_'da dört kova var:
`recipe-media`, `site-media` (herkese açık), `client-files`, `diary-photos` (özel).

## Adım 4 — Diyetisyen hesabını oluştur

> Bu **ilk** hesap olmalı. Sistemdeki ilk hesap diyetisyen olur; sonra gelen her hesap danışan
> hesabıdır ve diyetisyen verisine erişemez.

Supabase → _Authentication_ → _Users_ → **Add user** → _Create new user_:

- E-posta: diyetisyenin e-postası
- Şifre: güçlü bir şifre
- **Auto Confirm User: açık**

**Kontrol:** SQL Editor'da çalıştır:

```sql
select id, role from public.profiles;
```

Tek satır ve `role = dietitian` görmelisin.

## Adım 5 — Anahtarlar ve ortam değişkenleri

Supabase'in **Connect** penceresindeki `.env` örneği (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`) Edge Functions içindir. Bu projede değerler aynı,
**adlar farklı** — ve veritabanı bağlantısı ayrıca gerekiyor. Eşleştirme:

| Supabase'te gördüğün                            | Bu projedeki ad                        | Not                                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL` (`https://xxxx.supabase.co`)     | `NEXT_PUBLIC_SUPABASE_URL`             | Adı mutlaka böyle olmalı (admin medya yükleyicisi tarayıcıda kullanır)                                                                                                        |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Gizli değil. Eski tip `anon` anahtarın varsa `NEXT_PUBLIC_SUPABASE_ANON_KEY` de olur                                                                                          |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`)           | `SUPABASE_SECRET_KEY`                  | **Gizli, sadece sunucu.** Başına asla `NEXT_PUBLIC_` koyma (koyarsan uygulama açılmayı reddeder). Eski tip `service_role` anahtarın varsa `SUPABASE_SERVICE_ROLE_KEY` de olur |
| `SUPABASE_JWKS_URL`                             | —                                      | **Gerekmez.** Oturum doğrulaması bu adresi kendisi bulur                                                                                                                      |
| _(bu pencerede yok)_                            | `DATABASE_URL`                         | **Şart.** Aşağıya bak                                                                                                                                                         |

**`DATABASE_URL` nereden?** Üstteki **Connect** düğmesi → _Connection String_ sekmesi → Type:
**URI**, Method: **Transaction pooler** → gösterilen adresi kopyala. `[YOUR-PASSWORD]` yerine
Adım 2'deki veritabanı şifresini yaz. Port **6543** olmalı. (_Direct connection_ kullanma: Vercel
ondan bağlanamaz.) Şuna benzer:

```
postgresql://postgres.xxxx:SIFRE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Kendin üreteceğin değerler:

| Değişken               | Değer                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IP_HASH_SALT`         | Rastgele 32+ karakter. Üret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`                                    |
| `NEXT_PUBLIC_SITE_URL` | Sitenin adresi, sonda `/` olmadan. Canlıda `https://alanadin.com`, bilgisayarında `http://localhost:3000`                                        |
| `ANTHROPIC_API_KEY`    | İsteğe bağlı. Sadece CMS'teki "Taslak çeviri" düğmesi için; yalnızca herkese açık tarif/rehber metni gönderilir, danışan verisi asla gönderilmez |

Sonuçta `.env.local` (bilgisayarında) ya da Vercel'deki değişkenler şöyle görünür:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.xxxx:SIFRE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
IP_HASH_SALT=...32+ rastgele karakter...
```

**Gizli anahtar (`SUPABASE_SECRET_KEY`) neden gerekli?** Danışan davet linkini açıp şifresini
belirlediğinde, sunucu onun giriş hesabını Supabase'in yönetici API'siyle oluşturur (herkese
açık kayıt kapalı olduğu için). Şifre sıfırlama ve "Panel erişimini kapat" da bu anahtarla
çalışır. Anahtar kodda yalnızca `lib/auth/accounts.ts` içinde kullanılır ve silme işlemi sadece
**danışan** rolündeki hesaplara izin verir. Anahtar yoksa site ve diyetisyen paneli çalışır ama
danışan paneli davetleri devre dışı kalır (panelde uyarı görünür).

**Dikkat:** `DATABASE_URL`'deki şifrede `@ : / ? #` gibi karakterler varsa URL-kodla
(ör. `@` → `%40`) ya da bu karakterleri içermeyen bir şifre seç.

**Kontrol (isteğe bağlı, bilgisayarında):** değerleri `.env.local`'e yaz, `pnpm dev`,
http://localhost:3000/admin/login adresinden Adım 4'teki hesapla gir. Boş bir panel görmelisin
(demo verisi Supabase'e gitmez).

## Adım 6 — Herkese açık içeriği yükle (seed)

Adım 4'ten **sonra**: SQL Editor → `supabase/seed.sql` dosyasının içeriğini yapıştır → _Run_.

83 besin, 13 tarif, 6 rehber (4 dilde) ve varsayılan site ayarlarını ekler. **Danışan veya
kişisel veri içermez.** "No dietitian account found" hatası alırsan Adım 4'ü yapmamışsın.

> `supabase/local/demo.sql` sahte danışanlar içerir ve **yalnızca yerel demo** içindir;
> Supabase'te asla çalıştırma.

**Kontrol:** _Table Editor → recipes_ tablosunda 13 satır.

## Adım 7 — Auth ayarları

Supabase → _Authentication_:

1. _Sign In / Providers_ → **Email** açık; **"Allow new users to sign up" KAPALI**
   (hesapları sadece diyetisyen davetle açar).
2. _URL Configuration_ → **Site URL** = sitenin adresi; _Redirect URLs_'e
   `https://alanadin.com/admin` ekle.
3. _Multi-Factor_ → **TOTP** açık (diyetisyen, panelde Ayarlar → Güvenlik'ten iki adımlı
   doğrulamayı etkinleştirir).

Danışan davetleri e-posta ile gitmez: link diyetisyen panelinde oluşur, diyetisyen onu
WhatsApp / kopyala / QR kod ile iletir. Supabase e-posta şablonu ayarlamana gerek yok.

## Adım 8 — Vercel'e yükle

1. Vercel → **Add New → Project** → GitHub deposunu seç.
2. Framework: _Next.js_ (otomatik). Install: `pnpm install`. Build: `pnpm build`.
3. _Environment Variables_: Adım 5'teki **tüm** değişkenleri ekle (Production ve Preview).
   `ALLOW_LOCAL_BACKEND` ve `PREVIEW_UNREVIEWED_TRANSLATIONS` **ekleme**.
4. _Settings → Functions → Region_: **Frankfurt (fra1)** (veritabanına yakın = daha hızlı).
5. **Deploy**. Alan adını bağladıktan sonra `NEXT_PUBLIC_SITE_URL`'i güncelle ve yeniden
   deploy et; Supabase'teki Site URL'i de aynı adrese çek (Adım 7).

**Kontrol:** `https://alanadin.com` açılıyor, `/sitemap.xml` ve `/robots.txt` geliyor.

## Adım 9 — İlk kullanım ve uçtan uca deneme

1. `/admin/login` → Adım 4'teki hesapla gir → **Ayarlar → Güvenlik**: iki adımlı doğrulamayı aç.
2. **Ayarlar**: iletişim, WhatsApp, biyografi, görseller (README → _Content needed_ listesi).
3. **Danışan paneli denemesi** (kendi ikinci e-postanla):
   1. _Danışanlar → Yeni danışan_: ad + **e-posta** (davet için şart) + telefon → Kaydet.
   2. Danışan sayfası → _Genel_ → **Danışan paneli** → _Davet linki oluştur_.
   3. Linki telefonuna gönder (_WhatsApp ile gönder_ / _Kopyala_ / _QR kod_). Link **bir kez**
      gösterilir, **7 gün** geçerli ve **tek kullanımlık**.
   4. Telefonda linki aç → şifre belirle → açık rızayı onayla → panel açılır.
   5. Su bardağı ekle, bir öğüne yiyecek ve fotoğraf ekle, bir mesaj yaz.
   6. Diyetisyen panelinde danışanın _Takip_, _Günlük_, _Mesajlar_ sekmelerinde bunları gör;
      mesaja yanıt ver. Menüdeki **Mesajlar** sayacı okunmamışları gösterir.
   7. Bitince deneme danışanını _Genel → İşlemler → Kalıcı olarak sil_ ile sil (giriş hesabı ve
      fotoğrafları da silinir).

## Danışan paneli — diyetisyen için kısa kullanım

| Ne yapmak istiyorsun            | Nerede                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Danışanı panele davet et        | Danışan → _Genel_ → _Danışan paneli_ → **Davet linki oluştur**                             |
| Danışan şifresini unuttu        | Aynı yer → **Şifre sıfırlama linki** (2 gün geçerli, tek kullanımlık)                      |
| Günlük alışkanlık hedefleri koy | Danışan → _Takip_ → _Alışkanlık hedefleri_ (duraklat / sil)                                |
| Kilo, su, enerji, notlar        | Danışan → _Takip_                                                                          |
| Ne yediği, öğün fotoğrafları    | Danışan → _Günlük_ (14 günlük sayfalar)                                                    |
| Mesajlar                        | Menü → _Mesajlar_ (tümü) veya danışan → _Mesajlar_                                         |
| Paneli kapat                    | _Danışan paneli_ → **Panel erişimini kapat** (giriş hesabı silinir, kayıtları sende kalır) |

Danışan kendi panelinde: bugünün programını görür, su / kilo / alışkanlık / enerji kaydeder,
öğünlerini (besin veritabanından, programdan tek dokunuşla ya da serbest metinle) ve öğün
fotoğraflarını ekler, ilerlemesini grafiklerle izler, sana mesaj yazar, verilerini JSON olarak
indirebilir ve açık rızasını geri çekebilir. Klinik notların, tıbbi notlar ve iç randevu notları
danışana **hiçbir zaman** gösterilmez.

## Sorun giderme

| Belirti                                                      | Sebep / çözüm                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Seed: _No dietitian account found_                           | Adım 4 yapılmamış.                                                                                                                     |
| Davet düğmesi pasif, "gizli Supabase anahtarı tanımlı değil" | Adım 5: `SUPABASE_SECRET_KEY`'i (ya da `SUPABASE_SERVICE_ROLE_KEY`) Vercel'e ekle, yeniden deploy et.                                  |
| Uygulama açılmıyor: _contains a SECRET Supabase key_         | Gizli anahtarı `NEXT_PUBLIC_` ile başlayan bir değişkene yazmışsın. Düzelt ve Supabase'te o gizli anahtarı yenile (_API Keys → Roll_). |
| Davet düğmesi pasif, "önce e-posta" uyarısı                  | Danışanın _Genel_ sekmesinde e-postasını kaydet.                                                                                       |
| Uygulama açılmıyor: _IP_HASH_SALT is required_               | Adım 5: `IP_HASH_SALT` ekle.                                                                                                           |
| Giriş sonrası tekrar giriş sayfası                           | Supabase Site URL / Redirect URL'leri (Adım 7) ve `NEXT_PUBLIC_SITE_URL` aynı alan adı olmalı.                                         |
| Veritabanı bağlantı hatası                                   | `DATABASE_URL` _Transaction pooler_ (6543) olmalı; şifredeki özel karakterleri URL-kodla.                                              |
| Danışan "Hesabın şu an kapalı" görüyor                       | Danışan kaydı arşivlenmiş. _Genel → İşlemler_'den arşivden geri al. (Rızasını geri çeken danışan girişte yeniden rıza ekranını görür.) |
| Link "geçersiz ya da süresi dolmuş"                          | Link kullanılmış, süresi dolmuş ya da yenisi üretilmiş. Yeni link oluştur.                                                             |
| Öğün fotoğrafı yüklenmiyor                                   | _Storage_'da `diary-photos` kovası var mı? (Adım 3'teki 4. dosya.) Fotoğraf en fazla 4 MB; tarayıcı yüklemeden önce küçültür.          |

## Güvenlik ve KVKK notları

- Her tabloda RLS açık. Diyetisyen yalnızca kendi verisini; danışan yalnızca **kendi**
  kayıtlarını ve kendisi için hazırlanan özetleri görür. Bu kurallar `pnpm db:test` ile test
  edilir.
- Danışan paneli sağlık verisi işler: danışan ilk girişte **açık rıza** verir; rıza yoksa hiçbir
  veri gösterilmez ve kaydedilmez. Rıza metni **yer tutucudur — hukuki inceleme gerekir**
  (README → _Content needed_).
- Öğün fotoğrafları özel kovada tutulur, tarayıcıda küçültülür ve konum (EXIF/GPS) bilgisi
  silinir; yalnızca danışan ve diyetisyen görebilir.
- Danışan verisi hiçbir yapay zekâ servisine gönderilmez; sitede izleyici/analitik yok.
- Gizli anahtarı (`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) kimseyle paylaşma; sızarsa Supabase'ten yenile
  (_API Keys → Roll_) ve Vercel'de güncelle.
- Yedekleme: Supabase ücretsiz planında otomatik yedek sınırlıdır; ücretli planda yedeklemeyi
  aç. Panelde _Danışanlar → CSV indir_ danışan listesini, danışan sayfasındaki _Danışan verisini
  dışa aktar_ ise tek danışanın tüm verisini (panel kayıtları dahil, JSON) indirir — KVKK
  erişim talepleri için de bunu kullan.
