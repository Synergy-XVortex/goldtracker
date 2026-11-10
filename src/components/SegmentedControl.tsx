interface SegmentedControlProps<Value extends string | number> {
  label: string
  name: string
  options: ReadonlyArray<{ value: Value; label: string }>
  value: Value
  onChange: (value: Value) => void
  size?: 'small' | 'regular'
}

/** Radio group styled as buttons: keyboard and screen reader friendly by construction. */
export function SegmentedControl<Value extends string | number>({
  label,
  name,
  options,
  value,
  onChange,
  size = 'regular',
}: SegmentedControlProps<Value>) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={String(option.value)}
              className={[
                'cursor-pointer rounded-control text-center font-semibold transition-colors',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                size === 'small' ? 'py-1.5 text-xs' : 'py-2.5 text-sm',
                selected ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-fg',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
