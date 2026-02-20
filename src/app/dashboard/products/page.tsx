'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, Package, ToggleLeft, ToggleRight, X, DollarSign } from 'lucide-react'
import { getProducts, createProduct, deleteProduct, toggleProduct, updateProduct, type Product } from './actions'

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: 'general'
    })

    useEffect(() => {
        loadProducts()
    }, [])

    const loadProducts = async () => {
        const data = await getProducts()
        setProducts(data)
    }

    const resetForm = () => {
        setFormData({ name: '', description: '', price: '', category: 'general' })
        setIsCreating(false)
        setEditingId(null)
    }

    const handleCreate = async () => {
        if (!formData.name || !formData.price) return

        startTransition(async () => {
            try {
                await createProduct({
                    name: formData.name,
                    description: formData.description,
                    price: parseFloat(formData.price),
                    category: formData.category
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

        startTransition(async () => {
            try {
                const product = products.find(p => p.id === editingId)
                await updateProduct(editingId, {
                    name: formData.name,
                    description: formData.description,
                    price: parseFloat(formData.price),
                    category: formData.category,
                    is_active: product?.is_active ?? true
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
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            category: product.category
        })
        setIsCreating(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return

        startTransition(async () => {
            try {
                await deleteProduct(id)
                await loadProducts()
            } catch (error) {
                console.error("Error deleting product:", error)
            }
        })
    }

    const handleToggle = async (id: string, isActive: boolean) => {
        startTransition(async () => {
            try {
                await toggleProduct(id, isActive)
                await loadProducts()
            } catch (error) {
                console.error("Error toggling product:", error)
            }
        })
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description?.toLowerCase().includes(search.toLowerCase()))
    )

    const categories = [
        { value: 'general', label: 'General' },
        { value: 'servicio', label: 'Servicio' },
        { value: 'producto', label: 'Producto' },
        { value: 'plan', label: 'Plan/Suscripción' },
        { value: 'consulta', label: 'Consulta' },
        { value: 'paquete', label: 'Paquete' }
    ]

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-200">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Productos y Servicios</h1>
                    <p className="text-slate-400">Define tu catálogo. La IA usará esta información para responder a tus clientes.</p>
                </div>
                {!isCreating && (
                    <Button
                        onClick={() => { resetForm(); setIsCreating(true) }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                        <Plus size={20} />
                        Nuevo Producto
                    </Button>
                )}
            </div>

            {/* Create/Edit Form */}
            {isCreating && (
                <Card className="mb-8 border-slate-800 bg-slate-900/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-white">
                            {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                        </CardTitle>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: Masaje Relajante, Plan Premium, Consulta General..."
                                    className="bg-slate-950 border-slate-800 text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Precio (Bs) *</Label>
                                    <Input
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                        placeholder="0"
                                        className="bg-slate-950 border-slate-800 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Categoría</Label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-white rounded-md text-sm"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe tu producto o servicio. Esta información la usará la IA para responder a tus clientes..."
                                className="bg-slate-950 border-slate-800 text-white h-24"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                onClick={resetForm}
                                className="bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={editingId ? handleUpdate : handleCreate}
                                disabled={isPending || !formData.name || !formData.price}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Producto'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar productos..."
                    className="pl-10 bg-slate-900/50 border-slate-800 text-white w-full max-w-md"
                />
            </div>

            {/* Products List */}
            <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium mb-2">No tienes productos creados aún</p>
                        <p className="text-sm">Agrega tus productos o servicios para que la IA pueda informar a tus clientes.</p>
                    </div>
                ) : (
                    filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-colors group ${product.is_active
                                    ? 'bg-slate-900/50 border-slate-800 hover:border-indigo-500/30'
                                    : 'bg-slate-900/20 border-slate-800/50 opacity-60'
                                }`}
                        >
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className={`p-3 rounded-lg ${product.is_active ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                                    <Package size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-medium text-white text-lg">{product.name}</h3>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize">
                                            {product.category}
                                        </span>
                                        {!product.is_active && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                                                Inactivo
                                            </span>
                                        )}
                                    </div>
                                    {product.description && (
                                        <p className="text-slate-400 text-sm line-clamp-1 mt-1">{product.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <DollarSign size={16} className="text-green-400" />
                                    <span className="text-lg font-bold text-green-400">Bs {product.price}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    className="h-8 w-8 p-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
                                    onClick={() => handleToggle(product.id, product.is_active)}
                                    title={product.is_active ? 'Desactivar' : 'Activar'}
                                >
                                    {product.is_active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                                </Button>
                                <Button
                                    className="h-8 w-8 p-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
                                    onClick={() => handleEdit(product)}
                                >
                                    <Edit size={18} />
                                </Button>
                                <Button
                                    className="h-8 w-8 p-0 bg-transparent text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    onClick={() => handleDelete(product.id)}
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Info Box */}
            {products.length > 0 && (
                <div className="mt-8 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                    <p className="text-sm text-indigo-300">
                        💡 <strong>Tip:</strong> La IA usará estos productos automáticamente al conversar con tus clientes.
                        Asegúrate de que las descripciones sean claras y detalladas.
                    </p>
                </div>
            )}
        </div>
    )
}
