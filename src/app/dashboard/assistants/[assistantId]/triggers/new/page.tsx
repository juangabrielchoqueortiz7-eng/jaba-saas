'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import SimpleCreationHub from '@/components/dashboard/SimpleCreationHub'
import TriggerBuilder from '../TriggerBuilder'
import TriggerTemplates, { type TriggerTemplate } from '../TriggerTemplates'

export default function NewTriggerPage() {
    const params = useParams()
    const assistantId = params?.assistantId as string

    const [selectedTemplate, setSelectedTemplate] = useState<TriggerTemplate | null | 'blank'>(null)

    // Step 1: Show template gallery
    if (selectedTemplate === null) {
        return (
            <div className="min-h-screen bg-[#F7F8FA]">
                <div className="mx-auto max-w-7xl p-6 md:p-8">
                    <div className="mb-6">
                        <SimpleCreationHub assistantId={assistantId} surface="triggers" />
                    </div>
                    <TriggerTemplates
                        onSelectTemplate={(t) => setSelectedTemplate(t)}
                        onStartBlank={() => setSelectedTemplate('blank')}
                    />
                </div>
            </div>
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
