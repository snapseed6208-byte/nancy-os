import { useState } from "react";
import { useLocation } from "wouter";
import type { useVocabulary } from "@/lib/hooks/useVocabulary";
import type { VocabularyQuestion, VocabularyWord, TestMode } from "@/lib/english/vocabulary";
import VocabularyCard from "./VocabularyCard";
import VocabularyPractice from "./VocabularyPractice";

export default function VocabularyWordDetail({ word, model }: { word: VocabularyWord; model: ReturnType<typeof useVocabulary> }) {
  const [, navigate] = useLocation();
  const [test, setTest] = useState<VocabularyQuestion | null>(null);
  async function startTest(mode: TestMode) {
    setTest(await model.question.mutateAsync({ wordId: word.id, mode }));
  }
  return <>
    <VocabularyCard word={word} model={model} onTest={startTest} />
    {test && <VocabularyPractice key={test.attemptId} test={test} onSubmit={answer => model.submit.mutateAsync({ attemptId: test.attemptId, answer })} onClose={() => setTest(null)} onNext={() => { setTest(null); navigate("/tem8/vocabulary/today"); }} />}
  </>;
}
