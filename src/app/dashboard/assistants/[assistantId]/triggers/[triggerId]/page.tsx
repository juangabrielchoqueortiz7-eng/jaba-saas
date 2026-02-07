'use client'

import { useParams } from 'next/navigation'
import TriggerBuilder from '../TriggerBuilder'

export default function EditTriggerPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string
    const triggerId = params?.triggerId as string

    return <TriggerBuilder assistantId={assistantId} triggerId={triggerId} />
}
