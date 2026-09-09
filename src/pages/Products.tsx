import React, { useEffect, useState } from 'react';
import { Plus, X, Trash2, Package } from 'lucide-react';
import api from '../api/axios';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  moq: string;
  availability: string;
  shippingInfo: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    moq: '',
    availability: 'In Stock',
    shippingInfo: ''
  });

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/products', {
        id: Date.now().toString(),
        name: formData.name,
        category: formData.category,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        moq: formData.moq,
        availability: formData.availability,
        shippingInfo: formData.shippingInfo
      });
      setShowModal(false);
      setFormData({
        name: '', category: '', description: '', price: '', moq: '', availability: 'In Stock', shippingInfo: ''
      });
      fetchProducts();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Product Knowledge Base</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your products so the AI can answer customer queries about them.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">No products added</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              You haven't added any products to the knowledge base yet. 
            </p>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-white shadow-sm hover:shadow-md px-6 py-2.5 border border-slate-200 rounded-full text-emerald-600 font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add First Product
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className="group border border-slate-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-md transition-all bg-white relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 leading-tight pr-8">{p.name}</h3>
                    <button 
                      onClick={() => handleDelete(p.id, p.name)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs font-medium text-emerald-600 mb-3 bg-emerald-50 inline-block px-2 py-1 rounded-md">{p.category}</div>
                  {p.description && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{p.description}</p>}
                  
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end mt-auto">
                    <div>
                      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Price</div>
                      <div className="font-bold text-slate-800 text-lg">${p.price}</div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide uppercase ${
                      p.availability === 'In Stock' ? 'bg-emerald-100 text-emerald-700' : 
                      p.availability === 'Out of Stock' ? 'bg-red-100 text-red-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {p.availability}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">Add New Product</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Product Name *</label>
                  <input 
                    name="name" type="text" required
                    value={formData.name} onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Category *</label>
                  <input 
                    name="category" type="text" required placeholder="e.g. Agricultural"
                    value={formData.category} onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  name="description" rows={3}
                  value={formData.description} onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Price *</label>
                  <input 
                    name="price" type="number" step="0.01" required
                    value={formData.price} onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Minimum Order (MOQ)</label>
                  <input 
                    name="moq" type="text" placeholder="e.g. 100 units"
                    value={formData.moq} onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Availability</label>
                  <select 
                    name="availability"
                    value={formData.availability} onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Pre-order">Pre-order</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Shipping Info</label>
                <input 
                  name="shippingInfo" type="text" placeholder="e.g. Ships worldwide in 3-5 days"
                  value={formData.shippingInfo} onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
