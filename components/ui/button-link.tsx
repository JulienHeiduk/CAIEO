import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'
import { VariantProps } from 'class-variance-authority'

type ButtonLinkProps = {
  href: string
  children: React.ReactNode
  className?: string
} & VariantProps<typeof buttonVariants>

export function ButtonLink({ href, children, className, variant, size }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  )
}
