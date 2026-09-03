import { Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Plan from "@/pages/Plan";
import Career from "@/pages/Career";
import English from "@/pages/English";
import EnglishExpressionHub from "@/pages/EnglishExpressionHub";
import EnglishExpressions from "@/pages/EnglishExpressions";
import EnglishExpressionDetail from "@/pages/EnglishExpressionDetail";
import EnglishReview from "@/pages/EnglishReview";
import EnglishReviewV3 from "@/pages/EnglishReviewV3";
import EnglishLearn from "@/pages/EnglishLearn";
import EnglishSpeaking from "@/pages/EnglishSpeaking";
import EnglishSpeakingHub from "@/pages/EnglishSpeakingHub";
import SpeakingImport from "@/pages/SpeakingImport";
import EnglishProgress from "@/pages/EnglishProgress";
import EnglishProgressHub from "@/pages/EnglishProgressHub";
import EnglishLearningHistory from "@/pages/EnglishLearningHistory";
import EnglishImport from "@/pages/EnglishImport";
import EnglishReader from "@/pages/EnglishReader";
import EnglishReaderLibrary from "@/pages/EnglishReaderLibrary";
import EnglishReadingHub from "@/pages/EnglishReadingHub";
import EnglishReadingHistory from "@/pages/EnglishReadingHistory";
import EnglishArticleLibrary from "@/pages/EnglishArticleLibrary";
import EnglishArticleReader from "@/pages/EnglishArticleReader";
import Health from "@/pages/Health";
import Exam from "@/pages/Exam";
import LifeTrace from "@/pages/LifeTrace";
import LifeTraceCapture from "@/pages/LifeTraceCapture";
import LifeTraceJournal from "@/pages/LifeTraceJournal";
import LifeTraceJournalEntry from "@/pages/LifeTraceJournalEntry";
import LifeTraceDailyRecord from "@/pages/LifeTraceDailyRecord";
import LifeTraceMood from "@/pages/LifeTraceMood";
import LifeTraceMoney from "@/pages/LifeTraceMoney";
import Ideas from "@/pages/Ideas";
import Review from "@/pages/Review";
import HabitLab from "@/pages/HabitLab";
import HabitLabNew from "@/pages/HabitLabNew";
import HabitLabDetail from "@/pages/HabitLabDetail";
import HabitLabReview from "@/pages/HabitLabReview";
import ReviewHistory from "@/pages/ReviewHistory";
import ReviewDetail from "@/pages/ReviewDetail";
import Reflection from "@/pages/Reflection";
import MemoryCenter from "@/pages/MemoryCenter";
import Settings from "@/pages/Settings";
import AIHealth from "@/pages/AIHealth";
import Resources from "@/pages/Resources";
import ChineseSpeaking from "@/pages/ChineseSpeaking";
import ChineseSpeakingSession from "@/pages/ChineseSpeakingSession";
import ChineseSpeakingHistory from "@/pages/ChineseSpeakingHistory";
import ChineseSpeakingDetail from "@/pages/ChineseSpeakingDetail";
import ChineseMaterialNew from "@/pages/ChineseMaterialNew";
import ExpressionAssetLibrary from "@/pages/ExpressionAssetLibrary";
import ExpressionAssetDetail from "@/pages/ExpressionAssetDetail";
import NancyAIDashboard from "@/pages/NancyAIDashboard";
import { Loader2 } from "lucide-react";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard/ai" component={NancyAIDashboard} />
        <Route path="/plan" component={Plan} />
        <Route path="/career" component={Career} />
        <Route path="/english" component={English} />
        <Route path="/english/expressions" component={EnglishExpressionHub} />
        <Route path="/english/library" component={EnglishExpressions} />
        <Route path="/english/library/:id" component={EnglishExpressionDetail} />
        <Route path="/english/expressions/:id" component={EnglishExpressionDetail} />
        <Route path="/english/learn" component={EnglishLearn} />
        <Route path="/english/review" component={EnglishReviewV3} />
        <Route path="/english/speaking" component={EnglishSpeakingHub} />
        <Route path="/english/speaking/practice" component={EnglishSpeaking} />
        <Route path="/english/speaking/import" component={SpeakingImport} />
        <Route path="/english/progress" component={EnglishProgressHub} />
        <Route path="/english/progress/speaking" component={EnglishProgress} />
        <Route path="/english/speaking/progress" component={EnglishProgress} />
        <Route path="/english/history" component={EnglishLearningHistory} />
        <Route path="/english/import" component={EnglishImport} />
        <Route path="/english/reading" component={EnglishReadingHub} />
        <Route path="/english/reading/library" component={EnglishReaderLibrary} />
        <Route path="/english/reading/book/:bookId" component={EnglishReader} />
        <Route path="/english/reading/articles" component={EnglishArticleLibrary} />
        <Route path="/english/reading/article/:resourceId" component={EnglishArticleReader} />
        <Route path="/english/reading/history" component={EnglishReadingHistory} />
        <Route path="/english/reader" component={EnglishReaderLibrary} />
        <Route path="/english/reader/:bookId" component={EnglishReader} />
        <Route path="/health" component={Health} />
        <Route path="/exam" component={Exam} />
        <Route path="/life-trace" component={LifeTrace} />
        <Route path="/life-trace/capture" component={LifeTraceCapture} />
        <Route path="/life-trace/daily" component={LifeTraceDailyRecord} />
        <Route path="/life-trace/journal" component={LifeTraceJournal} />
        <Route path="/life-trace/journal/:date" component={LifeTraceJournalEntry} />
        <Route path="/life-trace/mood" component={LifeTraceMood} />
        <Route path="/life-trace/money" component={LifeTraceMoney} />
        <Route path="/ideas" component={Ideas} />
        <Route path="/review" component={Review} />
        <Route path="/review/history" component={ReviewHistory} />
        <Route path="/habits" component={HabitLab} />
        <Route path="/habits/new" component={HabitLabNew} />
        <Route path="/habits/:id" component={HabitLabDetail} />
        <Route path="/habits/:id/review" component={HabitLabReview} />
        <Route path="/review/date/:date" component={ReviewDetail} />
        <Route path="/reflection" component={Reflection} />
        <Route path="/memory-center" component={MemoryCenter} />
        <Route path="/resources" component={Resources} />
        <Route path="/chinese" component={ChineseSpeaking} />
        <Route path="/chinese/material/new" component={ChineseMaterialNew} />
        <Route path="/chinese/session/:id" component={ChineseSpeakingSession} />
        <Route path="/chinese/history" component={ChineseSpeakingHistory} />
        <Route path="/chinese/detail/:id" component={ChineseSpeakingDetail} />
        <Route path="/chinese/assets" component={ExpressionAssetLibrary} />
        <Route path="/chinese/assets/:id" component={ExpressionAssetDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/settings/ai-health" component={AIHealth} />
      </Switch>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
