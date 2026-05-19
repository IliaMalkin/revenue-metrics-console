import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPICard } from "../components/charts/KPICard";
import type { KPIMetric } from "@dashboard/shared";

const mockMetric: KPIMetric = {
  current: 45230,
  previous: 40000,
  change: 12.5,
  trend: "up",
  sparkline: [40000, 41000, 42000, 43000, 44000, 45230],
};

describe("KPICard", () => {
  it("renders title", () => {
    render(
      <KPICard
        title="Monthly Recurring Revenue"
        metric={mockMetric}
        format={(v) => `$${v.toFixed(0)}`}
      />
    );
    expect(screen.getByText("Monthly Recurring Revenue")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading", () => {
    const { container } = render(
      <KPICard
        title="MRR"
        metric={mockMetric}
        format={(v) => `$${v}`}
        isLoading={true}
      />
    );
    expect(container.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("renders trend indicator for positive change", () => {
    const { container } = render(
      <KPICard
        title="MRR"
        metric={mockMetric}
        format={(v) => `$${v.toFixed(0)}`}
      />
    );
    expect(screen.getByText(/12.5%/)).toBeInTheDocument();
    expect(container.querySelector(".lucide-trending-up")).toBeInTheDocument();
  });

  it("renders downward trend for negative change", () => {
    const downMetric: KPIMetric = {
      ...mockMetric,
      change: -3.2,
      trend: "down",
    };
    const { container } = render(
      <KPICard
        title="Churn Rate"
        metric={downMetric}
        format={(v) => `${v.toFixed(1)}%`}
      />
    );
    expect(container.querySelector(".lucide-trending-down")).toBeInTheDocument();
  });
});
