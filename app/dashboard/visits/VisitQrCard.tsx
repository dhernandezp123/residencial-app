'use client'

import Image from 'next/image'

type VisitQrCardProps = {
  qrDataUrl: string
  visitorName: string
}

export function VisitQrCard({ qrDataUrl, visitorName }: VisitQrCardProps) {
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
