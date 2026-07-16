import { ForceLightTheme } from './force-light-theme'

interface Props {
  orientation?: 'portrait' | 'landscape'
  margin?: string
}

// Shared @page CSS for the print routes. Plain <style> (not styled-jsx) so
// it only exists while a print route is mounted and doesn't leak into the
// rest of the app.
//
// Default (no orientation/margin passed) is the single-column, full-width,
// ~3-per-A4-page layout matching the business's physical pre-printed slip
// booklet. The free-placement designer (Settings → Slip Placement) passes
// its own orientation/margin since it controls the whole page itself.
export function PrintStyles({ orientation = 'portrait', margin = '10mm' }: Props = {}) {
  return (
    <>
    <ForceLightTheme />
    <style>{`
      @page {
        size: A4 ${orientation};
        margin: ${margin};
      }

      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
      }

      .slip-page {
        height: 277mm;
        display: flex;
        flex-direction: column;
        gap: 3mm;
        page-break-after: always;
      }

      .slip-page:last-child {
        page-break-after: auto;
      }

      .slip-box {
        position: relative;
        flex-shrink: 0;
        height: 82mm;
        box-sizing: border-box;
        padding: 4mm 6mm;
        border: 1.5px solid #000;
        display: flex;
        flex-direction: column;
        font-size: 10pt;
        overflow: hidden;
      }
    `}</style>
    </>
  )
}
