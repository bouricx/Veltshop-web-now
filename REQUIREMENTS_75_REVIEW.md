# ตรวจข้อกำหนด Veltshop ทั้ง 75 หัวข้อ

แหล่งอ้างอิง: `MASTER_REQUIREMENTS_TH.md` (ข้อความต้นฉบับจากผู้ใช้ ไม่เปลี่ยนข้อกำหนด)
รุ่นที่ตรวจ: 0.5.0, ต่อจาก main b80f08f วันที่ 10 ตุลาคม 2026

คำว่า **มีระบบ** หมายถึงพบโค้ดรองรับและมีการตรวจแบบ local/isolated ตามรายงานการทดสอบ ไม่ได้แปลว่าทุกกรณีผ่านการทดสอบกับเงินจริงใน production แล้ว **ตรวจเพิ่มเติม** คือมีส่วนที่ยังต้องยืนยันหรือปรับให้ครบ และ **รอบริการจริง** คือจำเป็นต้องใช้บัญชี/credentials/specification ของผู้ให้บริการ ไม่ใช้ข้อมูลจำลองแทน production.

| ข้อ | ระบบ | ผลตรวจและหลักฐาน |
|---|---|---|
| 1 | แบรนด์ | มีระบบ: BrandMark, settings-schema, ShopShell; Discord/Facebook และข้อความ 24 ชั่วโมง |
| 2 | บัญชี / Google | บัญชีปกติมีระบบ; Google รอบริการจริงและทดสอบ callback/account linking |
| 3 | Session security | มีระบบ: native auth, disabled users, session revoke, login history; reset/verification email รอบริการจริง |
| 4 | โปรไฟล์ | มีระบบ: myAccountData/profile; เพิ่ม last login, รูป, rank, credit, spending, histories |
| 5 | สินค้า | มีระบบ: actions/validation/ProductEditor; เพิ่ม description/icon และ delivery types |
| 6 | รูป / ไอคอน | มีระบบ: central ImageEditor/media, validation/Sharp/thumbnails; ไอคอนสินค้ารอบนี้เป็นข้อความอีโมจิ |
| 7 | สีสินค้า | มีระบบ: migration0013, สีหลัก/ขอบ/accent/badge แยกกัน, preview และ foreground contrast |
| 8 | หมวด | มีระบบ: category editor/actions, icon/image/color/order/visibility |
| 9 | ค้นหา | มีระบบ: product ID/name/description/category label, multi-word, price/name/stock sort, available filter, pagination; admin SQL filtering |
| 10 | Banner | มีระบบ: content scheduling, carousel, image editor; browser QA ข้อมูลจริงตามที่มีในร้าน |
| 11 | Stock states | มีระบบ: inventory available/reserved/sold/disabled, quantity/individual mode |
| 12 | Stock concurrency | มีระบบ: transaction, row locks, SKIP LOCKED; ยังต้องทดสอบ PostgreSQL หลาย connection จริง |
| 13 | Orders | มีระบบ: authoritative order states/history; operation locks/idempotency |
| 14 | Auto delivery | มีระบบ: encrypted inventory and buyer-bound delivery/private files, revoke after refund/replacement |
| 15 | Warranty/claims | มีระบบ: warrantyDays/claims/replacement/admin responses |
| 16 | Wallet | มีระบบ: authoritative account/ledger; whole-baht precision ตามข้อจำกัดปัจจุบัน |
| 17 | Ledger | มีระบบ: immutable history/atomic financial changes |
| 18 | Admin credit | มีระบบ: reason/confirmation/audit/idempotent adjustment |
| 19 | Gift code | มีระบบ: credit/product/category, selected product validation, usage/expiry/retry, metadata edit/disable |
| 20 | Membership | มีระบบ: completed spending, VIP/VVip thresholds/admin approvals/rank color |
| 21 | Permission | มีระบบ: server permission checks; รักษา main security fix ที่จำกัดการให้ admin/super_admin โดย super admin |
| 22 | Dashboard | มีระบบ: actual totals/recent orders/topups; today/7/30/month/all/custom ตามเวลาไทย |
| 23 | Admin users | มีระบบ: user search/profile/rank/credit/orders/spending/last login และ audit; การดูรายละเอียดกระจายตามเมนูที่เกี่ยวข้อง |
| 24 | Topup UI | มีระบบ: payment steps/methods/history/policy; live provider tests ยังไม่ครบ |
| 25 | Slip2Go | มี adapter อย่างเป็นทางการที่ fail closed; รอ credentials/live test |
| 26 | Slip payment | มีระบบ: fee/amount/receiver/reference validation; รอ live provider test |
| 27 | PromptPay | มีระบบ: QR amount/destination validation; ต้องยืนยันบัญชีรับเงินจริงก่อนเปิดรับ |
| 28 | TrueMoney Gift | Manual pending/review ตามกรณีไม่มี authorized API; ไม่อ้างว่า redeem อัตโนมัติ |
| 29 | Payment abstraction | มีระบบ: payment-providers/slip2go/manual-gift |
| 30 | Payment idempotency | มีระบบ: request/proof/transfer reference fences และ ledger transaction |
| 31 | Reconciliation | มีระบบ: pending/reconciliation-required/admin review; รอ provider/live scenarios |
| 32 | Signed webhooks | รอบริการจริง: ยังไม่มี official event/signature contract จึงไม่สร้าง endpoint สมมุติ |
| 33 | Payment admin | มีระบบ: SQL search/status/date/pagination/review/export |
| 34 | Realtime | มีระบบ: scoped SSE revisions/15-second fallback; browser isolated QA และต้องติดตาม live connections |
| 35 | Notifications | User notifications มีระบบ; dashboard recent/actions/low-stock/rank/job indicators มีระบบ; เพิ่ม persistent admin inbox สำหรับ new user/order/topup, low stock, VIP/VVip และ payment/job failures; read state แยกต่อ admin |
| 36 | Low stock | มีระบบ: editable threshold; product cards ใช้ threshold เดียวกับ dashboard |
| 37 | Audit | มีระบบ: immutable audit, financial/product/media/role/gift actions |
| 38 | Backup | มีระบบ: encrypted manual/scheduled backup/history/download; off-site copy เป็นงานการปฏิบัติการ |
| 39 | Backup verification | มี isolated restore verification; ยังไม่ใช่ production PostgreSQL disaster-recovery drill |
| 40 | Maintenance | ปิดหน้าร้าน/financial flows และเข้าหลังบ้านได้; เพิ่ม admin storefront preview โดยตรวจสถานะจาก server; financial flows ยังคงระงับ |
| 41 | Global settings | มีระบบ: brand/contact/ranks/payment/retention/images/maintenance; เพิ่ม allowed formats/thumbnail/dimensions/auto resize/auto crop |
| 42 | Announcements | มีระบบ: audience/priority/schedule/content images |
| 43 | Coupons | มีระบบ: fixed/percent/product/category/min/expiry/usage/per-user and transactional redemption |
| 44 | Refund | มีระบบ: idempotent credit refund/replacement/claim audit; ไม่มี financial hard delete |
| 45 | Soft delete | มีระบบ: product/category visibility/gift disable/account disable; financial records retained |
| 46 | Export | มีระบบ: admin records/products and personal export; raw stock credentials ไม่ออกผ่าน CSV |
| 47 | Import | มีระบบ: validate/atomic products/gifts/stock, retry identity; เพิ่ม description/colors/category gifts |
| 48 | Privacy | มีระบบ: export, reviewed account closure/anonymization, retention; financial evidence retained |
| 49 | Security | มี auth/RBAC/CSRF/input validation/encryption/disabled checks; external penetration review ยังไม่ทำ |
| 50 | Rate limits | มี mutation/auth limits; search ใช้ client filtering ไม่ส่งคำขอทุกตัวอักษร; public endpoint/global perimeter limits ยังตรวจเพิ่มเติม |
| 51 | Jobs | มี durable queue/leases/retry/deadletter/runner; additional provider async jobs ขึ้นกับ integration จริง |
| 52 | Errors | มี safe error handling; เพิ่ม catalog retry/loading/error และ empty states |
| 53 | Health | มี DB timing/keys/provider setup flags/job/scheduler status; provider API latency และ error-rate aggregation ยังตรวจเพิ่มเติม |
| 54 | Database | มี FK/indexes/constraints, migration0013/0014 additive ไม่ลบข้อมูล |
| 55 | Migration | มี versioned migrations/local integration/isolated restore; production recovery drill ยังไม่ทำ |
| 56 | Environments | Local isolated DB และ staging deploy มี; ต้องยืนยัน staging DB/secrets แยกก่อนใช้ production-like tests |
| 57 | Environment | .env.example/server-only hosting secrets; ไม่มี secret ใน git |
| 58 | Admin search/pagination | Core admin tables มีระบบ; เพิ่ม media/privacy/backup SQL search/status/date/sort และ pagination |
| 59 | Statistics | มี real revenue/completed orders/best sellers/custom dates; ไม่มี fake totals |
| 60 | Product security | มี AES-GCM bound payloads/private files, owner-only delivery; trusted ZIP input, ไม่มี malware scanner |
| 61 | SEO | Product routes/meta/sitemap/robots มี; social/canonical live checks ยังตรวจเพิ่มเติม |
| 62 | Accessibility | Labels/focus/skip link/aria states/color contrast/reduced motion มี; screen-reader/axe full audit ยังไม่ทำ |
| 63 | Responsive | ต้องตรวจ 320/360/390/430/tablet/desktop ตาม browser report; preserve main product-image fix |
| 64 | Flags | Store flags/maintenance/provider flags มี; Google account capability ตรวจ server configuration |
| 65 | Version | package0.5.0/changelog/release documents |
| 66 | Tests | Existing unit/integration/auth and isolated browser flows plus new catalog/date/category-gift tests |
| 67 | Concurrency tests | Embedded DB transactional/race tests มี; true multi-connection PostgreSQL test ยังไม่ทำ |
| 68 | Payment tests | Fail/replay/receiver/reference/rollback tests มี; live timeout/provider outage tests รอบริการจริง |
| 69 | Customer database | Real Neon persisted users/orders/topups, scoped account/admin data |
| 70 | Actual data | Production uses real DB; synthetic data only isolated QA; live catalog name `test` เป็นข้อมูลผู้ดูแลที่พบ ไม่เปลี่ยนเอง |
| 71 | Admin safety | Server permissions/reasons/confirmations/audit; privileged role grants preserve main security fix |
| 72 | QA | Typecheck/lint/unit/integration/build/browser gates, final evidence in release report; live paid operations not performed |
| 73 | Final report | Exact files/schema/validation/provider boundaries documented in release report |
| 74 | Work sequence | Existing project inspected before changes, safe migration/merge/test/deploy; all original clauses copied for traceability |
| 75 | Image management | Central editor validates, shows sizes/ratio, crops/rotate/zoom/position, re-edits current local media; preserve full product artwork; เพิ่ม allowed formats/auto resize/auto crop/thumbnail size และ dimension settings; public media มี original/thumbnail variants |

## ข้อจำกัดต่อคำว่า 100%

ตรวจครบทั้ง 75 หัวข้อ ไม่เท่ากับทุกหัวข้อเสร็จ 100%. รายการที่เขียนว่า "ตรวจเพิ่มเติม" และ "รอบริการจริง" ยังต้องปิดด้วย implementation/credentials/หลักฐาน production ที่เหมาะสม ไม่กำหนดคะแนนรวมใหม่จากการคาดเดา. งานที่ต้องใช้เงินจริง ผู้ให้บริการจริง หรือ recovery production จะไม่รายงานว่าผ่านจาก local tests.
