import { createFileRoute } from "@tanstack/react-router";
import { RewardPanel } from "@/components/shop/reward-panel";
import { EmptyGate } from "@/components/shop/shop-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
export const Route = createFileRoute("/shop/wheel")({ component: Page });
function Page() {
  const { user } = useCurrentUserState();
  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">กงล้อนำโชค</h1>
      <EmptyGate>
        <RewardPanel key={user?.id ?? "out"} id="wheel" />
      </EmptyGate>
    </section>
  );
}
