// Overlay route gets its own minimal layout — no ClientLayout wrapper, transparent body
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          margin: 0; padding: 0;
          background: transparent !important;
          overflow: hidden;
        }
      `}</style>
      {children}
    </>
  )
}
