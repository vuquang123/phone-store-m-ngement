"use client"
import React, { useCallback, useState } from 'react'

export default function ImagePicker({ onUploaded, onSelectFile, onSelectBlob, onSelectBlobs, immediateUpload = false, orderType }: { onUploaded?: (res: any) => void, onSelectFile?: (dataUrl: string|null, files?: File[])=>void, onSelectBlob?: (blob: Blob|null, file?: File)=>void, onSelectBlobs?: (blobs: Blob[]|null, files?: File[])=>void, immediateUpload?: boolean, orderType?: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  const onSelect = useCallback((fList?: FileList | File[]) => {
    if (!fList || (fList as any).length === 0) return
    const arr = Array.from(fList as any as File[])
    setFiles(arr)
    const first = arr[0]
    if (first) {
      const url = URL.createObjectURL(first)
      setPreview(url)
    }
    // produce base64 array for backward compatibility
    if (onSelectFile) {
      Promise.all(arr.map(f => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (e) => reject(e)
        reader.readAsDataURL(f)
      }))).then(dataUrls => onSelectFile(dataUrls && dataUrls.length ? dataUrls[0] : null, arr)).catch(()=>{})
    }
    // create compressed blobs and notify parent
    (async () => {
      try {
        const blobs: Blob[] = []
        for (const f of arr) {
          try {
            const blob = await compressImageFile(f, 1280, 0.75)
            blobs.push(blob)
            // also call single-file callback for backward compatibility (defer to avoid setState-in-render)
            if (onSelectBlob) queueMicrotask(() => onSelectBlob(blob, f))
          } catch (e) {
            console.warn('compress failed for', f.name, e)
          }
        }
        // defer calling parent callbacks to next microtask to avoid updating parent during render
        if (onSelectBlobs) queueMicrotask(() => onSelectBlobs(blobs, arr))
        // if immediate upload is requested, upload all
        if (immediateUpload) {
          // create temporary File objects from blobs preserving names
          const uploadFiles = blobs.map((b, i) => new File([b], arr[i].name, { type: b.type }))
          setFiles(uploadFiles as any)
          uploadMultiple(uploadFiles).catch(()=>{})
        }
      } catch (e) {
        console.warn('compress batch failed', e)
      }
    })()
    if (immediateUpload) uploadMultiple(arr as File[]).catch(()=>{})
  }, [])

  // compress helper using canvas
  const compressImageFile = (file: File, maxDim = 1280, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const img = document.createElement('img')
        const reader = new FileReader()
        reader.onload = () => {
          img.onload = () => {
            const { width, height } = img
            let newW = width
            let newH = height
            if (width > height && width > maxDim) {
              newW = maxDim
              newH = Math.round((maxDim / width) * height)
            } else if (height > width && height > maxDim) {
              newH = maxDim
              newW = Math.round((maxDim / height) * width)
            } else if (width === height && width > maxDim) {
              newW = newH = maxDim
            }
            const canvas = document.createElement('canvas')
            canvas.width = newW
            canvas.height = newH
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0, newW, newH)
            canvas.toBlob((b) => {
              if (b) resolve(b)
              else reject(new Error('Canvas toBlob returned null'))
            }, file.type || 'image/jpeg', quality)
          }
          img.onerror = (e) => reject(e)
          img.src = String(reader.result)
        }
        reader.onerror = (e) => reject(e)
        reader.readAsDataURL(file)
      } catch (e) { reject(e) }
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
    onSelect(e.dataTransfer.files)
  }, [onSelect])
  const uploadSingle = useCallback(async (f: File) => {
    setLoading(true)
    try {
      const reader = new FileReader()
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (e) => reject(e)
        reader.readAsDataURL(f)
      })
      const res = await fetch('/api/telegram/send-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: data, filename: f.name, caption: '', orderType: orderType || undefined })
      })
      const json = await res.json()
      onUploaded?.(json)
      return json
    } catch (e) {
      console.error(e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [onUploaded])

  const uploadMultiple = useCallback(async (filesToUpload: File[]) => {
    setLoading(true)
    try {
      const form = new FormData()
      for (const f of filesToUpload) form.append('photo', f, f.name)
  if (orderType) form.append('orderType', orderType)
  const res = await fetch('/api/telegram/send-photo', { method: 'POST', body: form })
      const json = await res.json()
      // call onUploaded for backward compat per file
      if (Array.isArray(json?.results)) {
        for (const r of json.results) onUploaded?.(r)
      } else {
        onUploaded?.(json)
      }
      return json
    } catch (e) {
      console.error('uploadMultiple', e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [onUploaded])

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{ border: '1px dashed #ccc', padding: 12, borderRadius: 8 }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && onSelect(e.target.files)}
        />
        <p></p>
        {files.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{f.name}</strong>
                <div style={{ color: '#666', fontSize: 12 }}>{Math.round((f.size || 0) / 1024)} KB</div>
                <button
                  onClick={() => {
                    setFiles(prev => {
                      const next = prev.filter((x, idx) => idx !== i)
                      // Recompute compressed blobs for remaining files and notify parent
                      ;(async () => {
                        try {
                          const blobs: Blob[] = []
                          for (const nf of next) {
                            try {
                              const b = await compressImageFile(nf, 1280, 0.75)
                              blobs.push(b)
                            } catch (e) {
                              // ignore individual compress errors
                            }
                          }
                          if (onSelectBlobs) queueMicrotask(() => onSelectBlobs(blobs.length ? blobs : null, next.length ? next : undefined))
                        } catch (e) {
                          // ignore
                        }
                      })()
                      return next
                    })
                  }}
                  className="text-xs text-red-600"
                >Xóa</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {!immediateUpload && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => uploadMultiple(files)} disabled={files.length===0 || loading} className="btn">
            {loading ? 'Đang gửi...' : `Gửi ${files.length} ảnh kèm thông báo`}
          </button>
        </div>
      )}
    </div>
  )
}
