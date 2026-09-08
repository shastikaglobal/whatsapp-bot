import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  availability: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.get('/products').then(res => setProducts(res.data)).catch(console.error);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">Product Knowledge Base</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <div key={p.id} className="border border-slate-200 rounded-xl p-4">
              <h3 className="font-bold text-slate-900">{p.name}</h3>
              <div className="text-sm text-slate-500 mt-1">{p.category}</div>
              <div className="mt-4 flex justify-between items-center">
                <span className="font-semibold text-slate-700">${p.price}</span>
                <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-full">{p.availability}</span>
              </div>
            </div>
          ))}
          {products.length === 0 && (
             <div className="col-span-full text-center text-slate-500 py-8">No products found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
