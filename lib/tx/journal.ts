// Saga journal — rollback thủ công cho hệ không có transaction (Google Sheets).
// Mỗi bước commit đăng ký một hàm undo (compensation). Nếu một bước fail,
// chạy undo của các bước ĐÃ hoàn thành theo THỨ TỰ NGƯỢC.
//
// Lưu ý: undo cũng có thể fail (Sheets 429/lỗi). rollback() KHÔNG ném lỗi —
// nó trả về báo cáo từng bước để caller quyết định (vd cờ needsManualFix).

export interface SagaStep<T> {
  name: string
  do: () => Promise<T>
  // undo nhận lại đúng result của do() để biết cần đảo ngược gì (id vừa tạo, dòng đã chụp...)
  undo?: (result: T) => Promise<void>
}

export interface RollbackResult {
  name: string
  ok: boolean
  error?: string
}

export class Journal {
  private done: { name: string; result: any; undo?: (r: any) => Promise<void> }[] = []

  /** Chạy 1 bước; nếu thành công ghi vào nhật ký kèm undo. Nếu do() ném, KHÔNG ghi (bước chưa xảy ra). */
  async run<T>(step: SagaStep<T>): Promise<T> {
    const result = await step.do()
    this.done.push({ name: step.name, result, undo: step.undo as any })
    return result
  }

  /** Đảo ngược các bước đã hoàn thành theo thứ tự ngược. Không ném; trả báo cáo. */
  async rollback(): Promise<RollbackResult[]> {
    const report: RollbackResult[] = []
    for (let i = this.done.length - 1; i >= 0; i--) {
      const s = this.done[i]
      if (!s.undo) {
        report.push({ name: s.name, ok: true })
        continue
      }
      try {
        await s.undo(s.result)
        report.push({ name: s.name, ok: true })
      } catch (e: any) {
        report.push({ name: s.name, ok: false, error: e?.message || String(e) })
      }
    }
    return report
  }

  completedSteps(): string[] {
    return this.done.map((d) => d.name)
  }
}
