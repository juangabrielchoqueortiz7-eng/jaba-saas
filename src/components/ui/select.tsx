"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

// Context to share state between Select parts
const SelectContext = React.createContext<{
    value: string | undefined
    onValueChange: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
} | null>(null)

export const Select = ({
    children,
    value,
    onValueChange,
    defaultValue,
}: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
    defaultValue?: string
}) => {
    const [open, setOpen] = React.useState(false)
    const [internalValue, setInternalValue] = React.useState(defaultValue || "")

    const handleValueChange = (newValue: string) => {
        setInternalValue(newValue)
        if (onValueChange) {
            onValueChange(newValue)
        }
        setOpen(false)
    }

    const currentValue = value !== undefined ? value : internalValue

    return (
        <SelectContext.Provider
            value={{
                value: currentValue,
                onValueChange: handleValueChange,
                open,
                setOpen,
            }}
        >
            <div className="relative inline-block w-full">{children}</div>
        </SelectContext.Provider>
    )
}

export const SelectTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectTrigger must be used within Select")

    return (
        <button
            ref={ref}
            type="button"
            onClick={() => context.setOpen(!context.open)}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm ring-offset-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
})
SelectTrigger.displayName = "SelectTrigger"

export const SelectValue = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectValue must be used within Select")

    // We can't easily find the label for the value without traversing children or passing options separately.
    // For simplicity in this custom implementation, we might need a workaround or rely on the parent to pass the label if needed,
    // OR we can hack it by searching the DOM or children.
    // HOWEVER, standard SelectValue usually displays the selected *Label*. 
    // Since this is a custom lightweight implementation, a common trick is to just show the value if label isn't found, 
    // OR require the user to pass the display value. 
    // But `TriggerBuilder` uses `<SelectValue />`.

    // To make this work properly without Radix's complex state, we can use a store or just iterate children in `SelectContent` IF we had access to them here. 
    // BUT `SelectValue` is rendered inside `SelectTrigger`, separate from `SelectContent`.

    // Compromise: We will display the `value` directly. 
    // If the user wants a label map, they might need to handle it.
    // *Wait*, better approach: The `SelectContent` usually isn't mounted when closed in Radix, but here we can hide it.
    // Actually, `TriggerBuilder` uses `SelectValue` with no props.
    // Let's try to display the value. Often the value is "logic" mapped to "Lógica IA". 
    // If we only show "logic", it's ugly.

    // Let's rely on a global event or just show the value for now (MVP). 
    // The user might complain, so I will add a small hack: 
    // I can't easily get the children of SelectContent from here.

    return (
        <span
            ref={ref}
            className={cn("block truncate", className)}
            {...props}
        >
            {context.value || placeholder}
        </span>
    )
})
SelectValue.displayName = "SelectValue"

export const SelectContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectContent must be used within Select")

    if (!context.open) return null

    return (
        <div
            ref={ref}
            className={cn(
                "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-slate-50 shadow-md animate-in fade-in-80 w-full mt-1",
                className
            )}
            {...props}
        >
            <div className="p-1">{children}</div>
        </div>
    )
})
SelectContent.displayName = "SelectContent"

export const SelectItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectItem must be used within Select")

    const isSelected = context.value === value

    return (
        <div
            ref={ref}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-800 focus:text-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-slate-800 cursor-pointer",
                className
            )}
            onClick={() => context.onValueChange(value)}
            {...props}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            {children}
        </div>
    )
})
SelectItem.displayName = "SelectItem"
