/** One connection per page. Polling remains the fallback if the host cannot stream. */
export const SHOP_CHANGED = "veltshop:changed";
export function onShopChange(load: () => void) {
  window.addEventListener(SHOP_CHANGED, load);
  return () => window.removeEventListener(SHOP_CHANGED, load);
}
