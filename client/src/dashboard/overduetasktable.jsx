import React, { useEffect, useState } from 'react';
import Table from '../component/ui/table';
import ExportButton from '../components/ExportButton';

// OverdueTaskTable
// Props:
// - userId: string (required)
// - userType: one of ['individual','employee','manager','org_admin'] (required)
// - initialPage: number (optional)

const OverdueTaskTable = ({ userId, userType, initialPage = 1 }) => {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = async (p = 1) => {
    if (!userId || !userType) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ user_id: userId, user_type: userType, page: p });
      const res = await fetch(`/dashboard/overdue?${q.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch overdue tasks');
      const body = await res.json();
      if (!body.success) throw new Error(body.message || 'Error response');
      const data = body.data || {};
      setPage(data.page || p);
      setPageSize(data.pageSize || 5);
      setTotal(data.total || 0);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userType]);

  const handlePageChange = (nextPage) => {
    if (nextPage < 1) return;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (nextPage > totalPages) return;
    fetchTasks(nextPage);
  };

  const columns = [
    { key: 'Task', title: 'Task' },
    { key: 'DueDate', title: 'Due Date', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'DaysOverdue', title: 'Days Overdue', render: (v) => v != null ? v : '-' },
    { key: 'Priority', title: 'Priority', render: (v) => v || '-' }
  ];

  return (
    <div className="overdue-task-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Overdue Report</h3>
        <ExportButton 
          reportType={userType === 'org_admin' ? 'organization' : userType === 'manager' ? 'team' : 'productivity'}
          filters={{ status: 'overdue' }}
          buttonText="Export Overdue"
          variant="outline"
        />
      </div>
      {error && <div className="error">{error}</div>}
      <Table
        columns={columns}
        data={tasks}
        loading={loading}
        emptyMessage="No overdue tasks"
      />

      <div className="pagination" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading}>Prev</button>
        <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
        <button onClick={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(total / pageSize) || loading}>Next</button>
      </div>
    </div>
  );
};

export default OverdueTaskTable;
