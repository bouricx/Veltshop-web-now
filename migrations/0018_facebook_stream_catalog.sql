-- Match the Facebook page's current monthly prices and add the two missing
-- streaming products. Existing stock quantities remain admin-owned values.
INSERT INTO categories(id,label,hint,sort_order,visible)
VALUES('stream','บัตรเติม / พรีเมียม','VOUCHER',0,true)
ON CONFLICT(id) DO NOTHING;

UPDATE products
SET name='Netflix 1 เดือน',
    subtitle='1 เดือน · ราคาอ้างอิงจากโพสต์เพจ',
    price=89,
    compare_at=NULL,
    image=CASE WHEN image='' THEN '/images/products/netflix-1m.webp' ELSE image END,
    delivery='account',
    description='เพจ Veltshop แจ้งราคา 89 บาทต่อ 1 เดือน และระบุว่ากลับมาขายได้ตามปกติ รายละเอียดบัญชีและเงื่อนไขรับประกันโปรดยืนยันกับร้านก่อนชำระเงิน',
    card_color='#E50914',
    accent_color='#E50914',
    border_color='#E50914',
    badge_color='#E50914',
    flash=false,
    updated_at=now()
WHERE id='p_8d5c9bd4-5c8f-449a-870b-f0411cf7ed0b';

UPDATE products
SET name='Spotify Premium 1 เดือน',
    subtitle='1 เดือน · บัญชีร้าน · มีประกัน/เคลมตามโพสต์',
    price=69,
    compare_at=NULL,
    delivery='account',
    description='เพจ Veltshop แจ้งราคา 69 บาทต่อเดือน ใช้บัญชีร้าน และระบุว่ามีประกันพร้อมเคลม แต่ไม่ได้ระบุระยะเวลาหรือเงื่อนไขประกัน กรุณาติดต่อร้านยืนยันรายละเอียดก่อนชำระเงิน',
    card_color='#1ED760',
    accent_color='#1ED760',
    border_color='#1ED760',
    badge_color='#1ED760',
    badge='บัญชีร้าน',
    flash=false,
    updated_at=now()
WHERE id='p_663df4c2-2899-4121-ab2a-9e3d669b7fcd';

INSERT INTO products(
  id,name,subtitle,category_id,price,compare_at,stock,image,delivery,warranty_days,
  card_color,badge,sort_order,featured,flash,active,description,icon,
  border_color,accent_color,badge_color
) VALUES (
  'veltshop-prime-video-1m','Prime Video 1 เดือน',
  '1 เดือน · บัญชีส่วนตัว · ดูพร้อมกันได้ 3 อุปกรณ์',
  'stream',59,NULL,0,'/images/products/prime-video-1m.webp','account',0,
  '#1597E5','บัญชีส่วนตัว',10,false,false,true,
  'เพจ Veltshop แจ้งราคา 59 บาทต่อเดือน ใช้บัญชีส่วนตัว ดูพร้อมกันได้สูงสุด 3 อุปกรณ์ และระบุว่ามีจำนวนจำกัด รายละเอียดประกันไม่ได้ระบุ กรุณาติดต่อร้านยืนยันสต็อกก่อนชำระเงิน',
  'P','#1597E5','#1597E5','#1597E5'
), (
  'veltshop-youtube-premium-1m','YouTube Premium 1 เดือน',
  '1 เดือน · บัญชีร้าน · มีประกัน/เคลมตามโพสต์',
  'stream',69,NULL,0,'/images/products/youtube-premium-1m.webp','account',0,
  '#EF233C','ประกัน/เคลม',11,false,false,true,
  'เพจ Veltshop แจ้งราคา 69 บาทต่อเดือน ใช้บัญชีร้าน และระบุว่ามีประกันพร้อมเคลม แต่ไม่ได้ระบุระยะเวลาหรือเงื่อนไขประกัน กรุณาติดต่อร้านยืนยันรายละเอียดและสต็อกก่อนชำระเงิน',
  'Y','#EF233C','#EF233C','#EF233C'
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  subtitle=EXCLUDED.subtitle,
  category_id=EXCLUDED.category_id,
  price=EXCLUDED.price,
  compare_at=EXCLUDED.compare_at,
  image=EXCLUDED.image,
  delivery=EXCLUDED.delivery,
  warranty_days=EXCLUDED.warranty_days,
  card_color=EXCLUDED.card_color,
  badge=EXCLUDED.badge,
  description=EXCLUDED.description,
  icon=EXCLUDED.icon,
  border_color=EXCLUDED.border_color,
  accent_color=EXCLUDED.accent_color,
  badge_color=EXCLUDED.badge_color,
  flash=EXCLUDED.flash,
  active=EXCLUDED.active,
  updated_at=now();
