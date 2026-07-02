'use client'

import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'sonner'

type EventQrCardProps = {
  qrDataUrl: string
  eventTitle: string
  hostName: string
  houseLabel: string
  eventDate: string
  validUntil: string
  guestCount: number
  shareUrl: string
}

type CardLine = {
  label: string
  value: string
}

const cardWidth = 1086
const cardHeight = 1448
const templatePath = '/visit-card-template.png'

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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar el QR'))
    image.src = src
  })
}

function normalizeDisplayName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatCardDate(value: string) {
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function setResponsiveFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontWeight: number,
  maxSize: number,
  minSize: number,
) {
  let fontSize = maxSize

  while (fontSize > minSize) {
    context.font = `${fontWeight} ${fontSize}px Arial`

    if (context.measureText(text).width <= maxWidth) {
      return fontSize
    }

    fontSize -= 1
  }

  context.font = `${fontWeight} ${minSize}px Arial`
  return minSize
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word

    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine
      return
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const renderedLine =
      index === maxLines - 1 && lines.length > maxLines
        ? `${line.replace(/\.$/, '')}...`
        : line
    context.fillText(renderedLine, x, y + index * lineHeight)
  })
}

export function EventQrCard({
  qrDataUrl,
  eventTitle,
  hostName,
  houseLabel,
  eventDate,
  validUntil,
  guestCount,
  shareUrl,
}: EventQrCardProps) {
  const [sharing, setSharing] = useState(false)

  const fileName = `evento-${eventTitle
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.png`

  const generateEventCardBlob = async () => {
    const [templateImage, qrImage] = await Promise.all([
      loadImage(templatePath),
      loadImage(qrDataUrl),
    ])
    const canvas = document.createElement('canvas')
    canvas.width = cardWidth
    canvas.height = cardHeight
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No se pudo preparar la imagen')
    }

    context.drawImage(templateImage, 0, 0, cardWidth, cardHeight)

    const qrSize = 520
    const qrX = (cardWidth - qrSize) / 2
    const qrY = 248
    context.fillStyle = '#ffffff'
    context.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48)
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

    context.textAlign = 'center'
    context.fillStyle = '#15936A'
    context.font = '700 22px Arial'
    context.fillText('VISITA GRUPAL', cardWidth / 2, 805)

    context.fillStyle = '#14231C'
    setResponsiveFont(context, normalizeDisplayName(eventTitle), 760, 800, 44, 31)
    drawWrappedText(
      context,
      normalizeDisplayName(eventTitle),
      cardWidth / 2,
      855,
      760,
      50,
      2,
    )

    const badgeText = `${guestCount} INVITADOS`
    context.font = '700 26px Arial'
    const badgeWidth = Math.max(275, context.measureText(badgeText).width + 58)
    const badgeX = (cardWidth - badgeWidth) / 2
    const badgeY = 895
    context.fillStyle = '#15936A'
    context.beginPath()
    context.roundRect(badgeX, badgeY, badgeWidth, 50, 25)
    context.fill()
    context.fillStyle = '#ffffff'
    context.fillText(badgeText, cardWidth / 2, badgeY + 34)

    const invitationLines = [
      `${normalizeDisplayName(hostName)} te ha invitado a una visita grupal,`,
      'presenta este QR en la garita de Seguridad',
    ]
    const invitationFontSize = Math.min(
      ...invitationLines.map((line) =>
        setResponsiveFont(context, line, 840, 700, 24, 19),
      ),
    )
    context.font = `700 ${invitationFontSize}px Arial`
    context.fillStyle = '#14231C'
    context.fillText(invitationLines[0], cardWidth / 2, 970)
    context.fillText(invitationLines[1], cardWidth / 2, 1000)

    const lines: CardLine[] = [
      { label: 'Anunciado por', value: normalizeDisplayName(hostName) },
      { label: 'Casa', value: houseLabel },
      { label: 'Fecha', value: formatCardDate(eventDate) },
      { label: 'Valido hasta', value: formatCardDate(validUntil) },
      { label: 'Invitados', value: String(guestCount) },
    ]

    context.textAlign = 'left'
    const firstColumnX = 195
    const secondColumnX = 565
    const firstRowY = 1048
    const rowGap = 66
    const columnWidth = 330

    lines.forEach((line, index) => {
      const isSecondColumn = index % 2 === 1
      const columnX = isSecondColumn ? secondColumnX : firstColumnX
      const rowY = firstRowY + Math.floor(index / 2) * rowGap

      context.font = '700 18px Arial'
      context.fillStyle = '#15936A'
      context.fillText(line.label.toUpperCase(), columnX, rowY)
      context.fillStyle = '#14231C'
      setResponsiveFont(context, line.value, columnWidth, 700, 22, 17)
      drawWrappedText(context, line.value, columnX, rowY + 28, columnWidth, 26, 2)
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la tarjeta del evento'))
          return
        }

        resolve(blob)
      }, 'image/png')
    })
  }

  const handleShare = async () => {
    setSharing(true)

    try {
      const blob = await generateEventCardBlob()
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
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-lg shadow-slate-200/80 transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/20">
        <div className="bg-[#15936A] px-5 py-4 text-center text-white">
          <p className="text-sm font-black tracking-wide">ResidentPass</p>
          <p className="mt-1 text-xs font-semibold text-white/80">
            Presenta este codigo en garita
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="text-center">
            <p className="text-xs font-bold uppercase text-[#15936A]">Evento</p>
            <h2 className="mt-1 text-xl font-black leading-tight text-slate-950 dark:text-white">
              {eventTitle}
            </h2>
          </div>

          <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-700/50">
            <Image
              src={qrDataUrl}
              alt="Codigo QR del evento"
              width={320}
              height={320}
              unoptimized
              className="mx-auto aspect-square w-full max-w-72"
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
              <dt className="text-xs font-bold text-slate-500">Anfitrion</dt>
              <dd className="mt-1 font-black text-slate-950 dark:text-white">
                {hostName}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
              <dt className="text-xs font-bold text-slate-500">Casa</dt>
              <dd className="mt-1 font-black text-slate-950 dark:text-white">
                {houseLabel}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
              <dt className="text-xs font-bold text-slate-500">Fecha</dt>
              <dd className="mt-1 font-black text-slate-950 dark:text-white">
                {formatCardDate(eventDate)}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
              <dt className="text-xs font-bold text-slate-500">Valido hasta</dt>
              <dd className="mt-1 font-black text-slate-950 dark:text-white">
                {formatCardDate(validUntil)}
              </dd>
            </div>
          </dl>

          <p className="rounded-2xl bg-[#EAF6F0] px-4 py-3 text-center text-sm font-black text-[#15936A]">
            {guestCount} invitados
          </p>
        </div>
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
