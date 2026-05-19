import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Line: () => React.createElement("canvas", { role: "img" }),
}));
