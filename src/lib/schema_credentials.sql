-- Create table for WhatsApp Credentials if it doesn't exist
CREATE TABLE IF NOT EXISTS whatsapp_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    phone_number_id TEXT,
    waba_id TEXT,
    app_id TEXT,
    access_token TEXT,
    bot_name TEXT DEFAULT 'Mi Asistente',
    phone_number_display TEXT,
    welcome_message TEXT,
    
    -- AI Configuration
    ai_status TEXT DEFAULT 'active', -- 'active', 'sleep'
    response_delay_seconds INTEGER DEFAULT 5,
    audio_probability INTEGER DEFAULT 0, -- 0 to 100
    message_delivery_mode TEXT DEFAULT 'complete', -- 'complete', 'parts'
    use_emojis BOOLEAN DEFAULT true,
    use_text_styles BOOLEAN DEFAULT true,
    
    -- Audio specific
    audio_voice_id TEXT,
    max_audio_count INTEGER DEFAULT 2,
    reply_audio_with_audio BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own credentials" 
ON whatsapp_credentials FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert, update, delete their own credentials" 
ON whatsapp_credentials FOR ALL 
USING (auth.uid() = user_id);
