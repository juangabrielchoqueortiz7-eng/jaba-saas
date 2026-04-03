'use client'

import type { WizardStep } from './wizard-utils'

interface PhonePreviewProps {
  steps: WizardStep[]
  flowName: string
}

export default function PhonePreview({ steps, flowName }: PhonePreviewProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="w-[280px] rounded-[28px] bg-[#0b141a] shadow-2xl border border-black/20 overflow-hidden">
        {/* Status bar */}
        <div className="h-6 bg-[#0b141a] flex items-center justify-center">
          <div className="w-16 h-1.5 rounded-full bg-[#1a2730]" />
        </div>

        {/* WhatsApp header */}
        <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#2a3942] flex items-center justify-center text-[10px]">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{flowName || 'Mi Bot'}</p>
            <p className="text-[10px] text-[#8696a0]">en linea</p>
          </div>
        </div>

        {/* Chat area */}
        <div
          className="bg-[#0b141a] min-h-[360px] max-h-[420px] overflow-y-auto p-3 space-y-2"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'a\' patternUnits=\'userSpaceOnUse\' width=\'30\' height=\'30\'%3E%3Cpath d=\'M15 0v30M0 15h30\' stroke=\'%23111b21\' fill=\'none\' stroke-width=\'.3\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%230b141a\'/%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23a)\'/%3E%3C/svg%3E")' }}
        >
          {steps.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-[11px] text-[#8696a0] text-center">
                Agrega pasos para ver<br />la vista previa aqui
              </p>
            </div>
          ) : (
            steps.map((step, i) => (
              <StepPreview key={step.id} step={step} index={i} />
            ))
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#1f2c34] px-2 py-2 flex items-center gap-2">
          <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5">
            <p className="text-[10px] text-[#8696a0]">Escribe un mensaje...</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center">
            <span className="text-white text-[10px]">▶</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="h-4 bg-[#0b141a]" />
      </div>
    </div>
  )
}

function StepPreview({ step, index }: { step: WizardStep; index: number }) {
  switch (step.type) {
    case 'trigger':
      return (
        <div className="flex justify-center">
          <div className="bg-[#182229] rounded-lg px-3 py-1.5 border border-[#233138]">
            <p className="text-[9px] text-[#8696a0] text-center">
              ⚡ El cliente escribe: <span className="text-[#00a884]">{step.config.keywords || '...'}</span>
            </p>
          </div>
        </div>
      )

    case 'message':
      return (
        <BotBubble text={step.config.text || 'Escribe tu mensaje...'} />
      )

    case 'buttons':
      return (
        <div className="space-y-1">
          <BotBubble text={step.config.text || 'Elige una opcion:'} />
          <div className="ml-1 space-y-1">
            {(step.config.buttons || []).map((btn: any, i: number) => (
              <div key={i} className="bg-[#1f2c34] border border-[#2a3942] rounded-lg px-3 py-1.5 text-center">
                <p className="text-[10px] text-[#53bdeb] font-medium">{btn.title || `Opcion ${i + 1}`}</p>
              </div>
            ))}
          </div>
        </div>
      )

    case 'list':
      return (
        <div className="space-y-1">
          <BotBubble text={step.config.text || 'Selecciona una opcion:'} />
          <div className="ml-1">
            <div className="bg-[#1f2c34] border border-[#2a3942] rounded-lg px-3 py-1.5 text-center">
              <p className="text-[10px] text-[#53bdeb] font-medium">📋 {step.config.button_text || 'Ver opciones'}</p>
            </div>
          </div>
        </div>
      )

    case 'question':
      return (
        <div className="space-y-1.5">
          <BotBubble text={step.config.text || 'Escribe tu pregunta...'} />
          <UserBubble text={`[${step.config.variable_name || 'respuesta'}]`} />
        </div>
      )

    case 'ai_response':
      return (
        <div className="flex items-start gap-1.5">
          <div className="bg-[#005c4b] rounded-tr-lg rounded-br-lg rounded-bl-lg px-2.5 py-1.5 max-w-[85%]">
            <p className="text-[10px] text-[#e9edef] leading-relaxed">
              🤖 <span className="italic text-[#8696a0]">La IA respondera inteligentemente aqui...</span>
            </p>
          </div>
        </div>
      )

    case 'action': {
      const actionLabel = step.config.action_type === 'add_tag' ? `Etiqueta: ${step.config.tag || '...'}` :
                           step.config.action_type === 'remove_tag' ? `Quitar: ${step.config.tag || '...'}` :
                           step.config.action_type === 'send_image' ? 'Enviar imagen' : 'Accion'
      return (
        <div className="flex justify-center">
          <div className="bg-[#182229] rounded-lg px-3 py-1.5 border border-[#233138]">
            <p className="text-[9px] text-[#8696a0] text-center">⚙️ {actionLabel}</p>
          </div>
        </div>
      )
    }

    case 'delay':
      return (
        <div className="flex justify-center">
          <div className="bg-[#182229] rounded-lg px-3 py-1 border border-[#233138]">
            <p className="text-[9px] text-[#8696a0] text-center">⏱️ Pausa {step.config.seconds || 2}s</p>
          </div>
        </div>
      )

    default:
      return null
  }
}

function BotBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start">
      <div className="bg-[#005c4b] rounded-tr-lg rounded-br-lg rounded-bl-lg px-2.5 py-1.5 max-w-[85%]">
        <p className="text-[10px] text-[#e9edef] leading-relaxed whitespace-pre-wrap break-words">
          {text.replace(/\{\{contact_name\}\}/g, 'Juan').replace(/\{\{phone_number\}\}/g, '+591...').substring(0, 200)}
        </p>
        <p className="text-[7px] text-[#8696a0] text-right mt-0.5">12:00</p>
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end">
      <div className="bg-[#1f2c34] rounded-tl-lg rounded-bl-lg rounded-br-lg px-2.5 py-1.5 max-w-[75%]">
        <p className="text-[10px] text-[#8696a0] italic leading-relaxed">{text}</p>
        <p className="text-[7px] text-[#8696a0] text-right mt-0.5">12:01</p>
      </div>
    </div>
  )
}
