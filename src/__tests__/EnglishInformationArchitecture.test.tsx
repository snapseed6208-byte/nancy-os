import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import English from "@/pages/English";
import EnglishExpressionHub from "@/pages/EnglishExpressionHub";
import EnglishSpeakingHub from "@/pages/EnglishSpeakingHub";
import EnglishProgressHub from "@/pages/EnglishProgressHub";

const navigate = vi.fn();

vi.mock("wouter", () => ({ useLocation: () => ["/english", navigate] }));
vi.mock("@/lib/hooks/useEnglish", () => ({
  useEnglishStats: () => ({ data: { total: 120, due: 16, mastered: 20, totalSessions: 8, todayReviewed: 3, reviewStreak: 4 }, isError: false, isLoading: false }),
  useSpeakingStats: () => ({ data: { totalSessions: 8, practiceDays: 5, avgScore: 7.2 }, isError: false, isLoading: false }),
  useSpeakingSessions: () => ({ data: [], isError: false, isLoading: false }),
}));
vi.mock("@/lib/hooks/useReviewSession", () => ({
  useHubSessionProgress: () => ({ data: { allDone: false } }),
  useTodayReviewStatus: () => ({ data: { total: 31, completed: 15, remaining: 16 }, isError: false }),
  useLearnQueueCount: () => ({ data: 6, isError: false }),
  useTodayLearnSession: () => ({ data: { session: null, items: [] }, isError: false }),
  isLearnItemFinished: (item: { status?: string }) => item.status === "completed" || item.status === "passed",
}));
vi.mock("@/lib/hooks/useEnglishReader", () => ({
  useReaderBooks: () => ({ data: [], isError: false }),
}));

afterEach(cleanup);
beforeEach(() => navigate.mockClear());

describe("English OS information architecture", () => {
  it("renders exactly four primary learning hubs on /english", () => {
    render(<English />);
    expect(screen.getByRole("heading", { name: "表达学习" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "英语口语" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "英文阅读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "学习成长" })).toBeInTheDocument();
    expect(screen.queryByText("主动回忆")).not.toBeInTheDocument();
    expect(screen.queryByText("语境填空")).not.toBeInTheDocument();
    expect(screen.queryByText("个人造句")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /英文阅读/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/reading");
    fireEvent.click(screen.getByRole("button", { name: /学习成长/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/progress");
  });

  it("navigates from each lightweight hub to existing business pages", () => {
    const expressionView = render(<EnglishExpressionHub />);
    fireEvent.click(screen.getByRole("button", { name: /学习新表达/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/learn");
    fireEvent.click(screen.getByRole("button", { name: /表达库/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/library");
    expressionView.unmount();

    const speakingView = render(<EnglishSpeakingHub />);
    fireEvent.click(screen.getByRole("button", { name: /开始口语练习/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/speaking/practice");
    speakingView.unmount();

    render(<EnglishProgressHub />);
    fireEvent.click(screen.getByRole("button", { name: /学习历史/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/history");
  });

  it("keeps canonical pages and legacy aliases registered", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const expressionDetail = readFileSync("src/pages/EnglishExpressionDetail.tsx", "utf8");
    for (const route of [
      "/english/learn",
      "/english/review",
      "/english/library",
      "/english/expressions/:id",
      "/english/speaking/practice",
      "/english/reading",
      "/english/reading/library",
      "/english/reading/book/:bookId",
      "/english/reading/articles",
      "/english/reading/history",
      "/english/reader",
      "/english/progress/speaking",
    ]) expect(app).toContain(`path="${route}"`);
    expect(expressionDetail).toContain('useRoute("/english/library/:id")');
    expect(expressionDetail).toContain('useRoute("/english/expressions/:id")');
  });

  it("uses single-column mobile hubs without horizontal scrolling", () => {
    const home = readFileSync("src/pages/English.tsx", "utf8");
    const hubs = [
      readFileSync("src/pages/EnglishExpressionHub.tsx", "utf8"),
      readFileSync("src/pages/EnglishSpeakingHub.tsx", "utf8"),
      readFileSync("src/pages/EnglishProgressHub.tsx", "utf8"),
    ].join("\n");
    expect(home).toContain("grid grid-cols-1 sm:grid-cols-2");
    expect(hubs).toContain("grid grid-cols-1 sm:grid-cols-2");
    expect(`${home}\n${hubs}`).not.toContain("overflow-x-auto");
  });
});
