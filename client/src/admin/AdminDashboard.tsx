import React, { useEffect, useState } from 'react';
import {
  Printer,
  Server,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Sliders,
  FileText,
  Search,
  Shield,
  Layers,
} from 'lucide-react';

interface MachineData {
  id: string;
  machineCode: string;
  name: string;
  locationName: string;
  status: string;
  isOnline: boolean;
  printerModel: string;
  paperLevel: number;
  tonerLevel: number;
  lastHeartbeat?: string;
  pricing?: {
    bwSingleRate: number;
    bwDoubleRate: number;
    colorSingleRate: number;
    colorDoubleRate: number;
  };
}

interface JobData {
  id: string;
  jobCode: string;
  fileName: string;
  pageCount: number;
  copies: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  machine?: {
    machineCode: string;
    name: string;
  };
}

interface DashboardSummary {
  totalMachines: number;
  onlineMachines: number;
  offlineMachines: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingQueue: number;
  totalRevenueINR: number;
}

export const AdminDashboard: React.FC<{ onBackToKiosk: () => void }> = ({ onBackToKiosk }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [recentJobs, setRecentJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'jobs'>('overview');
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [pricingForm, setPricingForm] = useState({
    bwSingleRate: 2.0,
    bwDoubleRate: 4.0,
    colorSingleRate: 10.0,
    colorDoubleRate: 16.0,
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data.summary);
        setMachines(json.data.machines || []);
        setRecentJobs(json.data.recentJobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdatePricing = async (machineId: string) => {
    try {
      const res = await fetch(`/api/admin/machines/${machineId}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingForm),
      });
      const json = await res.json();
      if (json.success) {
        setEditingPricing(null);
        fetchDashboardData();
      }
    } catch (err) {
      alert('Failed to update pricing');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
    }}>
      {/* Top Navbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '20px',
        marginBottom: '28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            backgroundColor: '#0284c7',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 900,
            fontSize: '20px',
          }}>
            P
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
              Instant Print SaaS Control Panel
            </h1>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              Multi-Machine Kiosk Monitoring & Analytics
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchDashboardData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={onBackToKiosk}
            style={{
              backgroundColor: '#0284c7',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            Switch to Kiosk Display
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
              <span>Total Fleet ATMs</span>
              <Server size={18} color="#38bdf8" />
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'white', display: 'block', marginTop: '8px' }}>
              {summary.totalMachines}
            </span>
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>
              ● {summary.onlineMachines} Online ({summary.offlineMachines} Offline)
            </span>
          </div>

          <div style={{
            backgroundColor: '#1e293b',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
              <span>Total Revenue</span>
              <DollarSign size={18} color="#4ade80" />
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#4ade80', display: 'block', marginTop: '8px' }}>
              ₹{summary.totalRevenueINR.toFixed(2)}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              From {summary.completedJobs} successful print jobs
            </span>
          </div>

          <div style={{
            backgroundColor: '#1e293b',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
              <span>Active Job Queue</span>
              <Activity size={18} color="#f59e0b" />
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', display: 'block', marginTop: '8px' }}>
              {summary.pendingQueue}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Jobs printing / waiting on ATMs
            </span>
          </div>

          <div style={{
            backgroundColor: '#1e293b',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
              <span>Completed / Total</span>
              <CheckCircle2 size={18} color="#38bdf8" />
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'white', display: 'block', marginTop: '8px' }}>
              {summary.completedJobs} / {summary.totalJobs}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Success rate: {summary.totalJobs > 0 ? Math.round((summary.completedJobs / summary.totalJobs) * 100) : 100}%
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'overview' ? '#38bdf8' : '#94a3b8',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 12px',
            borderBottom: activeTab === 'overview' ? '2px solid #38bdf8' : 'none',
          }}
        >
          Machine Fleet ({machines.length})
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'jobs' ? '#38bdf8' : '#94a3b8',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 12px',
            borderBottom: activeTab === 'jobs' ? '2px solid #38bdf8' : 'none',
          }}
        >
          Print Job History ({recentJobs.length})
        </button>
      </div>

      {/* Machine Fleet Table */}
      {activeTab === 'overview' && (
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '14px 16px' }}>Machine Code</th>
                <th style={{ padding: '14px 16px' }}>Location</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px' }}>Printer Model</th>
                <th style={{ padding: '14px 16px' }}>Rate Card</th>
                <th style={{ padding: '14px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '16px', fontWeight: 800, color: '#38bdf8' }}>
                    {m.machineCode}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 600, display: 'block' }}>{m.name}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{m.locationName}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '99px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: m.isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: m.isOnline ? '#4ade80' : '#f87171',
                    }}>
                      {m.isOnline ? '● ONLINE' : '○ OFFLINE'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#e2e8f0', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Printer size={16} color="#38bdf8" />
                      {m.printerModel}
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '12px', color: '#94a3b8' }}>
                    B&amp;W: ₹{m.pricing?.bwSingleRate || 2.0} / ₹{m.pricing?.bwDoubleRate || 4.0} <br />
                    Color: ₹{m.pricing?.colorSingleRate || 10.0} / ₹{m.pricing?.colorDoubleRate || 16.0}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button
                      onClick={() => {
                        setEditingPricing(m.id);
                        if (m.pricing) {
                          setPricingForm({
                            bwSingleRate: m.pricing.bwSingleRate,
                            bwDoubleRate: m.pricing.bwDoubleRate,
                            colorSingleRate: m.pricing.colorSingleRate,
                            colorDoubleRate: m.pricing.colorDoubleRate,
                          });
                        }
                      }}
                      style={{
                        backgroundColor: '#334155',
                        border: 'none',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <Sliders size={13} /> Edit Pricing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Print Jobs Table */}
      {activeTab === 'jobs' && (
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '14px 16px' }}>Job Code</th>
                <th style={{ padding: '14px 16px' }}>Machine</th>
                <th style={{ padding: '14px 16px' }}>Document Name</th>
                <th style={{ padding: '14px 16px' }}>Pages / Copies</th>
                <th style={{ padding: '14px 16px' }}>Total Amount</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '16px', fontWeight: 800, color: '#38bdf8' }}>
                    {j.jobCode}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600 }}>
                    {j.machine?.machineCode || 'ATM001'}
                  </td>
                  <td style={{ padding: '16px', color: '#e2e8f0' }}>
                    {j.fileName}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {j.pageCount} pages ({j.copies} copy)
                  </td>
                  <td style={{ padding: '16px', fontWeight: 800, color: '#4ade80' }}>
                    ₹{j.totalPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: j.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: j.status === 'COMPLETED' ? '#4ade80' : '#38bdf8',
                    }}>
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pricing Edit Modal */}
      {editingPricing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Edit Machine Pricing Card
            </h3>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                B&amp;W Single-Sided Rate (₹ per page)
              </label>
              <input
                type="number"
                value={pricingForm.bwSingleRate}
                onChange={(e) => setPricingForm({ ...pricingForm, bwSingleRate: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                B&amp;W Double-Sided Rate (₹ per 2-sided sheet)
              </label>
              <input
                type="number"
                value={pricingForm.bwDoubleRate}
                onChange={(e) => setPricingForm({ ...pricingForm, bwDoubleRate: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Color Single-Sided Rate (₹ per page)
              </label>
              <input
                type="number"
                value={pricingForm.colorSingleRate}
                onChange={(e) => setPricingForm({ ...pricingForm, colorSingleRate: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Color Double-Sided Rate (₹ per 2-sided sheet)
              </label>
              <input
                type="number"
                value={pricingForm.colorDoubleRate}
                onChange={(e) => setPricingForm({ ...pricingForm, colorDoubleRate: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={() => handleUpdatePricing(editingPricing)}
                style={{ flex: 1, backgroundColor: '#0284c7', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Rate Card
              </button>
              <button
                onClick={() => setEditingPricing(null)}
                style={{ flex: 1, backgroundColor: '#334155', color: '#94a3b8', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
