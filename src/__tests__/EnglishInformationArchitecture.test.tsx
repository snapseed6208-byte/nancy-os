import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import English from "@/pages/English";
import EnglishExpressionHub from "@/pages/EnglishExpressionHub";
import EnglishSpeakingHub from "@/pages/EnglishSpeakingHub";
import EnglishProgressHub from "@/pages/EnglishProgressHub";

const navigate = vi.fn();
let speakingSessions: Array<{ id: string; created_at: string; title?: string; prompt?: string }> = [];
let readerBooks: Array<{ id: string; reading_progress?: { updated_at: string; percentage: number } }> = [];
let reviewStatus = { total: 31, completed: 15, remaining: 16, hasSession: true, dayComplete: false };

vi.mock("wouter", () => ({ useLocation: () => ["/english", navigate] }));
vi.mock("@/lib/hooks/useEnglish", () => ({
  useEnglishStats: () => ({ data: { total: 120, due: 16, mastered: 20, totalSessions: 8, todayReviewed: 3, reviewStreak: 4 }, isError: false, isLoading: false }),
  useSpeakingStats: () => ({ data: { totalSessions: 8, practiceDays: 5, avgScore: 7.2 }, isError: false, isLoading: false }),
  useSpeakingSessions: () => ({ data: speakingSessions, isError: false, isLoading: false }),
}));
vi.mock("@/lib/hooks/useReviewSession", () => ({
  useHubSessionProgress: () => ({ data: { allDone: false } }),
  useTodayReviewStatus: () => ({ data: reviewStatus, isError: false }),
  useLearnQueueCount: () => ({ data: 6, isError: false }),
  useTodayLearnSession: () => ({ data: { session: null, items: [] }, isError: false }),
  isLearnItemFinished: (item: { status?: string }) => item.status === "completed" || item.status === "passed",
}));
vi.mock("@/lib/hooks/useEnglishReader", () => ({
  useReaderBooks: () => ({ data: readerBooks, isError: false }),
}));

afterEach(cleanup);
beforeEach(() => {
  navigate.mockClear();
  speakingSessions = [];
  readerBooks = [];
  reviewStatus = { total: 31, completed: 15, remaining: 16, hasSession: true, dayComplete: false };
});

describe("English OS information architecture", () => {
  it("keeps TEM8 outside the English learning hubs", () => {
    render(<English />);
    expect(screen.getByRole("button", { name: /表达学习/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /英语口语/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /英文阅读/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /学习分析/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /专八词汇|TEM8/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "今日英语" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "快捷入口" })).not.toBeInTheDocument();
    expect(screen.queryByText("搜索表达库")).not.toBeInTheDocument();
    expect(screen.queryByText("主动回忆")).not.toBeInTheDocument();
    expect(screen.queryByText("语境填空")).not.toBeInTheDocument();
    expect(screen.queryByText("个人造句")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /英文阅读/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/reading");
    fireEvent.click(screen.getByRole("button", { name: /学习分析/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/progress");
  });

  it("offers reading only after today's speaking is complete", () => {
    speakingSessions = [{ id: "speaking-1", created_at: new Date().toISOString() }];
    readerBooks = [{ id: "book-1", reading_progress: { updated_at: "2024-01-01T00:00:00.000Z", percentage: 30 } }];
    reviewStatus = { total: 31, completed: 31, remaining: 0, hasSession: true, dayComplete: true };
    render(<English />);
    fireEvent.click(screen.getByRole("button", { name: /继续阅读/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/reading");
  });

  it("navigates from each lightweight hub to existing business pages", () => {
    const expressionView = render(<EnglishExpressionHub />);
    fireEvent.click(screen.getByRole("button", { name: /学习新表达/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/learn");
    fireEvent.click(screen.getByRole("button", { name: /表达库/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/library");
    fireEvent.click(screen.getByRole("button", { name: /导入表达/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/import");
    expect(screen.queryByRole("button", { name: /学习历史/ })).not.toBeInTheDocument();
    expressionView.unmount();

    const speakingView = render(<EnglishSpeakingHub />);
    fireEvent.click(screen.getByRole("button", { name: /开始口语练习/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/speaking/practice");
    fireEvent.click(screen.getByRole("button", { name: /导入口语题库/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/speaking/import");
    expect(screen.queryByRole("button", { name: /情境与主题表达/ })).not.toBeInTheDocument();
    speakingView.unmount();

    render(<EnglishProgressHub />);
    fireEvent.click(screen.getByRole("button", { name: /学习历史/ }));
    expect(navigate).toHaveBeenLastCalledWith("/english/history");
    expect(screen.queryByRole("button", { name: /回到口语中心|口语记录/ })).not.toBeInTheDocument();
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
      "/english/speaking/progress",
      "/english/reading",
      "/english/reading/library",
      "/english/reading/book/:bookId",
      "/english/reading/articles",
      "/english/reading/history",
      "/english/reader",
      "/english/reader/:bookId",
      "/english/history",
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
