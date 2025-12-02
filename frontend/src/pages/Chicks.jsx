// src/pages/Chicks.jsx
import React, { useEffect, useState } from 'react';
import { readLS, writeLS } from '../utils/storage';

const today = new Date().toISOString().slice(0,10);

export default function Chicks() {
  const [items, setItems] = useState(() => readLS('chicks', []));
  const [form, setForm] = useState({ id: '', batchNo: '', total: '', date: today });
  const [error, setError] = useState('');

  useEffect(()=> writeLS('chicks', items), [items]);

  function validate({batchNo, total, date}) {
    if (!batchNo?.trim()) return 'Batch no required';
    if (!total || Number(total) <= 0) return 'Total must be > 0';
    if (!date) return 'Date required';
    if (new Date(date) > new Date()) return 'Date cannot be future';
    return null;
  }

  function onSubmit(e) {
    e.preventDefault();
    const v = validate(form);
    if (v) { setError(v); return; }
    setError('');
    if (form.id) {
      setItems(prev => prev.map(it => it.id === form.id ? {...it, batchNo: form.batchNo, total: Number(form.total), date: form.date} : it));
    } else {
      setItems(prev => [{ id: Date.now().toString(), batchNo: form.batchNo, total: Number(form.total), date: form.date }, ...prev]);
    }
    setForm({ id:'', batchNo:'', total:'', date: today });
  }

  function onEdit(id) {
    const it = items.find(x=>x.id===id);
    if (it) setForm({ id: it.id, batchNo: it.batchNo, total: it.total.toString(), date: it.date });
  }
  function onDelete(id) {
    if (!confirm('Delete this entry?')) return;
    setItems(prev => prev.filter(x=>x.id !== id));
  }

  return (
    <div style={{maxWidth:900, margin:'24px auto', padding:16}}>
      <h2>Chicks</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:8, marginBottom:12}}>
        <input placeholder="Batch No" value={form.batchNo} onChange={e=>setForm({...form, batchNo: e.target.value})} />
        <input placeholder="Total chicks" type="number" value={form.total} onChange={e=>setForm({...form, total: e.target.value})} />
        <input type="date" max={today} value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
        <div>
          <button type="submit">{form.id ? 'Update' : 'Add'}</button>
          <button type="button" onClick={()=> setForm({id:'', batchNo:'', total:'', date: today})} style={{marginLeft:8}}>Reset</button>
        </div>
        {error && <div style={{color:'red'}}>{error}</div>}
      </form>

      <table border="1" cellPadding="6" style={{width:'100%', borderCollapse:'collapse'}}>
        <thead><tr><th>Batch</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan="4">No entries</td></tr> :
            items.map(it => (
              <tr key={it.id}>
                <td>{it.batchNo}</td>
                <td>{it.total}</td>
                <td>{it.date}</td>
                <td>
                  <button onClick={()=>onEdit(it.id)}>Edit</button>
                  <button onClick={()=>onDelete(it.id)} style={{marginLeft:8}}>Delete</button>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
