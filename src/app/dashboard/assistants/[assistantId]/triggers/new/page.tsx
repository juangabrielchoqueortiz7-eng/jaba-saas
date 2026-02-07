'use client'

import { useParams } from 'next/navigation'
import TriggerBuilder from '../TriggerBuilder'

export default function NewTriggerPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    return <TriggerBuilder assistantId={assistantId} />
}
