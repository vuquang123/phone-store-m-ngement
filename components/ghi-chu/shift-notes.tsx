"use client";

// ---------------------------------------------------------------------------
// Bảng ghi chú bàn giao — nhân viên gõ việc cần ca sau xử lý, tích ô khi xong.
// Không chia theo ca: mọi ghi chú chưa xong đều hiện cho tới khi có người tích.
// Ai tích thì tên + thời điểm được ghi lại (sheet "Ghi_chu"), không xoá được.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, NotebookPen, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export type NoteStatus = "chua_xu_ly" | "hoan_thanh";

export interface Note {
  id: string;
  noiDung: string;
  nguoiTao: string;
  nguoiHoanThanh?: string;
  createdAt: string;
  completedAt?: string;
  status: NoteStatus;
}

const VN_TZ = "Asia/Ho_Chi_Minh";
/** Số ghi chú đã xong hiện mặc định — phần còn lại xem ở trang Ghi chú. */
const DONE_PREVIEW = 5;

/** Luôn hiện NGÀY/THÁNG/NĂM giờ:phút theo giờ VN — không phó mặc cho locale máy. */
function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: VN_TZ,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

async function fetchNotes(): Promise<Note[]> {
  const res = await fetch("/api/ghi-chu", { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!json?.success)
    throw new Error(json?.error || `Lỗi tải ghi chú (${res.status})`);
  return (json.items as Note[]) || [];
}

export function ShiftNotes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [noiDung, setNoiDung] = useState("");
  const [showAllDone, setShowAllDone] = useState(false);

  const { data, isLoading, error } = useQuery<Note[]>({
    queryKey: ["ghi-chu"],
    queryFn: fetchNotes,
    staleTime: 30_000,
  });

  const notes = useMemo(() => data ?? [], [data]);

  // Chưa xong: cũ nhất lên đầu (việc tồn lâu nhất cần xử lý trước).
  const chuaXong = useMemo(
    () =>
      notes
        .filter((n) => n.status !== "hoan_thanh")
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")),
    [notes],
  );
  // Đã xong: mới nhất lên đầu.
  const daXong = useMemo(
    () =>
      notes
        .filter((n) => n.status === "hoan_thanh")
        .sort((a, b) =>
          (b.completedAt || "").localeCompare(a.completedAt || ""),
        ),
    [notes],
  );

  const create = useMutation({
    mutationFn: async (value: string) => {
      const res = await fetch("/api/ghi-chu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noiDung: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success)
        throw new Error(json?.error || `Lỗi tạo ghi chú (${res.status})`);
      return json as { telegramSent?: boolean; telegramError?: string };
    },
    onSuccess: (json) => {
      setNoiDung("");
      qc.invalidateQueries({ queryKey: ["ghi-chu"] });
      qc.invalidateQueries({ queryKey: ["tong-ket-ca"] });
      toast({
        title: "Đã lưu ghi chú",
        description: json?.telegramSent
          ? "Đã gửi vào nhóm Telegram — mục Ghi chú."
          : `Ghi chú đã lưu, nhưng Telegram báo lỗi: ${json?.telegramError || "không rõ"}`,
      });
    },
    onError: (e: unknown) => {
      toast({
        title: "Lưu thất bại",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    },
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/ghi-chu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success)
        throw new Error(json?.error || `Lỗi cập nhật (${res.status})`);
      return json as { nguoiHoanThanh?: string };
    },
    onSuccess: (json) => {
      qc.invalidateQueries({ queryKey: ["ghi-chu"] });
      qc.invalidateQueries({ queryKey: ["tong-ket-ca"] });
      toast({
        title: "Đã đánh dấu hoàn thành",
        description: json?.nguoiHoanThanh
          ? `Ghi nhận: ${json.nguoiHoanThanh}`
          : undefined,
      });
    },
    onError: (e: unknown) => {
      toast({
        title: "Cập nhật thất bại",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    },
  });

  const completingId = complete.isPending
    ? (complete.variables as string | undefined)
    : undefined;
  const danhSachDaXong = showAllDone ? daXong : daXong.slice(0, DONE_PREVIEW);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          Ghi chú bàn giao
          <Badge variant="secondary" className="ml-auto">
            {chuaXong.length} việc tồn
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ô nhập */}
        <div className="space-y-2">
          <Textarea
            placeholder="Việc cần ca sau xử lý… (Ctrl/⌘ + Enter để lưu)"
            value={noiDung}
            onChange={(e) => setNoiDung(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                noiDung.trim()
              ) {
                create.mutate(noiDung.trim());
              }
            }}
            rows={2}
            className="resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Ghi chú được gửi vào nhóm Telegram, mục Ghi chú.
            </p>
            <Button
              size="sm"
              onClick={() => create.mutate(noiDung.trim())}
              disabled={create.isPending || !noiDung.trim()}
            >
              {create.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Lưu ghi chú
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {(error as Error).message}
          </p>
        )}

        {/* Chưa xong */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải ghi chú…
          </div>
        ) : chuaXong.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Không còn việc nào đang chờ. 👍
          </p>
        ) : (
          <ul className="space-y-2">
            {chuaXong.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <Checkbox
                  id={`note-${n.id}`}
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={false}
                  disabled={complete.isPending}
                  onCheckedChange={(checked) => {
                    if (checked) complete.mutate(n.id);
                  }}
                  aria-label="Đánh dấu hoàn thành"
                />
                <label
                  htmlFor={`note-${n.id}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span className="block whitespace-pre-wrap break-words text-sm">
                    {n.noiDung}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {n.nguoiTao || "—"} · {fmtDateTime(n.createdAt)}
                  </span>
                </label>
                {completingId === n.id && (
                  <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Đã xong — giữ lại để biết ai đã tích */}
        {daXong.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Đã hoàn thành ({daXong.length})
            </p>
            <ul className="space-y-2">
              {danhSachDaXong.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <span className="block whitespace-pre-wrap break-words text-muted-foreground line-through">
                      {n.noiDung}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {n.nguoiTao || "—"} tạo ·{" "}
                      <b className="font-medium text-foreground">
                        {n.nguoiHoanThanh || "—"}
                      </b>{" "}
                      hoàn thành lúc {fmtDateTime(n.completedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {daXong.length > DONE_PREVIEW && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowAllDone((v) => !v)}
              >
                {showAllDone
                  ? "Thu gọn"
                  : `Xem thêm ${daXong.length - DONE_PREVIEW} ghi chú`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
