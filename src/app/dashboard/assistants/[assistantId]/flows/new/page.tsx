'use client'

import { useParams } from 'next/navigation'
import FlowWizard from '../FlowWizard'

export default function NewFlowPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    return <FlowWizard assistantId={assistantId} />
}
