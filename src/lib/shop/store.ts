import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  boxTiers,
  deliverPayload,
  giftCodes,
  pickWeighted,
  products as catalog,
  type Product,
  wheelPrizes,
} from "@/lib/shop/catalog";
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
  buy: (product: Product, extra?: string, skipStock?: boolean) => { ok: boolean; message: string; order?: Order };
  topup: (amount: number, method: TopupMethod, note?: string, serverPaymentId?: string) => { ok: boolean; message: string };
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
      logs: [
        log("system", "boot", "ร้านเดโมพร้อมใช้งาน · เครดิตทดลองเมื่อเข้าสู่ระบบ"),
      ],
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
          balance: first ? 500 : s.balance,
          spinsLeft: first ? 2 : s.spinsLeft,
          logs: [
            log("user", "login", `${trimmed} เข้าสู่ระบบเดโม${first ? " · รับเครดิตทดลอง ฿500" : ""}`),
            ...s.logs,
          ],
        }));
      },

      logout: () => set({ loggedIn: false }),

      buy: (product, extra, skipStock) => {
        const s = get();
        if (!s.loggedIn) return { ok: false, message: "เข้าสู่ระบบก่อนซื้อ" };
        if (s.balance < product.price) return { ok: false, message: "ยอดเงินไม่พอ เติมเงินก่อนได้ที่เมนูเติมเงิน" };
        const localStock = product.flash ? s.flashStock : (s.stock[product.id] ?? product.stock);
        if (!skipStock && localStock <= 0) return { ok: false, message: "สินค้าหมด" };
        const order: Order = {
          id: uid("ord"),
          productId: product.id,
          name: product.name,
          price: product.price,
          at: Date.now(),
          kind: "product",
          status: "success",
          payload: extra ? `${deliverPayload(product)}\n${extra}` : deliverPayload(product),
        };
        set({
          balance: s.balance - product.price,
          stock: skipStock || product.flash ? s.stock : { ...s.stock, [product.id]: localStock - 1 },
          flashStock: !skipStock && product.flash ? s.flashStock - 1 : s.flashStock,
          orders: [order, ...s.orders],
          logs: [log("user", "purchase", `${product.name} · ${product.price} บาท`), ...s.logs],
        });
        return { ok: true, message: "ส่งของแล้ว เปิดประวัติเพื่อคัดลอกไอดี", order };
      },

      topup: (amount, method, note, serverPaymentId) => {
        const s = get();
        if (!s.loggedIn) return { ok: false, message: "เข้าสู่ระบบก่อนเติมเงิน" };
        if (amount <= 0) return { ok: false, message: "ยอดไม่ถูกต้อง" };
        // PromptPay / TrueWallet must not fake-credit locally — only mirror after server slip verify.
        if (method === "promptpay" || method === "truewallet") {
          return {
            ok: false,
            message: "ยังไม่เติมเครดิต — โอนแล้วอัปโหลดสลิปให้บริการกลางตรวจก่อน",
          };
        }
        if (method !== "slip") return { ok: false, message: "วิธีเติมไม่รองรับ" };
        // Block direct client credit: local mirror only after processPayment returned a paymentId.
        if (!serverPaymentId || !String(serverPaymentId).trim()) {
          return {
            ok: false,
            message: "ยังไม่เติมเครดิต — ต้องผ่านการตรวจบนเซิร์ฟเวอร์ก่อน",
          };
        }
        const credit = amount;
        const order: Order = {
          id: uid("top"),
          name: "โอนพร้อมเพย์ · สลิป",
          price: amount,
          at: Date.now(),
          kind: "topup",
          status: "success",
          payload: note,
        };
        set({
          balance: s.balance + credit,
          orders: [order, ...s.orders],
          logs: [log("system", "topup", `+฿${credit} ผ่าน slip${note ? ` · ${note}` : ""}`), ...s.logs],
        });
        return { ok: true, message: `เติม ฿${credit} สำเร็จ` };
      },

      checkSlip: (_hash, _amount, _accountOk) => {
        // Fail-closed: local demo must not credit without shared :8787 verify.
        return {
          ok: false,
          message: "ใช้แท็บอัปโหลดสลิปบน /shop/topup — ตรวจที่บริการกลางก่อนเติมเครดิต",
        };
      },

      spin: () => {
        const s = get();
        if (!s.loggedIn) return { ok: false, message: "เข้าสู่ระบบก่อนหมุน", prizeIndex: 0 };
        if (s.spinsLeft <= 0) return { ok: false, message: "สิทธิ์หมุนหมดแล้ว", prizeIndex: 0 };
        const prize = pickWeighted(wheelPrizes);
        const prizeIndex = wheelPrizes.findIndex((p) => p.id === prize.id);
        let message = `ได้ ${prize.label}`;
        const order: Order = {
          id: uid("whl"),
          name: `กงล้อ · ${prize.label}`,
          price: 0,
          at: Date.now(),
          kind: "wheel",
          status: "success",
        };
        const patch: Partial<ShopState> = {
          spinsLeft: s.spinsLeft - 1,
          orders: [order, ...s.orders],
          logs: [log("user", "wheel", prize.label), ...s.logs],
        };
        if (prize.kind === "wallet") {
          patch.balance = s.balance + prize.value;
          order.payload = `+฿${prize.value}`;
        } else if (prize.kind === "box") {
          patch.boxes = s.boxes + 1;
          order.payload = "กล่องสุ่ม +1";
        } else if (prize.kind === "product") {
          const productId = "productId" in prize ? prize.productId : undefined;
          const product = catalog.find((p) => p.id === productId);
          if (product) {
            order.payload = deliverPayload(product);
            order.productId = product.id;
            message = `ได้ ${product.name}`;
          }
        } else {
          order.payload = "ไม่ได้รางวัลเงิน — ลองใหม่รอบหน้า";
        }
        set(patch);
        return { ok: true, message, prizeIndex };
      },

      openBox: () => {
        const s = get();
        if (!s.loggedIn) return { ok: false, message: "เข้าสู่ระบบก่อน", tier: "" };
        const price = 35;
        const usingFree = s.boxes > 0;
        if (!usingFree && s.balance < price) return { ok: false, message: "ยอดไม่พอ", tier: "" };
        const roll = Math.random() * 100;
        let acc = 0;
        let tier = boxTiers[0];
        for (const t of boxTiers) {
          acc += t.chance;
          if (roll <= acc) {
            tier = t;
            break;
          }
        }
        const item = tier.items[Math.floor(Math.random() * tier.items.length)];
        let payload = item.name;
        const patch: Partial<ShopState> = {
          boxes: usingFree ? s.boxes - 1 : s.boxes,
          balance: usingFree ? s.balance : s.balance - price,
        };
        if (item.kind === "wallet") {
          patch.balance = (patch.balance ?? s.balance) + item.value;
          payload = `+฿${item.value}`;
        } else if (item.productId) {
          const product = catalog.find((p) => p.id === item.productId);
          if (product) payload = `${product.name}\n${deliverPayload(product)}`;
        }
        const order: Order = {
          id: uid("box"),
          name: `กล่องสุ่ม · ${tier.label}`,
          price: usingFree ? 0 : price,
          at: Date.now(),
          kind: "box",
          status: "success",
          payload,
        };
        set({
          ...patch,
          orders: [order, ...s.orders],
          logs: [log("user", "box", `${tier.label} · ${item.name}`), ...s.logs],
        });
        return { ok: true, message: `${tier.label}: ${item.name}`, tier: tier.id };
      },

      redeem: (code) => {
        const s = get();
        if (!s.loggedIn) return { ok: false, message: "เข้าสู่ระบบก่อน" };
        const key = code.trim().toUpperCase();
        const gift = giftCodes[key];
        if (!gift) return { ok: false, message: "โค้ดไม่ถูกต้อง" };
        if (gift.once && s.redeemed.includes(key)) return { ok: false, message: "ใช้โค้ดนี้ไปแล้ว" };
        const order: Order = {
          id: uid("gft"),
          name: `โค้ด ${key}`,
          price: 0,
          at: Date.now(),
          kind: "gift",
          status: "success",
          payload: `+฿${gift.credit}`,
        };
        set({
          balance: s.balance + gift.credit,
          redeemed: [...s.redeemed, key],
          orders: [order, ...s.orders],
          logs: [log("user", "redeem", key), ...s.logs],
        });
        return { ok: true, message: `รับ ฿${gift.credit} จากโค้ด ${key}` };
      },

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
          claims: s.claims.map((c) => (c.id === id ? { ...c, reply, status: "replied" as const } : c)),
          logs: [log("admin", "claim-reply", id), ...s.logs],
        }));
      },

      adjustBalance: (delta, reason) => {
        set((s) => ({
          balance: Math.max(0, s.balance + delta),
          logs: [log("admin", "adjust", `${delta > 0 ? "+" : ""}${delta} · ${reason}`), ...s.logs],
        }));
      },

      setWalletFee: (fee) => set({ walletFee: fee }),
      setSlipProvider: (p) =>
        set((s) => ({
          slipProvider: p,
          logs: [log("admin", "provider", `สลับเป็น ${p}`), ...s.logs],
        })),
      setBanner: (text) => set({ banner: text }),
      setNavFlag: (key, value) =>
        set((s) => ({ navFlags: { ...s.navFlags, [key]: value } })),
    }),
    {
      name: "velt-shop-v1",
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
