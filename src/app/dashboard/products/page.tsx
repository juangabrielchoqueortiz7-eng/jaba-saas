'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Plus, Search, Trash2, Edit, Package, ToggleLeft, ToggleRight, X,
    Image as ImageIcon, Upload, Clock, Layers, Briefcase, ShoppingBag,
    Wrench, Grid3X3, Star
} from 'lucide-react'
import { getProducts, createProduct, deleteProduct, toggleProduct, updateProduct, type Product } from './actions'
import { createClient } from '@/utils/supabase/client'

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
    {
        value: 'servicio_digital',
        label: 'Servicio Digital',
        icon: <Star size={18} />,
        color: 'bg-purple-50 text-purple-600 border-purple-200',
        desc: 'Canva, Netflix, ChatGPT, cuentas con acceso',
        extraFields: ['duration_months', 'access_type', 'access_info'],
        showDuration: true,
    },
    {
        value: 'producto',
        label: 'Producto Físico',
        icon: <ShoppingBag size={18} />,
        color: 'bg-orange-50 text-orange-600 border-orange-200',
        desc: 'Ropa, cosméticos, accesorios, artículos',
        extraFields: ['variants', 'stock'],
        showDuration: false,
    },
    {
        value: 'servicio',
        label: 'Servicio Profesional',
        icon: <Briefcase size={18} />,
        color: 'bg-blue-50 text-blue-600 border-blue-200',
        desc: 'Consultas, diseño, reparaciones, asesoría',
        extraFields: ['modality', 'session_duration', 'availability'],
        showDuration: false,
    },
    {
        value: 'plan',
        label: 'Plan / Suscripción',
        icon: <Layers size={18} />,
        color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        desc: 'Membresías, paquetes mensuales, acceso recurrente',
        extraFields: ['duration_months', 'includes'],
        showDuration: true,
    },
    {
        value: 'consulta',
        label: 'Consulta / Sesión',
        icon: <Wrench size={18} />,
        color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
        desc: 'Consultas médicas, psicológicas, técnicas',
        extraFields: ['modality', 'session_duration'],
        showDuration: false,
    },
    {
        value: 'general',
        label: 'General',
        icon: <Grid3X3 size={18} />,
        color: 'bg-[#F7F8FA] text-[#0F172A]/60 border-black/[0.08]',
        desc: 'Otro tipo de producto o servicio',
        extraFields: [],
        showDuration: false,
    },
]

const getCatConfig = (value: string) => CATEGORIES.find(c => c.value === value) || CATEGORIES[5]

// ── Build description with extra fields ─────────────────────────────────────
function buildDescription(base: string, extra: Record<string, string>): string {
    const parts = [base.trim()]
    if (extra.duration_months) parts.push(`Duración: ${extra.duration_months} mes(es)`)
    if (extra.access_type) parts.push(`Tipo de acceso: ${extra.access_type}`)
    if (extra.access_info) parts.push(`Instrucciones de acceso: ${extra.access_info}`)
    if (extra.variants) parts.push(`Variantes disponibles: ${extra.variants}`)
    if (extra.stock) parts.push(`Stock disponible: ${extra.stock}`)
    if (extra.modality) parts.push(`Modalidad: ${extra.modality}`)
    if (extra.session_duration) parts.push(`Duración de sesión: ${extra.session_duration} minutos`)
    if (extra.availability) parts.push(`Disponibilidad: ${extra.availability}`)
    if (extra.includes) parts.push(`Incluye: ${extra.includes}`)
    return parts.filter(Boolean).join('\n')
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [imageUploading, setImageUploading] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: 'general',
        duration_months: '',
        // Extra fields
        access_type: '',
        access_info: '',
        variants: '',
        stock: '',
        modality: '',
        session_duration: '',
        availability: '',
        includes: '',
    })

    useEffect(() => { loadProducts() }, [])

    const loadProducts = async () => {
        const data = await getProducts()
        setProducts(data)
    }

    const resetForm = () => {
        setFormData({ name: '', description: '', price: '', category: 'general', duration_months: '', access_type: '', access_info: '', variants: '', stock: '', modality: '', session_duration: '', availability: '', includes: '' })
        setIsCreating(false)
        setEditingId(null)
        setImagePreview(null)
        setImageUrl(null)
    }

    const setField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }))

    const handleImageUpload = async (file: File) => {
        if (!file) return
        setImageUploading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const ext = file.name.split('.').pop()
            const path = `products/${user.id}_${Date.now()}.${ext}`
            const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
            setImageUrl(publicUrl)
            setImagePreview(URL.createObjectURL(file))
        } catch (e) {
            console.error('Error uploading product image:', e)
        } finally {
            setImageUploading(false)
        }
    }

    const handleCreate = async () => {
        if (!formData.name || !formData.price) return
        const catConfig = getCatConfig(formData.category)
        const extraKeys: Record<string, string> = {}
        if (catConfig.showDuration && formData.duration_months) extraKeys.duration_months = formData.duration_months
        if (formData.access_type) extraKeys.access_type = formData.access_type
        if (formData.access_info) extraKeys.access_info = formData.access_info
        if (formData.variants) extraKeys.variants = formData.variants
        if (formData.stock) extraKeys.stock = formData.stock
        if (formData.modality) extraKeys.modality = formData.modality
        if (formData.session_duration) extraKeys.session_duration = formData.session_duration
        if (formData.availability) extraKeys.availability = formData.availability
        if (formData.includes) extraKeys.includes = formData.includes
        const fullDescription = buildDescription(formData.description, extraKeys)

        startTransition(async () => {
            try {
                await createProduct({
                    name: formData.name,
                    description: fullDescription,
                    price: parseFloat(formData.price),
                    category: formData.category,
                    duration_months: catConfig.showDuration && formData.duration_months ? parseInt(formData.duration_months) : undefined,
                    qr_image_url: imageUrl || null,
                })
                await loadProducts()
                resetForm()
            } catch (error) {
                console.error("Error creating product:", error)
                alert("Error al crear el producto")
            }
        })
    }

    const handleUpdate = async () => {
        if (!editingId || !formData.name || !formData.price) return
        const catConfig = getCatConfig(formData.category)
        const extraKeys: Record<string, string> = {}
        if (catConfig.showDuration && formData.duration_months) extraKeys.duration_months = formData.duration_months
        if (formData.access_type) extraKeys.access_type = formData.access_type
        if (formData.access_info) extraKeys.access_info = formData.access_info
        if (formData.variants) extraKeys.variants = formData.variants
        if (formData.stock) extraKeys.stock = formData.stock
        if (formData.modality) extraKeys.modality = formData.modality
        if (formData.session_duration) extraKeys.session_duration = formData.session_duration
        if (formData.availability) extraKeys.availability = formData.availability
        if (formData.includes) extraKeys.includes = formData.includes
        const fullDescription = buildDescription(formData.description, extraKeys)

        startTransition(async () => {
            try {
                const product = products.find(p => p.id === editingId)
                await updateProduct(editingId, {
                    name: formData.name,
                    description: fullDescription,
                    price: parseFloat(formData.price),
                    category: formData.category,
                    is_active: product?.is_active ?? true,
                    duration_months: catConfig.showDuration && formData.duration_months ? parseInt(formData.duration_months) : null,
                    qr_image_url: imageUrl,
                })
                await loadProducts()
                resetForm()
            } catch (error) {
                console.error("Error updating product:", error)
                alert("Error al actualizar el producto")
            }
        })
    }

    const handleEdit = (product: Product) => {
        setEditingId(product.id)
        // Parse back description (first line is the base description)
        const lines = product.description?.split('\n') || []
        const base = lines[0] || ''
        setFormData({
            name: product.name,
            description: base,
            price: product.price.toString(),
            category: product.category,
            duration_months: product.duration_months?.toString() || '',
            access_type: '', access_info: '', variants: '', stock: '',
            modality: '', session_duration: '', availability: '', includes: '',
        })
        setImageUrl(product.qr_image_url || null)
        setImagePreview(product.qr_image_url || null)
        setIsCreating(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return
        startTransition(async () => {
            try { await deleteProduct(id); await loadProducts() }
            catch (error) { console.error("Error deleting product:", error) }
        })
    }

    const handleToggle = async (id: string, isActive: boolean) => {
        startTransition(async () => {
            try { await toggleProduct(id, isActive); await loadProducts() }
            catch (error) { console.error("Error toggling product:", error) }
        })
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description?.toLowerCase().includes(search.toLowerCase()))
    )

    const catConfig = getCatConfig(formData.category)

    return (
        <div className="p-8 max-w-7xl mx-auto text-[#0F172A] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Catálogo de Productos</h1>
                    <p className="text-[rgba(15,23,42,0.45)]">Define tu catálogo. La IA usará esta información para responder a tus clientes.</p>
                </div>
                {!isCreating && (
                    <Button
                        onClick={() => { resetForm(); setIsCreating(true) }}
                        className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2"
                    >
                        <Plus size={20} />
                        Agregar Producto
                    </Button>
                )}
            </div>

            {/* Create/Edit Form */}
            {isCreating && (
                <Card className="mb-8 border-black/[0.08] bg-white shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <CardTitle className="text-[#0F172A] text-lg">
                            {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                        </CardTitle>
                        <button onClick={resetForm} className="text-[#0F172A]/40 hover:text-[#0F172A] transition-colors">
                            <X size={20} />
                        </button>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Step 1: Category selector */}
                        <div>
                            <Label className="text-sm font-semibold text-[#0F172A] mb-3 block">
                                1. ¿Qué tipo de producto o servicio es?
                            </Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setField('category', cat.value)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                            formData.category === cat.value
                                                ? `${cat.color} ring-2 ring-offset-1 ring-current`
                                                : 'border-black/[0.08] bg-[#F7F8FA] text-[#0F172A]/60 hover:border-black/[0.15]'
                                        }`}
                                    >
                                        <span className={`mt-0.5 flex-shrink-0 ${formData.category === cat.value ? '' : 'text-[#0F172A]/35'}`}>
                                            {cat.icon}
                                        </span>
                                        <div>
                                            <p className="font-semibold text-xs">{cat.label}</p>
                                            <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{cat.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2: Basic fields */}
                        <div>
                            <Label className="text-sm font-semibold text-[#0F172A] mb-3 block">
                                2. Información básica
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-[#0F172A]/60">Nombre *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setField('name', e.target.value)}
                                        placeholder="Ej: Plan Premium Canva, Masaje Relajante..."
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-[#0F172A]/60">Precio (Bs) *</Label>
                                    <Input
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setField('price', e.target.value)}
                                        placeholder="0.00"
                                        className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A]"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 space-y-2">
                                <Label className="text-xs text-[#0F172A]/60">Descripción (aparece en el catálogo)</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setField('description', e.target.value)}
                                    placeholder="Describe brevemente qué incluye este producto o servicio..."
                                    className="bg-[#F7F8FA] border-black/[0.08] text-[#0F172A] h-20"
                                />
                            </div>
                        </div>

                        {/* Step 3: Category-specific fields */}
                        {catConfig.extraFields.length > 0 && (
                            <div>
                                <Label className="text-sm font-semibold text-[#0F172A] mb-3 block">
                                    3. Detalles de {catConfig.label}
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F7F8FA] border border-black/[0.06]">
                                    {catConfig.showDuration && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60 flex items-center gap-1.5">
                                                <Clock size={12} /> Duración (meses) *
                                            </Label>
                                            <Input
                                                type="number" min="1" max="120"
                                                value={formData.duration_months}
                                                onChange={e => setField('duration_months', e.target.value)}
                                                placeholder="Ej: 1, 3, 6, 12"
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('access_type') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60">Tipo de acceso</Label>
                                            <select
                                                value={formData.access_type}
                                                onChange={e => setField('access_type', e.target.value)}
                                                className="w-full h-10 px-3 bg-white border border-black/[0.08] text-[#0F172A] rounded-md text-sm"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="Cuenta compartida">Cuenta compartida</option>
                                                <option value="Cuenta propia">Cuenta propia</option>
                                                <option value="Acceso por enlace">Acceso por enlace</option>
                                                <option value="Código de activación">Código de activación</option>
                                            </select>
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('access_info') && (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs text-[#0F172A]/60">Instrucciones de acceso (para el cliente)</Label>
                                            <Input
                                                value={formData.access_info}
                                                onChange={e => setField('access_info', e.target.value)}
                                                placeholder="Ej: Ingresa con el correo y contraseña que te enviamos..."
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('variants') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60">Variantes (tallas, colores, etc.)</Label>
                                            <Input
                                                value={formData.variants}
                                                onChange={e => setField('variants', e.target.value)}
                                                placeholder="Ej: Talla S, M, L, XL — Rojo, Azul, Negro"
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('stock') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60">Stock disponible</Label>
                                            <Input
                                                type="number" min="0"
                                                value={formData.stock}
                                                onChange={e => setField('stock', e.target.value)}
                                                placeholder="Ej: 50"
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('modality') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60">Modalidad</Label>
                                            <select
                                                value={formData.modality}
                                                onChange={e => setField('modality', e.target.value)}
                                                className="w-full h-10 px-3 bg-white border border-black/[0.08] text-[#0F172A] rounded-md text-sm"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="Presencial">Presencial</option>
                                                <option value="Virtual / Online">Virtual / Online</option>
                                                <option value="Presencial y virtual">Presencial y virtual</option>
                                            </select>
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('session_duration') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-[#0F172A]/60">Duración de sesión (minutos)</Label>
                                            <Input
                                                type="number" min="5"
                                                value={formData.session_duration}
                                                onChange={e => setField('session_duration', e.target.value)}
                                                placeholder="Ej: 60"
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('availability') && (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs text-[#0F172A]/60">Disponibilidad</Label>
                                            <Input
                                                value={formData.availability}
                                                onChange={e => setField('availability', e.target.value)}
                                                placeholder="Ej: Lunes a viernes 9am–6pm, previa cita"
                                                className="bg-white border-black/[0.08] text-[#0F172A]"
                                            />
                                        </div>
                                    )}
                                    {catConfig.extraFields.includes('includes') && (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs text-[#0F172A]/60">¿Qué incluye? (uno por línea)</Label>
                                            <Textarea
                                                value={formData.includes}
                                                onChange={e => setField('includes', e.target.value)}
                                                placeholder="Acceso ilimitado&#10;Soporte 24/7&#10;Actualizaciones gratuitas"
                                                className="bg-white border-black/[0.08] text-[#0F172A] h-20"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Product image */}
                        <div>
                            <Label className="text-sm font-semibold text-[#0F172A] mb-3 block">
                                {catConfig.extraFields.length > 0 ? '4.' : '3.'} Imagen del producto <span className="font-normal text-[#0F172A]/40">(opcional)</span>
                            </Label>
                            <div
                                className="relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-black/[0.10] bg-[#F7F8FA] cursor-pointer hover:border-[#25D366]/50 transition-colors"
                                onClick={() => imageInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-[#0F172A]">Imagen cargada</p>
                                            <p className="text-xs text-[#0F172A]/45 mt-0.5">Haz clic para cambiarla</p>
                                        </div>
                                        <button
                                            className="absolute top-2 right-2 p-1 bg-white rounded-full border border-black/[0.08] text-[#0F172A]/40 hover:text-red-500 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageUrl(null) }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-14 h-14 rounded-xl bg-black/[0.05] flex items-center justify-center flex-shrink-0">
                                            {imageUploading
                                                ? <Upload size={22} className="text-[#25D366] animate-bounce" />
                                                : <ImageIcon size={22} className="text-[#0F172A]/25" />
                                            }
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#0F172A]/60">
                                                {imageUploading ? 'Subiendo imagen...' : 'Haz clic para subir una imagen'}
                                            </p>
                                            <p className="text-xs text-[#0F172A]/35 mt-0.5">JPG, PNG o WEBP · Máx. 5MB</p>
                                        </div>
                                    </div>
                                )}
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2 border-t border-black/[0.06]">
                            <Button
                                onClick={resetForm}
                                className="bg-transparent hover:bg-black/[0.04] text-[#0F172A]/40 hover:text-[#0F172A]"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={editingId ? handleUpdate : handleCreate}
                                disabled={isPending || !formData.name || !formData.price || imageUploading}
                                className="bg-[#25D366] hover:bg-[#128C7E] text-white min-w-[140px]"
                            >
                                {isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Producto'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#0F172A]/35" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar productos..."
                    className="pl-10 bg-white border-black/[0.08] text-[#0F172A] w-full max-w-md"
                />
            </div>

            {/* Products List */}
            <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16 text-[#0F172A]/35 bg-white rounded-xl border border-dashed border-black/[0.12]">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium mb-2">No tienes productos creados aún</p>
                        <p className="text-sm">Agrega tus productos o servicios para que la IA pueda informar a tus clientes.</p>
                    </div>
                ) : (
                    filteredProducts.map(product => {
                        const catCfg = getCatConfig(product.category)
                        return (
                            <div
                                key={product.id}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-colors group ${product.is_active
                                    ? 'bg-white border-black/[0.08] hover:border-[rgba(37,211,102,0.3)]'
                                    : 'bg-[#F7F8FA] border-black/[0.06] opacity-60'
                                    }`}
                            >
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    {/* Image or icon */}
                                    {product.qr_image_url ? (
                                        <img
                                            src={product.qr_image_url}
                                            alt={product.name}
                                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-black/[0.06]"
                                        />
                                    ) : (
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${product.is_active ? catCfg.color : 'bg-black/[0.04] text-[#0F172A]/25 border-black/[0.06]'} border`}>
                                            {catCfg.icon}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-[#0F172A] text-base">{product.name}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${catCfg.color}`}>
                                                {catCfg.label}
                                            </span>
                                            {!product.is_active && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                                                    Inactivo
                                                </span>
                                            )}
                                        </div>
                                        {product.description && (
                                            <p className="text-[#0F172A]/40 text-sm line-clamp-1 mt-1">{product.description.split('\n')[0]}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        {product.duration_months && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(37,211,102,0.1)] text-[#128C7E] border border-[rgba(37,211,102,0.2)] flex items-center gap-1">
                                                <Clock size={11} />
                                                {product.duration_months}m
                                            </span>
                                        )}
                                        <span className="text-lg font-bold text-[#128C7E]">Bs {product.price}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        className="h-8 w-8 p-0 bg-transparent hover:bg-[#F7F8FA] text-[#0F172A]/40 hover:text-[#0F172A]"
                                        onClick={() => handleToggle(product.id, product.is_active)}
                                        title={product.is_active ? 'Desactivar' : 'Activar'}
                                    >
                                        {product.is_active ? <ToggleRight size={18} className="text-[#25D366]" /> : <ToggleLeft size={18} />}
                                    </Button>
                                    <Button
                                        className="h-8 w-8 p-0 bg-transparent hover:bg-[#F7F8FA] text-[#0F172A]/40 hover:text-[#0F172A]"
                                        onClick={() => handleEdit(product)}
                                    >
                                        <Edit size={18} />
                                    </Button>
                                    <Button
                                        className="h-8 w-8 p-0 bg-transparent text-red-400 hover:text-red-500 hover:bg-red-50"
                                        onClick={() => handleDelete(product.id)}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Info Box */}
            {products.length > 0 && (
                <div className="mt-8 p-4 rounded-lg bg-[rgba(37,211,102,0.06)] border border-[rgba(37,211,102,0.15)]">
                    <p className="text-sm text-[#128C7E]">
                        💡 <strong>Tip:</strong> La IA usará estos productos automáticamente al conversar con tus clientes.
                        Asegúrate de que las descripciones sean claras y detalladas.
                    </p>
                </div>
            )}
        </div>
    )
}
