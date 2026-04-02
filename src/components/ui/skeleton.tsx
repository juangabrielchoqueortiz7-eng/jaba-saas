import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-black/[0.06]", className)}
            {...props}
        />
    )
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <tr key={i} className="border-b border-black/[0.04]">
                    {Array.from({ length: cols }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                            <Skeleton className={cn("h-4", j === 0 ? "w-32" : "w-20")} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    )
}

function CardSkeleton() {
    return (
        <div className="rounded-lg border border-black/[0.08] bg-white p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
        </div>
    )
}

export { Skeleton, TableSkeleton, CardSkeleton }
