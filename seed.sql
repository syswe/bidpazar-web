-- BidPazar Kategoriler Seed Data
-- Kullanım: Bu dosyayı PostgreSQL veritabanında çalıştırın
-- psql -h hostname -U username -d database_name -f seed.sql

-- Mevcut kategorileri temizle (gerekirse)
-- DELETE FROM "Category";

-- Ana kategoriler emojiler ile birlikte (UPSERT ile güvenli ekleme)
INSERT INTO "Category" (id, name, description, emoji, "parentId", "createdAt", "updatedAt") VALUES
('cat-aksesuar', 'Aksesuar', 'Çanta, takı, saat ve diğer aksesuarlar', '👜', NULL, NOW(), NOW()),
('cat-antika', 'Antika', 'Tarihi değer taşıyan antika eşyalar', '🏺', NULL, NOW(), NOW()),
('cat-dekorasyon', 'Dekorasyon', 'Ev ve ofis dekorasyon ürünleri', '🎨', NULL, NOW(), NOW()),
('cat-efemera', 'Efemera', 'Kağıt üzerindeki tarihi belgeler ve materyaller', '📜', NULL, NOW(), NOW()),
('cat-elektronik', 'Elektronik', 'Elektronik cihazlar ve teknoloji ürünleri', '📱', NULL, NOW(), NOW()),
('cat-ev-yasam', 'Ev & Yaşam', 'Ev eşyaları ve yaşam ürünleri', '🏠', NULL, NOW(), NOW()),
('cat-geleneksel-sanatlar', 'Geleneksel Sanatlar', 'El sanatları ve geleneksel sanat eserleri', '🎭', NULL, NOW(), NOW()),
('cat-giyim-tekstil', 'Giyim & Tekstil', 'Giyim eşyaları ve tekstil ürünleri', '👗', NULL, NOW(), NOW()),
('cat-hobi', 'Hobi', 'Hobi malzemeleri ve koleksiyon ürünleri', '🎯', NULL, NOW(), NOW()),
('cat-karma', 'Karma', 'Çeşitli kategorilerdeki karışık ürünler', '🎲', NULL, NOW(), NOW()),
('cat-kitap-muzik', 'Kitap & Müzik', 'Kitaplar, notalar ve müzik materyalleri', '📚', NULL, NOW(), NOW()),
('cat-makine', 'Makine', 'Makineler ve endüstriyel ekipmanlar', '⚙️', NULL, NOW(), NOW()),
('cat-mobilya', 'Mobilya', 'Antika ve modern mobilyalar', '🪑', NULL, NOW(), NOW()),
('cat-numismatik', 'Nümismatik', 'Madeni paralar, banknotlar ve madalyalar', '🪙', NULL, NOW(), NOW()),
('cat-objeler', 'Objeler', 'Çeşitli objeler ve dekoratif eşyalar', '🏮', NULL, NOW(), NOW()),
('cat-ofis-kirtasiye', 'Ofis & Kırtasiye', 'Ofis malzemeleri ve kırtasiye ürünleri', '📎', NULL, NOW(), NOW()),
('cat-oyuncaklar', 'Oyuncaklar', 'Vintage ve koleksiyon oyuncakları', '🧸', NULL, NOW(), NOW()),
('cat-plak-kaset', 'Plak & Kaset', 'Müzik plakları, kasetler ve CDler', '💿', NULL, NOW(), NOW()),
('cat-porselen', 'Porselen', 'Porselen ve seramik eşyalar', '🍽️', NULL, NOW(), NOW()),
('cat-saat', 'Saat', 'Antika ve modern saatler', '⏰', NULL, NOW(), NOW()),
('cat-spor-outdoor', 'Spor & Outdoor', 'Spor ekipmanları ve açık hava ürünleri', '⚽', NULL, NOW(), NOW()),
('cat-tablo-resim', 'Tablo & Resim', 'Tablolar, resimler ve sanat eserleri', '🖼️', NULL, NOW(), NOW()),
('cat-tesbih', 'Tesbih', 'Tesbihler ve dini eşyalar', '📿', NULL, NOW(), NOW()),
('cat-yapi-market', 'Yapı Market', 'İnşaat ve yapı malzemeleri', '🔨', NULL, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  "parentId" = EXCLUDED."parentId",
  "updatedAt" = NOW();

-- Kategorilerin başarıyla eklendiğini kontrol et
SELECT COUNT(*) as kategori_sayisi FROM "Category";
SELECT name, emoji FROM "Category" ORDER BY name; 

-- Test kullanıcıları (UPSERT ile güvenli ekleme)
INSERT INTO "User" (
  id,
  email,
  username,
  password,
  name,
  "isVerified",
  "userType",
  "updatedAt"
) VALUES 
  (
    md5(random()::text || clock_timestamp()::text),
    'streamer1@test.com',
    'streamer1',
    '$2a$10$PTZIYRUf0x394y492uc0fe/VsxM.tOmUl0sgvELIkzrTxwjCyFwKy',
    'streamer1',
    true,
    'MEMBER',
    NOW()
  ),
  (
    md5(random()::text || clock_timestamp()::text),
    'watcher1@test.com',
    'watcher1',
    '$2a$10$6s1CzNKizqqh3QSd/xCFVevKana1H1dpv41b4XU/j9yld53UrJ5LW',
    'watcher1',
    true,
    'MEMBER',
    NOW()
  ),
  (
    md5(random()::text || clock_timestamp()::text),
    'watcher2@test.com',
    'watcher2',
    '$2a$10$zr8zZs4F1lI.D6NgygWG5uZ2..2L7AQ.quB0pqxD2DCsatqOOQVue',
    'watcher2',
    true,
    'MEMBER',
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- Test kullanıcılarını doğrula
SELECT 
  username,
  email,
  name,
  "isVerified",
  "userType",
  "createdAt"
FROM "User" 
WHERE email LIKE '%@test.com'
ORDER BY username;