import { Drawer } from '@mui/material'

export type ActionSheetItem = {
  label: string
  destructive?: boolean
  onSelect: () => void
}

type ActionSheetProps = {
  open: boolean
  title?: string
  items: ActionSheetItem[]
  onClose: () => void
}

/** A list of choices from the bottom of the screen, with Cancel underneath (like iOS). */
export function ActionSheet({ open, title, items, onClose }: ActionSheetProps) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} slotProps={{ paper: { className: 'action-sheet' } }}>
      <div className="actions">
        <div className="group">
          {title ? <div className="a-title">{title}</div> : null}
          {items.map((item, index) => (
            <button
              key={`${index}-${item.label}`}
              type="button"
              className={item.destructive ? 'destructive' : undefined}
              onClick={() => {
                onClose()
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Drawer>
  )
}
