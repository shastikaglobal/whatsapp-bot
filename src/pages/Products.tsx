import React, { useEffect, useState, useRef } from 'react';
import { Plus, X, Trash2, Package, CheckCircle2, AlertCircle, Download, Upload } from 'lucide-react';
import api from '../api/axios';
import ConfirmModal from '../components/ConfirmModal';

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
  const [isImporting, setIsImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    summary: { totalRows: number; toAdd: number; toUpdate: number; toSkip: number; errorCount: number };
    errors: string[];
    previewRows: any[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/products/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'shastika_products.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Products exported to CSV successfully', 'success');
    } catch (err: any) {
      console.error('Export failed:', err);
      showToast('Failed to export products to CSV', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvText = event.target?.result as string;
      if (!csvText) return;
      setIsImporting(true);
      try {
        const res = await api.post('/products/import-preview', { csvText });
        setImportPreviewData(res.data);
        setShowImportPreview(true);
      } catch (err: any) {
        console.error('Import preview error:', err);
        showToast(err.response?.data?.error || 'Failed to preview CSV import', 'error');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreviewData?.previewRows) return;
    setIsImporting(true);
    try {
      const res = await api.post('/products/import', { confirmedRows: importPreviewData.previewRows });
      showToast(res.data?.message || 'Products imported successfully!', 'success');
      setShowImportPreview(false);
      setImportPreviewData(null);
      fetchProducts();
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(err.response?.data?.error || 'Failed to import products', 'error');
    } finally {
      setIsImporting(false);
    }
  };

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
      showToast('Product created successfully', 'success');
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to save product', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmConfig({
      title: 'Delete Product',
      message: `Are you sure you want to delete ${name}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/products/${id}`);
          setProducts(prev => prev.filter(p => p.id !== id));
          showToast('Product deleted successfully', 'success');
        } catch (error: any) {
          console.error(error);
          showToast(error.response?.data?.error || 'Failed to delete product', 'error');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Product Knowledge Base</h2>
          <p className="text-sm text-slate-300 mt-1 font-medium">Manage your products so the AI can answer customer queries about them.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={handleExportCSV}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
            title="Export products to CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            title="Import products from CSV"
          >
            <Upload className="w-4 h-4" /> {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="panel-card overflow-hidden min-h-[400px]">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">No products added</h3>
            <p className="text-slate-600 text-sm mb-6 max-w-sm mx-auto">
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
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className="group border border-slate-200/80 rounded-xl p-5 hover:border-emerald-400 hover:shadow-lg transition-all bg-white relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 leading-tight pr-8">{p.name}</h3>
                    <button 
                      onClick={() => handleDelete(p.id, p.name)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mb-3 bg-emerald-50 border border-emerald-200/60 inline-block px-2 py-1 rounded-md">{p.category}</div>
                  {p.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{p.description}</p>}
                  
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end mt-auto">
                    <div>
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Price</div>
                      <div className="font-extrabold text-slate-900 text-lg">${p.price}</div>
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

      {/* Dry-Run CSV Import Preview Modal */}
      {showImportPreview && importPreviewData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Import Preview (Dry-Run)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review matched products before applying changes to the database.
                </p>
              </div>
              <button 
                onClick={() => { setShowImportPreview(false); setImportPreviewData(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  + {importPreviewData.summary.toAdd} To Add
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  ↺ {importPreviewData.summary.toUpdate} To Update
                </span>
                {importPreviewData.summary.toSkip > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    ⚠ {importPreviewData.summary.toSkip} Skipped
                  </span>
                )}
                {importPreviewData.summary.errorCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    ✕ {importPreviewData.summary.errorCount} Errors/Warnings
                  </span>
                )}
              </div>

              {/* Errors list if any */}
              {importPreviewData.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Validation Notes:
                  </div>
                  {importPreviewData.errors.map((err, idx) => (
                    <div key={idx} className="pl-4 text-[11px]">• {err}</div>
                  ))}
                </div>
              )}

              {/* Rows Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">MOQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreviewData.previewRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.action === 'add' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {row.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3 py-2">{row.category || <span className="text-slate-400 italic">None</span>}</td>
                        <td className="px-3 py-2">
                          {row.price !== null ? `₹${row.price}` : <span className="text-slate-400 italic">None (NULL)</span>}
                        </td>
                        <td className="px-3 py-2">{row.moq || <span className="text-slate-400 italic">None</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreviewData.previewRows.length > 15 && (
                  <div className="p-2 bg-slate-50 text-center text-[11px] text-slate-500 border-t border-slate-100">
                    ... and {importPreviewData.previewRows.length - 15} more rows
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Ready to import {importPreviewData.previewRows.length} valid row(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowImportPreview(false); setImportPreviewData(null); }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importPreviewData.previewRows.length === 0 || isImporting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {isImporting ? 'Importing...' : `Confirm & Save (${importPreviewData.previewRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
        confirmText="Delete"
      />
    </div>
  );
}
