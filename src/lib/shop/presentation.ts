import type { Product } from "./catalog";

/** WCAG relative luminance: choose the higher-contrast black/white foreground. */
export function contrastText(color: string): "#ffffff" | "#000000" {
  if (!/^#[a-f\d]{6}$/i.test(color)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(color.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
export type CatalogSort = "recommended" | "price-asc" | "price-desc" | "name" | "stock";
export function selectProducts(
  products: Product[],
  options: {
    category: string;
    query: string;
    sort: CatalogSort;
    inStock: boolean;
    categories: { id: string; label: string }[];
    onlyProductId?: string;
    featuredOnly?: boolean;
  },
) {
  const labels = new Map(options.categories.map((c) => [c.id, c.label]));
  const words = options.query.trim().toLocaleLowerCase("th").split(/\s+/).filter(Boolean);
  const result = products.filter(
    (p) =>
      labels.has(p.category) &&
      (!options.onlyProductId || p.id === options.onlyProductId) &&
      (!options.featuredOnly || p.featured) &&
      (options.category === "all" || p.category === options.category) &&
      (!options.inStock || p.stock > 0) &&
      words.every((word) =>
        `${p.id} ${p.name} ${p.subtitle} ${p.description ?? ""} ${p.category} ${labels.get(p.category)}`
          .toLocaleLowerCase("th")
          .includes(word),
      ),
  );
  return result.sort((a, b) => {
    if (options.sort === "price-asc") return a.price - b.price || a.id.localeCompare(b.id);
    if (options.sort === "price-desc") return b.price - a.price || a.id.localeCompare(b.id);
    if (options.sort === "stock") return b.stock - a.stock || a.id.localeCompare(b.id);
    if (options.sort === "name")
      return a.name.localeCompare(b.name, "th") || a.id.localeCompare(b.id);
    return (
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      a.name.localeCompare(b.name, "th")
    );
  });
}
