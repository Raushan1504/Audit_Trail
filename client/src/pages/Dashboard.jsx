import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import './Dashboard.css';

const QUICK_ACCESS_IDS = ['SHIP001', 'TEST1', 'DEMO'];

function Dashboard() {
  const navigate = useNavigate();

  const handleSearch = (shipmentId) => {
    if (!shipmentId || shipmentId.trim() === '') return;
    navigate(`/shipment/${shipmentId.trim()}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Audit Trail — Forensic Dashboard</h1>
        <p>Search a shipment to view its event history and current state.</p>
      </header>

      <SearchBar onSearch={handleSearch} />

      <div className="dashboard__quick-access">
        <span className="dashboard__quick-label">Quick test IDs:</span>
        <div className="dashboard__quick-buttons">
          {QUICK_ACCESS_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="dashboard__quick-button"
              onClick={() => handleSearch(id)}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;