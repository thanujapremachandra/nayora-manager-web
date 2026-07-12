import { computeCollectableAmount } from '@/lib/pricing'
import { formatRs } from '@/lib/stock-helpers'
import { CustomSlipNodes } from './custom-slip-front'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Settings } from '@/lib/supabase/types'

interface Props {
  order: OrderWithDetails
  settings: Settings
}

// The built-in layout's content, sized to exactly fill a SLIP_BOX_WIDTH_MM ×
// SLIP_BOX_HEIGHT_MM area with no padding of its own — callers provide the
// padding/border (either `.slip-box`'s, for the fixed single-column layout,
// or a CSS scale transform, for the free-placement designer).
export function DefaultSlipFrontContent({ order, settings }: Props) {
  const cod = computeCollectableAmount(order, order.order_items, settings)
  const phones = order.phone2 ? `${order.phone1} / ${order.phone2}` : order.phone1

  return (
    <div className="flex h-full w-full flex-col">
      <h1 className="text-center text-[16pt] font-bold">{settings.business_name}</h1>

      <div className="mt-2 flex flex-1 gap-4">
        <div className="flex-1 text-[9.5pt] leading-loose">
          <p>
            <span className="font-semibold">Name :- </span>
            {order.customer_name}
          </p>
          <p className="whitespace-pre-line">
            <span className="font-semibold">Address :- </span>
            {order.address}
          </p>
          <p>
            <span className="font-semibold">Phone Numbers :- </span>
            {phones}
          </p>
        </div>

        <div className="flex w-[32mm] shrink-0 flex-col items-end justify-start gap-1 text-right">
          <p className="text-[10pt] font-semibold">
            COD <span className="ml-1 font-bold">{formatRs(cod)}</span>
          </p>
          <p className="font-mono text-[9pt] font-semibold">{order.ref_id}</p>
        </div>
      </div>

      <p className="text-center text-[7.5pt] leading-tight text-gray-700">{settings.slip_footer_text}</p>
    </div>
  )
}

// Used by the fixed single-column print layout (DuplexSlipView). The
// free-placement designer renders DefaultSlipFrontContent/CustomSlipNodes
// directly inside its own scale wrapper instead of this.
export function SlipFront({ order, settings }: Props) {
  if (settings.slip_template && settings.slip_template.nodes.length > 0) {
    return (
      <div className="slip-box">
        <CustomSlipNodes
          template={settings.slip_template}
          ctx={{ order, items: order.order_items, settings }}
        />
      </div>
    )
  }

  return (
    <div className="slip-box">
      <DefaultSlipFrontContent order={order} settings={settings} />
    </div>
  )
}
