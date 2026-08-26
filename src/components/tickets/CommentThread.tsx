'use client'

import { useEffect, useRef, useState, useActionState, useTransition } from 'react'
import { AlertCircle, Lock, ImagePlus, X, Loader2, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { cn, timeAgo } from '@/lib/utils'
import {
  addCommentAction,
  uploadCommentImageAction,
  deleteCommentAction,
  type ActionState,
} from '@/server/actions/ticket.actions'
import type { CommentView } from '@/lib/ticket-view'

type PendingImage = {
  id: string
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  error?: string
  uploaded?: { url: string; publicId: string; width: number; height: number }
}

// Keep in sync with MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES in server/actions/ticket.actions.ts —
// checked here too so an oversized file never reaches the network (it would otherwise blow
// past Next's Server Action body-size limit and surface as a raw framework crash).
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function CommentThread({
  ticketNumber,
  comments,
  canComment,
  canNote,
  canDeleteComment,
}: {
  ticketNumber: number
  comments: CommentView[]
  canComment: boolean
  canNote: boolean
  canDeleteComment: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addCommentAction,
    undefined,
  )
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [images, setImages] = useState<PendingImage[]>([])
  const wasPending = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, startUploadTransition] = useTransition()
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [, startDeleteTransition] = useTransition()

  function handleDelete(commentId: string) {
    setConfirmDeleteId(null)
    setDeletingIds((prev) => new Set(prev).add(commentId))
    startDeleteTransition(async () => {
      await deleteCommentAction(ticketNumber, commentId)
    })
  }

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setBody('')
      setIsInternal(false)
      setEditorKey((k) => k + 1)
      setImages([])
    }
    wasPending.current = pending
  }, [pending, state])

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const previewUrl = URL.createObjectURL(file)

      if (file.size > MAX_IMAGE_BYTES) {
        setImages((prev) => [
          ...prev,
          { id, previewUrl, status: 'error', error: 'Image must be under 8MB' },
        ])
        continue
      }
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setImages((prev) => [
          ...prev,
          { id, previewUrl, status: 'error', error: 'Only PNG, JPEG, WEBP, and GIF are allowed' },
        ])
        continue
      }

      setImages((prev) => [...prev, { id, previewUrl, status: 'uploading' }])

      startUploadTransition(async () => {
        try {
          const fd = new FormData()
          fd.set('file', file)
          const result = await uploadCommentImageAction(undefined, fd)
          setImages((prev) =>
            prev.map((img) =>
              img.id === id
                ? result?.image
                  ? { ...img, status: 'done', uploaded: result.image }
                  : { ...img, status: 'error', error: result?.error ?? 'Upload failed' }
                : img,
            ),
          )
        } catch {
          setImages((prev) =>
            prev.map((img) =>
              img.id === id ? { ...img, status: 'error', error: 'Image must be under 8MB' } : img,
            ),
          )
        }
      })
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  const uploadedAttachments = images
    .filter((img) => img.status === 'done' && img.uploaded)
    .map((img) => img.uploaded!)
  const hasUploadingImages = images.some((img) => img.status === 'uploading')
  const visibleComments = comments.filter((c) => !deletingIds.has(c.id))

  return (
    <div className="space-y-5">
      {visibleComments.length === 0 && (
        <p className="text-sm text-muted">No comments yet — be the first to reply.</p>
      )}

      {visibleComments.map((c) => (
        <div
          key={c.id}
          className={cn(
            'group/comment flex gap-3',
            c.isInternal && 'rounded-lg bg-warning-soft/40 p-3',
          )}
        >
          <Avatar
            person={
              c.author
                ? { name: c.author.name, initials: c.author.initials, color: '#818cf8' }
                : { name: 'Unknown', initials: '?', color: '#4b5563' }
            }
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{c.author?.name ?? 'Unknown'}</p>
              {c.isInternal && (
                <span className="flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  <Lock className="h-2.5 w-2.5" /> Internal note
                </span>
              )}
              <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
              {canDeleteComment && (
                <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover/comment:opacity-100">
                  {confirmDeleteId === c.id ? (
                    <>
                      <span className="text-[11px] text-muted-strong">Delete this comment?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-[11px] font-medium text-danger hover:underline"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[11px] text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      aria-label="Delete comment"
                      className="text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {c.bodyHtml && (
              <div
                className="mt-1 text-sm text-muted-strong [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
              />
            )}
            {c.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.attachments.map((a) => (
                  <a
                    key={a.publicId}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border-strong"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt="Comment attachment"
                      className="h-28 w-28 object-cover transition-opacity hover:opacity-90"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {(canComment || canNote) && (
        <form action={formAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="ticketNumber" value={ticketNumber} />
          <input type="hidden" name="isInternal" value={String(isInternal)} />
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="attachments" value={JSON.stringify(uploadedAttachments)} />

          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {state.error}
            </div>
          )}

          <RichTextEditor
            key={editorKey}
            content={body}
            onChange={setBody}
            placeholder={isInternal ? 'Write an internal note…' : 'Write a reply…'}
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {images.map((img) => (
                <div key={img.id} className="flex flex-col items-center gap-1">
                  <div className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border-strong">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                    {img.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {img.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-danger/80">
                        <AlertCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      aria-label="Remove image"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {img.status === 'error' && (
                    <p className="max-w-20 text-center text-[10px] leading-tight text-danger">
                      {img.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {canNote ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-strong">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-border-strong bg-transparent accent-amber-500"
                  />
                  Internal note (not visible to the requester)
                </label>
              ) : (
                <span />
              )}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-strong hover:text-foreground">
                <ImagePlus className="h-4 w-4" />
                Add image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </label>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={
                pending || hasUploadingImages || (!body.trim() && uploadedAttachments.length === 0)
              }
            >
              {pending ? 'Posting…' : isInternal ? 'Add note' : 'Reply'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
