/** Human-authored semantic expectations, not recordings of live model outputs. */
export const speakingCases = [
  {
    id: "A", question: "Do you enjoy cooking?", mode: "light",
    input: "I enjoy cooking because it helps me unwind after a busy day. I usually makes simple meals with fresh vegetables, and I like sharing them with my family. It is a relaxing way to spend time together.",
    final: "I enjoy cooking because it helps me unwind after a busy day. I usually make simple meals with fresh vegetables, and I like sharing them with my family. It is a relaxing way to spend time together.",
    summary: "保留你的内容和顺序。只把 I usually makes 改为 I usually make。", notice: "",
    reference: "Cooking can also be a creative hobby. Trying different combinations of ingredients is a simple way to experiment and learn something new.",
  },
  {
    id: "B", question: "Do you prefer working from home?", mode: "expand",
    input: "I prefer working from home because it's convenient.",
    final: "I prefer working from home because it's convenient.",
    summary: "保留原观点。建议你补充具体方便在哪里，但不替你编造新的理由。", notice: "",
    reference: "An office can be useful when a task calls for close teamwork. Being in the same room makes it easier to ask a quick question and solve problems together.",
  },
  {
    id: "C", question: "Why do you like cycling?", mode: "structure",
    input: "It saves money on transport. I cycle to work. It also gives me exercise. My main reason is staying active. I don't need a separate workout.",
    final: "I cycle to work mainly because it helps me stay active. It gives me exercise, so I don't need a separate workout. It also saves money on transport.",
    summary: "保留运动和节省交通费两点。先说明主要原因，再解释结果，最后补充次要好处。", notice: "",
    reference: "Cycling can be a pleasant way to explore a neighborhood. At a slower pace, it is easier to notice small shops and parks along the way.",
  },
  {
    id: "D", question: "Why do you like cooking?", mode: "trim",
    input: "I like cooking because I can choose fresh ingredients. My school has five buildings. My address is near a bus stop. The weather is sunny today. Choosing fresh ingredients matters to me.",
    final: "I like cooking because I can choose fresh ingredients. That matters to me.",
    summary: "保留选择新鲜食材的原因。删除与做饭无关的学校、住址和天气信息，合并重复内容。", notice: "",
    reference: "Cooking can bring people together. For example, a group of friends could each prepare one dish and share a meal.",
  },
  {
    id: "E", question: "Do you prefer big cities?", mode: "rewrite",
    input: "Big city good. My school wall blue. Jobs because more. More jobs. I no like crowd but bus easy. Better city.",
    final: "I prefer big cities because they offer more job opportunities and convenient public transport. Although I don't like crowds, those advantages make city life more appealing to me.",
    summary: "保留工作机会多和交通方便的核心观点。删除学校墙面和重复信息，用让步连接不喜欢拥挤这一点，并修正语法。", notice: "",
    reference: "A big city can offer a rich cultural life. Museums, concerts and community events give people different ways to explore their interests.",
  },
  {
    id: "F", question: "Why is teamwork useful?", mode: "expand",
    input: "Teamwork is useful because people have different skills.",
    final: "Teamwork is useful because people bring different skills to the table.",
    summary: "保留不同技能的观点，优化口语搭配。建议你自己补充一个真实的分工例子。", notice: "",
    reference: "Working with others can also keep people motivated. Regular check-ins give a group a sense of progress and encourage everyone to keep going.",
  },
  {
    id: "G-city", question: "Do you prefer living in big cities?", mode: "structure",
    input: "I like living in big cities because there are more jobs. And actually I don't like crowded places. My boyfriend also lives here. The transport is very convenient. So I think big cities are better.",
    final: "I prefer living in big cities because there are more job opportunities and the public transport is very convenient. Although I don't like crowded places, these advantages make big cities a better choice for me.",
    summary: "保留工作机会多和交通便利两点。删除没有展开说明的男友信息，把不喜欢拥挤作为让步，再收束到你的选择。", notice: "",
    reference: "One reason to choose a big city is its cultural life. There are often museums, concerts and community events to explore. For someone interested in meeting people with different interests, that variety could make everyday life more enjoyable.",
  },
  {
    id: "G-tv", question: "How much time do you spend watching TV?", mode: "light",
    input: "I watch quite a lot of TV. Recently I watched four seasons of Trying in three days because I liked the family relationships. I also watch AI short dramas to unwind.",
    final: "I watch quite a lot of TV. Recently, I watched four seasons of Trying in three days because I liked the family relationships. I also watch AI short dramas to unwind.",
    summary: "保留具体节目、观看时长和原因。只做轻微语言整理。", notice: "",
    reference: "I rarely watch TV during the week. On Sundays I might spend an hour on a documentary, choosing one subject to focus on rather than leaving the screen on in the background.",
  },
] as const;

export function responseFor(c: typeof speakingCases[number]) {
  return {
    final_upgraded_answer: c.final, reference_answer: c.reference, revision_mode: c.mode,
    overall_score: 6, target_score: 7, optimization_summary: c.summary, expansion_notice: c.notice,
    key_issues: [{ type: c.mode === "light" ? "grammar" : c.mode === "structure" ? "structure" : "content",
      message: { light: "一处主谓一致问题。", expand: "观点清楚，但解释和展开不足。", structure: "信息顺序较散，主要理由不够突出。", trim: "有跑题和重复信息。", rewrite: "内容跳跃、重复，并有明显语法问题。" }[c.mode] }],
    takeaway_expressions: [],
    detailed_analysis: { fluencyScore: 6, grammarScore: 6, vocabularyScore: 6, naturalnessScore: 6,
      expressionsUsed: [], expressionsMissed: [], contentAnalysis: { relevanceScore: 6, coherenceScore: 6, developmentScore: 6 } },
  };
}
