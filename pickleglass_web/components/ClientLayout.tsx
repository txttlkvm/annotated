'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SearchPopup from '@/components/SearchPopup'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const isOverlay = pathname === '/overlay' || pathname?.startsWith('/overlay')

  useEffect(() => {
    if (isOverlay) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOverlay])

  // Overlay route is a bare transparent Electron window — no PickleGlass chrome
  if (isOverlay) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={setIsSidebarCollapsed}
        onSearchClick={() => setIsSearchOpen(true)}
      />
      <main className="flex-1 overflow-auto bg-white">
        {children}
      </main>

      <SearchPopup
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  )
} 