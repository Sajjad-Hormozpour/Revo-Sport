import type { KeyboardEvent } from "react";
import { CreditCard, Crown, Receipt } from "lucide-react";
import { useStore } from "../../lib/store";
import { coachPlanList } from "../../data/plans";
import { fa } from "../../lib/core";
import CoachPlans from "./CoachPlans";
import { Billing } from "./CoachHub";

export type SubscriptionTab = "plans" | "payments";

export default function CoachSubscriptions({
  tab,
  onTabChange,
  onToast,
}: {
  tab: SubscriptionTab;
  onTabChange: (tab: SubscriptionTab) => void;
  onToast: (title: string, description: string) => void;
}) {
  const { data, session } = useStore();
  const tabs = [
    { id: "plans" as const, label: "پلن‌های اشتراک", icon: Crown, count: coachPlanList(data, session?.userId).length },
    { id: "payments" as const, label: "فاکتورها و پرداخت‌ها", icon: Receipt, count: data.invoices.length },
  ];

  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowLeft") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowRight") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onTabChange(tabs[next].id);
    document.getElementById(`coach-subscription-tab-${tabs[next].id}`)?.focus();
  };

  return (
    <div className="screen-in mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-[19px] font-black">
          <CreditCard size={20} className="text-[#e9e400]" /> اشتراک و پرداخت
        </h2>
        <p className="mt-1 text-[12px] leading-6 text-[var(--color-mute)]">
          مدیریت پلن‌ها، صدور فاکتور و پیگیری پرداخت‌های شاگردان در یک بخش.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="مدیریت اشتراک و پرداخت"
        className="flex gap-1 border-b border-[var(--color-line)]"
      >
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`coach-subscription-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`coach-subscription-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => onTabChange(item.id)}
            onKeyDown={(event) => navigateTabs(event, index)}
            className={`press -mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-[12px] font-black outline-none transition-colors focus-visible:bg-[var(--color-card)] sm:gap-2 sm:px-4 sm:text-[13px] ${
              tab === item.id
                ? "border-[#e9e400] text-[#e9e400]"
                : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            <item.icon size={16} />
            {item.label}
            <span className="tnum rounded-full bg-[var(--color-card2)] px-2 py-0.5 text-[10px]">
              {fa(item.count)}
            </span>
          </button>
        ))}
      </div>

      {/* Keep both panels mounted so switching tabs preserves unfinished edits. */}
      <section
        id="coach-subscription-panel-plans"
        role="tabpanel"
        aria-labelledby="coach-subscription-tab-plans"
        hidden={tab !== "plans"}
      >
        <CoachPlans onToast={onToast} />
      </section>
      <section
        id="coach-subscription-panel-payments"
        role="tabpanel"
        aria-labelledby="coach-subscription-tab-payments"
        hidden={tab !== "payments"}
      >
        <Billing onToast={onToast} />
      </section>
    </div>
  );
}