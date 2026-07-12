import { resolveSlipNodeText } from '@/lib/slip-template'
import type { SlipContext } from '@/lib/slip-template'
import type { SlipTemplate } from '@/lib/supabase/types'

interface Props {
  template: SlipTemplate
  ctx: SlipContext
}

// Positions every node in real mm, matching the slip box's print dimensions
// exactly — the same component (just wrapped differently) powers both the
// printed slip and the designer's live preview.
export function CustomSlipNodes({ template, ctx }: Props) {
  return (
    <div className="absolute inset-0">
      {template.nodes.map((node) =>
        node.fieldKey === 'box' ? (
          <div
            key={node.id}
            className="absolute border border-black"
            style={{
              left: `${node.x}mm`,
              top: `${node.y}mm`,
              width: `${node.width}mm`,
              height: `${node.height ?? 20}mm`,
            }}
          />
        ) : (
          <p
            key={node.id}
            className="absolute whitespace-pre-line leading-snug"
            style={{
              left: `${node.x}mm`,
              top: `${node.y}mm`,
              width: `${node.width}mm`,
              fontSize: `${node.fontSize}pt`,
              fontWeight: node.bold ? 700 : 400,
              textAlign: node.align,
            }}
          >
            {resolveSlipNodeText(node, ctx)}
          </p>
        )
      )}
    </div>
  )
}
