'use client'

import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'

type Platform = 'ios' | 'android' | null

export function PwaInstallHint() {
  const [platform, setPlatform] = useState<Platform>(null)

  useEffect(() => {
    const detect = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true

      if (standalone) return

      const ua = navigator.userAgent.toLowerCase()
      if (/iphone|ipad|ipod/.test(ua)) {
        setPlatform('ios')
      } else if (/android/.test(ua)) {
        setPlatform('android')
      }
    }
    detect()
  }, [])

  if (!platform) return null

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
      <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {platform === 'ios'
          ? 'Para recibir notificaciones, agrega ResidentPass a tu pantalla de inicio.'
          : 'Puedes instalar ResidentPass desde el menú de Chrome → Instalar app.'}
      </p>
    </div>
  )
}
