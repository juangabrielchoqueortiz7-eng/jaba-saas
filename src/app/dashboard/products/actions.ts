'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type Product = {
    id: string
    name: string
    description: string | null
    price: number
    category: string
    qr_image_url: string | null
    is_active: boolean
    sort_order: number
    created_at: string
}

export async function getProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Error fetching products:', error)
        return []
    }

    return data as Product[]
}

export async function createProduct(productData: {
    name: string
    description: string
    price: number
    category: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { error } = await supabase
        .from('products')
        .insert({
            user_id: user.id,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            category: productData.category
        })

    if (error) throw error
    revalidatePath('/dashboard/products')
}

export async function updateProduct(id: string, productData: {
    name: string
    description: string
    price: number
    category: string
    is_active: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { error } = await supabase
        .from('products')
        .update({
            name: productData.name,
            description: productData.description,
            price: productData.price,
            category: productData.category,
            is_active: productData.is_active
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/products')
}

export async function deleteProduct(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/products')
}

export async function toggleProduct(id: string, isActive: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { error } = await supabase
        .from('products')
        .update({ is_active: !isActive })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/products')
}
