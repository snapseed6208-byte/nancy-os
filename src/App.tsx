import { Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Plan from "@/pages/Plan";
import Career from "@/pages/Career";
import English from "@/pages/English";
import EnglishExpressions from "@/pages/EnglishExpressions";
import EnglishExpressionDetail from "@/pages/EnglishExpressionDetail";
import EnglishReview from "@/pages/EnglishReview";
import EnglishSpeaking from "@/pages/EnglishSpeaking";
import SpeakingImport from "@/pages/SpeakingImport";
import EnglishProgress from "@/pages/EnglishProgress";
import EnglishImport from "@/pages/EnglishImport";
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
        <Route path="/plan" component={Plan} />
        <Route path="/career" component={Career} />
        <Route path="/english" component={English} />
        <Route path="/english/expressions" component={EnglishExpressions} />
        <Route path="/english/expressions/:id" component={EnglishExpressionDetail} />
        <Route path="/english/review" component={EnglishReview} />
        <Route path="/english/speaking" component={EnglishSpeaking} />
        <Route path="/english/speaking/import" component={SpeakingImport} />
        <Route path="/english/progress" component={EnglishProgress} />
        <Route path="/english/import" component={EnglishImport} />
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
        <Route path="/review/date/:date" component={ReviewDetail} />
        <Route path="/reflection" component={Reflection} />
        <Route path="/memory-center" component={MemoryCenter} />
        <Route path="/resources" component={Resources} />
        <Route path="/chinese" component={ChineseSpeaking} />
        <Route path="/chinese/material/new" component={ChineseMaterialNew} />
        <Route path="/chinese/session/:id" component={ChineseSpeakingSession} />
        <Route path="/chinese/history" component={ChineseSpeakingHistory} />
        <Route path="/chinese/detail/:id" component={ChineseSpeakingDetail} />
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
