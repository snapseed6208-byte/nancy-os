import { fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TEM8Vocabulary from "@/pages/TEM8Vocabulary";
import TEM8Hub from "@/pages/TEM8Hub";
import { Router, Route, Switch, Redirect } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { NAVIGATION_ITEMS } from "@/config/navigation";
import { parseFile } from "@/lib/parsers/fileParsers";
const state=vi.hoisted(()=>({words:[] as unknown[],imports:[] as unknown[],submit:vi.fn(),question:vi.fn(),ai:vi.fn(),refresh:vi.fn(),startDay:vi.fn(),deleteWord:vi.fn(),deleteImport:vi.fn(),createImport:vi.fn(),archive:vi.fn(),plan:undefined as unknown}));
vi.mock("@/lib/hooks/useVocabulary",()=>({useVocabulary:()=>({
  words:{data:state.words,isLoading:false},imports:{data:state.imports,isLoading:false},day:"2026-09-10",
  plan:{data:state.plan === null ? null : {day:"2026-09-10",new_ids:["one"],familiar_ids:[],production_ids:[],target:25}},
  submit:{mutateAsync:state.submit,isPending:false},question:{mutateAsync:state.question,isPending:false},ai:{mutateAsync:state.ai,isPending:false},
  startDay:{mutateAsync:state.startDay,isPending:false},edit:{isPending:false},archive:{mutateAsync:state.archive,isPending:false},dashboard:{data:undefined},history:{data:[]},refresh:state.refresh,createImport:{mutateAsync:state.createImport},deleteWord:{mutateAsync:state.deleteWord},deleteImport:{mutateAsync:state.deleteImport},
})}));
vi.mock("@/lib/supabase",()=>({supabase:{}}));
vi.mock("@/lib/parsers/fileParsers",()=>({parseFile:vi.fn()}));
vi.mock("@/lib/hooks/useReviewSession",()=>({getSavedLearnTarget:()=>10,saveLearnTarget:vi.fn()}));
const sample={id:"one",word:"qualify",pos:"v.",meaning:"限定",type:"familiar",sources:[],enrichment:{core_meaning:"限定",tem8_meaning:"限定说法",english_definition:"limit",pronunciation:"",known_meaning:"有资格",trigger:"claim",trap:"",collocations:[],examples:["They qualify this claim."],register:"formal",recommended_level:"R2",value:"high",schema_version:2},level:"R0",status:"inbox",review_stage:0,due_at:null,error_count:0,version:0};
const test={attemptId:"attempt",mode:"R1",question:{prompt:"Choose the meaning in context.",options:["limit","reject","explain","accept"],audio_text:""},feedback:null};
const feedback={score:100,passed:true,explanation:"语境正确",expected_answer:"to limit a statement",corrected_answer:"",root_cause:"",transferable_rule:"Look at the object",level:"R1",mode:"R1",criteria:{meaning:100,grammar:100,collocation:100,register:100}};
function mount(path="/tem8/vocabulary/library"){
  const location=memoryLocation({path});
  return {...render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Router hook={location.hook}><Switch><Route path="/english/vocabulary"><Redirect to="/tem8/vocabulary" replace /></Route><Route path="/tem8" component={TEM8Hub}/><Route path={/^\/tem8\/vocabulary(?:\/.*)?$/} component={TEM8Vocabulary}/></Switch></Router></QueryClientProvider>),location};
}
async function openTest(){fireEvent.click(screen.getByRole("link",{name:/qualify/}));fireEvent.click(await screen.findByRole("button",{name:"继续学习"}));return await screen.findByRole("dialog");}
beforeEach(()=>{state.words=[{...sample}];state.imports=[];state.plan=undefined;vi.spyOn(window,"scrollTo").mockImplementation(()=>{});vi.clearAllMocks();state.question.mockResolvedValue(test);state.submit.mockResolvedValue(feedback);});
afterEach(cleanup);
describe("TEM8 full vocabulary page",()=>{
  it("saves extracted PDF text even when some pages produced a warning",async()=>{
    vi.mocked(parseFile).mockResolvedValue({text:"qualify 限定",warning:"第 2 页读取失败",fileName:"test.pdf",fileType:"pdf",charCount:10});
    state.createImport.mockResolvedValue({id:"pdf",name:"test.pdf",chunk_count:1,completed_chunks:[]});
    state.ai.mockResolvedValue({saved:1});
    mount("/tem8/vocabulary/import");
    fireEvent.change(screen.getByLabelText("导入词汇文件"),{target:{files:[new File(["pdf"],"test.pdf",{type:"application/pdf"})]}});
    await waitFor(()=>expect(state.createImport).toHaveBeenCalledWith(expect.objectContaining({text:"qualify 限定"})));
    expect(await screen.findByText("第 2 页读取失败")).toBeInTheDocument();
    await waitFor(()=>expect(state.ai).toHaveBeenCalled());
  });
  it("reports saved entries and pauses when the response is incomplete",async()=>{
    state.imports=[{id:"pdf",name:"词表.pdf",chunk_count:3,completed_chunks:[]}];
    state.ai.mockResolvedValueOnce({saved:12,partial:true});mount("/tem8/vocabulary/import");
    fireEvent.click(screen.getByText("继续提取"));
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("已保存 12 条"));
    expect(state.ai).toHaveBeenCalledTimes(1);
  });
  it("keeps an explicit saved count on a later chunk failure",async()=>{
    state.imports=[{id:"pdf",name:"词表.pdf",chunk_count:3,completed_chunks:[]}];
    state.ai.mockResolvedValueOnce({saved:9}).mockRejectedValueOnce(new Error("连接中断"));mount("/tem8/vocabulary/import");
    fireEvent.click(screen.getByText("继续提取"));
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("已保存 9 条"));
    expect(screen.getByRole("alert")).toHaveTextContent("连接中断");
  });
  it("requires confirmation for deleting a word and surfaces failures",async()=>{
    state.deleteWord.mockRejectedValueOnce(new Error("删除失败"));mount();
    fireEvent.click(screen.getByRole("button",{name:"删除qualify"}));
    expect(state.deleteWord).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"取消"}));
    expect(state.deleteWord).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"删除qualify"}));
    fireEvent.click(screen.getByRole("button",{name:"确认删除"}));
    await waitFor(()=>expect(state.deleteWord).toHaveBeenCalledWith("one"));
    expect(await screen.findByRole("alert")).toHaveTextContent("删除失败");
  });
  it("deletes only the selected import after explaining that vocabulary remains",async()=>{
    state.imports=[{id:"pdf",name:"词表.pdf",chunk_count:1,completed_chunks:[0]}];mount("/tem8/vocabulary/import");
    fireEvent.click(screen.getByRole("button",{name:"删除词表.pdf"}));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("已入库词汇和学习进度保留");
    fireEvent.click(screen.getByRole("button",{name:"确认删除"}));
    await waitFor(()=>expect(state.deleteImport).toHaveBeenCalledWith("pdf"));
    expect(state.deleteWord).not.toHaveBeenCalled();
  });
  it("hides the server solution until an answer is submitted",async()=>{
    mount();const dialog=await openTest();expect(within(dialog).queryByText("to limit a statement")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button",{name:"提交答案"})).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText("A. limit"));fireEvent.click(within(dialog).getByRole("button",{name:"提交答案"}));
    await waitFor(()=>expect(state.submit).toHaveBeenCalledWith({attemptId:"attempt",answer:"0"}));
    expect(await within(dialog).findByText("to limit a statement",{exact:false})).toBeInTheDocument();
  });
  it("retains the submitted answer when grading fails and permits retry",async()=>{
    state.submit.mockRejectedValueOnce(new Error("评分服务暂不可用"));mount();const dialog=await openTest();
    fireEvent.click(within(dialog).getByLabelText("A. limit"));fireEvent.click(within(dialog).getByText("提交答案"));
    await waitFor(()=>expect(within(dialog).getByRole("alert")).toHaveTextContent("评分服务暂不可用"));
    expect(within(dialog).getByLabelText("A. limit")).toBeChecked();
    fireEvent.click(within(dialog).getByText("提交答案"));await waitFor(()=>expect(state.submit).toHaveBeenCalledTimes(2));
  });
  it("resumes only incomplete import chunks",async()=>{
    state.imports=[{id:"pdf",name:"词表.pdf",chunk_count:3,completed_chunks:[0,1]}];mount("/tem8/vocabulary/import");
    fireEvent.click(screen.getByText("继续提取"));
    await waitFor(()=>expect(state.ai).toHaveBeenCalledTimes(1));
    expect(state.ai).toHaveBeenCalledWith({action:"extract",importId:"pdf",chunk:2});
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("导入完成"));
  });
  it("automatically enriches only an opened uncached card",async()=>{
    state.words=[{...sample,enrichment:null}];mount();expect(state.ai).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link",{name:/qualify/}));await waitFor(()=>expect(state.ai).toHaveBeenCalledTimes(1));
    expect(state.ai).toHaveBeenCalledWith({action:"enrich",wordId:"one"});
  });
  it("does not regenerate cached cards or daily plans on mount",()=>{
    mount();fireEvent.click(screen.getByRole("link",{name:/qualify/}));expect(state.ai).not.toHaveBeenCalled();expect(state.startDay).not.toHaveBeenCalled();
  });
  it("listening cannot be scored without successful audio playback",async()=>{
    state.question.mockResolvedValue({...test,mode:"listening",question:{prompt:"听音并写出听到的单词或短语",options:[],audio_text:"qualify"}});
    mount();const dialog=await openTest();expect(within(dialog).queryByText("qualify")).not.toBeInTheDocument();fireEvent.change(within(dialog).getByLabelText("你的答案"),{target:{value:"qualify"}});
    expect(within(dialog).getByText("提交答案")).toBeDisabled();
  });
});


describe("TEM8 routing and progressive disclosure",()=>{
  it("redirects old bookmarks to a dashboard without word details",async()=>{
    mount("/english/vocabulary");
    expect(await screen.findByRole("heading",{name:"专八词汇"})).toBeInTheDocument();
    expect(screen.queryByText("qualify")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 学习卡")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索词汇")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/全部词汇/}));
    expect(await screen.findByRole("link",{name:/qualify/})).toBeInTheDocument();
  });
  it("exposes one TEM8 sidebar entry and six disabled future modules",()=>{
    expect(NAVIGATION_ITEMS.filter(item=>item.path.startsWith("/tem8"))).toHaveLength(1);
    expect(NAVIGATION_ITEMS.find(item=>item.id==="vocabulary")).toMatchObject({label:"TEM8 OS",path:"/tem8"});
    expect(NAVIGATION_ITEMS.some(item=>item.path==="/english/vocabulary")).toBe(false);
    mount("/tem8");
    expect(screen.getAllByRole("button").filter(button=>button.hasAttribute("disabled"))).toHaveLength(6);
    fireEvent.click(screen.getByRole("button",{name:/Vocabulary/}));
    expect(screen.getByRole("heading",{name:"专八词汇"})).toBeInTheDocument();
  });
  it("opens deep links with collapsed sources and working archive",async()=>{
    state.words=[{...sample,sources:[{import_id:"pdf",name:"词表.pdf",original:"qualify",context:"RAW_SOURCE"}]}];
    mount("/tem8/vocabulary/word/one");
    expect(screen.getByRole("heading",{name:"AI 学习卡"})).toBeInTheDocument();
    expect(screen.getByText("RAW_SOURCE").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("查看原文")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"暂不学习，归档"}));
    await waitFor(()=>expect(state.archive).toHaveBeenCalledWith({id:"one",archived:true}));
  });
  it("shows completion without a primary study CTA for an empty daily queue",()=>{
    state.words=[];mount("/tem8/vocabulary");
    expect(screen.getByText("今日学习已完成")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"开始今日学习"})).not.toBeInTheDocument();
  });
  it("does not claim completion before a daily plan exists",()=>{
    state.plan=null;mount("/tem8/vocabulary");
    expect(screen.queryByText("今日学习已完成")).not.toBeInTheDocument();
    expect(state.startDay).not.toHaveBeenCalled();
  });
  it("filters status, type and archived words without enriching the list",()=>{
    state.words=[sample,{...sample,id:"two",word:"steady",status:"stable",type:"new"},{...sample,id:"three",word:"archived",archived:true}];
    mount();
    fireEvent.change(screen.getByLabelText("学习状态"),{target:{value:"stable"}});
    expect(screen.getByRole("link",{name:/steady/})).toBeInTheDocument();
    expect(screen.queryByRole("link",{name:/qualify/})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("学习状态"),{target:{value:"archived"}});
    expect(screen.getByRole("link",{name:/archived/})).toBeInTheDocument();
    expect(state.ai).not.toHaveBeenCalled();
  });
});
