'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import TriggerBuilder from '../TriggerBuilder'
import TriggerTemplates, { type TriggerTemplate } from '../TriggerTemplates'

export default function NewTriggerPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    const [selectedTemplate, setSelectedTemplate] = useState<TriggerTemplate | null | 'blank'>(null)

    // Step 1: Show template gallery
    if (selectedTemplate === null) {
        return (
            <TriggerTemplates
                onSelectTemplate={(t) => setSelectedTemplate(t)}
                onStartBlank={() => setSelectedTemplate('blank')}
            />
        )
    }

    // Step 2: TriggerBuilder pre-filled with template (or blank)
    return (
        <TriggerBuilder
            assistantId={assistantId}
            initialTemplate={selectedTemplate === 'blank' ? undefined : selectedTemplate}
        />
    )
}
