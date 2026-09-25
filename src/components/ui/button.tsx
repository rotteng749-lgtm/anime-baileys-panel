import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-wide transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/40 bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/35%),0_3px_0_oklch(0.16_0.05_264),0_10px_22px_-12px_oklch(0.7_0.16_220/80%)] hover:brightness-110",
        destructive:
          "border border-destructive/50 bg-gradient-to-b from-destructive to-destructive/80 text-white shadow-[inset_0_1px_0_oklch(1_0_0/25%),0_3px_0_oklch(0.16_0.05_264)] hover:brightness-110",
        outline:
          "border border-edge bg-gradient-to-b from-surface-3 to-surface text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/16%),0_3px_0_oklch(0.16_0.05_264)] hover:border-edge-strong hover:brightness-110",        secondary:
          "border border-edge/70 bg-gradient-to-b from-surface-2 to-surface text-secondary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/12%),0_2px_0_oklch(0.16_0.05_264)] hover:brightness-110",
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
