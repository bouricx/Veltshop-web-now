import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPublicProduct } from "@/lib/shop/actions";
import { ProductGrid } from "@/components/shop/product-grid";
export const Route = createFileRoute("/shop/product/$id")({
  loader: async ({ params }) => {
    const product = await getPublicProduct({ data: { id: params.id } });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? loaderData.name + " — Veltshop" : "สินค้า — Veltshop" },
      {
        name: "description",
        content: loaderData?.description?.slice(0, 160) || loaderData?.subtitle || "สินค้าดิจิทัล",
      },
      { property: "og:title", content: loaderData?.name ?? "Veltshop" },
    ],
  }),
  component: ProductPage,
});
function ProductPage() {
  const product = Route.useLoaderData();
  return (
    <div>
      <Link to="/shop/catalog" search={{ cat: undefined }} className="text-sm text-muted">
        ← สินค้าทั้งหมด
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">{product.name}</h1>
      <p className="mt-2 text-muted">{product.subtitle}</p>
      {product.description ? (
        <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
          {product.description}
        </p>
      ) : null}
      <div className="mt-6">
        <ProductGrid onlyProductId={product.id} />
      </div>
    </div>
  );
}
