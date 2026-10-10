# Veltshop original master requirements

คุณคือ Senior Full-Stack Engineer, Software Architect, Database Engineer,
DevOps Engineer และ Security Engineer

หน้าที่ของคุณคือพัฒนาและปรับปรุงเว็บไซต์ Veltshop ให้เป็นระบบร้านค้า Digital Product แบบ Production-ready

==================================================
IMPORTANT OPERATING RULES
==================================================

1. ห้ามเดาชื่อไฟล์
2. ห้ามเดา framework
3. ห้ามเดา database
4. ห้ามเดา architecture
5. ห้ามสร้างระบบใหม่ซ้ำกับระบบเดิมโดยไม่ตรวจสอบก่อน
6. ต้องตรวจสอบ project จริงก่อนแก้ไข
7. ต้องตรวจสอบ dependency ก่อนเพิ่ม package
8. ต้องตรวจสอบ database schema ก่อนสร้าง migration
9. ต้องตรวจสอบ authentication เดิมก่อนเพิ่ม Google Login
10. ต้องตรวจสอบ admin system เดิมก่อนสร้าง /admin ใหม่
11. ต้องตรวจสอบ Product / Stock / Order / Payment ที่มีอยู่แล้วก่อนแก้
12. ห้ามลบข้อมูล production
13. ห้าม DROP database/table โดยไม่มีเหตุผลและขั้นตอน backup/recovery
14. ห้าม hard-code secret/API key/password
15. ห้ามใส่ credential จริงลง source code
16. ห้าม commit .env ที่มี secret
17. ห้ามใช้ mock data แทน database จริงเมื่อระบบ production เชื่อม database แล้ว
18. ห้ามบอกว่าเสร็จถ้ายังมี build error สำคัญ
19. ห้ามบอกว่า payment พร้อม production ถ้ายังไม่มี credential/API จริง
20. ห้าม bypass security ของ third-party service
21. ถ้า third-party ไม่มี official API/integration ที่ได้รับอนุญาต ห้ามสร้างระบบ scraping/bypass เอง
22. ต้องรักษา backward compatibility กับระบบเดิมเท่าที่ทำได้

==================================================
PHASE 0 — INSPECT PROJECT FIRST
==================================================

ก่อนแก้ code ใดๆ ให้ตรวจสอบ:

- Project structure
- Framework
- Frontend
- Backend
- API routes
- Database
- ORM
- Authentication
- Authorization
- Admin
- Product
- Category
- Stock
- Order
- Payment
- Wallet/Credit
- File storage
- Image handling
- Environment variables
- Existing tests
- Build system
- Deployment configuration

ตรวจสอบ package.json หรือ package manager ที่ใช้
ตรวจสอบ scripts
ตรวจสอบ database schema/migrations
ตรวจสอบ existing API
ตรวจสอบ existing components

ห้ามเริ่มแก้ไขก่อนทำ inspection

หลัง inspection ให้รายงาน:

TECH STACK
DATABASE
AUTHENTICATION
ADMIN SYSTEM
PAYMENT SYSTEM
PRODUCT SYSTEM
STOCK SYSTEM
ORDER SYSTEM
CURRENT FEATURES
MISSING FEATURES

จากนั้นสร้างรายการ:

FILES TO MODIFY
- exact/path/file.ext
- เหตุผล

FILES TO CREATE
- exact/path/file.ext
- เหตุผล

DATABASE CHANGES
- ตารางที่ต้องเพิ่ม
- field ที่ต้องเพิ่ม
- index
- constraint
- migration

ENVIRONMENT VARIABLES
- ชื่อตัวแปรที่ต้องเพิ่ม

DEPENDENCIES
- package ที่จำเป็นจริงเท่านั้น

จากนั้นจึงเริ่ม implementation

==================================================
1. BRAND / VELTSHOP
==================================================

ชื่อร้าน:

Veltshop

ต้องทำให้ Brand "Veltshop" เด่นและเห็นชัดเจนทั่วเว็บไซต์

Logo ต้องแสดงอย่างเหมาะสม

Admin สามารถเปลี่ยน:
- Logo
- Favicon
- Store name
- Store description
- Theme
- สีหลัก
- สีรอง

เว็บไซต์เปิดให้ซื้อขายได้ 24 ชั่วโมง

ข้อความ:

"ซื้อขายได้ตลอด 24 ชั่วโมง"

หากพบปัญหา:

"หากพบปัญหา กรุณาติดต่อทีมงานผ่านช่องทางด้านล่าง"

ช่องทางติดต่อมีเพียง:

Discord:
https://discord.gg/bjakzMKXK

Facebook:
https://www.facebook.com/Veltshop/

ห้ามเพิ่มช่องทางอื่นเอง

Admin สามารถแก้ Discord/Facebook จาก /admin/settings

==================================================
2. AUTHENTICATION
==================================================

รองรับ:

- Normal account
- Google OAuth
- Login
- Logout
- Session
- Account linking
- Profile
- Secure authentication

Google OAuth ต้องมี:

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL

เก็บใน ENV/Secret Manager

ห้ามเก็บ secret ใน frontend

ต้องป้องกัน:
- CSRF
- OAuth state attack
- Session hijacking
- Invalid callback
- Duplicate account
- Email conflict

ระบบต้องตรวจสอบ authentication เดิมก่อน

ห้ามสร้าง auth system ใหม่ถ้าระบบเดิมสามารถต่อยอดได้

==================================================
3. SESSION SECURITY
==================================================

รองรับ:

- Secure cookies
- HttpOnly
- SameSite
- Session expiration
- Session revocation
- Logout all devices
- Login history
- Rate limit
- Suspicious login protection

ถ้ามี password login:

- Password hashing
- Password reset
- Password change
- Email verification ถ้าระบบมี email provider
- Rate limit

ห้ามเก็บ password plaintext

==================================================
4. USER PROFILE
==================================================

Profile ต้องแสดง:

- Name
- Profile picture
- Email
- Rank
- Credit
- Total spending
- Purchase history
- Top-up history
- Registration date
- Last login

Google user:
ใช้ Google profile picture เป็น default

Normal account:
ใช้ Veltshop default avatar

ผู้ใช้สามารถแก้ข้อมูลที่อนุญาตได้

Admin สามารถแก้ข้อมูลผู้ใช้ผ่าน /admin/users

==================================================
5. PRODUCT SYSTEM
==================================================

Admin สามารถ:

- Add product
- Edit product
- Delete/soft delete product
- Enable/disable product
- Set price
- Set stock
- Set product description
- Set category
- Set image
- Set icon
- Set color
- Set badge
- Set ordering
- Set availability

Product ต้องรองรับ Digital Product

Delivery type:

- Account
- Email + Password
- License Key
- Code
- Text
- File
- Link
- Other digital delivery type

Product สามารถกำหนด Delivery Type ได้

==================================================
6. PRODUCT IMAGE / ICON
==================================================

Admin สามารถ:

- Upload image
- Replace image
- Delete image
- Preview
- Set product icon
- Set product thumbnail

ต้อง validate:

- MIME type
- File size
- Extension
- Image dimensions
- Filename
- Path traversal

ห้าม upload executable file

==================================================
7. PRODUCT COLOR
==================================================

เฉพาะ Admin สามารถกำหนด:

- Card color
- Border
- Accent
- Badge color
- Category color
- Product theme

User ทั่วไปเปลี่ยนไม่ได้

==================================================
8. CATEGORY
==================================================

Admin สามารถ:

- Add category
- Edit category
- Delete/soft delete category
- Change icon
- Change color
- Change order
- Enable/disable

==================================================
9. SEARCH
==================================================

หน้า Store ต้องค้นหาได้:

- Product name
- Category
- Keyword
- Product code ถ้ามี

Admin search ต้องรองรับ:

- Users
- Products
- Orders
- Topups
- Gift Codes
- Claims
- Audit Logs
- Transactions

รองรับ:

- Search
- Filter
- Sort
- Pagination

==================================================
10. PROMOTION BANNER
==================================================

บริเวณด้านบนเมนูแนะนำมี Promotion Carousel

Admin สามารถ:

- Add banner
- Upload image
- Delete
- Edit
- Set link
- Set order
- Enable/disable
- Set start date
- Set end date

Frontend:

- Horizontal carousel
- Left/right navigation
- Auto slide
- Responsive
- Mobile friendly

==================================================
11. PRODUCT STOCK
==================================================

Stock ต้องเป็นข้อมูลจริงจาก database

รองรับ:

AVAILABLE
RESERVED
SOLD
DISABLED

แยก:

- Total stock
- Available stock
- Reserved stock
- Sold stock

ถ้าสินค้าเป็น account/key/code ต้องรองรับ individual inventory item

เมื่อซื้อ:

AVAILABLE
→ RESERVED
→ SOLD

ถ้าซื้อไม่สำเร็จ:

RESERVED
→ AVAILABLE

ต้องป้องกัน race condition

==================================================
12. STOCK CONCURRENCY
==================================================

หาก User A และ User B ซื้อ stock เดียวกันพร้อมกัน

ต้องมีเพียงคนเดียวที่ได้ stock

ห้าม:

User A → stock #001
User B → stock #001

ต้องใช้:

- Database transaction
- Row locking หรือ atomic update
- Unique constraints
- Idempotency

==================================================
13. ORDER SYSTEM
==================================================

สร้างระบบ Order ที่มี:

Order ID

สถานะ:

PENDING
PAID
PROCESSING
COMPLETED
CANCELLED
REFUNDED
FAILED

Order ต้องมี:

- User
- Product
- Quantity
- Price
- Credit used
- Payment reference
- Stock reference
- CreatedAt
- UpdatedAt

User ดูได้เฉพาะ order ของตัวเอง

Admin ดูได้ทั้งหมด

==================================================
14. AUTOMATIC PRODUCT DELIVERY
==================================================

หลังซื้อสำเร็จ ระบบต้องส่งสินค้าตาม Delivery Type

เช่น:

Account
Key
Code
Text
File
Link

ลูกค้าสามารถดูสินค้าที่ซื้อย้อนหลังใน profile/order history

ข้อมูล sensitive ต้องไม่แสดงใน log

==================================================
15. WARRANTY / CLAIM
==================================================

Product สามารถกำหนด:

- No warranty
- 7 days
- 30 days
- Custom warranty

Order ต้องรู้:

Warranty start
Warranty end

ลูกค้าสามารถ Claim ได้จาก Order

Admin /admin/claims สามารถ:

- Accept
- Reject
- Replace
- Refund
- Credit compensation
- Close case

ทุก action ต้องสร้าง Audit Log

==================================================
16. CREDIT / WALLET
==================================================

สร้าง Credit Wallet ที่ปลอดภัย

รองรับ:

- Add credit
- Remove credit
- Purchase
- Transaction history
- Balance
- Ledger

ห้ามเชื่อ balance จาก frontend

Backend เป็น source of truth

ทุกการเปลี่ยนเครดิตต้องสร้าง immutable transaction

ตัวอย่าง:

Balance before
Transaction
Amount
Balance after

ห้ามแก้ transaction history ย้อนหลัง

==================================================
17. TRANSACTION LEDGER
==================================================

ทุก financial operation ต้องมี Ledger

เช่น:

TOPUP
PURCHASE
REFUND
ADMIN_ADD
ADMIN_REMOVE
GIFT_CODE
ADJUSTMENT

แต่ละ transaction:

- ID
- User ID
- Type
- Amount
- Balance before
- Balance after
- Reference
- Status
- CreatedAt
- CreatedBy

Financial transaction ต้องไม่ถูก hard delete

==================================================
18. ADMIN CREDIT CONTROL
==================================================

Admin สามารถ:

- Add credit
- Remove credit
- Adjust credit

แต่ทุกครั้งต้องบันทึก:

- Admin ID
- User ID
- Before
- Amount
- After
- Reason
- Timestamp

ต้องมี confirmation ก่อน destructive financial action

==================================================
19. GIFT CODE
==================================================

Admin สามารถ:

- Create
- Delete/disable
- Edit
- Set expiry
- Set usage limit
- View usage

Reward:

A. Credit

หรือ

B. Product

สามารถเลือก product/category ที่ได้รับ

ป้องกัน:

- Duplicate use
- Expired code
- Disabled code
- Usage exceeded
- Brute force
- Race condition

ทุก redemption ต้อง idempotent

==================================================
20. MEMBERSHIP
==================================================

Rank:

New Member
VIP Member
VVip

เงื่อนไข:

New Member:
สมาชิกใหม่

VIP Member:
ยอดซื้อสะสม >= 500 บาท

VVip:
ยอดซื้อสะสม >= 2,000 บาท

ยอดซื้อสะสมต้องมาจาก completed/valid orders เท่านั้น

ถ้าถึง threshold:

Admin dashboard ต้องแจ้งเตือน

Admin เป็นผู้อนุมัติ rank

Admin สามารถ:

- Add rank
- Remove rank
- Change rank

Admin สามารถกำหนดสีของ Rank ได้

==================================================
21. ADMIN PERMISSION
==================================================

รองรับ:

SUPER_ADMIN
ADMIN
STAFF

ต้องเป็น server-side authorization

ตัวอย่าง:

SUPER_ADMIN:
- ทุกอย่าง
- Settings
- Admin management
- Backup/Restore

ADMIN:
- Users
- Products
- Orders
- Stock
- Topup
- Gift Code
- Claims

STAFF:
- ดู/จัดการงานที่ได้รับอนุญาต
- ห้ามแก้ financial settings
- ห้ามจัดการ admin

Permission ต้องตรวจสอบทุก API

ไม่ใช่เพียงซ่อนปุ่ม frontend

==================================================
22. ADMIN DASHBOARD
==================================================

/admin

แสดงข้อมูลจริง:

- Total members
- New members
- Total products
- Total stock
- Available stock
- Low stock
- Ready-to-ship
- Total orders
- Recent orders
- Sales
- Total topups
- Recent topups
- Total credit
- Pending claims

Statistics:

- Today
- 7 days
- 30 days
- This month
- All time
- Custom date range

==================================================
23. ADMIN USERS
==================================================

/admin/users

ค้นหา:

- Name
- Email
- User ID

แสดง:

- Profile
- Rank
- Credit
- Total spending
- Orders
- Topups
- Login history
- Created date
- Last login

Admin สามารถแก้ข้อมูลที่ได้รับอนุญาต

ทุก sensitive action ต้อง Audit Log

==================================================
24. TOP-UP SYSTEM
==================================================

หน้า:

เติมเงินเข้ากระเป๋า

ข้อความ:

อัปโหลดสลิป · TrueMoney Gift · รับเงินทันที

ขั้นตอน:

1 ช่องทาง
2 แนบสลิป
3 สำเร็จ

ระบบเปิด 24 ชั่วโมง

ข้อความ:

"เติมเงินเข้าระบบแล้ว ไม่สามารถคืนได้ เป็นไปตามเงื่อนไขของเว็บไซต์"

และ:

[ขั้นตอนการขอคืนเงิน]

ข้อความสามารถแก้จาก Admin Settings

==================================================
25. SLIP2GO
==================================================

ใช้ Slip2Go เป็นระบบหลักสำหรับ Slip Verification

สร้าง integration layer:

PaymentProvider
→ Slip2Go

ต้องรองรับ:

- API key
- API secret ถ้ามี
- Webhook secret
- Endpoint
- Minimum topup
- Maximum topup
- Fee

Credentials ต้องมาจาก ENV/Secret Manager

ห้ามสร้าง credential ปลอม

ห้าม hard-code

ถ้ายังไม่มี credential:
ระบบต้องอยู่ใน configuration-ready state
และไม่แกล้งแสดงว่า production payment verification ทำงานแล้ว

==================================================
26. SLIP PAYMENT
==================================================

แสดง:

อัปโหลดสลิป

ข้อความ:

"โอนแล้วแนบสลิป รับเงินอัตโนมัติ"

ค่าธรรมเนียม default:

2.9%

Admin แก้ได้

รองรับ:

- Minimum
- Maximum
- Slip upload
- Verification
- Automatic credit
- Transaction status

ระบบต้องตรวจ:

- Slip duplicate
- Slip hash/reference
- Amount
- Receiver
- Timestamp
- Transaction ID
- Provider response

สลิปเดิมต้องเติมเงินได้เพียงครั้งเดียว

==================================================
27. PROMPTPAY
==================================================

Admin ตั้งค่า:

- Account name
- PromptPay number
- Minimum
- Maximum

สร้าง QR ตามยอดที่ลูกค้าเลือก

หน้าเติมเงินแสดง:

ชื่อบัญชี
PromptPay
ยอด
QR
ขั้นต่ำ

ห้ามให้ user แก้ยอดที่ระบบสร้างเพื่อหลอกระบบ

==================================================
28. TRUEMONEY GIFT
==================================================

เพิ่มช่องทาง:

TrueMoney Gift

ลูกค้าสามารถวางลิงก์ซองของขวัญ

ระบบต้องตรวจสอบผ่านวิธี/API ที่ได้รับอนุญาต

หมายเลขปลายทางเริ่มต้น:

0928160016

แต่ต้องสามารถแก้ผ่าน Admin Settings/ENV

ห้าม hard-code ใน frontend

หาก provider มี official API:
ใช้ official API

หากไม่มี official integration:
อย่า scrape/bypass security

ให้ใช้สถานะ Manual/Pending Verification แทน

ป้องกัน Gift link เดิมถูกใช้ซ้ำ

==================================================
29. PAYMENT ABSTRACTION
==================================================

ออกแบบ Payment Provider interface:

PaymentProvider
├── Slip2Go
├── PromptPay
└── TrueMoneyGift

เพื่อให้เปลี่ยน provider ได้ในอนาคตโดยไม่ต้องเขียน Wallet ใหม่ทั้งหมด

==================================================
30. PAYMENT IDEMPOTENCY
==================================================

ทุก payment operation ต้องรองรับ:

- Idempotency key
- Provider transaction ID
- Event ID
- Duplicate event protection
- Replay protection

Webhook ซ้ำต้องไม่เพิ่มเครดิตซ้ำ

==================================================
31. PAYMENT RECONCILIATION
==================================================

ระบบต้องตรวจสอบ:

Provider amount
vs
Internal transaction

ถ้าเงินเข้า provider แต่ระบบไม่เพิ่มเครดิต:

สร้างสถานะ:

RECONCILIATION_REQUIRED

Admin สามารถตรวจสอบได้ที่:

/admin/payments/reconciliation

==================================================
32. WEBHOOK SECURITY
==================================================

Webhook ต้องตรวจ:

- Signature
- Timestamp
- Event ID
- Provider transaction ID
- Replay attack
- Duplicate event

ห้ามเชื่อ request เพียงเพราะส่งเข้ามาที่ webhook endpoint

==================================================
33. PAYMENT ADMIN
==================================================

/admin/topups

Filter:

- Pending
- Success
- Failed
- Rejected
- Duplicate
- Reconciliation required

แสดง:

- User
- Amount
- Fee
- Net amount
- Provider
- Reference
- Timestamp
- Status

==================================================
34. REALTIME
==================================================

ข้อมูลสำคัญควร update realtime หรือ near realtime:

- Orders
- Stock
- Topups
- Credit
- Users
- Product availability

Events:

ORDER_CREATED
ORDER_COMPLETED
TOPUP_CREATED
TOPUP_COMPLETED
CREDIT_CHANGED
STOCK_CHANGED
USER_CREATED

ใช้ WebSocket/SSE/realtime solution ที่เหมาะสมกับ project

ถ้ามี realtime architecture เดิม ให้ใช้ของเดิม

==================================================
35. NOTIFICATION
==================================================

Admin notification:

- New user
- New order
- New topup
- Low stock
- VIP eligible
- VVip eligible
- Failed payment
- Failed job

User notification:

- Purchase success
- Topup success
- Topup failed
- Product delivered
- Claim updated
- Important account notification

==================================================
36. LOW STOCK
==================================================

Admin สามารถตั้ง threshold

ตัวอย่าง:

Stock <= 5

แสดง:

"สินค้าใกล้หมด"

Threshold แก้ได้จาก /admin/settings

==================================================
37. AUDIT LOG
==================================================

บันทึกทุก admin action สำคัญ:

- Login
- Logout
- Add credit
- Remove credit
- Edit user
- Edit product
- Delete product
- Edit stock
- Create gift code
- Delete gift code
- Approve topup
- Reject topup
- Change rank
- Settings changes
- Backup
- Restore

บันทึก:

- Admin
- Action
- Target
- Before
- After
- Reason
- Timestamp
- IP ถ้าเหมาะสม

Audit Log ห้ามถูกแก้ไขโดยทั่วไป

==================================================
38. BACKUP
==================================================

ระบบต้องรองรับ:

- Manual backup
- Scheduled backup
- Backup history
- Restore
- Backup verification

Restore เฉพาะ SUPER_ADMIN

Backup ห้ามอยู่ใน public folder

ไม่ควร backup secret แบบ plaintext หากไม่จำเป็น

ต้องมี restore procedure

==================================================
39. BACKUP VERIFICATION
==================================================

Backup ต้องสามารถตรวจสอบว่า restore ได้จริง

Flow:

Backup
→ Test Restore
→ Validate Database
→ Mark Backup Valid

==================================================
40. MAINTENANCE MODE
==================================================

Admin Settings:

Maintenance ON/OFF

เมื่อ ON:

User เห็น maintenance page

Admin ยังเข้า /admin ได้

==================================================
41. GLOBAL SETTINGS
==================================================

/admin/settings

แก้ได้:

Store name
Logo
Favicon
Colors
Discord
Facebook
Service hours
Terms
Refund text

Payment:

Slip2Go
PromptPay
TrueMoney
Fee
Minimum
Maximum

Member:

VIP threshold
VVip threshold
Rank colors

Product:

Default colors
Stock threshold
Delivery settings

Promotion:

Banner
Announcement

ไม่ควรต้องแก้ code สำหรับ configuration เหล่านี้

==================================================
42. ANNOUNCEMENTS
==================================================

Admin สามารถสร้างประกาศ:

- Announcement
- Promotion
- Maintenance
- Payment notice

กำหนด:

- Start
- End
- Audience
- Priority
- Enable/disable

==================================================
43. COUPON / PROMOTION
==================================================

แยกจาก Gift Code

รองรับ:

- Percentage discount
- Fixed discount
- Product-specific
- Category-specific
- Minimum order
- Expiration
- Usage limit
- Per-user limit

==================================================
44. REFUND
==================================================

ระบบ Refund ต้องแยกจาก Topup policy

รองรับ:

- Refund request
- Approve
- Reject
- Refund credit
- Replace product
- Compensation

ทุก action Audit Log

ห้าม refund ซ้ำ

==================================================
45. SOFT DELETE
==================================================

ข้อมูลสำคัญใช้ soft delete เมื่อเหมาะสม

เช่น:

- Users
- Products
- Categories
- Gift Codes

Financial records เช่น Transaction/Order ต้องไม่ hard delete

==================================================
46. DATA EXPORT
==================================================

Admin สามารถ export:

- Users
- Products
- Orders
- Stock
- Transactions
- Gift Codes
- Audit Logs

ห้าม export:

- Password
- OAuth secrets
- API secrets
- Unnecessary sensitive information

==================================================
47. DATA IMPORT
==================================================

รองรับ import:

- Stock
- Products
- Gift Codes

ต้อง validate ก่อน import

หากข้อมูลผิด:
ต้อง reject พร้อม error report

==================================================
48. PRIVACY
==================================================

ต้องมี:

- Privacy policy
- Data retention
- Access control
- Data export
- Data deletion process ตามที่เหมาะสม

Sensitive data ต้องถูกจำกัดการเข้าถึง

ห้าม log:

- Password
- API key
- Secret
- Full sensitive credentials

==================================================
49. SECURITY
==================================================

ตรวจสอบ:

- XSS
- CSRF
- SQL injection
- SSRF ถ้ามี
- Path traversal
- File upload vulnerabilities
- Authentication bypass
- Authorization bypass
- Rate limit
- Brute force
- Session security
- Payment replay
- Webhook spoofing
- Race condition
- Double spending
- IDOR
- Privilege escalation

Backend ต้องเป็น source of truth

==================================================
50. RATE LIMIT
==================================================

Rate limit:

- Login
- OAuth
- Gift Code
- Topup
- Checkout
- Password reset
- API
- Search

ป้องกัน abuse และ brute force

==================================================
51. JOB QUEUE
==================================================

งานที่ใช้เวลานานควรทำผ่าน Job/Queue

เช่น:

- Slip verification
- Payment reconciliation
- Product delivery
- Notification
- Backup
- Retry
- External API sync

Status:

PENDING
PROCESSING
SUCCESS
FAILED
RETRY
DEAD_LETTER

ต้องมี retry policy

==================================================
52. ERROR HANDLING
==================================================

API ต้องมี:

- Input validation
- Proper HTTP status
- Safe error messages
- Server logs

ห้ามแสดง:

- Stack trace
- Database error
- Secret
- Internal filesystem path

==================================================
53. SYSTEM HEALTH
==================================================

/admin/system

แสดง:

Database
Authentication
Payment API
Storage
Realtime
Queue
External services

สถานะ:

HEALTHY
WARNING
ERROR

แสดง:

- Last check
- Error
- Response time

==================================================
54. DATABASE
==================================================

ตรวจสอบ schema เดิมก่อน

เพิ่ม migration อย่างปลอดภัย

ต้องมี:

- Foreign keys
- Indexes
- Unique constraints
- Check constraints ถ้าเหมาะสม
- Transaction
- Referential integrity

ห้าม destructive migration โดยไม่มี backup/recovery plan

==================================================
55. MIGRATION
==================================================

ทุก migration ต้อง:

- Versioned
- Reviewable
- Reversible ถ้าเป็นไปได้
- Tested

หาก migration fail ต้องมี recovery strategy

==================================================
56. DEVELOPMENT ENVIRONMENT
==================================================

แยก:

Development
Staging
Production

แยก:

- Database
- ENV
- API keys
- Webhooks
- Storage

ห้ามใช้ Production payment ใน development

==================================================
57. ENVIRONMENT VARIABLES
==================================================

สร้าง/ปรับ .env.example

ตัวอย่าง:

DATABASE_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

SLIP2GO_API_KEY=
SLIP2GO_API_SECRET=
SLIP2GO_WEBHOOK_SECRET=

PAYMENT_CONFIG=

TRUEMONEY_CONFIG=

STORAGE_CONFIG=

ห้ามใส่ credential จริง

==================================================
58. ADMIN SEARCH / PAGINATION
==================================================

ทุก admin table ข้อมูลจำนวนมากต้องรองรับ:

- Search
- Filter
- Sort
- Pagination
- Date range

==================================================
59. DASHBOARD STATISTICS
==================================================

แสดง:

- Sales today
- Sales month
- Total sales
- Orders
- New users
- Topups
- Credit used
- Best selling products
- Low stock products

==================================================
60. PRODUCT SECURITY
==================================================

ถ้าเก็บ:

- Account
- Password
- License
- Token
- Key

ให้ป้องกันข้อมูล sensitive

ถ้าจำเป็นต้องเก็บ sensitive credentials:
เข้ารหัสที่ rest

ห้ามแสดงใน logs

จำกัดสิทธิ์การเข้าถึง

==================================================
61. SEO
==================================================

รองรับ:

- Meta title
- Meta description
- Open Graph
- Sitemap
- Robots
- Favicon
- Product metadata

==================================================
62. ACCESSIBILITY
==================================================

รองรับ:

- Keyboard navigation
- Focus state
- Alt text
- Contrast
- Form validation
- Screen reader friendly structure

==================================================
63. RESPONSIVE
==================================================

รองรับ:

Desktop
Tablet
Mobile

Admin ต้องใช้งานมือถือได้

==================================================
64. FEATURE FLAGS
==================================================

สร้างระบบ feature flag ถ้าเหมาะสม:

Google Login
TrueMoney
Slip2Go
New Checkout
Promotion Banner
Maintenance
Realtime

เปิด/ปิดจาก admin หรือ environment ตามความเหมาะสม

==================================================
65. VERSION / CHANGELOG
==================================================

ระบบควรมี:

- Application version
- Build version
- Migration version
- Changelog

ทุก release สำคัญต้องระบุสิ่งที่เปลี่ยน

==================================================
66. TESTING
==================================================

ต้องสร้าง/ปรับ tests:

Unit:
- Credit
- Ledger
- Gift Code
- Rank
- Fee
- Stock
- Order

Integration:
- Authentication
- Google OAuth
- Product
- Stock
- Order
- Payment
- Topup
- Gift Code
- Admin

E2E:

Register/Login
→ Topup
→ Credit
→ Purchase
→ Stock reduction
→ Delivery
→ Order complete

==================================================
67. CONCURRENCY TEST
==================================================

ต้องทดสอบ:

User A + User B ซื้อ stock เดียวกันพร้อมกัน

Expected:

คนเดียวสำเร็จ
อีกคนได้รับ sold out/failed อย่างถูกต้อง

ห้ามแจก stock เดียวกันสองคน

==================================================
68. PAYMENT TEST
==================================================

ต้อง test:

- Duplicate webhook
- Duplicate slip
- Duplicate gift
- Timeout
- API failure
- Retry
- Partial failure
- Reconciliation
- Double click
- Network retry

==================================================
69. CUSTOMER DATABASE
==================================================

/admin/customers

สามารถ:

- View all
- Search
- Filter
- View individual
- Export

รายละเอียด:

- User ID
- Name
- Email
- Rank
- Credit
- Spending
- Orders
- Topups
- Login
- Created date
- Last login

==================================================
70. REAL CUSTOMER DATA
==================================================

ห้ามใช้ mock data หลังระบบ database พร้อม

Dashboard, Users, Stock, Orders, Topups ต้องใช้ข้อมูลจริง

==================================================
71. ADMIN SAFETY
==================================================

การทำ action สำคัญ:

Delete
Remove credit
Restore
Change payment settings
Change admin permissions

ต้องมี:

- Confirmation
- Permission check
- Audit log

==================================================
72. FINAL QA
==================================================

หลัง implementation:

1. Run lint
2. Run unit tests
3. Run integration tests
4. Run E2E tests
5. Run build
6. Check migration
7. Check API
8. Check auth
9. Check authorization
10. Check payment idempotency
11. Check stock concurrency
12. Check responsive UI
13. Check security
14. Check error handling

แก้ errors ที่เกิดขึ้น

อย่าหยุดเพียงเพราะ code compile

==================================================
73. FINAL REPORT
==================================================

หลังเสร็จให้รายงาน:

FILES MODIFIED
- exact path
- what changed

FILES CREATED
- exact path
- purpose

DATABASE CHANGES
- tables
- columns
- indexes
- constraints
- migrations

ENV CHANGES
- variables

DEPENDENCIES
- added packages

FEATURES IMPLEMENTED
- checklist

TEST RESULTS
- Unit
- Integration
- E2E
- Build
- Lint

SECURITY CHECK
- Passed
- Warning
- Remaining issue

PAYMENT STATUS
- Ready
- Requires credentials
- Requires provider configuration

REMAINING TASKS
เฉพาะสิ่งที่ต้องทำโดยเจ้าของระบบ

==================================================
74. MOST IMPORTANT FINAL RULE
==================================================

อย่าแก้ไข Code ทันที

ลำดับการทำงานต้องเป็น:

INSPECT
↓
ANALYZE
↓
REPORT EXACT FILES
↓
PLAN DATABASE
↓
PLAN ARCHITECTURE
↓
IMPLEMENT
↓
TEST
↓
SECURITY AUDIT
↓
BUILD
↓
FINAL REPORT

หากพบว่าระบบเดิมสามารถรองรับ requirement ได้
ให้แก้/ต่อยอดระบบเดิม

อย่าสร้างระบบซ้ำ

ถ้าต้องสร้างไฟล์ใหม่ ให้ระบุเหตุผล

ถ้าต้องแก้ไฟล์ ให้ระบุเหตุผล

ถ้าต้องเปลี่ยน database ให้ระบุ migration

ห้ามเดาชื่อไฟล์

ห้ามเดา API

ห้ามสร้าง credentials ปลอม

ห้ามแสดงระบบ payment ว่าพร้อมใช้งานจริงจนกว่าจะได้รับ credentials/configuration จริง

เป้าหมายคือทำให้ Veltshop เป็นระบบร้านค้า Digital Product ที่ปลอดภัย,
เสถียร, ดูแลต่อได้ง่าย, รองรับการขยายระบบในอนาคต,
และสามารถบริหารร้านทั้งหมดจาก /admin ได้

==================================================
75. IMAGE MANAGEMENT / IMAGE DIMENSION SYSTEM
==================================================

สร้างระบบจัดการรูปภาพแบบรวมศูนย์สำหรับทุกส่วนของเว็บไซต์

ครอบคลุม:

- Product Image
- Product Icon
- Product Thumbnail
- Category Image
- Category Icon
- Promotion Banner
- Store Logo
- Favicon
- Profile Image
- Announcement Image
- Other Admin-uploaded images

==================================================
IMAGE DIMENSION DISPLAY
==================================================

ทุกครั้งที่ Admin เพิ่ม/อัปโหลดรูป
ระบบต้องแสดงขนาดรูปที่เหมาะสมให้ Admin ทราบก่อนอัปโหลด

ตัวอย่าง:

Product Image
Recommended: 800 × 800 px

Product Icon
Recommended: 512 × 512 px

Promotion Banner
Recommended: 1920 × 600 px

Logo
Recommended: 500 × 150 px

Favicon
Recommended: 512 × 512 px

Category Image
Recommended: 800 × 800 px

Profile Image
Recommended: 512 × 512 px

หมายเหตุ:
ขนาดด้านบนเป็นค่าเริ่มต้นที่สามารถปรับตาม UI จริงของ Project ได้

==================================================
ADMIN IMAGE UI
==================================================

ในหน้า /admin ที่มีการอัปโหลดรูป
ต้องแสดง:

- Recommended Size
- Current Image Size
- File Size
- File Type
- Aspect Ratio
- Preview

ตัวอย่าง:

Image:
[ Preview ]

Recommended:
800 × 800 px

Current:
1200 × 1200 px

File:
PNG
1.2 MB

Status:
✓ Suitable

หรือ:

Status:
⚠ Wrong aspect ratio

==================================================
IMAGE VALIDATION
==================================================

เมื่อ Upload:

1. ตรวจสอบ MIME type
2. ตรวจสอบ file extension
3. ตรวจสอบ file size
4. ตรวจสอบ width
5. ตรวจสอบ height
6. ตรวจสอบ aspect ratio
7. ตรวจสอบ image integrity
8. ป้องกัน malicious files

ห้ามเชื่อ extension เพียงอย่างเดียว

==================================================
IMAGE RESIZE / CROP
==================================================

Admin ต้องสามารถแก้รูปก่อนบันทึกได้

รองรับ:

- Crop
- Resize
- Rotate
- Zoom
- Position
- Aspect ratio
- Preview

ตัวอย่าง:

Product Image:
1:1

Promotion Banner:
16:5 หรือ ratio ที่ระบบกำหนด

Profile:
1:1

ระบบต้องมี crop area ตามประเภทของรูป

==================================================
AUTO OPTIMIZATION
==================================================

หลัง upload:

- Optimize image
- Compress image
- Generate suitable format ถ้าเหมาะสม
- Generate thumbnail
- Preserve acceptable quality

ต้องไม่ทำให้รูปเสียคุณภาพเกินความจำเป็น

==================================================
EDIT IMAGE
==================================================

Admin สามารถกลับมาแก้รูปภายหลังได้

เช่น:

Product
→ Edit
→ Image
→ Replace / Crop / Resize
→ Save

ไม่จำเป็นต้องลบ Product เพื่อเปลี่ยนรูป

==================================================
IMAGE REPLACEMENT
==================================================

เมื่อเปลี่ยนรูป:

1. Upload รูปใหม่
2. Validate
3. Preview
4. Confirm
5. Update database
6. Replace reference
7. ลบไฟล์เก่าหลังตรวจสอบว่าไม่มีส่วนอื่นใช้งาน

ห้ามลบไฟล์เก่าก่อน update สำเร็จ

==================================================
IMAGE USAGE PROTECTION
==================================================

ถ้ารูปถูกใช้โดยหลายส่วนของเว็บไซต์:

ห้ามลบไฟล์ทันที

ระบบต้องตรวจสอบว่า image ถูกใช้อยู่ที่ไหนก่อนลบ

==================================================
IMAGE STORAGE
==================================================

แยกประเภท storage/path เช่น:

/products
/categories
/banners
/logo
/favicon
/profiles
/announcements

ไม่ควรเก็บทุกอย่างไว้ใน directory เดียว

==================================================
RESPONSIVE IMAGE
==================================================

ถ้าเหมาะสม ให้สร้าง image variants:

Original
Large
Medium
Small
Thumbnail

Frontend เลือกขนาดที่เหมาะสมตาม device

==================================================
ADMIN IMAGE SETTINGS
==================================================

ใน /admin/settings/image

Admin สามารถตั้งค่า:

- Maximum file size
- Allowed formats
- Recommended dimensions
- Compression quality
- Auto resize
- Auto crop
- Thumbnail size

แต่ต้องมี safe defaults

==================================================
IMAGE ERROR MESSAGE
==================================================

ถ้ารูปไม่ตรงเงื่อนไข
ต้องแจ้งสาเหตุที่เข้าใจง่าย

ตัวอย่าง:

"รูปนี้มีขนาด 400 × 200 px
แต่ Banner ต้องการอัตราส่วน 16:5"

หรือ:

"ไฟล์มีขนาด 12 MB
ขนาดสูงสุดคือ 5 MB"

ห้ามแสดง error แบบ technical ที่ผู้ใช้ทั่วไปอ่านไม่เข้าใจ

==================================================
IMPORTANT
==================================================

ก่อนสร้าง Image Management System
ให้ตรวจสอบว่าระบบเดิมมี image/upload/storage system อยู่แล้วหรือไม่

ถ้ามี:
ให้ต่อยอดระบบเดิม

ถ้าไม่มี:
สร้างระบบกลางที่สามารถนำไปใช้กับ Product, Banner,
Category, Logo, Profile และส่วนอื่นในอนาคตได้

ห้ามสร้าง upload logic ซ้ำหลายชุด