import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// app/page → load-tools-data が server-only を使うため、Vitest(jsdom) ではスタブする
vi.mock("server-only", () => ({}));

