import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products as catalog, type Product } from "@/lib/shop/catalog";
import { uid } from "@/lib/utils";

export type SlipProvider = "thunder" | "slip2go";

export type Order = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  at: number;
  kind: "product" | "topup" | "wheel" | "box" | "gift";
  status: "success" | "pending" | "failed";
  payload?: string;
};

export type Claim = {
  id: string;
  orderId: string;
  title: string;
  message: string;
  reply?: string;
  at: number;
  status: "open" | "replied";
};

export type LogEntry = {
  id: string;
  at: number;
  actor: "admin" | "system" | "user";
  action: string;
  detail: string;
};

export type TopupMethod = "promptpay" | "truewallet" | "slip";

type ShopState = {
  hydrated: boolean;
  displayName: string;
  loggedIn: boolean;
  balance: number;
  boxes: number;
  spinsLeft: number;
  stock: Record<string, number>;
  flashEndsAt: number;
  flashStock: number;
  orders: Order[];
  claims: Claim[];
  logs: LogEntry[];
  redeemed: string[];
  slipHashes: string[];
  walletFee: number;
  slipProvider: SlipProvider;
  banner: string;
  navFlags: { streaming: boolean; otp: boolean; smm: boolean };
  login: (name: string) => void;
  logout: () => void;
  buy: (
    product: Product,
    extra?: string,
    skipStock?: boolean,
  ) => { ok: boolean; message: string; order?: Order };
  topup: (
    amount: number,
    method: TopupMethod,
    note?: string,
    serverPaymentId?: string,
  ) => { ok: boolean; message: string };
  checkSlip: (hash: string, amount: number, accountOk: boolean) => { ok: boolean; message: string };
  spin: () => { ok: boolean; message: string; prizeIndex: number };
  openBox: () => { ok: boolean; message: string; tier: string };
  redeem: (code: string) => { ok: boolean; message: string };
  fileClaim: (orderId: string, title: string, message: string) => void;
  replyClaim: (id: string, reply: string) => void;
  adjustBalance: (delta: number, reason: string) => void;
  setWalletFee: (fee: number) => void;
  setSlipProvider: (p: SlipProvider) => void;
  setBanner: (text: string) => void;
  setNavFlag: (key: "streaming" | "otp" | "smm", value: boolean) => void;
};

function log(actor: LogEntry["actor"], action: string, detail: string): LogEntry {
  return { id: uid("log"), at: Date.now(), actor, action, detail };
}

function initialStock() {
  const stock: Record<string, number> = {};
  for (const p of catalog) stock[p.id] = p.stock;
  return stock;
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      displayName: "",
      loggedIn: false,
      balance: 0,
      boxes: 0,
      spinsLeft: 2,
      stock: initialStock(),
      flashEndsAt: Date.now() + 1000 * 60 * 60 * 6,
      flashStock: 12,
      orders: [],
      claims: [],
      logs: [log("system", "boot", "ร้านพร้อมให้ตรวจสอบการตั้งค่า")],
      redeemed: [],
      slipHashes: [],
      walletFee: 2.5,
      slipProvider: "thunder",
      banner: "เดือนแรก V1 ลด 50% · ทดลองร้านด้านบนได้ทันที ไม่คิดเงินจริง",
      navFlags: { streaming: true, otp: true, smm: true },

      login: (name) => {
        const trimmed = name.trim() || "ผู้ทดลอง";
        const first = !get().loggedIn && get().balance === 0 && get().orders.length === 0;
        set((s) => ({
          loggedIn: true,
          displayName: trimmed,
          balance: 0,
          spinsLeft: first ? 2 : s.spinsLeft,
          logs: [log("user", "login", `${trimmed} เข้าสู่ระบบ`), ...s.logs],
        }));
      },

      logout: () => set({ loggedIn: false, balance: 0, orders: [], claims: [] }),

      buy: () => ({ ok: false, message: "กรุณาสั่งซื้อผ่านหน้าสินค้า" }),
      topup: () => ({ ok: false, message: "กรุณาเติมเงินผ่านหน้าสลิป" }),

      checkSlip: (_hash, _amount, _accountOk) => {
        // Fail-closed: local demo must not credit without shared :8787 verify.
        return {
          ok: false,
          message: "ใช้แท็บอัปโหลดสลิปบน /shop/topup — ตรวจที่บริการกลางก่อนเติมเครดิต",
        };
      },

      spin: () => ({ ok: false, message: "ยังไม่เปิดใช้งานกิจกรรมนี้", prizeIndex: 0 }),
      openBox: () => ({ ok: false, message: "ยังไม่เปิดใช้งานกิจกรรมนี้", tier: "" }),
      redeem: () => ({ ok: false, message: "ระบบโค้ดของขวัญยังไม่เปิดใช้งาน" }),

      fileClaim: (orderId, title, message) => {
        const claim: Claim = {
          id: uid("clm"),
          orderId,
          title,
          message,
          at: Date.now(),
          status: "open",
        };
        set((s) => ({
          claims: [claim, ...s.claims],
          logs: [log("user", "claim", title), ...s.logs],
        }));
      },

      replyClaim: (id, reply) => {
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === id ? { ...c, reply, status: "replied" as const } : c,
          ),
          logs: [log("admin", "claim-reply", id), ...s.logs],
        }));
      },

      adjustBalance: () => {
        /* Financial changes must use an authorized server operation. */
      },

      setWalletFee: (fee) => set({ walletFee: fee }),
      setSlipProvider: (p) =>
        set((s) => ({
          slipProvider: p,
          logs: [log("admin", "provider", `สลับเป็น ${p}`), ...s.logs],
        })),
      setBanner: (text) => set({ banner: text }),
      setNavFlag: (key, value) => set((s) => ({ navFlags: { ...s.navFlags, [key]: value } })),
    }),
    {
      name: "velt-shop-v2",
      partialize: (state) => ({ navFlags: state.navFlags }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
