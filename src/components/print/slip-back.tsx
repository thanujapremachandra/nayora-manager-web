import { orderItemLabel } from '@/lib/order-helpers'
import type { OrderWithDetails } from '@/lib/order-helpers'

interface Props {
  order: OrderWithDetails
}

// Sized to exactly fill a SLIP_BOX_WIDTH_MM × SLIP_BOX_HEIGHT_MM area with
// no padding of its own — see DefaultSlipFrontContent for why.
export function SlipBackContent({ order }: Props) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[12pt] font-bold">{order.ref_id}</h2>
        <p className="text-[8pt] text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
      </div>

      {order.items_text && order.items_text.trim() ? (
        // Written order — print the typed contents instead of a stock item list.
        <p className="mt-2 flex-1 whitespace-pre-wrap text-[9pt]">{order.items_text}</p>
      ) : (
        <ul className="mt-2 flex-1 columns-2 gap-4 text-[9pt]">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 break-inside-avoid">
              <span className="truncate">{orderItemLabel(item)}</span>
              <span className="shrink-0">×{item.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SlipBack({ order }: Props) {
  return (
    <div className="slip-box">
      <SlipBackContent order={order} />
    </div>
  )
}
