'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'

type AccessMode = 'single_use' | 'multi_use'

type VisitQrCardProps = {
  qrDataUrl: string
  qrScanUrl: string
  visitorName: string
  announcedBy: string
  accessMode: AccessMode
  createdAt: string
  validUntil: string
  residentialName: string
  houseLabel: string
}

type CardLine = {
  label: string
  value: string
}

const cardWidth = 1086
const cardHeight = 1536
const templatePath = '/visit-card-template.png'

const accessModeLabels: Record<AccessMode, string> = {
  single_use: 'ACCESO ÚNICO',
  multi_use: 'ACCESO MÚLTIPLE',
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar la imagen QR'))
    image.src = src
  })
}

function normalizeDisplayName(name: string) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
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
    const isLastVisibleLine = index === maxLines - 1 && lines.length > maxLines
    const renderedLine = isLastVisibleLine
      ? `${line.replace(/\.$/, '')}...`
      : line
    context.fillText(renderedLine, x, y + index * lineHeight)
  })

  return Math.min(lines.length, maxLines) * lineHeight
}

function formatCardDate(dateValue: string) {
  const date = new Date(dateValue)

  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
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

export function VisitQrCard({
  qrDataUrl,
  qrScanUrl,
  visitorName,
  announcedBy,
  accessMode,
  createdAt,
  validUntil,
  residentialName,
  houseLabel,
}: VisitQrCardProps) {
  const [sharingImage, setSharingImage] = useState(false)

  const generateVisitCardBlob = async () => {
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

    const displayVisitorName = normalizeDisplayName(visitorName)

    context.textAlign = 'center'
    context.font = '700 22px Arial'
    context.fillStyle = '#ed6216'
    context.fillText('VISITANTE', cardWidth / 2, 825)

    context.fillStyle = '#05234c'
    setResponsiveFont(context, displayVisitorName, 720, 700, 44, 31)
    drawWrappedText(context, displayVisitorName, cardWidth / 2, 875, 720, 50, 2)

    const badgeText = accessModeLabels[accessMode]
    context.font = '700 26px Arial'
    const badgeWidth = Math.max(275, context.measureText(badgeText).width + 58)
    const badgeX = (cardWidth - badgeWidth) / 2
    const badgeY = 960
    context.fillStyle = '#ed6216'
    context.beginPath()
    context.roundRect(badgeX, badgeY, badgeWidth, 50, 25)
    context.fill()
    context.fillStyle = '#ffffff'
    context.fillText(badgeText, cardWidth / 2, badgeY + 34)

    context.font = '700 22px Arial'
    context.fillStyle = '#05234c'
    context.fillText(
      'Presentar este código al ingresar y salir.',
      cardWidth / 2,
      1048,
    )

    const lines: CardLine[] = [
      { label: 'Anunciado por', value: normalizeDisplayName(announcedBy) },
      { label: 'Creado', value: formatCardDate(createdAt) },
      { label: 'Válido hasta', value: formatCardDate(validUntil) },
      { label: 'Residencial', value: residentialName },
      { label: 'Casa', value: houseLabel },
    ]

    context.textAlign = 'left'
    const firstColumnX = 195
    const secondColumnX = 565
    const firstRowY = 1112
    const rowGap = 70
    const columnWidth = 330

    lines.forEach((line, index) => {
      const isSecondColumn = index % 2 === 1
      const columnX = isSecondColumn ? secondColumnX : firstColumnX
      const rowY = firstRowY + Math.floor(index / 2) * rowGap

      context.font = '700 18px Arial'
      context.fillStyle = '#ed6216'
      context.fillText(line.label.toUpperCase(), columnX, rowY)
      context.fillStyle = '#05234c'
      setResponsiveFont(context, line.value, columnWidth, 700, 22, 17)
      drawWrappedText(context, line.value, columnX, rowY + 28, columnWidth, 26, 2)
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen QR'))
          return
        }

        resolve(blob)
      }, 'image/png')
    })
  }

  const handleShareImage = async () => {
    setSharingImage(true)

    try {
      const blob = await generateVisitCardBlob()
      const fileName = `visita-${visitorName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
      const file = new File([blob], fileName, { type: 'image/png' })
      const shareData = {
        title: 'Acceso residencial',
        text: `QR de acceso para ${visitorName}`,
        files: [file],
      }

      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share(shareData)
        return
      }

      downloadBlob(blob, fileName)
      toast.success('Imagen QR descargada')
    } catch (error) {
      console.error('Error sharing QR image:', error)

      try {
        if (navigator.share) {
          await navigator.share({
            title: 'Acceso residencial',
            text: `Visita para ${visitorName}: ${qrScanUrl}`,
            url: qrScanUrl,
          })
        } else {
          window.open(
            `https://wa.me/?text=${encodeURIComponent(
              `Visita para ${visitorName}: ${qrScanUrl}`,
            )}`,
            '_blank',
            'noopener,noreferrer',
          )
        }
      } catch (shareError) {
        console.error('Error sharing QR fallback:', shareError)
        toast.error('No se pudo compartir la imagen QR')
      }
    } finally {
      setSharingImage(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-500">
          Código QR para ingreso
        </p>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <Image
            src={qrDataUrl}
            alt="Código QR para ingreso"
            width={256}
            height={256}
            unoptimized
            className="mx-auto aspect-square w-full max-w-64"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleShareImage()}
        disabled={sharingImage}
        className="min-h-12 w-full rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
      >
        {sharingImage ? 'Preparando imagen...' : 'Compartir imagen QR'}
      </button>

      <a
        href={qrDataUrl}
        download={`visita-${visitorName}.png`}
        className="block min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-center font-semibold text-slate-800 active:scale-[0.99]"
      >
        Descargar QR
      </a>
    </div>
  )
}
