export function googleOAuthError(code: string | null): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    invalid_code:
      "Google ส่งรหัสกลับแล้ว แต่เซิร์ฟเวอร์แลก token ไม่สำเร็จ ผู้ดูแลต้องตรวจ GOOGLE_CLIENT_SECRET และ callback URL ใน Google Cloud/Vercel",
    state_mismatch:
      "การยืนยัน Google ไม่ตรงกับเบราว์เซอร์นี้ กรุณาเริ่มเข้าสู่ระบบใหม่ในแท็บเดียวกัน",
    state_expired: "การยืนยัน Google หมดอายุ กรุณาเริ่มเข้าสู่ระบบใหม่",
    state_not_found: "ไม่พบข้อมูลการยืนยัน Google กรุณาเริ่มเข้าสู่ระบบใหม่",
    account_not_linked:
      "อีเมลนี้มีบัญชีเดิมอยู่แล้ว กรุณาเข้าสู่ระบบบัญชีเดิมก่อนเชื่อม Google เพื่อรักษาข้อมูลสมาชิกและคำสั่งซื้อ",
    unable_to_create_user:
      "บันทึกสมาชิก Google ไม่สำเร็จ ผู้ดูแลต้องตรวจตาราง user และ account ในฐานข้อมูล",
    unable_to_create_session: "สร้าง session ไม่สำเร็จ ผู้ดูแลต้องตรวจตาราง session ในฐานข้อมูล",
    unable_to_get_user_info: "อ่านข้อมูลบัญชี Google ไม่สำเร็จ กรุณาลองใหม่",
    internal_server_error: "ระบบสมาชิกขัดข้อง ผู้ดูแลต้องตรวจ runtime logs ของ Vercel",
    access_denied: "การอนุญาต Google ถูกยกเลิก กรุณาเริ่มใหม่และอนุญาตการเข้าสู่ระบบ",
  };
  const safeCode = /^[a-zA-Z0-9_-]{1,80}$/.test(code) ? code : "oauth_error";
  return `${messages[code] || "การยืนยัน Google ล้มเหลว ผู้ดูแลต้องตรวจ runtime logs ของ Vercel"} (รหัส: ${safeCode})`;
}
