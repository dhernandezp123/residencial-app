'use client'

import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'sonner'

type EventQrCardProps = {
  qrDataUrl: string
  eventTitle: string
  shareUrl: string
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, data] = dataUrl.split(',')
  const mime = metadata.match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mime })
}

export function EventQrCard({
  qrDataUrl,
  eventTitle,
  shareUrl,
}: EventQrCardProps) {
  const [sharing, setSharing] = useState(false)

  const fileName = `evento-${eventTitle
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.png`

  const handleShare = async () => {
    setSharing(true)

    try {
      const blob = dataUrlToBlob(qrDataUrl)
      const file = new File([blob], fileName, { type: 'image/png' })

      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share({
          title: eventTitle,
          text: `QR de acceso para ${eventTitle}`,
          files: [file],
        })
        return
      }

      downloadBlob(blob, fileName)
      toast.success('Imagen QR descargada')
    } catch (error) {
      console.error('Error sharing event QR:', error)
      toast.error('No se pudo compartir el QR')
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copiado')
    } catch (error) {
      console.error('Error copying event link:', error)
      toast.error('No se pudo copiar el link')
    }
  }

  return (
    <div className="qr-reveal space-y-3 pb-[env(safe-area-inset-bottom)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 ease-out">
        <Image
          src={qrDataUrl}
          alt="Código QR del evento"
          width={256}
          height={256}
          unoptimized
          className="mx-auto aspect-square w-full max-w-64"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={sharing}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15936A] px-4 py-3 font-semibold text-white transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
      >
        {sharing ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Preparando...
          </>
        ) : (
          'Compartir imagen QR'
        )}
      </button>

      <button
        type="button"
        onClick={() => void handleCopyLink()}
        className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 transition-all duration-200 ease-out active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
      >
        Copiar link
      </button>
    </div>
  )
}
