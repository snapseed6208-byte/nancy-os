import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight, FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { useDeleteReaderBook, useImportEpub, useReaderBooks } from "@/lib/hooks/useEnglishReader";
import type { ReaderBook } from "@/lib/reader/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function EnglishReaderLibrary() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: books = [], isLoading, error } = useReaderBooks();
  const importEpub = useImportEpub();
  const deleteBook = useDeleteReaderBook();
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    try {
      const book = await importEpub.mutateAsync(file);
      navigate(`/english/reader/${book.id}`);
    } catch (uploadFailure) {
      setUploadError((uploadFailure as Error).message || "EPUB 导入失败");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate("/english")} title="返回 English OS" className="h-9 w-9 shrink-0 rounded-lg bg-ink/5 flex items-center justify-center hover:bg-ink/10">
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-ink-lighter">English OS</p>
            <h1 className="text-2xl font-semibold mt-0.5">英文阅读</h1>
            <p className="text-sm text-ink-light mt-1">我的书架 · EPUB 原著 · 阅读进度</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importEpub.isPending}
          className="h-10 px-3 rounded-lg bg-ink text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 self-end sm:self-auto"
        >
          {importEpub.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          导入 EPUB
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </header>

      {importEpub.isPending && (
        <div className="border border-sage/40 bg-sage-light/45 rounded-lg px-4 py-3 flex items-center gap-3">
          <Loader2 size={17} className="animate-spin text-sage-deep" />
          <div>
            <p className="text-sm font-medium">正在解析章节</p>
            <p className="text-xs text-ink-lighter mt-0.5">文件会在本机解析，再保存正文。</p>
          </div>
        </div>
      )}

      {uploadError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{uploadError}</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {!isLoading && books.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-64 border border-dashed border-border rounded-lg bg-card flex flex-col items-center justify-center gap-3 text-center px-6"
        >
          <span className="h-11 w-11 rounded-lg bg-sage-light flex items-center justify-center text-sage-deep">
            <FileUp size={21} />
          </span>
          <span>
            <span className="block text-sm font-semibold">上传第一本英文原著</span>
            <span className="block text-xs text-ink-lighter mt-1">EPUB · 最大 25MB</span>
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              onOpen={() => navigate(`/english/reader/${book.id}`)}
              onDelete={() => {
                if (window.confirm(`删除《${book.title}》及阅读记录？`)) deleteBook.mutate(book.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookRow({ book, onOpen, onDelete }: { book: ReaderBook; onOpen: () => void; onDelete: () => void }) {
  const progress = Math.round(book.reading_progress?.percentage || 0);
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex gap-3">
      <button type="button" onClick={onOpen} className="flex flex-1 min-w-0 gap-3 text-left">
        <span className="w-14 h-20 shrink-0 rounded-md bg-ink text-white flex items-end p-2">
          <BookOpen size={18} />
        </span>
        <span className="flex-1 min-w-0 py-0.5">
          <span className="block text-sm font-semibold truncate">{book.title}</span>
          <span className="block text-xs text-ink-lighter truncate mt-1">{book.author || "Unknown author"}</span>
          <span className="block text-[11px] text-ink-lighter mt-2">{book.chapter_count} 章 · {formatBytes(book.file_size)}</span>
          <span className="flex items-center gap-2 mt-2">
            <span className="h-1.5 flex-1 bg-ink/5 rounded-full overflow-hidden">
              <span className="block h-full bg-sage-deep rounded-full" style={{ width: `${progress}%` }} />
            </span>
            <span className="text-[10px] text-ink-lighter w-8 text-right">{progress}%</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-ink-lighter self-center" />
      </button>
      <button type="button" onClick={onDelete} title="删除书籍" className="h-8 w-8 shrink-0 rounded-md text-ink-lighter hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
